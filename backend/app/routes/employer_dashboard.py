"""
企业 Dashboard 图表 API

X 轴是时间，Function/Area 是筛选条件。
统计候选人数量随时间变化。
"""
from datetime import date, datetime, timezone, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func as sa_func, or_

from app.extensions import db
from app.models.employer_candidate_favorite import EmployerCandidateFavorite
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
    if granularity == 'bi_monthly':
        # day 1–10  → 本月10号快照（第一个能统计到该候选人的快照点）
        # day 11–20 → 本月20号快照
        # day 21–末 → 下月10号快照
        day = dt.day
        if day <= 10:
            snap_day = 10
            snap_month = dt.month
            snap_year = dt.year
        elif day <= 20:
            snap_day = 20
            snap_month = dt.month
            snap_year = dt.year
        else:
            snap_day = 10
            snap_month = dt.month + 1 if dt.month < 12 else 1
            snap_year = dt.year if dt.month < 12 else dt.year + 1
        mm = f"{snap_month:02d}"
        key = f"{snap_year}-{mm}-{snap_day:02d}"
        label = f"{mm}/{snap_day:02d}"
        return key, label
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
    if granularity == 'bi_monthly':
        # 最近 24 个统计点（12 个月 × 每月 2 个）
        year, month = now.year, now.month
        day = now.day
        # 当前所在的半月快照
        if day >= 20:
            snaps = [(year, month, 20), (year, month, 10)]
        else:
            snaps = [(year, month, 10)]
            # 上个月 20 号
            pm = month - 1 if month > 1 else 12
            py = year if month > 1 else year - 1
            snaps.append((py, pm, 20))
        # 补到 24 个点
        while len(snaps) < 24:
            y, m, d = snaps[-1]
            if d == 20:
                snaps.append((y, m, 10))
            else:
                pm = m - 1 if m > 1 else 12
                py = y if m > 1 else y - 1
                snaps.append((py, pm, 20))
        snaps = list(reversed(snaps))
        for y, m, d in snaps:
            mm = f"{m:02d}"
            key = f"{y}-{mm}-{d:02d}"
            label = f"{mm}/{d:02d}"
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


def _count_applicant_candidates(employer_id, function_value, region_value):
    """投递该企业岗位的去重候选人数。"""
    try:
        query = (
            db.session.query(sa_func.count(sa_func.distinct(JobApplication.candidate_id)))
            .join(Job, Job.id == JobApplication.job_id)
            .filter(JobApplication.employer_id == employer_id)
        )
        query = _apply_job_filters(query, function_value, region_value)
        return int(query.scalar() or 0)
    except Exception:
        return 0


def _count_favorited_candidates(employer_id):
    """该企业收藏的候选人数。"""
    try:
        return int(
            db.session.query(sa_func.count(EmployerCandidateFavorite.id))
            .filter(EmployerCandidateFavorite.employer_id == employer_id)
            .scalar() or 0
        )
    except Exception:
        return 0


# ── Trend summary helpers ──────────────────────────────────────────────────

# Asia/Shanghai is always UTC+8 (no DST)
_SHANGHAI_TZ = timezone(timedelta(hours=8))


def _start_of_year_utc_naive():
    """今年 1 月 1 日 00:00:00 Asia/Shanghai → UTC naive"""
    now_sh = datetime.now(_SHANGHAI_TZ)
    start_sh = datetime(now_sh.year, 1, 1, 0, 0, 0, tzinfo=_SHANGHAI_TZ)
    return start_sh.astimezone(timezone.utc).replace(tzinfo=None)


def _start_of_week_utc_naive():
    """本周一 00:00:00 Asia/Shanghai → UTC naive（weekday() Monday=0）"""
    now_sh = datetime.now(_SHANGHAI_TZ)
    days_since_monday = now_sh.weekday()
    monday_sh = now_sh - timedelta(days=days_since_monday)
    monday_start_sh = datetime(monday_sh.year, monday_sh.month, monday_sh.day, 0, 0, 0, tzinfo=_SHANGHAI_TZ)
    return monday_start_sh.astimezone(timezone.utc).replace(tzinfo=None)


def _now_utc_naive():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _count_platform_candidates_total(function_value, region_value):
    sql_parts = [
        "SELECT COUNT(*) FROM candidates WHERE availability_status IN ('open', 'passive')"
    ]
    params = {}
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
        return int(db.session.execute(db.text(''.join(sql_parts)), params).scalar() or 0)
    except Exception:
        return 0


def _count_platform_jobs_total(function_value, region_value):
    sql_parts = ["SELECT COUNT(*) FROM jobs WHERE status = 'published'"]
    params = {}
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
        return int(db.session.execute(db.text(''.join(sql_parts)), params).scalar() or 0)
    except Exception:
        return 0


def _count_platform_teams_total():
    try:
        return int(db.session.query(sa_func.count(User.id)).filter(
            User.role == 'employer',
            User.is_active.is_(True),
        ).scalar() or 0)
    except Exception:
        return 0


def _count_platform_candidates_since(function_value, region_value, start, end):
    sql_parts = [
        """SELECT COUNT(*) FROM candidates
        WHERE availability_status IN ('open', 'passive')
          AND COALESCE(profile_confirmed_at, created_at) >= :start
          AND COALESCE(profile_confirmed_at, created_at) < :end"""
    ]
    params = {'start': start, 'end': end}
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
        return int(db.session.execute(db.text(''.join(sql_parts)), params).scalar() or 0)
    except Exception:
        return 0


def _count_platform_jobs_since(function_value, region_value, start, end):
    sql_parts = [
        """SELECT COUNT(*) FROM jobs
        WHERE status = 'published'
          AND created_at >= :start
          AND created_at < :end"""
    ]
    params = {'start': start, 'end': end}
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
        return int(db.session.execute(db.text(''.join(sql_parts)), params).scalar() or 0)
    except Exception:
        return 0


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

    now = _now_utc_naive()
    year_start = _start_of_year_utc_naive()
    week_start = _start_of_week_utc_naive()

    # platform_totals 和 growth 始终是全平台口径，不受 function/region 筛选影响
    jobs_total_now = _count_platform_jobs_total(ALL_VALUE, ALL_VALUE)
    cands_total_now = _count_platform_candidates_total(ALL_VALUE, ALL_VALUE)

    jobs_ytd = _count_platform_jobs_since(ALL_VALUE, ALL_VALUE, year_start, now)
    jobs_week = _count_platform_jobs_since(ALL_VALUE, ALL_VALUE, week_start, now)
    cands_ytd = _count_platform_candidates_since(ALL_VALUE, ALL_VALUE, year_start, now)
    cands_week = _count_platform_candidates_since(ALL_VALUE, ALL_VALUE, week_start, now)

    def _growth_pct(delta, base):
        """相对基准时点存量的增幅：delta / base * 100。"""
        if base > 0:
            return round(delta / base * 100, 1)
        return 100.0 if delta > 0 else 0.0

    jobs_year_start_total = jobs_total_now - jobs_ytd
    jobs_week_start_total = jobs_total_now - jobs_week
    cands_year_start_total = cands_total_now - cands_ytd
    cands_week_start_total = cands_total_now - cands_week

    jobs_ytd_pct = _growth_pct(jobs_ytd, jobs_year_start_total)
    jobs_week_pct = _growth_pct(jobs_week, jobs_week_start_total)
    cands_ytd_pct = _growth_pct(cands_ytd, cands_year_start_total)
    cands_week_pct = _growth_pct(cands_week, cands_week_start_total)

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
        "platform_totals": {
            "candidates": cands_total_now,
            "jobs": jobs_total_now,
            "teams": _count_platform_teams_total(),
            "soon": None,
        },
        "growth": {
            "jobs": {
                "label": "PLATFORM JOB GROWTH",
                "total": jobs_total_now,
                "ytd_delta": jobs_ytd,
                "ytd_base": jobs_year_start_total,
                "ytd_percent": jobs_ytd_pct,
                "week_delta": jobs_week,
                "week_base": jobs_week_start_total,
                "week_percent": jobs_week_pct,
                "direction": "up" if jobs_ytd > 0 else "neutral",
            },
            "candidates": {
                "label": "PLATFORM CANDIDATE GROWTH",
                "total": cands_total_now,
                "ytd_delta": cands_ytd,
                "ytd_base": cands_year_start_total,
                "ytd_percent": cands_ytd_pct,
                "week_delta": cands_week,
                "week_base": cands_week_start_total,
                "week_percent": cands_week_pct,
                "direction": "up" if cands_ytd > 0 else "neutral",
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
    valid_granularities = ('bi_monthly', 'week', 'month', 'quarter', 'year')
    if granularity not in valid_granularities:
        granularity = 'bi_monthly'

    result = _time_series_bars(function_value, region_value, granularity)
    stats = {
        "applications_received": _count_received_applications(user.id, function_value, region_value),
        "applicant_candidates": _count_applicant_candidates(user.id, function_value, region_value),
        "jobs": _count_employer_jobs(user.id, function_value, region_value),
        "interested": _count_interested_candidates(user.id, function_value, region_value),
        "favorited_candidates": _count_favorited_candidates(user.id),
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
