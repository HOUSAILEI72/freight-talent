from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timezone
from ..extensions import db, socketio
from ..models.user import User
from ..models.candidate import Candidate
from ..models.conversation import ConversationThread, Message

conversations_bp = Blueprint('conversations', __name__)


def _current_user():
    return db.session.get(User, int(get_jwt_identity()))


def _err(msg, code=400):
    return jsonify({'success': False, 'message': msg}), code


def _thread_summary(thread, current_user_id=None):
    """Build the list-view dict for one thread."""
    latest_msg = thread.messages.order_by(Message.created_at.desc()).first()
    inv        = thread.invitation

    unread_count = 0
    if current_user_id is not None:
        unread_count = (
            Message.query
            .filter_by(thread_id=thread.id, is_read=False)
            .filter(Message.sender_user_id != current_user_id)
            .count()
        )

    return {
        'id':                thread.id,
        'invitation_id':     thread.invitation_id,
        'invitation_status': inv.status if inv else 'pending',
        'job_id':            thread.job_id,
        'job_title':         thread.job.title if thread.job else '—',
        'company_name':      (thread.job.company.company_name if thread.job and thread.job.company else '—'),
        'candidate_id':      thread.candidate_id,
        'candidate_name':    thread.candidate.full_name if thread.candidate else '—',
        'employer_id':       thread.employer_id,
        'latest_message':    latest_msg.content[:60] if latest_msg else None,
        'latest_message_at': latest_msg.created_at.isoformat() if latest_msg else None,
        'updated_at':        thread.updated_at.isoformat() if thread.updated_at else None,
        'unread_count':      unread_count,
    }


@conversations_bp.get('')
@jwt_required()
def get_my_conversations():
    """GET /api/conversations/my — 返回当前用户所有相关会话"""
    user = _current_user()
    if not user or not user.is_active:
        return _err('用户不存在', 404)

    if user.role == 'employer':
        threads = (ConversationThread.query
                   .filter_by(employer_id=user.id)
                   .order_by(ConversationThread.updated_at.desc())
                   .all())
    elif user.role == 'candidate':
        candidate = Candidate.query.filter_by(user_id=user.id).first()
        if not candidate:
            return jsonify({'success': True, 'conversations': []}), 200
        threads = (ConversationThread.query
                   .filter_by(candidate_id=candidate.id)
                   .order_by(ConversationThread.updated_at.desc())
                   .all())
    elif user.role == 'admin':
        threads = (ConversationThread.query
                   .order_by(ConversationThread.updated_at.desc())
                   .all())
    else:
        return _err('无权限', 403)

    summaries = [_thread_summary(t, user.id) for t in threads]
    total_unread = sum(s['unread_count'] for s in summaries)
    return jsonify({
        'success':       True,
        'conversations': summaries,
        'total_unread':  total_unread,
    }), 200


def _get_accessible_thread(thread_id, user):
    """Return thread if user can access it, else None."""
    thread = db.session.get(ConversationThread, thread_id)
    if not thread:
        return None, _err('会话不存在', 404)
    if user.role == 'employer' and thread.employer_id != user.id:
        return None, _err('无权限访问该会话', 403)
    if user.role == 'candidate':
        candidate = Candidate.query.filter_by(user_id=user.id).first()
        if not candidate or thread.candidate_id != candidate.id:
            return None, _err('无权限访问该会话', 403)
    return thread, None


@conversations_bp.get('/<int:thread_id>/messages')
@jwt_required()
def get_messages(thread_id):
    """GET /api/conversations/<id>/messages
    Params:
      limit  — int, default 20, max 100
      before — int message id, load messages older than this id
    """
    user = _current_user()
    if not user or not user.is_active:
        return _err('用户不存在', 404)

    thread, err = _get_accessible_thread(thread_id, user)
    if err:
        return err

    # Parse pagination params
    try:
        limit = max(1, min(100, int(request.args.get('limit', 20))))
    except (ValueError, TypeError):
        limit = 20

    before_id = request.args.get('before', None)
    try:
        before_id = int(before_id) if before_id else None
    except (ValueError, TypeError):
        before_id = None

    # Mark received messages as read only on initial open (no before_id)
    if before_id is None:
        Message.query.filter_by(thread_id=thread_id, is_read=False).filter(
            Message.sender_user_id != user.id
        ).update({'is_read': True}, synchronize_session=False)
        db.session.commit()

    # Fetch limit+1 rows (newest-first) to detect has_more
    query = Message.query.filter_by(thread_id=thread_id)
    if before_id is not None:
        query = query.filter(Message.id < before_id)
    rows = query.order_by(Message.id.desc()).limit(limit + 1).all()

    has_more = len(rows) > limit
    if has_more:
        rows = rows[:limit]

    # Reverse to chronological order for the client
    rows.reverse()

    next_before = rows[0].id if (rows and has_more) else None

    return jsonify({
        'success':     True,
        'thread':      _thread_summary(thread, user.id),
        'messages':    [m.to_dict() for m in rows],
        'has_more':    has_more,
        'next_before': next_before,
    }), 200


@conversations_bp.post('/<int:thread_id>/messages')
@jwt_required()
def send_message(thread_id):
    """POST /api/conversations/<id>/messages"""
    user = _current_user()
    if not user or not user.is_active:
        return _err('用户不存在', 404)
    if user.role not in ('employer', 'candidate', 'admin'):
        return _err('无权限', 403)

    thread, err = _get_accessible_thread(thread_id, user)
    if err:
        return err

    data    = request.get_json(silent=True) or {}
    content = (data.get('content') or '').strip()
    if not content:
        return _err('消息内容不能为空')
    if len(content) > 2000:
        return _err('消息过长，最多 2000 字')

    msg = Message(
        thread_id      = thread_id,
        sender_user_id = user.id,
        sender_role    = user.role,
        content        = content,
    )
    db.session.add(msg)

    # bump thread updated_at so it floats to top of list
    thread.updated_at = datetime.now(timezone.utc)
    db.session.commit()

    # ── Socket.IO 实时推送 ────────────────────────────────────────────────────
    msg_dict = msg.to_dict()

    # 1. 通知 thread 房间内的所有成员（对方实时收到新消息）
    socketio.emit('new_message', msg_dict, room=f'thread_{thread_id}')

    # 2. 通知双方用户房间（会话列表实时更新 latest_message / updated_at）
    conversation_update = {
        'thread_id':        thread_id,
        'latest_message':   content[:60],
        'latest_message_at': msg.created_at.isoformat(),
        'updated_at':        thread.updated_at.isoformat(),
        'sender_user_id':   user.id,
    }
    socketio.emit('conversation_updated', conversation_update,
                  room=f'user_{thread.employer_id}')
    candidate = db.session.get(Candidate, thread.candidate_id)
    if candidate:
        socketio.emit('conversation_updated', conversation_update,
                      room=f'user_{candidate.user_id}')
    # ─────────────────────────────────────────────────────────────────────────

    return jsonify({'success': True, 'message': msg_dict}), 201
