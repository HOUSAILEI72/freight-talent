from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User
from app.models.job import Job
from app.models.junction_tags import JobTag

jobs_bp = Blueprint("jobs", __name__, url_prefix="/api/jobs")

VALID_STATUSES = {"draft", "published", "paused", "closed"}
VALID_DEGREE_REQUIREMENTS = {"不限", "初中及以下", "高中", "大专", "本科", "硕士", "博士"}


def _err(msg, code=400):
    return jsonify({"success": False, "message": msg}), code


def _current_user():
    """从 JWT 取当前 User，不存在则返回 None。"""
    user_id = int(get_jwt_identity())
    return db.session.get(User, user_id)


def _load_job_tags_by_category(job_ids: list[int]) -> dict[int, dict[str, list[str]]]:
    """批量加载岗位的标签（active+pending），按分类聚合。"""
    if not job_ids:
        return {}
    rows = db.session.execute(
        db.text("""
            SELECT jt.job_id, t.category, t.name
            FROM job_tags jt
            JOIN tags t ON t.id = jt.tag_id
            WHERE jt.job_id IN :ids
              AND t.status IN ('active', 'pending')
            ORDER BY t.category, t.name
        """).bindparams(db.bindparam("ids", expanding=True)),
        {"ids": job_ids},
    ).fetchall()
    out: dict[int, dict[str, list[str]]] = {}
    for r in rows:
        out.setdefault(r.job_id, {}).setdefault(r.category, []).append(r.name)
    return out


def _parse_salary(label):
    """将 '20k-30k' 解析为 (20000, 30000)；'面议' 返回 (None, None)。"""
    if not label or label == "面议":
        return None, None
    try:
        parts = label.lower().replace("k", "000").split("-")
        lo = int(parts[0])
        hi = int(parts[1]) if len(parts) > 1 else lo
        return lo, hi
    except Exception:
        return None, None


def _sync_job_tags(job_id: int, tag_ids: list, now):
    """删旧写新 job_tags，tag_ids 为 int 列表。"""
    db.session.execute(
        db.text("DELETE FROM job_tags WHERE job_id = :jid"),
        {"jid": job_id},
    )
    for tid in tag_ids:
        if not isinstance(tid, int):
            continue
        db.session.execute(
            db.text(
                "INSERT IGNORE INTO job_tags (job_id, tag_id, created_at)"
                " VALUES (:jid, :tid, :now)"
            ),
            {"jid": job_id, "tid": tid, "now": now},
        )


def _build_job_fields(data):
    """
    Validate and parse a job create/update payload.
    Returns (fields_dict, error_response).  error_response is None on success.
    fields_dict maps Job model attribute names to values (excludes company_id/id/timestamps).
    """
    from app.utils.business_area import validate_location_payload

    title = (data.get("title") or "").strip()
    if not title:
        return None, _err("岗位名称不能为空")

    location_code_raw = (data.get("location_code") or "").strip()
    legacy_city       = (data.get("city") or "").strip()
    location_dict = None

    if location_code_raw:
        loc, loc_err = validate_location_payload({
            "location_code": location_code_raw,
            "location_name": (data.get("location_name") or "").strip(),
            "location_path": (data.get("location_path") or "").strip(),
            "location_type": (data.get("location_type") or "").strip(),
        })
        if loc_err:
            return None, _err(loc_err)
        location_dict = loc
        city = loc["location_name"]
    elif legacy_city:
        city = legacy_city
    else:
        return None, _err("工作城市不能为空")

    experience_required = (data.get("experience_required") or "").strip() or None
    if location_code_raw and not experience_required:
        return None, _err("经验要求不能为空")
    if experience_required:
        VALID_EXP = frozenset({"不限", "1年以内", "1-3年", "3-5年", "5-10年", "10年以上"})
        if experience_required not in VALID_EXP:
            exp_text = experience_required.replace(" ", "")
            if exp_text.endswith("年以上"):
                exp_num_text = exp_text[:-3]
            elif exp_text.endswith("年"):
                exp_num_text = exp_text[:-1]
            else:
                return None, _err("无效的经验要求，请选择：不限、1年以内、1-3年、3-5年、5-10年")
            try:
                exp_years = int(exp_num_text)
            except (ValueError, TypeError):
                return None, _err("无效的经验要求，请选择：不限、1年以内、1-3年、3-5年、5-10年")
            if exp_years < 0 or exp_years > 30:
                return None, _err("经验要求年数必须在 0-30 之间")
            experience_required = f"{exp_years}年"

    degree_required = (data.get("degree_required") or "").strip() or None
    if location_code_raw and not degree_required:
        return None, _err("学历要求不能为空")
    if degree_required and degree_required not in VALID_DEGREE_REQUIREMENTS:
        return None, _err("学历要求不在可选范围内")

    address = (data.get("address") or "").strip() or None
    if address and len(address) > 200:
        return None, _err("详细地址不能超过 200 个字符")

    description = (data.get("description") or "").strip()
    if not location_code_raw and not description:
        return None, _err("岗位职责不能为空")

    salary_label = (data.get("salary_label") or "").strip() or None

    sm_raw = data.get("salary_min")
    sx_raw = data.get("salary_max")
    if sm_raw is not None or sx_raw is not None:
        try:
            salary_min = int(sm_raw) if sm_raw is not None else None
            salary_max = int(sx_raw) if sx_raw is not None else None
        except (ValueError, TypeError):
            return None, _err("salary_min / salary_max 必须为整数")
    else:
        salary_min, salary_max = _parse_salary(salary_label)

    if salary_min is not None and salary_max is not None and salary_min > salary_max:
        return None, _err("薪资最小值不能大于最大值")

    status = (data.get("status") or "published").strip()
    if status not in VALID_STATUSES:
        status = "published"

    try:
        headcount = int(data.get("headcount") or 1)
        if headcount < 1 or headcount > 9999:
            return None, _err("招聘人数请填写 1-9999 之间的整数")
    except (ValueError, TypeError):
        return None, _err("招聘人数格式不正确")

    try:
        urgency_level = int(data.get("urgency_level") or 2)
        if urgency_level not in (1, 2, 3):
            return None, _err("urgency_level 只能是 1（紧急）、2（普通）、3（不急）")
    except (ValueError, TypeError):
        return None, _err("urgency_level 格式不正确")

    def _vtags(val, field_name):
        if val is None:
            return [], None
        if not isinstance(val, list):
            return None, f"{field_name} 必须为字符串数组"
        if not all(isinstance(t, str) for t in val):
            return None, f"{field_name} 的每个元素必须为字符串"
        return val, None

    route_tags_raw, route_err = _vtags(data.get("route_tags"), "route_tags")
    if route_err:
        return None, _err(route_err)
    skill_tags_raw, skill_err = _vtags(data.get("skill_tags"), "skill_tags")
    if skill_err:
        return None, _err(skill_err)

    function_code = (data.get("function_code") or "").strip() or None
    function_name = (data.get("function_name") or "").strip() or None

    is_management_role = data.get("is_management_role")
    if is_management_role is not None and not isinstance(is_management_role, bool):
        return None, _err("is_management_role 必须为布尔值")

    management_headcount = None
    raw_mhc = data.get("management_headcount")
    if is_management_role:
        if raw_mhc is None or str(raw_mhc).strip() == "":
            return None, _err("预计团队人数不能为空")
        raw_mhc_text = str(raw_mhc).strip()
        if not raw_mhc_text.isdigit():
            return None, _err("预计团队人数必须为纯数字")
        management_headcount = int(raw_mhc_text)
        if management_headcount <= 0 or management_headcount > 9999:
            return None, _err("预计团队人数必须是 1-9999 之间的数字")

    knowledge_arr,  k_err = _vtags(data.get("knowledge_requirements"),  "knowledge_requirements")
    if k_err: return None, _err(k_err)
    hard_skill_arr, h_err = _vtags(data.get("hard_skill_requirements"), "hard_skill_requirements")
    if h_err: return None, _err(h_err)
    soft_skill_arr, s_err = _vtags(data.get("soft_skill_requirements"), "soft_skill_requirements")
    if s_err: return None, _err(s_err)

    salary_months = data.get("salary_months")
    if salary_months is not None:
        try:
            salary_months = int(salary_months)
        except (ValueError, TypeError):
            return None, _err("salary_months 格式不正确")
        if salary_months not in (12, 13, 14):
            return None, _err("salary_months 只能是 12 / 13 / 14")

    average_bonus_percent = data.get("average_bonus_percent")
    if average_bonus_percent is not None:
        try:
            average_bonus_percent = float(average_bonus_percent)
        except (ValueError, TypeError):
            return None, _err("average_bonus_percent 格式不正确")
        if average_bonus_percent < 0 or average_bonus_percent > 100:
            return None, _err("average_bonus_percent 必须在 0-100 之间")

    commission_bonus_period = (data.get("commission_bonus_period") or "").strip() or None
    if commission_bonus_period and commission_bonus_period not in (
        "not_applicable", "monthly", "quarterly", "semi_annual"
    ):
        return None, _err("commission_bonus_period 必须是 not_applicable / monthly / quarterly / semi_annual")

    commission_bonus_amount = data.get("commission_bonus_amount")
    if commission_bonus_amount is not None:
        try:
            commission_bonus_amount = float(commission_bonus_amount)
        except (ValueError, TypeError):
            return None, _err("commission_bonus_amount 格式不正确")
        if commission_bonus_amount <= 0 or commission_bonus_amount > 99999999:
            return None, _err("commission_bonus_amount 必须在 0-99999999 之间")

    has_year_end_bonus = data.get("has_year_end_bonus")
    if has_year_end_bonus is not None and not isinstance(has_year_end_bonus, bool):
        return None, _err("has_year_end_bonus 必须为布尔值")

    year_end_bonus_months = data.get("year_end_bonus_months")
    if has_year_end_bonus:
        if year_end_bonus_months is None:
            return None, _err("勾选年终奖时必须填写 year_end_bonus_months")
        try:
            year_end_bonus_months = float(year_end_bonus_months)
        except (ValueError, TypeError):
            return None, _err("year_end_bonus_months 格式不正确")
        if year_end_bonus_months < 0 or year_end_bonus_months > 24:
            return None, _err("year_end_bonus_months 必须在 0-24 之间")
    elif year_end_bonus_months is not None:
        year_end_bonus_months = None

    legacy_province = (data.get("province") or "").strip() or None
    legacy_city_nm  = (data.get("city_name") or "").strip() or None
    legacy_district = (data.get("district") or "").strip() or None

    if location_dict and location_dict["location_type"] == "mainland_china":
        path = location_dict["location_path"] or ""
        parts = [p for p in path.split("/") if p]
        if parts and parts[0] == "China":
            sub = parts[1:]
            if not legacy_province and len(sub) >= 1: legacy_province = sub[0]
            if not legacy_city_nm  and len(sub) >= 2: legacy_city_nm  = sub[1]
            if not legacy_district and len(sub) >= 3: legacy_district = sub[2]

    business_type_val = (data.get("business_type") or "").strip() or function_name or None
    job_type_val = (data.get("job_type") or "").strip() or None
    if not job_type_val and is_management_role is not None:
        job_type_val = "管理" if is_management_role else "非管理"

    VALID_EMPLOYMENT_TYPES = frozenset({"全职", "兼职", "实习生"})
    employment_type = (data.get("employment_type") or "").strip() or None
    if location_code_raw and not employment_type:
        return None, _err("请选择应聘类型")
    if employment_type and employment_type not in VALID_EMPLOYMENT_TYPES:
        return None, _err("应聘类型只能是：全职、兼职、实习生")

    VALID_JOB_LEVELS = frozenset({"高管层", "总监级", "高级经理级", "经理级", "主管级", "专员级", "助理岗"})
    job_level = (data.get("job_level") or "").strip() or None
    if job_level and job_level not in VALID_JOB_LEVELS:
        return None, _err("职级层级不在可选范围内")

    benefits_raw, ben_err = _vtags(data.get("benefits"), "benefits")
    if ben_err:
        return None, ben_err

    fields = {
        "title":        title,
        "city":         city,
        "province":     legacy_province,
        "city_name":    legacy_city_nm,
        "district":     legacy_district,
        "salary_min":   salary_min,
        "salary_max":   salary_max,
        "salary_label": salary_label,
        "experience_required": experience_required,
        "degree_required":     degree_required,
        "headcount":    headcount,
        "description":  description or "",
        "requirements": (data.get("requirements") or "").strip() or None,
        "business_type": business_type_val,
        "job_type":      job_type_val,
        "route_tags":    route_tags_raw,
        "skill_tags":    skill_tags_raw,
        "urgency_level": urgency_level,
        "status":        status,
        "location_code": location_dict["location_code"] if location_dict else None,
        "location_name": location_dict["location_name"] if location_dict else None,
        "location_path": location_dict["location_path"] if location_dict else None,
        "location_type": location_dict["location_type"] if location_dict else None,
        "address":       address,
        "business_area_code": location_dict["business_area_code"] if location_dict else None,
        "business_area_name": location_dict["business_area_name"] if location_dict else None,
        "function_code": function_code,
        "function_name": function_name,
        "is_management_role":   is_management_role,
        "management_headcount": management_headcount,
        "knowledge_requirements":  knowledge_arr,
        "hard_skill_requirements": hard_skill_arr,
        "soft_skill_requirements": soft_skill_arr,
        "salary_months":          salary_months,
        "average_bonus_percent":  average_bonus_percent,
        "commission_bonus_period": commission_bonus_period,
        "commission_bonus_amount": commission_bonus_amount,
        "has_year_end_bonus":    has_year_end_bonus,
        "year_end_bonus_months": year_end_bonus_months,
        "employment_type": employment_type,
        "job_level":       job_level,
        "benefits":        benefits_raw,
    }
    return fields, None


@jobs_bp.post("")
@jwt_required()
def create_job():
    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)
    if user.role not in ("employer", "admin"):
        return _err("只有企业账号可以发布岗位", 403)

    # Phase 8: employer must have active subscription to post jobs.
    if user.role == "employer":
        from app.utils.subscription_access import subscription_gate
        _, sub_err = subscription_gate(user.id)
        if sub_err:
            return sub_err

        JOB_LIMIT = 5
        published_count = Job.query.filter_by(company_id=user.id, status="published").count()
        if published_count >= JOB_LIMIT:
            return _err(f"每个企业账号最多同时发布 {JOB_LIMIT} 个岗位，请关闭旧岗位后再发布", 400)

    data = request.get_json(silent=True) or {}
    fields, err = _build_job_fields(data)
    if err:
        return err

    job = Job(company_id=user.id, **fields)
    db.session.add(job)
    db.session.flush()  # 获取 job.id

    tag_ids = data.get("tag_ids")
    if isinstance(tag_ids, list):
        _sync_job_tags(job.id, tag_ids, datetime.now(timezone.utc))

    db.session.commit()
    return jsonify({"success": True, "job": job.to_dict()}), 201


@jobs_bp.get("/public")
@jwt_required()
def public_jobs():
    """
    GET /api/jobs/public — 所有已发布岗位（candidate / employer / admin 均可访问）
    Query params:
      city          精确匹配
      business_type 精确匹配
      job_type      精确匹配
      q             关键词，按 title / city 做 LIKE 模糊匹配
    """
    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)

    query = Job.query.filter_by(status="published")

    # employer 永远只能看到自己发布的岗位，与 ?own=1 参数无关
    if user.role == "employer":
        query = query.filter(Job.company_id == user.id)

    city = request.args.get("city", "").strip()
    business_type = request.args.get("business_type", "").strip()
    job_type = request.args.get("job_type", "").strip()
    function_code = request.args.get("function_code", "").strip()
    business_area_code = request.args.get("business_area_code", "").strip()
    location_code_filter = request.args.get("location_code", "").strip()
    q = request.args.get("q", "").strip()
    tag_ids_raw = request.args.get("tag_ids", "").strip()
    employment_type_filter = request.args.get("employment_type", "").strip()

    if city:
        query = query.filter(Job.city == city)
    if business_type:
        query = query.filter(Job.business_type == business_type)
    if job_type:
        query = query.filter(Job.job_type == job_type)
    if function_code:
        query = query.filter(Job.function_code == function_code)
    if business_area_code:
        query = query.filter(Job.business_area_code == business_area_code)
    if employment_type_filter:
        query = query.filter(Job.employment_type == employment_type_filter)
    if location_code_filter:
        from app.utils.business_area import location_filter_clause
        clause = location_filter_clause(
            Job.location_code, Job.business_area_code, location_code_filter
        )
        if clause is not None:
            query = query.filter(clause)
    if q:
        like = f"%{q}%"
        query = query.filter(
            db.or_(
                Job.title.ilike(like),
                Job.city.ilike(like),
                Job.location_name.ilike(like),
                Job.location_path.ilike(like),
                Job.address.ilike(like),
                Job.function_name.ilike(like),
            )
        )
    if tag_ids_raw:
        ids = [int(x) for x in tag_ids_raw.split(",") if x.strip().isdigit()]
        if ids:
            query = (
                query
                .join(JobTag, JobTag.job_id == Job.id)
                .filter(JobTag.tag_id.in_(ids))
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
                db.session.query(JobTag.job_id)
                .filter(JobTag.job_id == Job.id, JobTag.tag_id.in_(grp))
            )
            query = query.filter(sub.exists())

    try:
        page      = max(1, int(request.args.get("page", 1)))
        page_size = max(1, min(int(request.args.get("page_size", 20)), 500))
    except (ValueError, TypeError):
        page, page_size = 1, 20

    total = query.count()
    total_pages = max(1, (total + page_size - 1) // page_size)
    page = min(page, total_pages)
    jobs_list = query.order_by(Job.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    # 注入按分类聚合的标签（含 pending）
    tag_map = _load_job_tags_by_category([j.id for j in jobs_list])

    out = []
    for j in jobs_list:
        d = j.to_dict()
        d["tags_by_category"] = tag_map.get(j.id, {})
        out.append(d)

    return jsonify({
        "success": True,
        "jobs": out,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    })


@jobs_bp.get("/area-filters")
@jwt_required()
def area_filters_jobs():
    """GET /api/jobs/area-filters

    Returns published-job counts grouped by business_area_code, ordered to
    match the front-end's DEFAULT_AREA_FILTERS, with any unknown codes
    appended at the end. Codes that have zero jobs are NOT returned, except
    that the canonical default order is preserved for codes that are.
    """
    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)

    from app.utils.business_area import BUSINESS_AREAS

    rows = (
        db.session.query(Job.business_area_code, db.func.count(Job.id))
        .filter(Job.status == "published")
        .filter(Job.business_area_code.isnot(None))
        .group_by(Job.business_area_code)
        .all()
    )
    counts = {code: cnt for code, cnt in rows}

    # Default canonical order (matches src/utils/businessArea.js DEFAULT_AREA_FILTERS).
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
    # Append any unknown / non-default codes (CENTRAL_CHINA / REMOTE / future)
    for code, cnt in counts.items():
        if code in seen:
            continue
        name = BUSINESS_AREAS.get(code, {}).get("name", code)
        out.append({"code": code, "name": name, "count": cnt})
    return jsonify({"success": True, "filters": out})


@jobs_bp.get("/my")
@jwt_required()
def my_jobs():
    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)
    if user.role not in ("employer", "admin"):
        return _err("只有企业账号可以查看自己的岗位", 403)

    jobs = (
        Job.query
        .filter_by(company_id=user.id)
        .order_by(Job.created_at.desc())
        .all()
    )
    return jsonify({"success": True, "jobs": [j.to_dict() for j in jobs]})


@jobs_bp.patch("/<int:job_id>/status")
@jwt_required()
def update_job_status(job_id):
    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)
    if user.role not in ("employer", "admin"):
        return _err("无权操作", 403)

    job = db.session.get(Job, job_id)
    if not job:
        return _err("岗位不存在", 404)
    if user.role == "employer" and job.company_id != user.id:
        return _err("无权操作该岗位", 403)

    data = request.get_json(silent=True) or {}
    new_status = (data.get("status") or "").strip()
    if new_status not in ("published", "closed", "paused"):
        return _err("status 只允许 published / closed / paused")

    job.status = new_status
    db.session.commit()
    return jsonify({"success": True, "job": job.to_dict()})


@jobs_bp.get("/<int:job_id>")
@jwt_required()
def get_job(job_id):
    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)

    job = db.session.get(Job, job_id)
    if not job:
        return _err("岗位不存在", 404)

    # candidate 只能看 published 岗位；employer 只能看自己的；admin 不限
    if user.role == "candidate" and job.status != "published":
        return _err("岗位不存在", 404)
    if user.role == "employer" and job.company_id != user.id:
        return _err("无权查看该岗位", 403)

    d = job.to_dict()
    d["tags_by_category"] = _load_job_tags_by_category([job.id]).get(job.id, {})
    return jsonify({"success": True, "job": d})


# ── 匹配引擎 ────────────────────────────────────────────────────────────────

@jobs_bp.get("/<int:job_id>/match")
@jwt_required()
def match_job(job_id):
    """
    计算并返回岗位匹配的候选人列表。
    每次调用重新计算（保证数据最新），结果 upsert 到 match_results 表。
    返回 score > 0 的结果，按 score DESC 排序。
    """
    from app.services.matching import compute_match

    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)
    if user.role not in ("employer", "admin"):
        return _err("仅企业或管理员可查看匹配结果", 403)

    # Phase 8: employer must have active subscription to run match.
    if user.role == "employer":
        from app.utils.subscription_access import subscription_gate
        _, sub_err = subscription_gate(user.id)
        if sub_err:
            return sub_err

    job = db.session.get(Job, job_id)
    if not job:
        return _err("岗位不存在", 404)
    if user.role == "employer" and job.company_id != user.id:
        return _err("无权查看该岗位的匹配结果", 403)

    from app.models.candidate import Candidate
    from app.models.match_result import MatchResult
    from app.modules.candidates.serializers import build_public_dict as _public_dict

    candidates_list = Candidate.query.filter_by(availability_status="open").all()

    # Phase 8: pre-compute which candidates this employer can fully see.
    if user.role == "employer":
        from app.utils.subscription_access import employer_unlocked_candidate_ids
        cand_ids_all = [c.id for c in candidates_list]
        unlocked_ids = employer_unlocked_candidate_ids(user.id, cand_ids_all)
    else:
        # admin sees all
        unlocked_ids = {c.id for c in candidates_list}

    # 一次性取出该岗位已有的所有 match_results，避免循环内单条查询（N+1）
    existing_mrs = {
        mr.candidate_id: mr
        for mr in MatchResult.query.filter_by(job_id=job.id).all()
    }

    now = datetime.now(timezone.utc)
    results = []
    new_mrs = []

    for c in candidates_list:
        match = compute_match(job, c)
        if match["score"] == 0:
            continue

        mr = existing_mrs.get(c.id)
        if mr:
            mr.score          = match["score"]
            mr.matched_tags   = match["matched_tags"]
            mr.score_breakdown = match["score_breakdown"]
            mr.reason_list    = match["reason_list"]
            mr.updated_at     = now
        else:
            mr = MatchResult(
                job_id         = job.id,
                candidate_id   = c.id,
                score          = match["score"],
                matched_tags   = match["matched_tags"],
                score_breakdown = match["score_breakdown"],
                reason_list    = match["reason_list"],
            )
            new_mrs.append(mr)

        results.append({
            **{
                "id":             mr.id,
                "job_id":         mr.job_id if mr.id else job.id,
                "candidate_id":   c.id,
                "score":          match["score"],
                "matched_tags":   match["matched_tags"],
                "score_breakdown": match["score_breakdown"],
                "reason_list":    match["reason_list"],
                "created_at":     (mr.created_at.isoformat() if mr.created_at else None),
                "updated_at":     now.isoformat(),
            },
            "candidate": _public_dict(
                c,
                include_private=(c.id in unlocked_ids),
                include_contact=(c.id in unlocked_ids),
            ),
        })

    if new_mrs:
        db.session.add_all(new_mrs)
    db.session.commit()
    results.sort(key=lambda r: r["score"], reverse=True)

    return jsonify({
        "success": True,
        "job": job.to_dict(),
        "matches": results,
        "total": len(results),
    })


# ── 岗位编辑 / 删除 / 模板 ────────────────────────────────────────────────────

@jobs_bp.patch("/<int:job_id>")
@jwt_required()
def update_job(job_id):
    """PATCH /api/jobs/<id> — 编辑岗位（employer/admin）"""
    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)
    if user.role not in ("employer", "admin"):
        return _err("无权操作", 403)

    job = db.session.get(Job, job_id)
    if not job:
        return _err("岗位不存在", 404)
    if user.role == "employer" and job.company_id != user.id:
        return _err("无权操作该岗位", 403)

    data = request.get_json(silent=True) or {}
    fields, err = _build_job_fields(data)
    if err:
        return err

    # 不改 status，除非 payload 明确携带
    if "status" not in data:
        fields.pop("status", None)

    for k, v in fields.items():
        setattr(job, k, v)

    tag_ids = data.get("tag_ids")
    if isinstance(tag_ids, list):
        _sync_job_tags(job.id, tag_ids, datetime.now(timezone.utc))

    db.session.commit()
    return jsonify({"success": True, "job": job.to_dict()})


@jobs_bp.delete("/<int:job_id>")
@jwt_required()
def delete_job(job_id):
    """DELETE /api/jobs/<id> — 物理删除岗位（employer/admin）"""
    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)
    if user.role not in ("employer", "admin"):
        return _err("无权操作", 403)

    job = db.session.get(Job, job_id)
    if not job:
        return _err("岗位不存在", 404)
    if user.role == "employer" and job.company_id != user.id:
        return _err("无权操作该岗位", 403)

    # 用原生 SQL DELETE 让 MySQL 自己触发 ON DELETE CASCADE，
    # 避免 SQLAlchemy ORM 先将子行 FK 置 NULL 导致 NOT NULL 报错。
    db.session.execute(db.text("DELETE FROM jobs WHERE id = :jid"), {"jid": job_id})
    db.session.commit()
    return jsonify({"success": True})


@jobs_bp.patch("/<int:job_id>/template")
@jwt_required()
def set_job_template(job_id):
    """PATCH /api/jobs/<id>/template — 设为/取消模板（employer/admin）"""
    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)
    if user.role not in ("employer", "admin"):
        return _err("无权操作", 403)

    job = db.session.get(Job, job_id)
    if not job:
        return _err("岗位不存在", 404)
    if user.role == "employer" and job.company_id != user.id:
        return _err("无权操作该岗位", 403)

    data = request.get_json(silent=True) or {}
    is_template = data.get("is_template")
    if not isinstance(is_template, bool):
        return _err("is_template 必须为布尔值")

    job.is_template = is_template
    db.session.commit()
    return jsonify({"success": True, "job": job.to_dict()})


@jobs_bp.get("/templates")
@jwt_required()
def get_job_templates():
    """GET /api/jobs/templates — 当前企业自己的模板岗位列表（employer/admin）"""
    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)
    if user.role not in ("employer", "admin"):
        return _err("无权操作", 403)

    company_id = user.id if user.role == "employer" else None
    query = Job.query.filter_by(is_template=True)
    if company_id:
        query = query.filter_by(company_id=company_id)
    jobs_list = query.order_by(Job.updated_at.desc()).all()
    return jsonify({"success": True, "jobs": [j.to_dict() for j in jobs_list]})
