from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User
from app.models.job import Job

jobs_bp = Blueprint("jobs", __name__, url_prefix="/api/jobs")

VALID_STATUSES = {"draft", "published", "paused", "closed"}


def _err(msg, code=400):
    return jsonify({"success": False, "message": msg}), code


def _current_user():
    """从 JWT 取当前 User，不存在则返回 None。"""
    user_id = int(get_jwt_identity())
    return db.session.get(User, user_id)


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
    city = (data.get("city") or "").strip()
    description = (data.get("description") or "").strip()
    if not title:
        return _err("岗位名称不能为空")
    if not city:
        return _err("工作城市不能为空")
    if not description:
        return _err("岗位职责不能为空")

    salary_label = (data.get("salary_label") or "").strip() or None
    salary_min, salary_max = _parse_salary(salary_label)

    # 薪资合理性校验（有数字时才检查）
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

    job = Job(
        company_id=user.id,
        title=title,
        city=city,
        salary_min=salary_min,
        salary_max=salary_max,
        salary_label=salary_label,
        experience_required=(data.get("experience_required") or "").strip() or None,
        degree_required=(data.get("degree_required") or "").strip() or None,
        headcount=headcount,
        description=description,
        requirements=(data.get("requirements") or "").strip() or None,
        business_type=(data.get("business_type") or "").strip() or None,
        job_type=(data.get("job_type") or "").strip() or None,
        route_tags=data.get("route_tags") or [],
        skill_tags=data.get("skill_tags") or [],
        urgency_level=urgency_level,
        status=status,
    )
    db.session.add(job)
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
    q = request.args.get("q", "").strip()

    if city:
        query = query.filter(Job.city == city)
    if business_type:
        query = query.filter(Job.business_type == business_type)
    if job_type:
        query = query.filter(Job.job_type == job_type)
    if q:
        like = f"%{q}%"
        query = query.filter(
            db.or_(Job.title.ilike(like), Job.city.ilike(like))
        )

    jobs_list = query.order_by(Job.created_at.desc()).all()
    return jsonify({
        "success": True,
        "jobs": [j.to_dict() for j in jobs_list],
        "total": len(jobs_list),
    })


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

    return jsonify({"success": True, "job": job.to_dict()})


# ── 匹配引擎 ────────────────────────────────────────────────────────────────

def _extract_exp_min(exp_str):
    """从 '3年以上' '5年' 等字符串提取最小年限数字，失败返回 0。"""
    if not exp_str:
        return 0
    import re
    m = re.search(r"(\d+)", exp_str)
    return int(m.group(1)) if m else 0


def _compute_match(job, candidate) -> dict:
    """
    计算单个 (job, candidate) 对的匹配结果。
    返回 {score, matched_tags, score_breakdown, reason_list}

    评分维度（总分 100）：
      skill_tags  命中  40
      route_tags  命中  15
      business_type 匹配 12
      job_type    匹配   8
      city        匹配  10
      freshnss    鲜度  10
      experience  年限   5
    """
    breakdown = {}
    reasons = []
    matched_tags = []

    j_skill = set(job.skill_tags or [])
    j_route = set(job.route_tags or [])
    c_skill = set(candidate.skill_tags or [])
    c_route = set(candidate.route_tags or [])

    # 1. skill_tags（满分 40，每命中 1 个 +8）
    skill_hit = list(j_skill & c_skill)
    skill_score = min(len(skill_hit) * 8, 40)
    breakdown["skill_tags"] = skill_score
    matched_tags.extend(skill_hit)
    if skill_hit:
        reasons.append(f"技能标签命中 {len(skill_hit)} 项：{'、'.join(skill_hit[:4])}")

    # 2. route_tags（满分 15，每命中 1 个 +8）
    route_hit = list(j_route & c_route)
    route_score = min(len(route_hit) * 8, 15)
    breakdown["route_tags"] = route_score
    matched_tags.extend(route_hit)
    if route_hit:
        reasons.append(f"航线匹配：{'、'.join(route_hit)}")

    # 3. business_type（满分 12）
    bt_score = 0
    if job.business_type and candidate.business_type:
        if job.business_type == candidate.business_type:
            bt_score = 12
            reasons.append(f"业务方向一致：{job.business_type}")
    breakdown["business_type"] = bt_score

    # 4. job_type（满分 8）
    jt_score = 0
    if job.job_type and candidate.job_type:
        if job.job_type == candidate.job_type:
            jt_score = 8
            reasons.append(f"岗位类型匹配：{job.job_type}")
    breakdown["job_type"] = jt_score

    # 5. city（满分 10）
    city_score = 0
    if job.city:
        if candidate.current_city == job.city:
            city_score = 10
            reasons.append(f"当前城市匹配：{job.city}")
        elif candidate.expected_city == job.city:
            city_score = 7
            reasons.append(f"期望城市匹配：{job.city}")
    breakdown["city"] = city_score

    # 6. 档案鲜度（满分 10）
    fresh_score = 0
    fresh_days = candidate.freshness_days()
    if fresh_days <= 7:
        fresh_score = 10
        reasons.append(f"近 {fresh_days} 天内更新档案，活跃度高")
    elif fresh_days <= 14:
        fresh_score = 5
        reasons.append(f"近 {fresh_days} 天内更新档案")
    elif fresh_days <= 30:
        fresh_score = 2
    breakdown["freshness"] = fresh_score

    # 7. 经验年限（满分 5）
    exp_score = 0
    exp_min = _extract_exp_min(job.experience_required)
    if exp_min == 0:
        exp_score = 5
    elif candidate.experience_years is not None and candidate.experience_years >= exp_min:
        exp_score = 5
        reasons.append(f"{candidate.experience_years} 年经验满足要求（≥{exp_min}年）")
    breakdown["experience"] = exp_score

    total = min(sum(breakdown.values()), 100)

    return {
        "score": total,
        "matched_tags": list(set(matched_tags)),
        "score_breakdown": breakdown,
        "reason_list": reasons,
    }


@jobs_bp.get("/<int:job_id>/match")
@jwt_required()
def match_job(job_id):
    """
    计算并返回岗位匹配的候选人列表。
    每次调用重新计算（保证数据最新），结果 upsert 到 match_results 表。
    返回 score > 0 的结果，按 score DESC 排序。
    """
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

    now = datetime.now(timezone.utc)
    results = []

    for c in candidates_list:
        match = _compute_match(job, c)
        if match["score"] == 0:
            continue

        # Upsert match_results
        mr = MatchResult.query.filter_by(job_id=job.id, candidate_id=c.id).first()
        if mr:
            mr.score = match["score"]
            mr.matched_tags = match["matched_tags"]
            mr.score_breakdown = match["score_breakdown"]
            mr.reason_list = match["reason_list"]
            mr.updated_at = now
        else:
            mr = MatchResult(
                job_id=job.id,
                candidate_id=c.id,
                score=match["score"],
                matched_tags=match["matched_tags"],
                score_breakdown=match["score_breakdown"],
                reason_list=match["reason_list"],
            )
            db.session.add(mr)

        results.append({
            **mr.to_dict(),
            "candidate": _public_dict(c),
        })

    db.session.commit()
    results.sort(key=lambda r: r["score"], reverse=True)

    return jsonify({
        "success": True,
        "job": job.to_dict(),
        "matches": results,
        "total": len(results),
    })
