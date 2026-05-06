"""
柱状图 API — /api/v2/candidates/chart  /api/v2/jobs/chart

tag_groups 参数格式："1,2;5,6"
  分号隔开分类组，逗号隔开同一分类内的 tag id。
  同分类组内 OR，跨分类组 AND。
"""
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from fastapi_app.core.auth import get_current_user_id
from fastapi_app.core.database import get_db
from fastapi_app.core.redis import get_redis_client
from fastapi_app.schemas.chart import ChartResponse

router = APIRouter(tags=["chart"])
logger = logging.getLogger("chart")

CST = timezone(timedelta(hours=8))

UserID = Annotated[int, Depends(get_current_user_id)]
DB     = Annotated[Session, Depends(get_db)]


def _now_cst() -> datetime:
    return datetime.now(CST)


def seconds_until_next_8am() -> int:
    now = _now_cst()
    target = now.replace(hour=8, minute=0, second=0, microsecond=0)
    if now >= target:
        target += timedelta(days=1)
    return max(60, int((target - now).total_seconds()))


def _get_user_role(db: Session, user_id: int) -> str:
    row = db.execute(
        text("SELECT role, is_active FROM users WHERE id = :uid"),
        {"uid": user_id},
    ).fetchone()
    if not row or not row.is_active:
        raise HTTPException(status_code=404, detail="用户不存在")
    return row.role


# ── 参数解析 ──────────────────────────────────────────────────────────────────

def _parse_groups(tag_groups: str) -> list[list[int]]:
    """'1,2;5,6' → [[1,2],[5,6]]，过滤非法值。"""
    if not tag_groups.strip():
        return []
    result = []
    for segment in tag_groups.split(";"):
        ids = [int(x) for x in segment.split(",") if x.strip().isdigit()]
        if ids:
            result.append(ids)
    return result


def _cache_key_suffix(groups: list[list[int]]) -> str:
    """规范化后的 cache key 部分，排序后保证幂等。"""
    return ";".join(
        ",".join(str(i) for i in sorted(g))
        for g in sorted(groups, key=lambda g: g[0] if g else 0)
    )


# ── 周期生成（零补全用） ───────────────────────────────────────────────────────

def _generate_periods(granularity: str, periods: int) -> list[str]:
    now = _now_cst()
    result = []

    if granularity == "day":
        for i in range(periods - 1, -1, -1):
            result.append((now - timedelta(days=i)).strftime("%Y-%m-%d"))

    elif granularity == "week":
        for i in range(periods - 1, -1, -1):
            result.append((now - timedelta(weeks=i)).strftime("%Y-%W"))

    elif granularity == "month":
        year, month = now.year, now.month
        for i in range(periods - 1, -1, -1):
            m = month - i
            y = year
            while m <= 0:
                m += 12
                y -= 1
            result.append(f"{y:04d}-{m:02d}")

    elif granularity == "quarter":
        year, q = now.year, (now.month - 1) // 3 + 1
        for i in range(periods - 1, -1, -1):
            qi = q - i
            yi = year
            while qi <= 0:
                qi += 4
                yi -= 1
            result.append(f"{yi:04d}-Q{qi}")

    elif granularity == "year":
        for i in range(periods - 1, -1, -1):
            result.append(str(now.year - i))

    return result


# ── SQL 构建 ──────────────────────────────────────────────────────────────────

_DATE_FMT = {
    "day":     "DATE_FORMAT(c.created_at, '%%Y-%%m-%%d')",
    "week":    "DATE_FORMAT(c.created_at, '%%Y-%%W')",
    "month":   "DATE_FORMAT(c.created_at, '%%Y-%%m')",
    "quarter": "CONCAT(YEAR(c.created_at), '-Q', QUARTER(c.created_at))",
    "year":    "YEAR(c.created_at)",
}


def _exists_clauses(tag_table: str, fk_col: str, groups: list[list[int]]) -> str:
    """为每个分类组生成一条 EXISTS 子句，组间以 AND 连接。
    IDs 均为 int，直接内插安全。
    """
    parts = [
        f"EXISTS (SELECT 1 FROM {tag_table} WHERE {fk_col}=c.id"
        f" AND tag_id IN ({','.join(str(i) for i in g)}))"
        for g in groups if g
    ]
    return ("AND " + "\n  AND ".join(parts)) if parts else ""


def _cutoff(granularity: str, periods: int) -> datetime:
    now = datetime.now(timezone.utc)
    deltas = {
        "day": timedelta(days=periods),
        "week": timedelta(weeks=periods),
        "month": timedelta(days=periods * 32),
        "quarter": timedelta(days=periods * 95),
        "year": timedelta(days=periods * 366),
    }
    return now - deltas.get(granularity, timedelta(days=periods * 32))


def _zero_fill(raw: list[dict], granularity: str, periods: int) -> list[dict]:
    all_periods = _generate_periods(granularity, periods)
    count_map = {r["period"]: r["count"] for r in raw}
    return [{"period": p, "count": count_map.get(p, 0)} for p in all_periods]


# ── 查询函数 ──────────────────────────────────────────────────────────────────

def _query_candidates(db: Session, groups: list[list[int]],
                      granularity: str, periods: int) -> list[dict]:
    fmt = _DATE_FMT.get(granularity, _DATE_FMT["month"])
    cutoff = _cutoff(granularity, periods)
    extra = _exists_clauses("candidate_tags", "candidate_id", groups)

    sql_str = f"""
        SELECT {fmt} AS period, COUNT(DISTINCT c.id) AS cnt
        FROM candidates c
        WHERE c.created_at >= :cutoff
          {extra}
        GROUP BY period
        ORDER BY period
    """
    sql = text(sql_str)
    rows = db.execute(sql, {"cutoff": cutoff}).fetchall()
    logger.info("candidate query: groups=%s cutoff=%s rows=%d total=%d",
                groups, cutoff, len(rows), sum(int(r.cnt) for r in rows))
    return [{"period": str(r.period), "count": int(r.cnt)} for r in rows]


def _query_jobs(db: Session, groups: list[list[int]],
                granularity: str, periods: int) -> list[dict]:
    fmt = _DATE_FMT.get(granularity, _DATE_FMT["month"])
    cutoff = _cutoff(granularity, periods)
    extra = _exists_clauses("job_tags", "job_id", groups)

    sql_str = f"""
        SELECT {fmt} AS period, COUNT(DISTINCT c.id) AS cnt
        FROM jobs c
        WHERE c.created_at >= :cutoff
          AND c.status = 'published'
          {extra}
        GROUP BY period
        ORDER BY period
    """
    sql = text(sql_str)
    rows = db.execute(sql, {"cutoff": cutoff}).fetchall()
    logger.info("job query: groups=%s cutoff=%s rows=%d total=%d",
                groups, cutoff, len(rows), sum(int(r.cnt) for r in rows))
    return [{"period": str(r.period), "count": int(r.cnt)} for r in rows]


# ── 端点 ──────────────────────────────────────────────────────────────────────

VALID_GRAN = {"day", "week", "month", "quarter", "year"}


@router.get("/candidates/chart", response_model=ChartResponse)
def candidate_chart(
    user_id: UserID,
    db: DB,
    tag_groups: str = Query(default="", description="分类分组：'1,2;5,6'，分号隔组，逗号隔 id"),
    granularity: str = Query(default="month"),
    periods: int = Query(default=12, ge=1, le=60),
    refresh: bool = Query(default=False, description="true 时跳过缓存直接查 DB"),
):
    """候选人数量柱状图 — employer / admin 可访问。"""
    role = _get_user_role(db, user_id)
    if role not in ("employer", "admin"):
        raise HTTPException(status_code=403, detail="仅企业或管理员可查看")
    if granularity not in VALID_GRAN:
        granularity = "month"

    groups = _parse_groups(tag_groups)
    cache_key = f"chart:candidates:{granularity}:{periods}:{_cache_key_suffix(groups)}"

    redis = get_redis_client()
    if redis and not refresh:
        try:
            cached = redis.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass

    raw = _query_candidates(db, groups, granularity, periods)
    data = _zero_fill(raw, granularity, periods)
    result = {
        "data": data,
        "total": sum(d["count"] for d in data),
        "granularity": granularity,
        "tag_groups": groups,
        "fetched_at": _now_cst().isoformat(),
    }

    if redis:
        try:
            redis.setex(cache_key, seconds_until_next_8am(), json.dumps(result))
        except Exception:
            pass

    return result


@router.get("/jobs/chart", response_model=ChartResponse)
def job_chart(
    user_id: UserID,
    db: DB,
    tag_groups: str = Query(default="", description="分类分组：'1,2;5,6'，分号隔组，逗号隔 id"),
    granularity: str = Query(default="month"),
    periods: int = Query(default=12, ge=1, le=60),
    refresh: bool = Query(default=False),
):
    """岗位数量柱状图 — 所有登录用户可访问。"""
    _get_user_role(db, user_id)
    if granularity not in VALID_GRAN:
        granularity = "month"

    groups = _parse_groups(tag_groups)
    cache_key = f"chart:jobs:{granularity}:{periods}:{_cache_key_suffix(groups)}"

    redis = get_redis_client()
    if redis and not refresh:
        try:
            cached = redis.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass

    raw = _query_jobs(db, groups, granularity, periods)
    data = _zero_fill(raw, granularity, periods)
    result = {
        "data": data,
        "total": sum(d["count"] for d in data),
        "granularity": granularity,
        "tag_groups": groups,
        "fetched_at": _now_cst().isoformat(),
    }

    if redis:
        try:
            redis.setex(cache_key, seconds_until_next_8am(), json.dumps(result))
        except Exception:
            pass

    return result


def flush_chart_cache() -> int:
    """删除所有 chart:* 缓存键，返回删除数量。供其他模块在数据变更后调用。"""
    redis = get_redis_client()
    if not redis:
        return 0
    try:
        keys = redis.keys("chart:*")
        if keys:
            return redis.delete(*keys) or 0
    except Exception:
        pass
    return 0
