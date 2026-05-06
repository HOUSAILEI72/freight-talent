"""CAND-4 — candidate-initiated job applications.

Three endpoints live here:
  • POST /api/jobs/<job_id>/applications  (candidate)
  • GET  /api/applications/my             (candidate)
  • GET  /api/applications/received       (employer / admin)

CAND-4 only persists the relation. CAND-5 will read from this table (and
from accepted invitations) to unlock the employer-side privacy view.
"""

from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models.user import User
from app.models.job import Job
from app.models.candidate import Candidate
from app.models.job_application import JobApplication
from app.utils.candidate_profile import (
    is_candidate_profile_complete,
    get_missing_profile_fields,
)


applications_bp = Blueprint("applications", __name__)


def _err(msg, code=400, **extra):
    body = {"success": False, "message": msg}
    body.update(extra)
    return jsonify(body), code


def _current_user():
    uid = int(get_jwt_identity())
    return db.session.get(User, uid)


# ── POST /api/jobs/<job_id>/applications ─────────────────────────────────────
@applications_bp.post("/api/jobs/<int:job_id>/applications")
@jwt_required()
def apply_to_job(job_id):
    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)
    if user.role != "candidate":
        return _err("仅候选人账号可以投递岗位", 403)

    profile = Candidate.query.filter_by(user_id=user.id).first()
    if not profile:
        return _err(
            "请先完善候选人档案", 422,
            error_code="profile_incomplete",
            missing=["profile"],
        )

    # profile_status is the source of truth (set by PUT /candidates/me); if
    # the column is empty (legacy candidate created before CAND-2A), recompute.
    is_complete = (
        profile.profile_status == "complete"
        if profile.profile_status
        else is_candidate_profile_complete(profile)
    )
    if not is_complete:
        return _err(
            "请先完善候选人档案", 422,
            error_code="profile_incomplete",
            missing=get_missing_profile_fields(profile),
        )

    job = db.session.get(Job, job_id)
    if not job:
        return _err("岗位不存在", 404)
    if job.status != "published":
        return _err("该岗位未发布或已下线，无法投递", 400)

    # Idempotent: same candidate re-applying to same job returns the
    # existing record so the front-end button can settle on "已投递".
    existing = JobApplication.query.filter_by(
        job_id=job.id, candidate_id=profile.id,
    ).first()
    if existing:
        # Re-applying after withdrawal flips the status back to submitted.
        if existing.status == "withdrawn":
            existing.status = "submitted"
            existing.updated_at = datetime.now(timezone.utc)
            db.session.commit()
        return jsonify({
            "success": True,
            "duplicate": True,
            "application": existing.to_dict(),
        }), 200

    message = (request.get_json(silent=True) or {}).get("message")
    if message is not None and not isinstance(message, str):
        return _err("message 必须为字符串")
    if isinstance(message, str):
        message = message.strip() or None

    app_row = JobApplication(
        job_id=job.id,
        candidate_id=profile.id,
        employer_id=job.company_id,
        status="submitted",
        message=message,
    )
    db.session.add(app_row)
    db.session.commit()

    return jsonify({"success": True, "application": app_row.to_dict()}), 201


# ── GET /api/applications/my (candidate) ─────────────────────────────────────
@applications_bp.get("/api/applications/my")
@jwt_required()
def my_applications():
    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)
    if user.role != "candidate":
        return _err("仅候选人账号可访问", 403)

    profile = Candidate.query.filter_by(user_id=user.id).first()
    if not profile:
        return jsonify({"success": True, "applications": []})

    rows = (
        JobApplication.query
        .options(joinedload(JobApplication.job))
        .filter(JobApplication.candidate_id == profile.id)
        .order_by(JobApplication.created_at.desc())
        .all()
    )
    out = []
    for r in rows:
        d = r.to_dict()
        j = r.job
        if j is not None:
            d["job"] = {
                "id":              j.id,
                "title":           j.title,
                # Job has no company_name column; it's derived from the
                # relationship to User. Mirror Job.to_dict()'s convention.
                "company_name":    j.company.company_name if j.company else None,
                "city":            j.city,
                "city_name":       getattr(j, "city_name", None),
                "salary_label":    getattr(j, "salary_label", None),
                "location_name":   getattr(j, "location_name", None),
                "location_path":   getattr(j, "location_path", None),
                "function_code":   getattr(j, "function_code", None),
                "function_name":   getattr(j, "function_name", None),
                "status":          j.status,
            }
        out.append(d)
    return jsonify({"success": True, "applications": out})


# ── GET /api/applications/received (employer / admin) ────────────────────────
@applications_bp.get("/api/applications/received")
@jwt_required()
def received_applications():
    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)
    if user.role not in ("employer", "admin"):
        return _err("仅企业 / 管理员可访问", 403)

    q = (
        JobApplication.query
        .options(joinedload(JobApplication.job))
        .options(joinedload(JobApplication.candidate))
        .order_by(JobApplication.created_at.desc())
    )
    if user.role == "employer":
        # Employer only sees applications addressed to themselves.
        q = q.filter(JobApplication.employer_id == user.id)

    # CAND-4B: optional status filter
    status_filter = request.args.get("status")
    if status_filter:
        q = q.filter(JobApplication.status == status_filter)

    rows = q.all()
    out = []
    for r in rows:
        d = r.to_dict()
        j = r.job
        if j is not None:
            d["job"] = {
                "id":           j.id,
                "title":        j.title,
                "city":         j.city,
                "function_code": getattr(j, "function_code", None),
                "function_name": getattr(j, "function_name", None),
            }
        # CAND-4 keeps candidate detail anonymous here; CAND-5 will lift the
        # veil for unlocked viewers. Surface only the bare list-row fields.
        c = r.candidate
        if c is not None:
            d["candidate"] = {
                "id":              c.id,
                "anonymous_name":  f"候选人 #{c.id}",
                "current_title":   c.current_title,
                "function_code":   getattr(c, "function_code", None),
                "function_name":   getattr(c, "function_name", None),
                "business_area_code": getattr(c, "business_area_code", None),
                "business_area_name": getattr(c, "business_area_name", None),
                "expected_salary_label": c.expected_salary_label,
                "experience_years": c.experience_years,
                "freshness_days":   c.freshness_days(),
            }
        out.append(d)
    return jsonify({"success": True, "applications": out})


# ── PATCH /api/applications/<id>/status (CAND-4B) ───────────────────────────
@applications_bp.patch("/api/applications/<int:application_id>/status")
@jwt_required()
def update_application_status(application_id):
    """Update application status with role-based permissions and state machine rules."""
    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)

    app_row = db.session.get(JobApplication, application_id)
    if not app_row:
        return _err("投递记录不存在", 404)

    data = request.get_json(silent=True) or {}
    new_status = data.get("status")
    if not new_status:
        return _err("缺少 status 字段", 400)

    VALID_STATUSES = {"submitted", "viewed", "shortlisted", "rejected", "withdrawn"}
    if new_status not in VALID_STATUSES:
        return _err(f"非法 status: {new_status}", 400)

    # ── Permission checks ────────────────────────────────────────────────────
    if user.role == "candidate":
        # Candidate can only withdraw their own applications
        profile = Candidate.query.filter_by(user_id=user.id).first()
        if not profile or app_row.candidate_id != profile.id:
            return _err("无权操作此投递", 403)
        if new_status != "withdrawn":
            return _err("候选人只能撤回投递", 403)
        # Cannot withdraw from terminal states (except admin override)
        if app_row.status in ("rejected", "withdrawn"):
            # Idempotent: if already withdrawn, return current state
            if app_row.status == "withdrawn":
                return jsonify({"success": True, "application": app_row.to_dict()})
            return _err("已被拒绝的投递无法撤回", 409)

    elif user.role == "employer":
        # Employer can only update applications addressed to them
        if app_row.employer_id != user.id:
            return _err("无权操作此投递", 403)
        if new_status == "withdrawn":
            return _err("企业不能将投递标记为撤回", 403)
        if new_status not in ("viewed", "shortlisted", "rejected"):
            return _err("企业只能标记为已查看/候选名单/暂不匹配", 400)
        # Cannot modify terminal states
        if app_row.status in ("rejected", "withdrawn"):
            return _err("终态投递无法修改", 409)

    elif user.role == "admin":
        # Admin can change any status
        pass
    else:
        return _err("无权操作", 403)

    # ── State machine validation ─────────────────────────────────────────────
    ALLOWED_TRANSITIONS = {
        "submitted":   {"viewed", "shortlisted", "rejected", "withdrawn"},
        "viewed":      {"shortlisted", "rejected", "withdrawn"},
        "shortlisted": {"rejected", "withdrawn"},
        "rejected":    set(),  # terminal (admin can override via permission check above)
        "withdrawn":   set(),  # terminal (admin can override via permission check above)
    }

    if user.role != "admin":
        allowed = ALLOWED_TRANSITIONS.get(app_row.status, set())
        if new_status not in allowed:
            return _err(
                f"不允许从 {app_row.status} 转换到 {new_status}",
                409,
            )

    # ── Apply update ─────────────────────────────────────────────────────────
    app_row.status = new_status
    app_row.updated_at = datetime.now(timezone.utc)
    db.session.commit()

    return jsonify({"success": True, "application": app_row.to_dict()})
