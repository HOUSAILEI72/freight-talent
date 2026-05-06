import os
import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from app.extensions import db
from app.models.user import User
from app.models.candidate import Candidate
from app.models.junction_tags import CandidateTag

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
    # Owner always sees the full record (including private + contact).
    return jsonify({
        "success": True,
        "profile": profile.to_dict(include_private=True, include_contact=True),
    })


@candidates_bp.put("/me")
@jwt_required()
def update_me():
    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)
    if user.role not in ("candidate", "admin"):
        return _err("仅候选人账号可更新资料", 403)

    data = request.get_json(silent=True) or {}

    # ── Phase C: optional standard location ─────────────────────────────────
    # If client sends location_code, validate via the rule layer and persist
    # location_* + business_area_*. Legacy clients still send only
    # current_city; that path remains supported until Phase E flips it.
    from app.utils.business_area import validate_location_payload
    location_code_raw = (data.get("location_code") or "").strip()
    location_dict = None
    if location_code_raw:
        loc, loc_err = validate_location_payload({
            "location_code": location_code_raw,
            "location_name": (data.get("location_name") or "").strip(),
            "location_path": (data.get("location_path") or "").strip(),
            "location_type": (data.get("location_type") or "").strip(),
        })
        if loc_err:
            return _err(loc_err)
        location_dict = loc

    # 必填校验
    full_name = (data.get("full_name") or "").strip()
    current_title = (data.get("current_title") or "").strip()
    current_city = (data.get("current_city") or "").strip()
    # If location_code was provided but current_city wasn't, derive it for
    # legacy compatibility (current_city is NOT NULL on the schema).
    if not current_city and location_dict:
        current_city = location_dict["location_name"]

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

    def _validate_tags(val, field_name):
        if val is None:
            return [], None
        if not isinstance(val, list):
            return None, f"{field_name} 必须为字符串数组"
        if not all(isinstance(t, str) for t in val):
            return None, f"{field_name} 的每个元素必须为字符串"
        return val, None

    route_tags_raw, route_err = _validate_tags(data.get("route_tags"), "route_tags")
    if route_err:
        return _err(route_err)
    skill_tags_raw, skill_err = _validate_tags(data.get("skill_tags"), "skill_tags")
    if skill_err:
        return _err(skill_err)

    # ── CAND-2A: capability-profile tag arrays ──
    # Only overwrite when the client actually sent a key — otherwise we
    # preserve the existing column value (UploadResume legacy path never
    # sends these).
    knowledge_tags_val   = None
    hard_skill_tags_val  = None
    soft_skill_tags_val  = None
    if "knowledge_tags" in data:
        knowledge_tags_val, err = _validate_tags(data.get("knowledge_tags"), "knowledge_tags")
        if err: return _err(err)
    if "hard_skill_tags" in data:
        hard_skill_tags_val, err = _validate_tags(data.get("hard_skill_tags"), "hard_skill_tags")
        if err: return _err(err)
    if "soft_skill_tags" in data:
        soft_skill_tags_val, err = _validate_tags(data.get("soft_skill_tags"), "soft_skill_tags")
        if err: return _err(err)

    VALID_AVAIL = {'open', 'passive', 'closed'}
    avail = data.get("availability_status") or "open"
    if avail not in VALID_AVAIL:
        return _err(f"availability_status 只能是 {sorted(VALID_AVAIL)} 之一")

    # 联系信息字段校验
    import re as _re
    contact_email = (data.get("email") or "").strip() or None
    if contact_email and not _re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', contact_email):
        return _err("邮箱格式不正确")
    contact_phone = (data.get("phone") or "").strip() or None
    if contact_phone:
        if len(contact_phone) > 30:
            return _err("电话号码过长")
        # 允许 +、空格、-、() 之外只能是数字；最终剥离非数字后必须 7-15 位
        digits_only = _re.sub(r"[^\d]", "", contact_phone)
        if not _re.match(r'^[\d+\-\s()]+$', contact_phone) or not (7 <= len(digits_only) <= 15):
            return _err("电话号码格式不正确")
    contact_address = (data.get("address") or "").strip() or None
    contact_visible_raw = data.get("contact_visible")
    if contact_visible_raw is None:
        contact_visible = None  # 不更新
    else:
        contact_visible = bool(contact_visible_raw)

    # ── CAND-2A: current-job structured fields ──────────────────────────────
    sentinel = object()
    current_responsibilities_val = sentinel
    if "current_responsibilities" in data:
        v = (data.get("current_responsibilities") or "").strip() or None
        current_responsibilities_val = v

    function_code_val = sentinel
    function_name_val = sentinel
    if "function_code" in data:
        v = (data.get("function_code") or "").strip() or None
        function_code_val = v
    if "function_name" in data:
        v = (data.get("function_name") or "").strip() or None
        function_name_val = v

    is_management_val = sentinel
    if "is_management_role" in data:
        v = data.get("is_management_role")
        is_management_val = bool(v) if v is not None else None

    def _opt_int(name):
        if name not in data: return sentinel, None
        v = data.get(name)
        if v is None or v == "": return None, None
        try:
            return int(v), None
        except (ValueError, TypeError):
            return None, f"{name} 必须为整数"

    def _opt_float(name):
        if name not in data: return sentinel, None
        v = data.get(name)
        if v is None or v == "": return None, None
        try:
            return float(v), None
        except (ValueError, TypeError):
            return None, f"{name} 必须为数字"

    csm_val, e = _opt_int("current_salary_min")
    if e: return _err(e)
    csx_val, e = _opt_int("current_salary_max")
    if e: return _err(e)
    cs_months_val, e = _opt_int("current_salary_months")
    if e: return _err(e)
    if cs_months_val is not sentinel and cs_months_val is not None and cs_months_val not in (12, 13, 14):
        return _err("current_salary_months 只能是 12 / 13 / 14")
    abp_val, e = _opt_float("current_average_bonus_percent")
    if e: return _err(e)
    if abp_val is not sentinel and abp_val is not None and not (0 <= abp_val <= 100):
        return _err("current_average_bonus_percent 必须在 0-100 之间")
    yebm_val, e = _opt_float("current_year_end_bonus_months")
    if e: return _err(e)
    if yebm_val is not sentinel and yebm_val is not None and not (0 <= yebm_val <= 24):
        return _err("current_year_end_bonus_months 必须在 0-24 之间")

    has_yeb_val = sentinel
    if "current_has_year_end_bonus" in data:
        v = data.get("current_has_year_end_bonus")
        has_yeb_val = bool(v) if v is not None else None

    # 当前 salary min/max 关系（只在两个值都存在时校验）
    # 用 profile 既有值兜底，避免单字段更新时误报。
    existing_for_salary = Candidate.query.filter_by(user_id=user.id).first()
    eff_min = csm_val if csm_val is not sentinel else (existing_for_salary.current_salary_min if existing_for_salary else None)
    eff_max = csx_val if csx_val is not sentinel else (existing_for_salary.current_salary_max if existing_for_salary else None)
    if eff_min is not None and eff_max is not None and eff_min > eff_max:
        return _err("current_salary_min 不能大于 current_salary_max")

    # ── CAND-2A: structured array shapes ────────────────────────────────────
    def _validate_object_array(val, name, required_keys=()):
        if val is None: return [], None
        if not isinstance(val, list):
            return None, f"{name} 必须为数组"
        out = []
        for i, item in enumerate(val):
            if not isinstance(item, dict):
                return None, f"{name}[{i}] 必须为对象"
            for k in required_keys:
                v = item.get(k)
                if v is None or (isinstance(v, str) and not v.strip()):
                    return None, f"{name}[{i}].{k} 不能为空"
            out.append(item)
        return out, None

    work_exp_val = sentinel
    if "work_experiences" in data:
        we, err = _validate_object_array(
            data.get("work_experiences"), "work_experiences",
            required_keys=("company_name", "title")
        )
        if err: return _err(err)
        work_exp_val = we

    edu_exp_val = sentinel
    if "education_experiences" in data:
        ee, err = _validate_object_array(
            data.get("education_experiences"), "education_experiences"
        )
        if err: return _err(err)
        edu_exp_val = ee

    certificates_val = sentinel
    if "certificates" in data:
        c = data.get("certificates")
        if c is None:
            certificates_val = []
        elif not isinstance(c, list):
            return _err("certificates 必须为数组")
        elif not all(isinstance(x, str) for x in c):
            return _err("certificates 的每个元素必须为字符串")
        else:
            certificates_val = c

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
    profile.route_tags = route_tags_raw
    profile.skill_tags = skill_tags_raw
    profile.availability_status = avail
    # 联系信息：只在前端明确传值时才更新
    if contact_email is not None:
        profile.email = contact_email
    if contact_phone is not None:
        profile.phone = contact_phone
    if contact_address is not None:
        profile.address = contact_address
    if contact_visible is not None:
        profile.contact_visible = contact_visible

    # Phase C: persist standard location + computed business_area
    if location_dict:
        profile.location_code      = location_dict["location_code"]
        profile.location_name      = location_dict["location_name"]
        profile.location_path      = location_dict["location_path"]
        profile.location_type      = location_dict["location_type"]
        profile.business_area_code = location_dict["business_area_code"]
        profile.business_area_name = location_dict["business_area_name"]

    # ── CAND-2A: persist builder fields (only when client sent the key) ─────
    if current_responsibilities_val is not sentinel:
        profile.current_responsibilities = current_responsibilities_val
    if function_code_val is not sentinel:
        profile.function_code = function_code_val
    if function_name_val is not sentinel:
        profile.function_name = function_name_val
    if is_management_val is not sentinel:
        profile.is_management_role = is_management_val
    if knowledge_tags_val is not None:
        profile.knowledge_tags = knowledge_tags_val
    if hard_skill_tags_val is not None:
        profile.hard_skill_tags = hard_skill_tags_val
    if soft_skill_tags_val is not None:
        profile.soft_skill_tags = soft_skill_tags_val
    if csm_val is not sentinel:
        profile.current_salary_min = csm_val
    if csx_val is not sentinel:
        profile.current_salary_max = csx_val
    if cs_months_val is not sentinel:
        profile.current_salary_months = cs_months_val
    if abp_val is not sentinel:
        profile.current_average_bonus_percent = abp_val
    if has_yeb_val is not sentinel:
        profile.current_has_year_end_bonus = has_yeb_val
    if yebm_val is not sentinel:
        profile.current_year_end_bonus_months = yebm_val
    if work_exp_val is not sentinel:
        profile.work_experiences = work_exp_val
    if edu_exp_val is not sentinel:
        profile.education_experiences = edu_exp_val
    if certificates_val is not sentinel:
        profile.certificates = certificates_val

    # ── CAND-2A: server-computed profile_status (mirrors front-end gate) ───
    def _is_nonempty_str(v):
        return isinstance(v, str) and v.strip() != ""
    def _is_nonempty_arr(v):
        return isinstance(v, list) and len(v) > 0

    is_complete = (
        _is_nonempty_str(profile.full_name) and
        _is_nonempty_str(profile.phone) and
        _is_nonempty_str(profile.email) and
        _is_nonempty_str(profile.location_code) and
        _is_nonempty_str(profile.location_name) and
        _is_nonempty_str(profile.location_path) and
        _is_nonempty_str(profile.location_type) and
        _is_nonempty_str(profile.current_company) and
        _is_nonempty_str(profile.current_title) and
        _is_nonempty_str(profile.current_responsibilities) and
        _is_nonempty_arr(profile.work_experiences) and
        _is_nonempty_arr(profile.knowledge_tags) and
        _is_nonempty_arr(profile.hard_skill_tags) and
        _is_nonempty_arr(profile.soft_skill_tags)
    )
    profile.profile_status = "complete" if is_complete else "incomplete"
    if is_complete and not profile.profile_completed_at:
        profile.profile_completed_at = now

    confirm_latest = data.get("confirm_latest", True) is not False
    if confirm_latest:
        profile.profile_confirmed_at = now
    profile.last_active_at = now
    profile.updated_at = now

    # 同步 candidate_tags 联结表（接收前端传入的 tag_ids: list[int]）
    tag_ids = data.get("tag_ids")
    if isinstance(tag_ids, list):
        db.session.flush()  # 确保 profile.id 已赋值（新建时）
        db.session.execute(
            db.text("DELETE FROM candidate_tags WHERE candidate_id = :cid"),
            {"cid": profile.id},
        )
        for tid in tag_ids:
            if not isinstance(tid, int):
                continue
            db.session.execute(
                db.text(
                    "INSERT IGNORE INTO candidate_tags (candidate_id, tag_id, created_at)"
                    " VALUES (:cid, :tid, :now)"
                ),
                {"cid": profile.id, "tid": tid, "now": now},
            )

    db.session.commit()
    return jsonify({
        "success": True,
        "profile": profile.to_dict(include_private=True, include_contact=True),
    })


@candidates_bp.post("/me/confirm-latest")
@jwt_required()
def confirm_latest_resume():
    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)
    if user.role not in ("candidate", "admin"):
        return _err("仅候选人账号可确认最新简历", 403)

    profile = Candidate.query.filter_by(user_id=user.id).first()
    if not profile:
        return _err("候选人档案不存在", 404)
    if profile.profile_status != "complete":
        return _err("档案未完整，不能确认最新简历", 422)

    now = datetime.now(timezone.utc)
    profile.profile_confirmed_at = now
    profile.last_active_at = now
    profile.updated_at = now
    db.session.commit()

    return jsonify({
        "success": True,
        "profile": profile.to_dict(include_private=True, include_contact=True),
    })


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
    function_code = request.args.get("function_code", "").strip()
    business_area_code = request.args.get("business_area_code", "").strip()
    location_code_filter = request.args.get("location_code", "").strip()
    q             = request.args.get("q", "").strip()
    tag_ids_raw   = request.args.get("tag_ids", "").strip()

    if city:
        query = query.filter(
            db.or_(Candidate.current_city == city, Candidate.expected_city == city)
        )
    if business_type:
        query = query.filter(Candidate.business_type == business_type)
    if job_type:
        query = query.filter(Candidate.job_type == job_type)
    if function_code:
        # Candidates share `business_type` with the job side's `function_code`
        # taxonomy (PostJob mirrors function_code → business_type on save).
        query = query.filter(Candidate.business_type == function_code)
    if business_area_code:
        query = query.filter(Candidate.business_area_code == business_area_code)
    if location_code_filter:
        from app.utils.business_area import location_filter_clause
        clause = location_filter_clause(
            Candidate.location_code, Candidate.business_area_code, location_code_filter
        )
        if clause is not None:
            query = query.filter(clause)
    if q:
        like = f"%{q}%"
        query = query.filter(
            db.or_(
                Candidate.full_name.ilike(like),
                Candidate.current_title.ilike(like),
                Candidate.current_city.ilike(like),
                Candidate.location_name.ilike(like),
                Candidate.location_path.ilike(like),
            )
        )
    if tag_ids_raw:
        ids = [int(x) for x in tag_ids_raw.split(",") if x.strip().isdigit()]
        if ids:
            query = (
                query
                .join(CandidateTag, CandidateTag.candidate_id == Candidate.id)
                .filter(CandidateTag.tag_id.in_(ids))
                .distinct()
            )

    # tag_groups：分面筛选 — 同分类 OR、跨分类 AND
    # 格式：'1,2;5,6' → [[1,2],[5,6]]
    tag_groups_raw = request.args.get("tag_groups", "").strip()
    if tag_groups_raw:
        groups = []
        for seg in tag_groups_raw.split(";"):
            grp = [int(x) for x in seg.split(",") if x.strip().isdigit()]
            if grp:
                groups.append(grp)
        for grp in groups:
            sub = (
                db.session.query(CandidateTag.candidate_id)
                .filter(CandidateTag.candidate_id == Candidate.id,
                        CandidateTag.tag_id.in_(grp))
            )
            query = query.filter(sub.exists())

    # MySQL 8 不支持 "ORDER BY ... DESC NULLS LAST" 语法。
    # 用 CASE WHEN 把 NULL 排到末尾，等价于 PostgreSQL 的 nullslast()。
    candidates_list = query.order_by(
        db.case((Candidate.profile_confirmed_at.is_(None), 0), else_=1).desc(),
        Candidate.profile_confirmed_at.desc(),
    ).all()

    # 候选人池列表：admin 看全私；employer 仅对已解锁的候选人开放隐私。
    # 解锁规则（CAND-5）= accepted invitation OR active application
    # （submitted / viewed / shortlisted），单次批量预取避免 N+1。
    is_admin = user.role == "admin"
    cand_ids = [c.id for c in candidates_list]
    unlocked_ids: set[int] = set()
    if user.role == "employer" and cand_ids:
        from app.utils.candidate_privacy import employer_unlocked_candidate_ids
        unlocked_ids = employer_unlocked_candidate_ids(user.id, cand_ids)

    tag_map = _load_tags_by_category(cand_ids)

    out = []
    for c in candidates_list:
        priv = is_admin or (c.id in unlocked_ids)
        out.append(_public_dict(
            c, include_contact=priv, include_private=priv,
            tags_by_category=tag_map.get(c.id, {}),
        ))

    return jsonify({
        "success": True,
        "candidates": out,
        "total": len(candidates_list),
    })


@candidates_bp.get("/area-filters")
@jwt_required()
def area_filters_candidates():
    """GET /api/candidates/area-filters

    Counts of open/passive candidates grouped by business_area_code, ordered
    by the canonical DEFAULT_AREA_FILTERS sequence (matches front-end), with
    any unknown / extra codes appended at the tail.
    """
    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)
    if user.role not in ("employer", "admin"):
        return _err("仅企业或管理员账号可访问此接口", 403)

    from app.utils.business_area import BUSINESS_AREAS

    rows = (
        db.session.query(Candidate.business_area_code, db.func.count(Candidate.id))
        .filter(Candidate.availability_status.in_(["open", "passive"]))
        .filter(Candidate.business_area_code.isnot(None))
        .group_by(Candidate.business_area_code)
        .all()
    )
    counts = {code: cnt for code, cnt in rows}

    default_order = [
        "GLOBAL", "GREAT_CHINA", "EAST_CHINA", "NORTH_CHINA", "SOUTH_CHINA",
        "WEST_CHINA", "HONG_KONG", "TAIWAN", "OVERSEAS",
    ]
    out = []
    seen = set()
    for code in default_order:
        if code in counts:
            out.append({"code": code, "name": BUSINESS_AREAS[code]["name"], "count": counts[code]})
            seen.add(code)
    for code, cnt in counts.items():
        if code in seen:
            continue
        name = BUSINESS_AREAS.get(code, {}).get("name", code)
        out.append({"code": code, "name": name, "count": cnt})
    return jsonify({"success": True, "filters": out})


@candidates_bp.get("/<int:candidate_id>")
@jwt_required()
def get_candidate_public(candidate_id):
    """
    候选人公开档案 — 供 employer / admin 查看，不含敏感字段。
    候选人本人也可查看自己的档案（id 匹配时豁免角色限制）。
    """
    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)

    profile = Candidate.query.filter_by(id=candidate_id).first()
    if not profile:
        return _err("候选人不存在", 404)

    is_own = (user.role == "candidate" and profile.user_id == user.id)

    if not is_own and user.role not in ("employer", "admin"):
        return _err("仅企业或管理员账号可查看候选人档案", 403)
    if not is_own and profile.availability_status == "closed" and user.role != "admin":
        return _err("该候选人暂不开放查看", 403)

    # 隐私可见性判定（CAND-5）：
    #   - 候选人本人 / admin → 永远私有
    #   - employer → accepted invitation OR active application（submitted /
    #     viewed / shortlisted）
    #   - 其它角色（不会到达这里，前面已 403）→ 公开视图
    if is_own or user.role == "admin":
        include_private = True
    elif user.role == "employer":
        from app.utils.candidate_privacy import employer_can_view_private_profile
        include_private = employer_can_view_private_profile(user.id, profile.id)
    else:
        include_private = False

    # CAND-5: contact_visible 不再控制企业可见性。已解锁即可看到
    # 联系方式；未解锁始终隐藏。本人 / admin 也永远可见。
    include_contact = include_private

    tag_map = _load_tags_by_category([profile.id])
    return jsonify({
        "success": True,
        "candidate": _public_dict(
            profile,
            include_contact=include_contact,
            include_private=include_private,
            tags_by_category=tag_map.get(profile.id, {}),
        ),
    })


def _employer_has_accepted_invite(employer_id: int, candidate_id: int) -> bool:
    """Legacy shim — kept so nothing imports a missing symbol. CAND-5 supersedes
    this with `employer_can_view_private_profile` in
    `app.utils.candidate_privacy`. Use that going forward."""
    from app.utils.candidate_privacy import employer_can_view_private_profile
    return employer_can_view_private_profile(employer_id, candidate_id)


def _load_tags_by_category(candidate_ids: list[int]) -> dict[int, dict[str, list[str]]]:
    """
    批量加载候选人的标签，按分类聚合。包括 pending（导入后未审批的也展示）。
    返回 {candidate_id: {category: [name, ...]}}
    """
    if not candidate_ids:
        return {}
    rows = db.session.execute(
        db.text("""
            SELECT ct.candidate_id, t.category, t.name
            FROM candidate_tags ct
            JOIN tags t ON t.id = ct.tag_id
            WHERE ct.candidate_id IN :ids
              AND t.status IN ('active', 'pending')
            ORDER BY t.category, t.name
        """).bindparams(db.bindparam("ids", expanding=True)),
        {"ids": candidate_ids},
    ).fetchall()
    out: dict[int, dict[str, list[str]]] = {}
    for r in rows:
        out.setdefault(r.candidate_id, {}).setdefault(r.category, []).append(r.name)
    return out


def _public_dict(profile: Candidate, include_contact: bool = False,
                 include_private: bool = False,
                 tags_by_category: dict[str, list[str]] | None = None) -> dict:
    """返回候选人公开信息（CAND-5 重整后）。

    `include_private=True` 时暴露隐私字段（候选人本人 / admin / 已解锁的 employer）。
    `include_contact` 与 `include_private` 同步，因 CAND-5 起两者总是一起开关 ——
    保留参数仅是为了减少 call-site 改动。

    永远公开（用于列表筛选、卡片展示、匹配）：
      function_code / function_name / is_management_role / location_* /
      business_area_* / knowledge_tags / hard_skill_tags / soft_skill_tags /
      route_tags / skill_tags / job_type / business_type / expected_* /
      english_level / summary / profile_status / freshness_days / 时间戳

    隐私字段（仅 include_private=True 时返回真实值）：
      full_name / age / experience_years / education / availability_status /
      work_experiences / education_experiences / certificates /
      current_company / current_responsibilities / current_salary_min/max/months /
      current_average_bonus_percent / current_has_year_end_bonus /
      current_year_end_bonus_months / email / phone / address
    """
    data = {
        "id": profile.id,
        # 公开字段（永远返回）
        "current_title": profile.current_title,
        "current_city": profile.current_city,
        "expected_city": profile.expected_city,
        "expected_salary_min": profile.expected_salary_min,
        "expected_salary_max": profile.expected_salary_max,
        "expected_salary_label": profile.expected_salary_label,
        "english_level": profile.english_level,
        "summary": profile.summary,
        "business_type": profile.business_type,
        "job_type": profile.job_type,
        "route_tags": profile.route_tags or [],
        "skill_tags": profile.skill_tags or [],
        "all_tags": profile.all_tags(),
        "contact_visible": profile.contact_visible,
        # Phase C: standard location
        "location_code": profile.location_code,
        "location_name": profile.location_name,
        "location_path": profile.location_path,
        "location_type": profile.location_type,
        "business_area_code": profile.business_area_code,
        "business_area_name": profile.business_area_name,
        # CAND-2A: capability profile (always public; used by matching)
        "function_code":      profile.function_code,
        "function_name":      profile.function_name,
        "is_management_role": profile.is_management_role,
        "knowledge_tags":     profile.knowledge_tags or [],
        "hard_skill_tags":    profile.hard_skill_tags or [],
        "soft_skill_tags":    profile.soft_skill_tags or [],
        "profile_status":     profile.profile_status,
        "profile_completed_at": (
            profile.profile_completed_at.isoformat()
            if profile.profile_completed_at else None
        ),
        "freshness_days": profile.freshness_days(),
        "resume_file_name": profile.resume_file_name,
        "resume_uploaded_at": (
            profile.resume_uploaded_at.isoformat() if profile.resume_uploaded_at else None
        ),
        "profile_confirmed_at": (
            profile.profile_confirmed_at.isoformat() if profile.profile_confirmed_at else None
        ),
        "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
    }

    if include_private:
        data.update({
            "full_name":             profile.full_name,
            "age":                   profile.age,
            "experience_years":      profile.experience_years,
            "education":             profile.education,
            "availability_status":   profile.availability_status,
            "work_experiences":      profile.work_experiences or [],
            "education_experiences": profile.education_experiences or [],
            "certificates":          profile.certificates or [],
            # CAND-5: 当前任职敏感字段
            "current_company":               profile.current_company,
            "current_responsibilities":      profile.current_responsibilities,
            "current_salary_min":            profile.current_salary_min,
            "current_salary_max":            profile.current_salary_max,
            "current_salary_months":         profile.current_salary_months,
            "current_average_bonus_percent": profile.current_average_bonus_percent,
            "current_has_year_end_bonus":    profile.current_has_year_end_bonus,
            "current_year_end_bonus_months": profile.current_year_end_bonus_months,
            "private_visible":       True,
        })
    else:
        data.update({
            "full_name":             f"候选人 #{profile.id}",
            "age":                   None,
            "experience_years":      None,
            "education":             None,
            "availability_status":   None,
            "work_experiences":      [],
            "education_experiences": [],
            "certificates":          [],
            "current_company":               None,
            "current_responsibilities":      None,
            "current_salary_min":            None,
            "current_salary_max":            None,
            "current_salary_months":         None,
            "current_average_bonus_percent": None,
            "current_has_year_end_bonus":    None,
            "current_year_end_bonus_months": None,
            "private_visible":       False,
        })

    if include_contact and include_private:
        data["email"]   = profile.email
        data["phone"]   = profile.phone
        data["address"] = profile.address
    else:
        data["email"]   = None
        data["phone"]   = None
        data["address"] = None

    # 注入按分类聚合的标签（含 pending）— 供前端按分类展示
    data["tags_by_category"] = tags_by_category or {}
    return data


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
