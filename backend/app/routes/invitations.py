from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
import logging
from ..extensions import db
from ..models.user import User
from ..models.job import Job
from ..models.candidate import Candidate
from ..models.invitation import Invitation
from ..models.conversation import ConversationThread
from ..services.email_service import send_invitation_email

invitations_bp = Blueprint('invitations', __name__)
logger = logging.getLogger(__name__)


@invitations_bp.route('', methods=['POST'])
@jwt_required()
def create_invitation():
    """POST /api/invitations — employer/admin 发起邀约"""
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    if not user or user.role not in ('employer', 'admin'):
        return jsonify({'message': '无权限'}), 403

    data = request.get_json(silent=True) or {}
    job_id       = data.get('job_id')
    candidate_id = data.get('candidate_id')
    message      = data.get('message', '').strip()

    if not job_id or not candidate_id:
        return jsonify({'message': 'job_id 和 candidate_id 为必填项'}), 400

    # 验证岗位存在且处于 published 状态
    job = Job.query.get(job_id)
    if not job:
        return jsonify({'message': '岗位不存在'}), 404
    if job.status != 'published':
        return jsonify({'message': f'岗位当前状态为 {job.status}，只有 published 岗位可发起邀约'}), 422

    # employer 只能为自己的岗位发邀约
    if user.role == 'employer' and job.company_id != current_user_id:
        return jsonify({'message': '只能对自己发布的岗位发起邀约'}), 403

    # 验证候选人存在且未关闭求职
    candidate = Candidate.query.get(candidate_id)
    if not candidate:
        return jsonify({'message': '候选人不存在'}), 404
    if candidate.availability_status == 'closed':
        return jsonify({'message': '该候选人当前不接受邀约（已关闭求职状态）'}), 422

    # 幂等/去重逻辑：
    # - 同一岗位+候选人已有 pending/accepted 邀约 → 直接返回已有记录（不重复发）
    # - 已有 declined → 允许重发（新建邀约，给候选人再次机会）
    existing = Invitation.query.filter_by(
        job_id=job_id,
        candidate_id=candidate_id,
    ).order_by(Invitation.created_at.desc()).first()

    if existing and existing.status in ('pending', 'accepted'):
        # Ensure a thread exists
        thread = ConversationThread.query.filter_by(invitation_id=existing.id).first()
        if not thread:
            thread = ConversationThread(
                invitation_id=existing.id,
                job_id=existing.job_id,
                candidate_id=existing.candidate_id,
                employer_id=existing.employer_id,
            )
            db.session.add(thread)
            db.session.commit()
        return jsonify({
            'message': '已存在邀约',
            'invitation': existing.to_dict(),
            'thread_id': thread.id,
            'already_existed': True,
        }), 200

    inv = Invitation(
        job_id=job_id,
        candidate_id=candidate_id,
        employer_id=current_user_id,
        message=message or None,
        status='pending',
    )
    db.session.add(inv)
    db.session.flush()  # get inv.id before commit

    # Auto-create conversation thread (idempotent via unique constraint on invitation_id)
    thread = ConversationThread(
        invitation_id=inv.id,
        job_id=job_id,
        candidate_id=candidate_id,
        employer_id=current_user_id,
    )
    db.session.add(thread)
    db.session.commit()

    # 发送邀约邮件（新邀约才发送，existing pending/accepted 不重复发）
    email_sent = False
    email_error = None
    try:
        # 邮件邀约应发到候选人的登录账号邮箱；profile contact email 可能是
        # 可见联系方式录入值，存在误填或与企业账号重复的情况，仅作为兜底。
        candidate_email = (candidate.user.email if candidate.user else None) or candidate.email
        if not candidate_email:
            logger.warning(f"Candidate {candidate.id} has no email, skip sending invitation email")
        else:
            # 获取企业名称
            company_name = user.company_name or user.name or "ACE-Talent 企业用户"

            # 获取该企业所有 published 岗位
            published_jobs = Job.query.filter_by(
                company_id=current_user_id,
                status='published'
            ).order_by(Job.created_at.desc()).all()

            # 构建岗位列表
            jobs_data = []
            for j in published_jobs:
                jobs_data.append({
                    'title': j.title,
                    'location_name': j.location_name,
                    'city': j.city,
                    'function_name': j.function_name,
                    'salary_label': j.salary_label,
                })

            # 发送邮件
            site_url = current_app.config.get('PUBLIC_SITE_URL', 'https://globalogin.com')
            send_invitation_email(candidate_email, company_name, jobs_data, site_url)
            email_sent = True
    except Exception as e:
        # 邮件发送失败不影响邀约创建
        logger.error(f"Failed to send invitation email for invitation {inv.id}: {type(e).__name__}")
        email_error = str(e) if current_app.config.get('DEBUG') else None

    response_data = {
        'message': '邀约已发出',
        'invitation': inv.to_dict(),
        'thread_id': thread.id,
        'already_existed': False,
        'email_sent': email_sent,
    }
    if email_error and current_app.config.get('DEBUG'):
        response_data['email_error'] = email_error

    return jsonify(response_data), 201


@invitations_bp.route('/sent', methods=['GET'])
@jwt_required()
def get_sent_invitations():
    """GET /api/invitations/sent — employer/admin 查看已发出的邀约列表"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if not user or user.role not in ('employer', 'admin'):
        return jsonify({'message': '无权限'}), 403

    if user.role == 'employer':
        invs = (
            Invitation.query
            .filter_by(employer_id=current_user_id)
            .order_by(Invitation.created_at.desc())
            .all()
        )
    else:
        # admin: 全部
        invs = Invitation.query.order_by(Invitation.created_at.desc()).all()

    return jsonify({
        'invitations': [
            {**inv.to_dict(), 'thread_id': inv.thread.id if inv.thread else None}
            for inv in invs
        ],
        'total': len(invs),
    }), 200


@invitations_bp.route('/my', methods=['GET'])
@jwt_required()
def get_my_invitations():
    """GET /api/invitations/my — candidate/admin 查看收到的邀约"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if not user or user.role not in ('candidate', 'admin'):
        return jsonify({'message': '无权限'}), 403

    # candidate 看自己的档案下的邀约
    if user.role == 'candidate':
        candidate = Candidate.query.filter_by(user_id=current_user_id).first()
        if not candidate:
            return jsonify({'invitations': []}), 200
        invs = (
            Invitation.query
            .filter_by(candidate_id=candidate.id)
            .order_by(Invitation.created_at.desc())
            .all()
        )
    else:
        # admin: 查看全部
        invs = Invitation.query.order_by(Invitation.created_at.desc()).all()

    result = []
    for inv in invs:
        item = inv.to_dict()
        item['job_title']    = inv.job.title if inv.job else '—'
        item['company_name'] = inv.job.company.company_name if inv.job and inv.job.company else '—'
        item['job_city']     = inv.job.city if inv.job else '—'
        item['thread_id']    = inv.thread.id if inv.thread else None
        result.append(item)

    return jsonify({'invitations': result}), 200


@invitations_bp.route('/company-summary', methods=['GET'])
@jwt_required()
def company_summary():
    """GET /api/invitations/company-summary — employer/admin 获取本企业邀约汇总"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if not user or user.role not in ('employer', 'admin'):
        return jsonify({'message': '无权限'}), 403

    if user.role == 'employer':
        total    = Invitation.query.filter_by(employer_id=current_user_id).count()
        accepted = Invitation.query.filter_by(employer_id=current_user_id, status='accepted').count()
        declined = Invitation.query.filter_by(employer_id=current_user_id, status='declined').count()
    else:
        total    = Invitation.query.count()
        accepted = Invitation.query.filter_by(status='accepted').count()
        declined = Invitation.query.filter_by(status='declined').count()

    replied = accepted + declined

    return jsonify({
        'total':    total,
        'replied':  replied,
        'accepted': accepted,
        'declined': declined,
    }), 200


@invitations_bp.route('/<int:inv_id>/status', methods=['PATCH'])
@jwt_required()
def update_invitation_status(inv_id):
    """PATCH /api/invitations/<id>/status — candidate/admin 回复邀约"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if not user or user.role not in ('candidate', 'admin'):
        return jsonify({'message': '无权限，只有候选人可以回复邀约'}), 403

    inv = Invitation.query.get(inv_id)
    if not inv:
        return jsonify({'message': '邀约不存在'}), 404

    # candidate 只能回复属于自己的邀约
    if user.role == 'candidate':
        candidate = Candidate.query.filter_by(user_id=current_user_id).first()
        if not candidate or inv.candidate_id != candidate.id:
            return jsonify({'message': '无权限修改该邀约'}), 403

    # 已回复的邀约不允许重复修改
    if inv.status != 'pending':
        return jsonify({
            'message': f'邀约已{("接受" if inv.status == "accepted" else "婉拒")}，不可重复修改',
            'current_status': inv.status,
        }), 409

    data = request.get_json(silent=True) or {}
    new_status = data.get('status', '')
    if new_status not in ('accepted', 'declined'):
        return jsonify({'message': 'status 只能是 accepted 或 declined'}), 400

    inv.status = new_status
    db.session.commit()

    return jsonify({
        'message': '邀约状态已更新',
        'invitation': inv.to_dict(),
    }), 200
