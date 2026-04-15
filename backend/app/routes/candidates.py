import os
import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from app.extensions import db
from app.models.user import User
from app.models.candidate import Candidate

candidates_bp = Blueprint("candidates", __name__, url_prefix="/api/candidates")


def _err(msg, code=400):
    return jsonify({"success": False, "message": msg}), code


def _current_user():
    user_id = int(get_jwt_identity())
    return db.session.get(User, user_id)


def _allowed_file(filename):
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return ext in current_app.config["ALLOWED_EXTENSIONS"]


def _parse_salary(label):
    if not label or label == "面议":
        return None, None
    try:
        parts = label.lower().replace("k", "000").split("-")
        lo = int(parts[0])
        hi = int(parts[1]) if len(parts) > 1 else lo
        return lo, hi
    except Exception:
        return None, None


@candidates_bp.get("/me")
@jwt_required()
def get_me():
    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)
    if user.role not in ("candidate", "admin"):
        return _err("仅候选人账号可访问", 403)

    profile = Candidate.query.filter_by(user_id=user.id).first()
    if not profile:
        return jsonify({"success": True, "profile": None})
    return jsonify({"success": True, "profile": profile.to_dict()})


@candidates_bp.put("/me")
@jwt_required()
def update_me():
    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)
    if user.role not in ("candidate", "admin"):
        return _err("仅候选人账号可更新资料", 403)

    data = request.get_json(silent=True) or {}

    # 必填校验
    full_name = (data.get("full_name") or "").strip()
    current_title = (data.get("current_title") or "").strip()
    current_city = (data.get("current_city") or "").strip()
    if not full_name:
        return _err("请填写姓名")
    if not current_title:
        return _err("请填写当前职位")
    if not current_city:
        return _err("请填写所在城市")

    exp = data.get("experience_years")
    if exp is not None:
        try:
            exp = int(exp)
            if exp < 0 or exp > 60:
                return _err("工作年限请填写 0-60 之间的数字")
        except (ValueError, TypeError):
            return _err("工作年限格式不正确")

    salary_label = (data.get("expected_salary_label") or "").strip() or None
    salary_min, salary_max = _parse_salary(salary_label)
    if salary_min and salary_max and salary_min > salary_max:
        return _err("薪资最小值不能大于最大值")

    profile = Candidate.query.filter_by(user_id=user.id).first()
    now = datetime.now(timezone.utc)

    if not profile:
        profile = Candidate(user_id=user.id)
        db.session.add(profile)

    profile.full_name = full_name
    profile.current_title = current_title
    profile.current_city = current_city
    profile.current_company = (data.get("current_company") or "").strip() or None
    profile.expected_city = (data.get("expected_city") or "").strip() or None
    profile.expected_salary_label = salary_label
    profile.expected_salary_min = salary_min
    profile.expected_salary_max = salary_max
    profile.experience_years = exp
    profile.education = (data.get("education") or "").strip() or None
    profile.english_level = (data.get("english_level") or "").strip() or None
    profile.summary = (data.get("summary") or "").strip() or None
    profile.business_type = (data.get("business_type") or "").strip() or None
    profile.job_type = (data.get("job_type") or "").strip() or None
    profile.route_tags = data.get("route_tags") or []
    profile.skill_tags = data.get("skill_tags") or []
    VALID_AVAIL = {'open', 'passive', 'closed'}
    avail = data.get("availability_status") or "open"
    if avail not in VALID_AVAIL:
        return _err(f"availability_status 只能是 {sorted(VALID_AVAIL)} 之一")
    profile.availability_status = avail
    profile.profile_confirmed_at = now
    profile.last_active_at = now
    profile.updated_at = now

    db.session.commit()
    return jsonify({"success": True, "profile": profile.to_dict()})


@candidates_bp.get("")
@jwt_required()
def list_candidates():
    """
    候选人列表 — 供 employer / admin 使用。
    支持过滤：city, business_type, job_type, availability_status, q
    availability_status:
      - 不传 → 只返回 open
      - open / passive → 精确匹配
      - all → open + passive（admin 专用；employer 也只能看 open+passive，不能看 closed）
    q: 按 full_name / current_title / current_city 做 LIKE 模糊匹配
    """
    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)
    if user.role not in ("employer", "admin"):
        return _err("仅企业或管理员账号可查看候选人列表", 403)

    query = Candidate.query

    # availability_status 过滤
    avail_param = request.args.get("availability_status", "open").strip()
    if avail_param == "all":
        # open + passive（任何角色都不返回 closed）
        query = query.filter(Candidate.availability_status.in_(["open", "passive"]))
    elif avail_param in ("open", "passive"):
        query = query.filter(Candidate.availability_status == avail_param)
    else:
        query = query.filter(Candidate.availability_status == "open")

    city          = request.args.get("city", "").strip()
    business_type = request.args.get("business_type", "").strip()
    job_type      = request.args.get("job_type", "").strip()
    q             = request.args.get("q", "").strip()

    if city:
        query = query.filter(
            db.or_(Candidate.current_city == city, Candidate.expected_city == city)
        )
    if business_type:
        query = query.filter(Candidate.business_type == business_type)
    if job_type:
        query = query.filter(Candidate.job_type == job_type)
    if q:
        like = f"%{q}%"
        query = query.filter(
            db.or_(
                Candidate.full_name.ilike(like),
                Candidate.current_title.ilike(like),
                Candidate.current_city.ilike(like),
            )
        )

    # MySQL 8 不支持 "ORDER BY ... DESC NULLS LAST" 语法。
    # 用 CASE WHEN 把 NULL 排到末尾，等价于 PostgreSQL 的 nullslast()。
    candidates_list = query.order_by(
        db.case((Candidate.profile_confirmed_at.is_(None), 0), else_=1).desc(),
        Candidate.profile_confirmed_at.desc(),
    ).all()
    return jsonify({
        "success": True,
        "candidates": [_public_dict(c) for c in candidates_list],
        "total": len(candidates_list),
    })


@candidates_bp.get("/<int:candidate_id>")
@jwt_required()
def get_candidate_public(candidate_id):
    """
    候选人公开档案 — 供 employer / admin 查看，不含敏感字段。
    """
    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)
    if user.role not in ("employer", "admin"):
        return _err("仅企业或管理员账号可查看候选人档案", 403)

    profile = Candidate.query.filter_by(id=candidate_id).first()
    if not profile:
        return _err("候选人不存在", 404)
    if profile.availability_status == "closed" and user.role != "admin":
        return _err("该候选人暂不开放查看", 403)

    return jsonify({"success": True, "candidate": _public_dict(profile)})


def _public_dict(profile: Candidate) -> dict:
    """返回候选人公开信息，过滤掉 user_id / resume_file_path 等敏感字段。"""
    return {
        "id": profile.id,
        "full_name": profile.full_name,
        "current_title": profile.current_title,
        "current_company": profile.current_company,
        "current_city": profile.current_city,
        "expected_city": profile.expected_city,
        "expected_salary_label": profile.expected_salary_label,
        "experience_years": profile.experience_years,
        "education": profile.education,
        "english_level": profile.english_level,
        "summary": profile.summary,
        "business_type": profile.business_type,
        "job_type": profile.job_type,
        "route_tags": profile.route_tags or [],
        "skill_tags": profile.skill_tags or [],
        "all_tags": profile.all_tags(),
        "availability_status": profile.availability_status,
        "freshness_days": profile.freshness_days(),
        "resume_file_name": profile.resume_file_name,   # 文件名可展示，路径不返回
        "resume_uploaded_at": (
            profile.resume_uploaded_at.isoformat() if profile.resume_uploaded_at else None
        ),
        "profile_confirmed_at": (
            profile.profile_confirmed_at.isoformat() if profile.profile_confirmed_at else None
        ),
        "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
    }


@candidates_bp.post("/upload-resume")
@jwt_required()
def upload_resume():
    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)
    if user.role not in ("candidate", "admin"):
        return _err("仅候选人账号可上传简历", 403)

    if "file" not in request.files:
        return _err("请选择要上传的文件")
    f = request.files["file"]
    if not f.filename:
        return _err("文件名不能为空")
    if not _allowed_file(f.filename):
        return _err("仅支持 PDF、DOC、DOCX 格式")

    # 生成安全、唯一的存储文件名
    ext = f.filename.rsplit(".", 1)[-1].lower()
    safe_name = f"{user.id}_{uuid.uuid4().hex}.{ext}"
    upload_dir = current_app.config["UPLOAD_FOLDER"]
    os.makedirs(upload_dir, exist_ok=True)
    save_path = os.path.join(upload_dir, safe_name)
    f.save(save_path)

    # 更新或创建 Candidate 记录中的简历字段
    now = datetime.now(timezone.utc)
    profile = Candidate.query.filter_by(user_id=user.id).first()
    if not profile:
        # 简历上传时档案尚未完整填写，设为 closed 避免半成品出现在候选人池。
        # 候选人完成 PUT /candidates/me 确认档案时，才会更新为 open/passive。
        profile = Candidate(
            user_id=user.id,
            full_name=user.name,
            current_title="",
            current_city="",
            availability_status="closed",
        )
        db.session.add(profile)

    # 删除旧文件（静默失败）
    if profile.resume_file_path and os.path.exists(profile.resume_file_path):
        try:
            os.remove(profile.resume_file_path)
        except OSError:
            pass

    profile.resume_file_path = save_path
    profile.resume_file_name = secure_filename(f.filename)
    profile.resume_uploaded_at = now
    profile.last_active_at = now
    profile.updated_at = now
    db.session.commit()

    return jsonify({
        "success": True,
        "file_name": profile.resume_file_name,
        "uploaded_at": profile.resume_uploaded_at.isoformat(),
        "profile": profile.to_dict(),
    }), 201