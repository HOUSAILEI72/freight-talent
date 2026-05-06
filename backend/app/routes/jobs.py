from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User
from app.models.job import Job
from app.models.junction_tags import JobTag

jobs_bp = Blueprint("jobs", __name__, url_prefix="/api/jobs")

VALID_STATUSES = {"draft", "published", "paused", "closed"}


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


@jobs_bp.post("")
@jwt_required()
def create_job():
    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)
    if user.role not in ("employer", "admin"):
        return _err("只有企业账号可以发布岗位", 403)

    data = request.get_json(silent=True) or {}

    # 必填校验
    title = (data.get("title") or "").strip()
    if not title:
        return _err("岗位名称不能为空")

    # ── Phase C: location_code mode (preferred) vs legacy city mode ────────
    # New mode: client sends location_code/name/path/type → validate via the
    # rule layer and let the back-end compute business_area_code/name.
    # Legacy mode: client only sends `city` → keep existing behaviour so the
    # current PostJob.jsx can still publish until Phase D.
    from app.utils.business_area import validate_location_payload

    location_code_raw = (data.get("location_code") or "").strip()
    legacy_city       = (data.get("city") or "").strip()

    location_dict = None  # set when running in new mode

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
        # Legacy `city` is required by the schema (NOT NULL). Reuse location_name.
        city = loc["location_name"]
    elif legacy_city:
        city = legacy_city
    else:
        return _err("工作城市不能为空")

    # description: 旧 PostJob 必填；新版改为非必填（Phase D 表单不收集）
    description = (data.get("description") or "").strip()
    if not location_code_raw and not description:
        # 旧 mode 仍然要求 description（保持当前 PostJob 行为）
        return _err("岗位职责不能为空")

    salary_label = (data.get("salary_label") or "").strip() or None

    # 优先接收前端直接传入的 salary_min/max；fallback 到 _parse_salary
    sm_raw = data.get("salary_min")
    sx_raw = data.get("salary_max")
    if sm_raw is not None or sx_raw is not None:
        try:
            salary_min = int(sm_raw) if sm_raw is not None else None
            salary_max = int(sx_raw) if sx_raw is not None else None
        except (ValueError, TypeError):
            return _err("salary_min / salary_max 必须为整数")
    else:
        salary_min, salary_max = _parse_salary(salary_label)

    if salary_min is not None and salary_max is not None and salary_min > salary_max:
        return _err("薪资最小值不能大于最大值")

    status = (data.get("status") or "published").strip()
    if status not in VALID_STATUSES:
        status = "published"

    # headcount / urgency_level 安全转换，非法值返回 400 而非 500
    try:
        headcount = int(data.get("headcount") or 1)
        if headcount < 1 or headcount > 9999:
            return _err("招聘人数请填写 1-9999 之间的整数")
    except (ValueError, TypeError):
        return _err("招聘人数格式不正确")

    try:
        urgency_level = int(data.get("urgency_level") or 2)
        if urgency_level not in (1, 2, 3):
            return _err("urgency_level 只能是 1（紧急）、2（普通）、3（不急）")
    except (ValueError, TypeError):
        return _err("urgency_level 格式不正确")

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

    # ── Phase C: function / management / skill arrays / salary structure ──
    function_code = (data.get("function_code") or "").strip() or None
    function_name = (data.get("function_name") or "").strip() or None

    is_management_role = data.get("is_management_role")
    if is_management_role is not None and not isinstance(is_management_role, bool):
        return _err("is_management_role 必须为布尔值")

    knowledge_arr,  k_err = _validate_tags(data.get("knowledge_requirements"),  "knowledge_requirements")
    if k_err: return _err(k_err)
    hard_skill_arr, h_err = _validate_tags(data.get("hard_skill_requirements"), "hard_skill_requirements")
    if h_err: return _err(h_err)
    soft_skill_arr, s_err = _validate_tags(data.get("soft_skill_requirements"), "soft_skill_requirements")
    if s_err: return _err(s_err)

    salary_months = data.get("salary_months")
    if salary_months is not None:
        try:
            salary_months = int(salary_months)
        except (ValueError, TypeError):
            return _err("salary_months 格式不正确")
        if salary_months not in (12, 13, 14):
            return _err("salary_months 只能是 12 / 13 / 14")

    average_bonus_percent = data.get("average_bonus_percent")
    if average_bonus_percent is not None:
        try:
            average_bonus_percent = float(average_bonus_percent)
        except (ValueError, TypeError):
            return _err("average_bonus_percent 格式不正确")
        if average_bonus_percent < 0 or average_bonus_percent > 100:
            return _err("average_bonus_percent 必须在 0-100 之间")

    has_year_end_bonus = data.get("has_year_end_bonus")
    if has_year_end_bonus is not None and not isinstance(has_year_end_bonus, bool):
        return _err("has_year_end_bonus 必须为布尔值")

    year_end_bonus_months = data.get("year_end_bonus_months")
    if has_year_end_bonus:
        if year_end_bonus_months is None:
            return _err("勾选年终奖时必须填写 year_end_bonus_months")
        try:
            year_end_bonus_months = float(year_end_bonus_months)
        except (ValueError, TypeError):
            return _err("year_end_bonus_months 格式不正确")
        if year_end_bonus_months < 0 or year_end_bonus_months > 24:
            return _err("year_end_bonus_months 必须在 0-24 之间")
    elif year_end_bonus_months is not None:
        # 未勾选 has_year_end_bonus 但传了月数，规整化为 None
        year_end_bonus_months = None

    # ── Compatibility: derive legacy province / city_name / district from
    # location_path "Great China/广东省/深圳市/南山区" so existing list
    # filters keep working until Phase D removes them. ────────────────────
    legacy_province = (data.get("province") or "").strip() or None
    legacy_city_nm  = (data.get("city_name") or "").strip() or None
    legacy_district = (data.get("district") or "").strip() or None

    if location_dict and location_dict["location_type"] == "mainland_china":
        path = location_dict["location_path"] or ""
        # path is like "Great China/X" or "Great China/X/Y" or "Great China/X/Y/Z"
        parts = [p for p in path.split("/") if p]
        if parts and parts[0] == "Great China":
            sub = parts[1:]
            if not legacy_province and len(sub) >= 1: legacy_province = sub[0]
            if not legacy_city_nm  and len(sub) >= 2: legacy_city_nm  = sub[1]
            if not legacy_district and len(sub) >= 3: legacy_district = sub[2]

    # business_type fallback: prefer explicit, else function_name
    business_type_val = (data.get("business_type") or "").strip() or function_name or None
    # job_type fallback: prefer explicit, else derive from is_management_role
    job_type_val = (data.get("job_type") or "").strip() or None
    if not job_type_val and is_management_role is not None:
        job_type_val = "管理" if is_management_role else "非管理"

    job = Job(
        company_id=user.id,
        title=title,
        city=city,
        province=legacy_province,
        city_name=legacy_city_nm,
        district=legacy_district,
        salary_min=salary_min,
        salary_max=salary_max,
        salary_label=salary_label,
        experience_required=(data.get("experience_required") or "").strip() or None,
        degree_required=(data.get("degree_required") or "").strip() or None,
        headcount=headcount,
        description=description or "",
        requirements=(data.get("requirements") or "").strip() or None,
        business_type=business_type_val,
        job_type=job_type_val,
        route_tags=route_tags_raw,
        skill_tags=skill_tags_raw,
        urgency_level=urgency_level,
        status=status,
        # Phase C standard location (only set when client sent location_code)
        location_code=location_dict["location_code"] if location_dict else None,
        location_name=location_dict["location_name"] if location_dict else None,
        location_path=location_dict["location_path"] if location_dict else None,
        location_type=location_dict["location_type"] if location_dict else None,
        business_area_code=location_dict["business_area_code"] if location_dict else None,
        business_area_name=location_dict["business_area_name"] if location_dict else None,
        # Phase C function / management / skill / salary
        function_code=function_code,
        function_name=function_name,
        is_management_role=is_management_role,
        knowledge_requirements=knowledge_arr,
        hard_skill_requirements=hard_skill_arr,
        soft_skill_requirements=soft_skill_arr,
        salary_months=salary_months,
        average_bonus_percent=average_bonus_percent,
        has_year_end_bonus=has_year_end_bonus,
        year_end_bonus_months=year_end_bonus_months,
    )
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

    city = request.args.get("city", "").strip()
    business_type = request.args.get("business_type", "").strip()
    job_type = request.args.get("job_type", "").strip()
    function_code = request.args.get("function_code", "").strip()
    business_area_code = request.args.get("business_area_code", "").strip()
    location_code_filter = request.args.get("location_code", "").strip()
    q = request.args.get("q", "").strip()
    tag_ids_raw = request.args.get("tag_ids", "").strip()

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

    jobs_list = query.order_by(Job.created_at.desc()).all()

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
        "total": len(jobs_list),
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

    job = db.session.get(Job, job_id)
    if not job:
        return _err("岗位不存在", 404)
    if user.role == "employer" and job.company_id != user.id:
        return _err("无权查看该岗位的匹配结果", 403)

    from app.models.candidate import Candidate
    from app.models.match_result import MatchResult
    from app.routes.candidates import _public_dict

    candidates_list = Candidate.query.filter_by(availability_status="open").all()

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
            "candidate": _public_dict(c),
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
