"""
socket_events.py — 所有 Socket.IO 事件处理器

房间命名约定：
  thread_{id}  — 某个会话的所有在线成员
  user_{id}    — 某个用户的所有设备（用于会话列表推送）
"""
from flask import request
from flask_socketio import emit, join_room, leave_room
from flask_jwt_extended import decode_token

from ..extensions import db, blocklist_contains
from ..models.conversation import ConversationThread, Message
from ..models.candidate import Candidate
from ..models.user import User

# sid → (user_id, role) 映射，避免每次事件都重新解析 JWT
_sid_to_user: dict[str, int] = {}
_sid_to_role: dict[str, str] = {}


# ── 工具函数 ────────────────────────────────────────────────────────────────────

def _user_id_from_token(token: str) -> tuple[int | None, str | None]:
    """
    从 JWT 字符串解析 user_id 和 role，失败返回 (None, None)。
    同时检查 blocklist，已撤销的 token 返回 (None, None)。
    """
    try:
        decoded = decode_token(token)
        jti = decoded.get('jti', '')
        if jti and blocklist_contains(jti):
            return None, None
        uid = decoded.get('sub')
        if uid is None:
            return None, None
        user = db.session.get(User, int(uid))
        if not user or not user.is_active:
            return None, None
        return int(uid), user.role
    except Exception:
        return None, None


def _can_access_thread(user_id: int, role: str, thread_id: int) -> bool:
    """校验 user_id 是否可以访问该 thread（参与者或 admin）。"""
    if role == 'admin':
        return db.session.get(ConversationThread, thread_id) is not None
    thread = db.session.get(ConversationThread, thread_id)
    if not thread:
        return False
    if thread.employer_id == user_id:
        return True
    candidate = Candidate.query.filter_by(id=thread.candidate_id).first()
    if candidate and candidate.user_id == user_id:
        return True
    return False


# ── 注册函数（由 create_app 调用） ─────────────────────────────────────────────

def register_socket_events(socketio):

    # ── connect ────────────────────────────────────────────────────────────────
    @socketio.on('connect')
    def handle_connect():
        """
        握手：验证 JWT（含 blocklist 撤销检查），拒绝未授权连接。
        前端传参：io(URL, { query: { token: '...' } })
        """
        token = request.args.get('token', '')
        user_id, role = _user_id_from_token(token)
        if not user_id:
            return False   # socket.io 自动发 connect_error 并断开

        _sid_to_user[request.sid] = user_id
        _sid_to_role[request.sid] = role or 'candidate'
        # 加入用户专属房间，用于接收会话列表推送
        join_room(f'user_{user_id}')
        emit('connected', {'status': 'ok', 'user_id': user_id})

    # ── disconnect ─────────────────────────────────────────────────────────────
    @socketio.on('disconnect')
    def handle_disconnect():
        _sid_to_user.pop(request.sid, None)
        _sid_to_role.pop(request.sid, None)

    # ── join_thread ────────────────────────────────────────────────────────────
    @socketio.on('join_thread')
    def handle_join_thread(data):
        """
        前端打开某会话时发送。
        data: { thread_id: int }
        （无需再传 token，connect 时已验证并记录 sid）
        """
        user_id = _sid_to_user.get(request.sid)
        if not user_id:
            emit('error', {'message': '未认证'})
            return

        thread_id = data.get('thread_id')
        if not thread_id:
            emit('error', {'message': '缺少 thread_id'})
            return

        role = _sid_to_role.get(request.sid, 'candidate')
        if not _can_access_thread(user_id, role, thread_id):
            emit('error', {'message': '无权访问该会话'})
            return

        join_room(f'thread_{thread_id}')
        emit('joined', {'thread_id': thread_id})

    # ── leave_thread ───────────────────────────────────────────────────────────
    @socketio.on('leave_thread')
    def handle_leave_thread(data):
        thread_id = data.get('thread_id')
        if thread_id:
            leave_room(f'thread_{thread_id}')

    # ── typing ─────────────────────────────────────────────────────────────────
    @socketio.on('typing')
    def handle_typing(data):
        """
        用户正在/停止输入时发送。
        data: { thread_id: int, is_typing: bool }
        广播给房间内其他人（排除发送者自己）。
        """
        user_id = _sid_to_user.get(request.sid)
        if not user_id:
            return

        thread_id = data.get('thread_id')
        is_typing = bool(data.get('is_typing', True))

        role = _sid_to_role.get(request.sid, 'candidate')
        if not thread_id or not _can_access_thread(user_id, role, thread_id):
            return

        emit(
            'typing',
            {
                'thread_id': thread_id,
                'user_id': user_id,
                'is_typing': is_typing,
            },
            room=f'thread_{thread_id}',
            skip_sid=request.sid,
        )

    # ── mark_read ──────────────────────────────────────────────────────────────
    @socketio.on('mark_read')
    def handle_mark_read(data):
        """
        当前用户打开/在看某会话时发送，标记对方消息已读。
        data: { thread_id: int }
        成功后向 thread 房间广播 messages_read，让发送方看到已读回执。
        """
        user_id = _sid_to_user.get(request.sid)
        if not user_id:
            return

        thread_id = data.get('thread_id')
        if not thread_id or not _can_access_thread(user_id, _sid_to_role.get(request.sid, 'candidate'), thread_id):
            return

        unread = (
            Message.query
            .filter_by(thread_id=thread_id, is_read=False)
            .filter(Message.sender_user_id != user_id)
            .all()
        )
        if not unread:
            return

        for msg in unread:
            msg.is_read = True
        db.session.commit()

        emit(
            'messages_read',
            {
                'thread_id': thread_id,
                'reader_user_id': user_id,
                'read_by': user_id,  # backward-compatible alias
            },
            room=f'thread_{thread_id}',
        )
