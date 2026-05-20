from datetime import datetime, timedelta, timezone
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func as sa_func
from sqlalchemy.orm import joinedload
from ..extensions import db
from ..models.user import User
from ..models.job import Job
from ..models.candidate import Candidate
from ..models.invitation import Invitation
from ..models.match_result import MatchResult

admin_bp = Blueprint('admin', __name__)


@admin_bp.route('/overview', methods=['GET'])
@jwt_required()
def overview():
    """GET /api/admin/overview — admin 运营总览统计"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if not user or user.role != 'admin':
        return jsonify({'message': '无权限，仅管理员可访问'}), 403

    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)

    # ── 核心计数 ──────────────────────────────────────────────
    total_users = User.query.count()
    total_candidates = Candidate.query.count()
    total_employers = User.query.filter_by(role='employer').count()
    total_admins = User.query.filter_by(role='admin').count()
    total_jobs = Job.query.count()
    published_jobs = Job.query.filter_by(status='published').count()
    total_invitations = Invitation.query.count()
    pending_inv = Invitation.query.filter_by(status='pending').count()
    accepted_inv = Invitation.query.filter_by(status='accepted').count()
    declined_inv = Invitation.query.filter_by(status='declined').count()
    total_matches = MatchResult.query.count()

    # ── 近7天新增 ─────────────────────────────────────────────
    new_users_7d = User.query.filter(User.created_at >= seven_days_ago).count()
    new_jobs_7d = Job.query.filter(Job.created_at >= seven_days_ago).count()
    new_candidates_7d = Candidate.query.filter(Candidate.created_at >= seven_days_ago).count()
    new_invitations_7d = Invitation.query.filter(Invitation.created_at >= seven_days_ago).count()

    # ── 实时动态：最近邀约 + 岗位 + 候选人（eager load 避免 N+1）───────────────────
    recent_invs = (
        Invitation.query
        .options(joinedload(Invitation.candidate), joinedload(Invitation.employer))
        .order_by(Invitation.created_at.desc())
        .limit(3).all()
    )
    recent_jobs = (
        Job.query
        .options(joinedload(Job.company))
        .order_by(Job.created_at.desc())
        .limit(3).all()
    )
    recent_cands = (
        Candidate.query
        .order_by(Candidate.created_at.desc())
        .limit(2).all()
    )

    activity = []
    for inv in recent_invs:
        cand_name = inv.candidate.full_name if inv.candidate else '—'
        company_name = (inv.employer.company_name or inv.employer.name) if inv.employer else '—'
        activity.append({
            'icon': 'send',
            'text': f'{company_name} 向 {cand_name} 发起邀约',
            'time': inv.created_at.isoformat(),
            'type': 'invite',
        })
    for job in recent_jobs:
        company_name = (job.company.company_name or job.company.name) if job.company else '—'
        activity.append({
            'icon': 'briefcase',
            'text': f'{company_name} 发布了新岗位：{job.title}',
            'time': job.created_at.isoformat(),
            'type': 'job',
        })
    for cand in recent_cands:
        activity.append({
            'icon': 'upload',
            'text': f'{cand.full_name} 上传了简历档案',
            'time': cand.created_at.isoformat(),
            'type': 'resume',
        })
    activity.sort(key=lambda x: x['time'], reverse=True)
    activity = activity[:6]

    # ── 近7天日趋势（3次 GROUP BY 替代 21次 per-day COUNT）────────────────────────
    cand_by_day = {
        str(r[0]): r[1]
        for r in db.session.query(
            sa_func.date(Candidate.created_at),
            sa_func.count(Candidate.id),
        ).filter(Candidate.created_at >= seven_days_ago).group_by(
            sa_func.date(Candidate.created_at)
        ).all()
    }
    job_by_day = {
        str(r[0]): r[1]
        for r in db.session.query(
            sa_func.date(Job.created_at),
            sa_func.count(Job.id),
        ).filter(Job.created_at >= seven_days_ago).group_by(
            sa_func.date(Job.created_at)
        ).all()
    }
    inv_by_day = {
        str(r[0]): r[1]
        for r in db.session.query(
            sa_func.date(Invitation.created_at),
            sa_func.count(Invitation.id),
        ).filter(Invitation.created_at >= seven_days_ago).group_by(
            sa_func.date(Invitation.created_at)
        ).all()
    }
    trend_7d = []
    for i in range(6, -1, -1):
        day = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_str = day.strftime('%Y-%m-%d')
        trend_7d.append({
            'date': day.strftime('%m-%d'),
            'candidates': cand_by_day.get(day_str, 0),
            'jobs': job_by_day.get(day_str, 0),
            'invitations': inv_by_day.get(day_str, 0),
        })

    return jsonify({
        'stats': {
            'total_users': total_users,
            'total_candidates': total_candidates,
            'total_employers': total_employers,
            'total_admins': total_admins,
            'total_jobs': total_jobs,
            'published_jobs': published_jobs,
            'total_invitations': total_invitations,
            'pending_invitations': pending_inv,
            'accepted_invitations': accepted_inv,
            'declined_invitations': declined_inv,
            'total_match_results': total_matches,
            'new_users_7d': new_users_7d,
            'new_jobs_7d': new_jobs_7d,
            'new_candidates_7d': new_candidates_7d,
            'new_invitations_7d': new_invitations_7d,
        },
        'activity': activity,
        'trend_7d': trend_7d,
        'fetched_at': now.strftime("%Y-%m-%dT%H:%M:%S") + "Z",
    }), 200
