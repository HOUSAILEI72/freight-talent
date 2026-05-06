"""
企业 Dashboard 图表 API

X 轴是时间，Function/Area 是筛选条件。
统计候选人数量随时间变化。
"""
from collections import defaultdict
from datetime import datetime, timezone, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.models.user import User


employer_dashboard_bp = Blueprint(
    "employer_dashboard",
    __name__,
    url_prefix="/api/employer",
)

ALL_VALUE = "ALL"

# Area 显示名到 business_area_code 的映射
AREA_NAME_TO_CODE = {
    'East China': 'EAST_CHINA',
    'South China': 'SOUTH_CHINA',
    'North China': 'NORTH_CHINA',
    'Central China': 'CENTRAL_CHINA',
    'West China': 'WEST_CHINA',
    'Great China': 'GREAT_CHINA',
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

    if region_value != ALL_VALUE:
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
    _, err = _current_employer()
    if err:
        return err

    function_value = _clean(request.args.get("function")) or ALL_VALUE
    region_value = _clean(request.args.get("region")) or ALL_VALUE
    granularity = _clean(request.args.get("granularity")) or 'day'

    if function_value.upper() == ALL_VALUE:
        function_value = ALL_VALUE
    # 规范化 area 值
    region_value = _normalize_area_value(region_value)

    # 规范化 granularity
    valid_granularities = ('day', 'week', 'month', 'quarter', 'year')
    if granularity not in valid_granularities:
        granularity = 'day'

    result = _time_series_bars(function_value, region_value, granularity)

    return jsonify({
        "success": True,
        "function": function_value,
        "region": region_value,
        "granularity": granularity,
        "bars": result["bars"],
        "total": result["total"],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
