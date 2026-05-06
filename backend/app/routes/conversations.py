from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func
from sqlalchemy.orm import joinedload
from datetime import datetime, timezone
from ..extensions import db, socketio
from ..models.user import User
from ..models.job import Job
from ..models.candidate import Candidate
from ..models.conversation import ConversationThread, Message

conversations_bp = Blueprint('conversations', __name__)


def _current_user():
    return db.session.get(User, int(get_jwt_identity()))


def _err(msg, code=400):
    return jsonify({'success': False, 'message': msg}), code


def _thread_summary_single(thread, current_user_id=None):
    """单会话视图（用于 get_messages）— 允许少量额外查询，可接受。"""
    latest_msg = thread.messages.order_by(Message.created_at.desc()).first()
    inv = thread.invitation

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
    """
    GET /api/conversations — 返回当前用户所有相关会话。

    优化：从 1+6N 次查询降为 3 次固定查询：
      1. threads（带 joinedload: invitation/job/job.company/candidate）
      2. latest message per thread（一次 subquery JOIN）
      3. unread count per thread（一次 GROUP BY）
    """
    try:
        user = _current_user()
        if not user or not user.is_active:
            return _err('用户不存在', 404)

        # ── 一次性 eager load 所有关联关系 ────────────────────────────────────────
        base_q = (
            ConversationThread.query
            .options(
                joinedload(ConversationThread.invitation),
                joinedload(ConversationThread.job).joinedload(Job.company),
                joinedload(ConversationThread.candidate),
            )
        )

        if user.role == 'employer':
            threads = (base_q
                       .filter_by(employer_id=user.id)
                       .order_by(ConversationThread.updated_at.desc())
                       .all())
        elif user.role == 'candidate':
            candidate = Candidate.query.filter_by(user_id=user.id).first()
            if not candidate:
                return jsonify({'success': True, 'conversations': [], 'total_unread': 0}), 200
            threads = (base_q
                       .filter_by(candidate_id=candidate.id)
                       .order_by(ConversationThread.updated_at.desc())
                       .all())
        elif user.role == 'admin':
            threads = (base_q
                       .order_by(ConversationThread.updated_at.desc())
                       .all())
        else:
            return _err('无权限', 403)

        if not threads:
            return jsonify({'success': True, 'conversations': [], 'total_unread': 0}), 200

        thread_ids = [t.id for t in threads]

        # ── 批量：每个 thread 的最新消息（一次查询） ──────────────────────────────
        latest_sub = (
            db.session.query(
                Message.thread_id,
                func.max(Message.id).label('max_id'),
            )
            .filter(Message.thread_id.in_(thread_ids))
            .group_by(Message.thread_id)
            .subquery()
        )
        latest_rows = (
            db.session.query(Message)
            .join(latest_sub, Message.id == latest_sub.c.max_id)
            .all()
        )
        latest_map = {m.thread_id: m for m in latest_rows}

        # ── 批量：每个 thread 的未读数（一次查询） ───────────────────────────────
        unread_rows = (
            db.session.query(
                Message.thread_id,
                func.count().label('cnt'),
            )
            .filter(
                Message.thread_id.in_(thread_ids),
                Message.is_read == False,           # noqa: E712
                Message.sender_user_id != user.id,
            )
            .group_by(Message.thread_id)
            .all()
        )
        unread_map = {r.thread_id: r.cnt for r in unread_rows}

        # ── 组装结果（纯 Python，无额外 SQL） ─────────────────────────────────────
        summaries = []
        for t in threads:
            latest_msg = latest_map.get(t.id)
            inv = t.invitation
            summaries.append({
                'id':                t.id,
                'invitation_id':     t.invitation_id,
                'invitation_status': inv.status if inv else 'pending',
                'job_id':            t.job_id,
                'job_title':         t.job.title if t.job else '—',
                'company_name':      (t.job.company.company_name if t.job and t.job.company else '—'),
                'candidate_id':      t.candidate_id,
                'candidate_name':    t.candidate.full_name if t.candidate else '—',
                'employer_id':       t.employer_id,
                'latest_message':    latest_msg.content[:60] if latest_msg else None,
                'latest_message_at': latest_msg.created_at.isoformat() if latest_msg else None,
                'updated_at':        t.updated_at.isoformat() if t.updated_at else None,
                'unread_count':      unread_map.get(t.id, 0),
            })

        total_unread = sum(s['unread_count'] for s in summaries)
        return jsonify({
            'success':       True,
            'conversations': summaries,
            'total_unread':  total_unread,
        }), 200

    except Exception as e:
        # Structured 500 — log full traceback server-side, never leak
        # DB stack traces to clients in production.
        # Note: _err(...) early-returns above never raise, so they are
        # not caught here.
        current_app.logger.exception('Failed to load conversations')
        payload = {
            'success': False,
            'message': '加载会话失败',
            'error':   'Failed to load conversations',
        }
        if current_app.debug:
            payload['detail'] = str(e)
        return jsonify(payload), 500


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

    try:
        limit = max(1, min(100, int(request.args.get('limit', 20))))
    except (ValueError, TypeError):
        limit = 20

    before_id = request.args.get('before', None)
    try:
        before_id = int(before_id) if before_id else None
    except (ValueError, TypeError):
        before_id = None

    if before_id is None:
        Message.query.filter_by(thread_id=thread_id, is_read=False).filter(
            Message.sender_user_id != user.id
        ).update({'is_read': True}, synchronize_session=False)
        db.session.commit()

    query = Message.query.filter_by(thread_id=thread_id)
    if before_id is not None:
        query = query.filter(Message.id < before_id)
    rows = query.order_by(Message.id.desc()).limit(limit + 1).all()

    has_more = len(rows) > limit
    if has_more:
        rows = rows[:limit]
    rows.reverse()

    next_before = rows[0].id if (rows and has_more) else None

    return jsonify({
        'success':     True,
        'thread':      _thread_summary_single(thread, user.id),
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
    thread.updated_at = datetime.now(timezone.utc)
    db.session.commit()

    msg_dict = msg.to_dict()

    socketio.emit('new_message', msg_dict, room=f'thread_{thread_id}')

    conversation_update = {
        'thread_id':         thread_id,
        'latest_message':    content[:60],
        'latest_message_at': msg.created_at.isoformat(),
        'updated_at':        thread.updated_at.isoformat(),
        'sender_user_id':    user.id,
    }
    socketio.emit('conversation_updated', conversation_update,
                  room=f'user_{thread.employer_id}')
    candidate = db.session.get(Candidate, thread.candidate_id)
    if candidate:
        socketio.emit('conversation_updated', conversation_update,
                      room=f'user_{candidate.user_id}')

    return jsonify({'success': True, 'message': msg_dict}), 201
