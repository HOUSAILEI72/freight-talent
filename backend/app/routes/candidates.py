import os
import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from app.extensions import db
from app.models.user import User
from app.models.candidate import Candidate
from app.modules.candidates.serializers import build_public_dict
from app.modules.candidates.repository import (
    get_candidate_by_user_id,
    get_candidate_by_id,
    list_candidates_with_filters,
    count_candidates_by_business_area,
    load_tags_by_category,
    sync_candidate_tags,
)

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

    profile = get_candidate_by_user_id(user.id)
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

    age_val = None
    birth_year_val = None
    birth_month_val = None
    birth_year = data.get("birth_year")
    if birth_year is not None:
        from datetime import datetime as _dt
        current_year = _dt.now().year
        try:
            birth_year = int(birth_year)
            if birth_year < 1950 or birth_year > current_year - 16:
                return _err(f"出生年份请填写 1950 至 {current_year - 16} 之间")
            birth_year_val = birth_year
            age_val = current_year - birth_year
        except (ValueError, TypeError):
            return _err("出生年份格式不正确")

    birth_month = data.get("birth_month")
    if birth_month is not None:
        try:
            birth_month = int(birth_month)
            if birth_month < 1 or birth_month > 12:
                return _err("出生月份请填写 1-12")
            birth_month_val = birth_month
        except (ValueError, TypeError):
            return _err("出生月份格式不正确")

    VALID_GENDER = {'male', 'female'}
    gender_val = data.get("gender") or None
    if gender_val is not None and gender_val not in VALID_GENDER:
        return _err("gender 只能是 male / female")

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

    VALID_AVAIL = {'open', 'passive_now', 'passive', 'closed'}
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
    existing_for_salary = get_candidate_by_user_id(user.id)
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

    profile = get_candidate_by_user_id(user.id)
    now = datetime.now(timezone.utc)

    if not profile:
        profile = Candidate(user_id=user.id)
        db.session.add(profile)

    profile.full_name = full_name
    profile.current_title = current_title
    profile.desired_position = (data.get("desired_position") or "").strip() or None
    profile.current_city = current_city
    profile.current_company = (data.get("current_company") or "").strip() or None
    profile.expected_city = (data.get("expected_city") or "").strip() or None
    profile.expected_salary_label = salary_label
    profile.expected_salary_min = salary_min
    profile.expected_salary_max = salary_max
    profile.experience_years = exp
    if age_val is not None:
        profile.age = age_val
    if birth_year_val is not None:
        profile.birth_year = birth_year_val
    if birth_month_val is not None:
        profile.birth_month = birth_month_val
    if "gender" in data:
        profile.gender = gender_val
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
        sync_candidate_tags(profile.id, tag_ids, now)

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

    profile = get_candidate_by_user_id(user.id)
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

    try:
        page      = max(1, int(request.args.get("page", 1)))
        page_size = max(1, min(int(request.args.get("page_size", 20)), 100))
    except (ValueError, TypeError):
        page, page_size = 1, 20

    pool_type   = request.args.get("pool_type", "all").strip()
    employer_id = user.id if user.role == "employer" else None

    job_id_raw = request.args.get("job_id", "").strip()
    job_id: int | None = None
    if job_id_raw.isdigit():
        job_id = int(job_id_raw)

    result = list_candidates_with_filters(
        avail_param=request.args.get("availability_status", "open").strip(),
        city=request.args.get("city", "").strip(),
        business_type=request.args.get("business_type", "").strip(),
        job_type=request.args.get("job_type", "").strip(),
        function_code=request.args.get("function_code", "").strip(),
        business_area_code=request.args.get("business_area_code", "").strip(),
        location_code_filter=request.args.get("location_code", "").strip(),
        q=request.args.get("q", "").strip(),
        tag_ids_raw=request.args.get("tag_ids", "").strip(),
        tag_groups_raw=request.args.get("tag_groups", "").strip(),
        gender=request.args.get("gender", "").strip(),
        page=page,
        page_size=page_size,
        pool_type=pool_type,
        employer_id=employer_id,
        job_id=job_id,
    )

    candidates_list = result["items"]

    # 候选人池列表：admin 看全私；employer 仅订阅覆盖的候选人开放隐私（Phase 8）。
    # 解锁规则：active subscription 且 function_code + business_area_code 双命中。
    is_admin = user.role == "admin"
    cand_ids = [c.id for c in candidates_list]
    unlocked_ids: set[int] = set()
    if user.role == "employer" and cand_ids:
        from app.utils.candidate_privacy import employer_unlocked_candidate_ids
        unlocked_ids = employer_unlocked_candidate_ids(user.id, cand_ids)

    tag_map = load_tags_by_category(cand_ids)
    application_map = result.get("application_map", {})

    out = []
    for c in candidates_list:
        priv = is_admin or (c.id in unlocked_ids)
        d = build_public_dict(
            c, include_contact=priv, include_private=priv,
            tags_by_category=tag_map.get(c.id, {}),
        )
        if c.id in application_map:
            d.update(application_map[c.id])
        out.append(d)

    # Compute pool_counts for the rail badges (only all + applied for now)
    pool_counts = {}
    if user.role == "employer":
        from app.models.job_application import JobApplication
        from app.models.job import Job
        from app.extensions import db as _db
        from app.models.candidate import Candidate as _Cand
        try:
            pool_counts["all"] = _db.session.query(_db.func.count(_Cand.id)).filter(
                _Cand.availability_status.in_(["open", "passive_now", "passive"])
            ).scalar() or 0
        except Exception:
            pool_counts["all"] = None
        try:
            pool_counts["applied"] = (
                _db.session.query(_db.func.count(_db.distinct(JobApplication.candidate_id)))
                .join(Job, Job.id == JobApplication.job_id)
                .filter(JobApplication.employer_id == employer_id)
                .scalar() or 0
            )
        except Exception:
            pool_counts["applied"] = None
        try:
            from app.models.employer_candidate_favorite import EmployerCandidateFavorite as _Fav
            pool_counts["favorited"] = (
                _db.session.query(_db.func.count(_Fav.id))
                .filter(_Fav.employer_id == employer_id)
                .scalar() or 0
            )
        except Exception:
            pool_counts["favorited"] = None
        for k in ("personal_headhunter", "team_headhunter", "entrusted"):
            pool_counts[k] = None

    return jsonify({
        "success": True,
        "candidates": out,
        "total": result["total"],
        "page": result["page"],
        "page_size": result["page_size"],
        "total_pages": result["total_pages"],
        "pool_counts": pool_counts,
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

    rows = count_candidates_by_business_area()
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

    profile = get_candidate_by_id(candidate_id)
    if not profile:
        return _err("候选人不存在", 404)

    is_own = (user.role == "candidate" and profile.user_id == user.id)

    if not is_own and user.role not in ("employer", "admin"):
        return _err("仅企业或管理员账号可查看候选人档案", 403)
    if not is_own and profile.availability_status == "closed" and user.role != "admin":
        return _err("该候选人暂不开放查看", 403)

    # 隐私可见性判定（Phase 8）：
    #   - 候选人本人 / admin → 永远私有
    #   - employer → active subscription 且 function+area 双命中
    #   - 其它角色（不会到达这里，前面已 403）→ 公开视图
    if is_own or user.role == "admin":
        include_private = True
    elif user.role == "employer":
        from app.utils.candidate_privacy import employer_can_view_private_profile
        include_private = employer_can_view_private_profile(user.id, profile.id)
    else:
        include_private = False

    # contact 可见性与 private 一致，订阅覆盖则可见，否则隐藏。
    include_contact = include_private

    tag_map = load_tags_by_category([profile.id])
    return jsonify({
        "success": True,
        "candidate": build_public_dict(
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
    profile = get_candidate_by_user_id(user.id)
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


# ── 收藏 toggle ───────────────────────────────────────────────────────────────

@candidates_bp.post("/<int:candidate_id>/favorite")
@jwt_required()
def toggle_favorite(candidate_id):
    """POST /api/candidates/:id/favorite — 切换收藏状态，返回 {favorited: bool}"""
    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)
    if user.role != "employer":
        return _err("仅企业账号可收藏候选人", 403)

    from app.models.employer_candidate_favorite import EmployerCandidateFavorite
    from datetime import datetime, timezone

    existing = EmployerCandidateFavorite.query.filter_by(
        employer_id=user.id, candidate_id=candidate_id
    ).first()

    if existing:
        db.session.delete(existing)
        db.session.commit()
        return jsonify({"success": True, "favorited": False})
    else:
        fav = EmployerCandidateFavorite(
            employer_id=user.id,
            candidate_id=candidate_id,
            created_at=datetime.now(timezone.utc),
        )
        db.session.add(fav)
        db.session.commit()
        return jsonify({"success": True, "favorited": True})


@candidates_bp.post("/favorites/sync")
@jwt_required()
def sync_favorites():
    """POST /api/candidates/favorites/sync
    body: { candidate_ids: [1,2,3] }
    用于前端迁移 localStorage → 后端，批量写入不存在的收藏记录，已有的跳过。
    返回 { synced: N, already_existed: M, favorited_ids: [...] }
    """
    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)
    if user.role != "employer":
        return _err("仅企业账号可同步收藏", 403)

    data = request.get_json(silent=True) or {}
    ids = data.get("candidate_ids", [])
    if not isinstance(ids, list):
        return _err("candidate_ids 必须为数组")

    from app.models.employer_candidate_favorite import EmployerCandidateFavorite
    from app.models.candidate import Candidate
    from datetime import datetime, timezone

    # 只保留实际存在的 candidate id
    valid_ids = {
        r.id for r in db.session.query(Candidate.id).filter(Candidate.id.in_(ids)).all()
    }
    existing_ids = {
        r.candidate_id
        for r in EmployerCandidateFavorite.query.filter_by(employer_id=user.id)
        .filter(EmployerCandidateFavorite.candidate_id.in_(valid_ids))
        .all()
    }

    now = datetime.now(timezone.utc)
    synced = 0
    for cid in valid_ids:
        if cid not in existing_ids:
            db.session.add(EmployerCandidateFavorite(
                employer_id=user.id, candidate_id=cid, created_at=now,
            ))
            synced += 1
    db.session.commit()

    all_fav_ids = [
        r.candidate_id
        for r in EmployerCandidateFavorite.query.filter_by(employer_id=user.id).all()
    ]
    return jsonify({
        "success": True,
        "synced": synced,
        "already_existed": len(existing_ids),
        "favorited_ids": all_fav_ids,
    })


@candidates_bp.get("/favorites")
@jwt_required()
def get_favorites():
    """GET /api/candidates/favorites — 返回该企业收藏的所有 candidate_id 列表"""
    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)
    if user.role != "employer":
        return _err("仅企业账号可查看收藏", 403)

    from app.models.employer_candidate_favorite import EmployerCandidateFavorite
    rows = EmployerCandidateFavorite.query.filter_by(employer_id=user.id).all()
    return jsonify({"success": True, "favorited_ids": [r.candidate_id for r in rows]})


# ── Email action constants ─────────────────────────────────────────────────────

_EMAIL_ACTION_WHITELIST = {"interview", "not_fit", "resume_update", "interview_address"}

_ACTION_TEMPLATES = {
    "interview": {
        "subject": "面试邀请 | ACE-Talent",
        "body": "您好 {name}，\n\n我们对您的背景很感兴趣，想邀请您进一步面试沟通。请您回复方便的面试时间。\n\n{company_name}\nACE-Talent",
    },
    "not_fit": {
        "subject": "岗位匹配结果通知 | ACE-Talent",
        "body": "您好 {name}，\n\n感谢您关注我们的岗位。综合当前岗位要求评估后，这次机会暂时不太匹配。后续如有更合适机会，我们会再联系您。\n\n{company_name}\nACE-Talent",
    },
    "resume_update": {
        "subject": "请更新您的简历信息 | ACE-Talent",
        "body": "您好 {name}，\n\n我们查看了您的档案，部分简历信息还需要补充或更新。请完善近期工作经历、项目经验、联系方式等内容，便于进一步沟通。\n\n{company_name}\nACE-Talent",
    },
    "interview_address": {
        "subject": "面试地址通知 | ACE-Talent",
        "body": "您好 {name}，\n\n面试地址如下：\n\n地址：请填写具体面试地址\n时间：请填写面试时间\n联系人：请填写联系人及电话\n\n请确认是否方便参加。\n\n{company_name}\nACE-Talent",
    },
}


@candidates_bp.post("/<int:candidate_id>/email-action")
@jwt_required()
def send_candidate_email_action(candidate_id):
    """POST /api/candidates/:id/email-action — 发送邮件动作给候选人并落库状态"""
    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)
    if user.role not in ("employer", "admin"):
        return _err("仅企业或管理员可发送候选人邮件", 403)

    data = request.get_json(silent=True) or {}
    action = data.get("action")
    job_id = data.get("job_id")
    thread_id = data.get("thread_id")

    if action not in _EMAIL_ACTION_WHITELIST:
        return _err(f"无效的 action，允许值：{', '.join(sorted(_EMAIL_ACTION_WHITELIST))}", 400)
    if not job_id:
        return _err("job_id 为必填项", 400)

    profile = get_candidate_by_id(candidate_id)
    if not profile:
        return _err("候选人不存在", 404)

    from app.models.job import Job
    job = db.session.get(Job, job_id)
    if not job:
        return _err("岗位不存在", 404)
    if user.role == "employer" and job.company_id != user.id:
        return _err("只能对自己发布的岗位发送邮件", 403)

    candidate_email = (profile.email or "").strip()
    if not candidate_email and profile.user:
        candidate_email = (profile.user.email or "").strip()
    if not candidate_email:
        return _err("候选人未配置邮箱，无法发送邮件", 422)

    candidate_name = profile.full_name or (profile.user.name if profile.user else None) or "候选人"
    company_name = user.company_name or user.name or "企业"

    tpl = _ACTION_TEMPLATES[action]
    subject = tpl["subject"]
    body = tpl["body"].format(name=candidate_name, company_name=company_name)

    # Upsert 状态记录
    from app.models.candidate_email_action import CandidateEmailAction
    from datetime import datetime, timezone
    record = CandidateEmailAction.query.filter_by(
        employer_id=user.id,
        candidate_id=candidate_id,
        job_id=job_id,
        action=action,
    ).first()

    if not record:
        record = CandidateEmailAction(
            employer_id=user.id,
            candidate_id=candidate_id,
            job_id=job_id,
            action=action,
        )
        db.session.add(record)

    record.status = "pending"
    record.thread_id = thread_id
    record.subject = subject
    record.body = body
    record.error_message = None
    db.session.commit()

    # 发送邮件
    from app.services.email_service import send_candidate_action_email
    try:
        send_candidate_action_email(candidate_email, candidate_name, company_name, action)
        record.status = "sent"
        record.sent_at = datetime.now(timezone.utc)
        record.error_message = None
        db.session.commit()
    except Exception as exc:
        record.status = "failed"
        record.error_message = str(exc)[:500]
        db.session.commit()
        return _err("邮件发送失败，请稍后重试", 500)

    return jsonify({
        "success": True,
        "message": "邮件已发送",
        "action": action,
        "status": "sent",
        "sent_at": record.sent_at.isoformat() if record.sent_at else None,
    })


@candidates_bp.get("/<int:candidate_id>/email-actions")
@jwt_required()
def get_candidate_email_actions(candidate_id):
    """GET /api/candidates/:id/email-actions?job_id=X — 查询邮件发送状态"""
    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)
    if user.role not in ("employer", "admin"):
        return _err("仅企业或管理员可查询邮件状态", 403)

    job_id = request.args.get("job_id", type=int)
    if not job_id:
        return _err("job_id 为必填项", 400)

    from app.models.candidate_email_action import CandidateEmailAction
    rows = CandidateEmailAction.query.filter_by(
        employer_id=user.id,
        candidate_id=candidate_id,
        job_id=job_id,
    ).all()

    # 补全四个 action 的状态，无记录时为 idle
    actions = {}
    for key in _EMAIL_ACTION_WHITELIST:
        actions[key] = {"status": "idle", "sent_at": None, "updated_at": None}
    for row in rows:
        actions[row.action] = {
            "status": row.status,
            "sent_at": row.sent_at.isoformat() if row.sent_at else None,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        }

    return jsonify({"success": True, "actions": actions})
