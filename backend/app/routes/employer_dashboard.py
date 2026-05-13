"""
企业 Dashboard 图表 API

X 轴是时间，Function/Area 是筛选条件。
统计候选人数量随时间变化。
"""
from collections import defaultdict
from datetime import date, datetime, timezone, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func as sa_func, or_

from app.extensions import db
from app.models.invitation import Invitation
from app.models.job import Job
from app.models.job_application import JobApplication
from app.models.user import User


employer_dashboard_bp = Blueprint(
    "employer_dashboard",
    __name__,
    url_prefix="/api/employer",
)

ALL_VALUE = "ALL"
DEFAULT_REGION_VALUE = "GREAT_CHINA"

GREAT_CHINA_AREA_CODES = (
    "GREAT_CHINA",
    "EAST_CHINA",
    "NORTH_CHINA",
    "SOUTH_CHINA",
    "WEST_CHINA",
    "CENTRAL_CHINA",
    "HONG_KONG",
    "TAIWAN",
    "MACAU",
)


def _is_default_region(region_value):
    return region_value in (ALL_VALUE, DEFAULT_REGION_VALUE)


def _is_paid_filter(function_value, region_value):
    # China 是默认免费区域，不触发订阅 gate
    return function_value != ALL_VALUE or not _is_default_region(region_value)


# Area 显示名到 business_area_code 的映射
AREA_NAME_TO_CODE = {
    'China': 'GREAT_CHINA',
    'Great China': 'GREAT_CHINA',
    'East China': 'EAST_CHINA',
    'South China': 'SOUTH_CHINA',
    'North China': 'NORTH_CHINA',
    'Central China': 'CENTRAL_CHINA',
    'West China': 'WEST_CHINA',
    'Hong Kong': 'HONG_KONG',
    'Taiwan': 'TAIWAN',
    'Macau': 'MACAU',
    'Southeast Asia': 'SOUTHEAST_ASIA',
    'Northeast Asia': 'NORTHEAST_ASIA',
    'Europe': 'EUROPE',
    'North America': 'NORTH_AMERICA',
    'Latin America': 'LATIN_AMERICA',
    'Middle East': 'MIDDLE_EAST',
    'Africa': 'AFRICA',
    'Oceania': 'OCEANIA',
}


def _err(message, code=400):
    return jsonify({"success": False, "message": message}), code


def _current_employer():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user or not user.is_active:
        return None, _err("用户不存在", 404)
    if user.role != "employer":
        return None, _err("仅企业账号可访问", 403)
    return user, None


def _clean(value):
    if value is None:
        return ""
    return str(value).strip()


def _sorted_values(values):
    return sorted(v for v in values if v)


def _normalize_area_value(raw):
    """把 area 显示名映射到 business_area_code"""
    if not raw or raw == ALL_VALUE:
        return ALL_VALUE
    raw_upper = raw.upper()
    if raw_upper == ALL_VALUE:
        return ALL_VALUE
    # 如果直接传的是 code（大写含下划线），直接用
    if '_' in raw or raw.isupper():
        return raw_upper
    # 否则按显示名映射
    return AREA_NAME_TO_CODE.get(raw, raw_upper)


def _period_key(dt, granularity):
    """根据粒度生成 period key 和 label"""
    if not dt:
        return None, None
    if granularity == 'day':
        return dt.strftime('%Y-%m-%d'), dt.strftime('%m-%d')
    elif granularity == 'week':
        iso_year, iso_week, _ = dt.isocalendar()
        return f"{iso_year}-W{iso_week:02d}", f"W{iso_week:02d}"
    elif granularity == 'month':
        return dt.strftime('%Y-%m'), dt.strftime('%Y-%m')
    elif granularity == 'quarter':
        quarter = (dt.month - 1) // 3 + 1
        return f"{dt.year}-Q{quarter}", f"{dt.year} Q{quarter}"
    elif granularity == 'year':
        return str(dt.year), str(dt.year)
    # fallback
    return dt.strftime('%Y-%m-%d'), dt.strftime('%m-%d')


def _generate_periods(granularity):
    """生成最近 N 个完整周期作为 X 轴"""
    now = datetime.now(timezone.utc)
    periods = []
    if granularity == 'day':
        # 最近 14 天
        for i in range(13, -1, -1):
            dt = now - timedelta(days=i)
            key, label = _period_key(dt, granularity)
            periods.append((key, label))
    elif granularity == 'week':
        # 最近 12 周
        for i in range(11, -1, -1):
            dt = now - timedelta(weeks=i)
            key, label = _period_key(dt, granularity)
            periods.append((key, label))
    elif granularity == 'month':
        # 最近 12 个月
        year, month = now.year, now.month
        for i in range(11, -1, -1):
            m = month - i
            y = year
            while m <= 0:
                m += 12
                y -= 1
            dt = datetime(y, m, 1, tzinfo=timezone.utc)
            key, label = _period_key(dt, granularity)
            periods.append((key, label))
    elif granularity == 'quarter':
        # 最近 8 个季度
        current_quarter = (now.month - 1) // 3 + 1
        year = now.year
        for i in range(7, -1, -1):
            q = current_quarter - i
            y = year
            while q <= 0:
                q += 4
                y -= 1
            dt = datetime(y, (q - 1) * 3 + 1, 1, tzinfo=timezone.utc)
            key, label = _period_key(dt, granularity)
            periods.append((key, label))
    elif granularity == 'year':
        # 最近 5 年
        for i in range(4, -1, -1):
            dt = datetime(now.year - i, 1, 1, tzinfo=timezone.utc)
            key, label = _period_key(dt, granularity)
            periods.append((key, label))

    return periods


def _load_candidates_with_time(function_value, region_value):
    """加载符合筛选条件的候选人，返回 [(time_field, ...), ...]"""
    sql_parts = [
        """
        SELECT id, function_code, business_type, business_area_code,
               profile_confirmed_at, created_at
        FROM candidates
        WHERE availability_status IN ('open', 'passive')
        """
    ]
    params = {}

    if function_value != ALL_VALUE:
        # 优先按 function_code 过滤，fallback business_type
        sql_parts.append(" AND (function_code = :func OR business_type = :func)")
        params['func'] = function_value

    if region_value == DEFAULT_REGION_VALUE:
        placeholders = ', '.join(f':area_{i}' for i in range(len(GREAT_CHINA_AREA_CODES)))
        sql_parts.append(f" AND business_area_code IN ({placeholders})")
        for i, code in enumerate(GREAT_CHINA_AREA_CODES):
            params[f'area_{i}'] = code
    elif region_value != ALL_VALUE:
        sql_parts.append(" AND business_area_code = :area")
        params['area'] = region_value

    sql = ''.join(sql_parts)
    try:
        rows = db.session.execute(db.text(sql), params).fetchall()
    except Exception:
        # fallback: 如果表缺少字段（老库），返回空
        return []
    return rows


def _time_series_bars(function_value, region_value, granularity):
    """按时间粒度聚合候选人数量"""
    periods = _generate_periods(granularity)
    candidates = _load_candidates_with_time(function_value, region_value)

    # 初始化每个 period 的计数为 0
    counter = {key: 0 for key, _ in periods}

    for row in candidates:
        # 优先用 profile_confirmed_at，fallback created_at
        dt = row.profile_confirmed_at or row.created_at
        if not dt:
            continue
        # 确保有时区
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        key, _ = _period_key(dt, granularity)
        if key in counter:
            counter[key] += 1

    bars = [
        {"period": key, "period_label": label, "count": counter.get(key, 0)}
        for key, label in periods
    ]
    total = sum(bar['count'] for bar in bars)

    return {
        "bars": bars,
        "total": total,
    }


def _apply_job_filters(query, function_value, region_value):
    """Apply the dashboard Function/Area filters to Job-backed metrics."""
    if function_value != ALL_VALUE:
        query = query.filter(or_(
            Job.function_code == function_value,
            Job.business_type == function_value,
        ))

    if region_value == DEFAULT_REGION_VALUE:
        query = query.filter(Job.business_area_code.in_(GREAT_CHINA_AREA_CODES))
    elif region_value != ALL_VALUE:
        query = query.filter(Job.business_area_code == region_value)

    return query


def _count_employer_jobs(employer_id, function_value, region_value):
    try:
        query = db.session.query(sa_func.count(Job.id)).filter(Job.company_id == employer_id)
        query = _apply_job_filters(query, function_value, region_value)
        return int(query.scalar() or 0)
    except Exception:
        return 0


def _count_received_applications(employer_id, function_value, region_value):
    try:
        query = (
            db.session.query(sa_func.count(JobApplication.id))
            .join(Job, Job.id == JobApplication.job_id)
            .filter(JobApplication.employer_id == employer_id)
        )
        query = _apply_job_filters(query, function_value, region_value)
        return int(query.scalar() or 0)
    except Exception:
        return 0


def _count_interested_candidates(employer_id, function_value, region_value):
    """Count distinct candidates who applied OR accepted an invitation from this employer."""
    try:
        # Candidates who submitted applications to this employer's jobs
        applied = (
            db.session.query(JobApplication.candidate_id)
            .join(Job, Job.id == JobApplication.job_id)
            .filter(JobApplication.employer_id == employer_id)
        )
        applied = _apply_job_filters(applied, function_value, region_value)

        # Candidates who accepted invitations from this employer
        invited = (
            db.session.query(Invitation.candidate_id)
            .join(Job, Job.id == Invitation.job_id)
            .filter(
                Invitation.employer_id == employer_id,
                Invitation.status == 'accepted',
            )
        )
        invited = _apply_job_filters(invited, function_value, region_value)

        union_query = applied.union(invited)
        count = db.session.query(sa_func.count(sa_func.distinct(
            union_query.subquery().c.candidate_id
        ))).scalar()
        return int(count or 0)
    except Exception:
        return 0


# ── Trend summary helpers ──────────────────────────────────────────────────

# Asia/Shanghai is always UTC+8 (no DST)
_SHANGHAI_TZ = timezone(timedelta(hours=8))


def _checkpoint_pair(now=None):
    """Return (current_checkpoint, previous_checkpoint) as date objects in Asia/Shanghai."""
    if now is None:
        now = datetime.now(_SHANGHAI_TZ)
    elif now.tzinfo is None:
        now = now.replace(tzinfo=_SHANGHAI_TZ)

    today = now.date()
    day = today.day
    year = today.year
    month = today.month

    if day >= 20:
        current = date(year, month, 20)
        previous = date(year, month, 10)
    elif day >= 10:
        current = date(year, month, 10)
        previous = date(year - 1, 12, 20) if month == 1 else date(year, month - 1, 20)
    else:
        if month == 1:
            current = date(year - 1, 12, 20)
            previous = date(year - 1, 12, 10)
        else:
            current = date(year, month - 1, 20)
            previous = date(year, month - 1, 10)

    return current, previous


def _checkpoint_cutoff_utc(date_obj):
    """23:59:59 Asia/Shanghai on date_obj, converted to UTC naive for MySQL comparison."""
    shanghai_end = datetime(
        date_obj.year, date_obj.month, date_obj.day, 23, 59, 59,
        tzinfo=_SHANGHAI_TZ,
    )
    utc_dt = shanghai_end.astimezone(timezone.utc)
    return utc_dt.replace(tzinfo=None)  # MySQL stores UTC naive


def _count_platform_candidates_as_of(function_value, region_value, cutoff_naive):
    """全平台候选人数（as-of 统计点），不限 company_id。"""
    sql_parts = [
        """
        SELECT COUNT(*) FROM candidates
        WHERE availability_status IN ('open', 'passive')
          AND COALESCE(profile_confirmed_at, created_at) <= :cutoff
        """
    ]
    params = {'cutoff': cutoff_naive}

    if function_value != ALL_VALUE:
        sql_parts.append(" AND (function_code = :func OR business_type = :func)")
        params['func'] = function_value

    if region_value == DEFAULT_REGION_VALUE:
        placeholders = ', '.join(f':area_{i}' for i in range(len(GREAT_CHINA_AREA_CODES)))
        sql_parts.append(f" AND business_area_code IN ({placeholders})")
        for i, code in enumerate(GREAT_CHINA_AREA_CODES):
            params[f'area_{i}'] = code
    elif region_value != ALL_VALUE:
        sql_parts.append(" AND business_area_code = :area")
        params['area'] = region_value

    try:
        result = db.session.execute(db.text(''.join(sql_parts)), params).scalar()
        return int(result or 0)
    except Exception:
        return 0


def _count_platform_jobs_as_of(function_value, region_value, cutoff_naive):
    """全平台已发布岗位数（as-of 统计点），不限 company_id。"""
    sql_parts = [
        """
        SELECT COUNT(*) FROM jobs
        WHERE status = 'published'
          AND created_at <= :cutoff
        """
    ]
    params = {'cutoff': cutoff_naive}

    if function_value != ALL_VALUE:
        sql_parts.append(" AND (function_code = :func OR business_type = :func)")
        params['func'] = function_value

    if region_value == DEFAULT_REGION_VALUE:
        placeholders = ', '.join(f':area_{i}' for i in range(len(GREAT_CHINA_AREA_CODES)))
        sql_parts.append(f" AND business_area_code IN ({placeholders})")
        for i, code in enumerate(GREAT_CHINA_AREA_CODES):
            params[f'area_{i}'] = code
    elif region_value != ALL_VALUE:
        sql_parts.append(" AND business_area_code = :area")
        params['area'] = region_value

    try:
        result = db.session.execute(db.text(''.join(sql_parts)), params).scalar()
        return int(result or 0)
    except Exception:
        return 0


def _trend_payload(current, previous):
    delta = current - previous
    if previous > 0:
        percent = round(delta / previous * 100, 2)
    else:
        percent = 0.0
    direction = 'up' if delta > 0 else ('down' if delta < 0 else 'neutral')
    return {
        'current': current,
        'previous': previous,
        'delta': delta,
        'percent': percent,
        'direction': direction,
    }


@employer_dashboard_bp.get("/dashboard-trend-summary")
@jwt_required()
def dashboard_trend_summary():
    user, err = _current_employer()
    if err:
        return err

    function_value = _clean(request.args.get("function")) or ALL_VALUE
    region_value = _clean(request.args.get("region")) or ALL_VALUE

    if function_value.upper() == ALL_VALUE:
        function_value = ALL_VALUE
    region_value = _normalize_area_value(region_value)

    if _is_paid_filter(function_value, region_value):
        from app.utils.subscription_access import subscription_scope_gate
        _, sub_err = subscription_scope_gate(user.id, function_value, region_value)
        if sub_err:
            return sub_err

    current_cp, previous_cp = _checkpoint_pair()
    current_cutoff = _checkpoint_cutoff_utc(current_cp)
    previous_cutoff = _checkpoint_cutoff_utc(previous_cp)

    cand_current = _count_platform_candidates_as_of(function_value, region_value, current_cutoff)
    cand_previous = _count_platform_candidates_as_of(function_value, region_value, previous_cutoff)

    jobs_current = _count_platform_jobs_as_of(function_value, region_value, current_cutoff)
    jobs_previous = _count_platform_jobs_as_of(function_value, region_value, previous_cutoff)

    return jsonify({
        "success": True,
        "function": function_value,
        "region": region_value,
        "current_checkpoint": current_cp.isoformat(),
        "previous_checkpoint": previous_cp.isoformat(),
        "timezone": "Asia/Shanghai",
        "cards": {
            "candidates": {
                "label": "PLATFORM CANDIDATES",
                **_trend_payload(cand_current, cand_previous),
            },
            "jobs": {
                "label": "PLATFORM JOBS",
                **_trend_payload(jobs_current, jobs_previous),
            },
        },
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })


@employer_dashboard_bp.get("/dashboard-filters")
@jwt_required()
def dashboard_filters():
    user, err = _current_employer()
    if err:
        return err

    # 简化的 filter 列表：返回所有 function_code 和 business_area_code
    try:
        func_rows = db.session.execute(db.text("""
            SELECT DISTINCT function_code FROM candidates
            WHERE function_code IS NOT NULL AND function_code <> ''
        """)).fetchall()
        functions = _sorted_values([r.function_code for r in func_rows])
    except Exception:
        functions = []

    try:
        area_rows = db.session.execute(db.text("""
            SELECT DISTINCT business_area_code FROM candidates
            WHERE business_area_code IS NOT NULL AND business_area_code <> ''
        """)).fetchall()
        regions = _sorted_values([r.business_area_code for r in area_rows])
    except Exception:
        regions = []

    return jsonify({
        "success": True,
        "functions": functions,
        "regions": regions,
    })


@employer_dashboard_bp.get("/dashboard-chart")
@jwt_required()
def dashboard_chart():
    user, err = _current_employer()
    if err:
        return err

    function_value = _clean(request.args.get("function")) or ALL_VALUE
    region_value = _clean(request.args.get("region")) or ALL_VALUE
    granularity = _clean(request.args.get("granularity")) or 'day'

    if function_value.upper() == ALL_VALUE:
        function_value = ALL_VALUE
    # 规范化 area 值
    region_value = _normalize_area_value(region_value)

    # China 是默认免费区域；只有非默认筛选才触发订阅 gate
    if _is_paid_filter(function_value, region_value):
        from app.utils.subscription_access import subscription_scope_gate
        _, sub_err = subscription_scope_gate(user.id, function_value, region_value)
        if sub_err:
            return sub_err

    # 规范化 granularity
    valid_granularities = ('day', 'week', 'month', 'quarter', 'year')
    if granularity not in valid_granularities:
        granularity = 'day'

    result = _time_series_bars(function_value, region_value, granularity)
    stats = {
        "applications_received": _count_received_applications(user.id, function_value, region_value),
        "jobs": _count_employer_jobs(user.id, function_value, region_value),
        "interested": _count_interested_candidates(user.id, function_value, region_value),
    }

    return jsonify({
        "success": True,
        "function": function_value,
        "region": region_value,
        "granularity": granularity,
        "bars": result["bars"],
        "total": result["total"],
        "stats": stats,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
