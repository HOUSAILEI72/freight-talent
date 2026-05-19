"""
public_market.py — 无需登录的市场快照接口。
GET /api/public/market-snapshot
"""
from datetime import datetime, timezone, timedelta

from flask import Blueprint, jsonify

from app.extensions import db
from app.models.candidate import Candidate
from app.models.job import Job
from app.utils.business_area import BUSINESS_AREAS

public_market_bp = Blueprint("public_market", __name__, url_prefix="/api/public")

# Canonical function codes — must match VALID_FUNCTIONS in subscriptions.py and DEFAULT_FUNCTIONS in FunctionRail.jsx
_FUNCTIONS = [
    {"code": "Sea", "name": "海运板块"},
    {"code": "Air", "name": "空运板块"},
    {"code": "CrossBorder", "name": "跨境电商物流"},
    {"code": "Railway", "name": "铁路 / 中欧班列"},
    {"code": "Road", "name": "陆路运输"},
    {"code": "ContractLogistics", "name": "合同物流 / 3PL"},
    {"code": "Warehousing", "name": "仓储 / 海外仓"},
    {"code": "Customs", "name": "关务 / 合规"},
]

# 排除 GLOBAL / REMOTE / OVERSEAS 等不实际展示的 area
_DISPLAY_AREAS = [
    "GREAT_CHINA", "EAST_CHINA", "NORTH_CHINA",
    "SOUTH_CHINA", "WEST_CHINA", "CENTRAL_CHINA",
    "HONG_KONG", "TAIWAN",
]


@public_market_bp.get("/market-snapshot")
def market_snapshot():
    try:
        # ── Totals ───────────────────────────────────────────────────────────
        total_candidates = db.session.query(db.func.count(Candidate.id)).filter(
            Candidate.availability_status.in_(["open", "passive"])
        ).scalar() or 0

        total_jobs = db.session.query(db.func.count(Job.id)).filter(
            Job.status == "published"
        ).scalar() or 0

        # ── Ticker：按 function_code + business_area_code 聚合 ───────────────
        cand_rows = (
            db.session.query(
                Candidate.function_code,
                Candidate.business_area_code,
                db.func.count(Candidate.id).label("cnt"),
            )
            .filter(
                Candidate.availability_status.in_(["open", "passive"]),
                Candidate.function_code.isnot(None),
                Candidate.business_area_code.isnot(None),
            )
            .group_by(Candidate.function_code, Candidate.business_area_code)
            .all()
        )

        job_rows = (
            db.session.query(
                Job.function_code,
                Job.business_area_code,
                db.func.count(Job.id).label("cnt"),
            )
            .filter(
                Job.status == "published",
                Job.function_code.isnot(None),
                Job.business_area_code.isnot(None),
            )
            .group_by(Job.function_code, Job.business_area_code)
            .all()
        )

        # merge into {(fn, area): {candidates, jobs}}
        ticker_map: dict = {}
        for fn, area, cnt in cand_rows:
            ticker_map.setdefault((fn, area), {"candidates": 0, "jobs": 0})
            ticker_map[(fn, area)]["candidates"] += cnt
        for fn, area, cnt in job_rows:
            ticker_map.setdefault((fn, area), {"candidates": 0, "jobs": 0})
            ticker_map[(fn, area)]["jobs"] += cnt

        ticker = []
        for (fn_code, area_code), counts in ticker_map.items():
            area_info = BUSINESS_AREAS.get(area_code, {})
            ticker.append({
                "function_code": fn_code,
                "function_name": fn_code,
                "area_code": area_code,
                "area_name": area_info.get("name", area_code),
                "candidates": counts["candidates"],
                "jobs": counts["jobs"],
            })

        # 无数据时给 fallback ticker，避免首页跑马灯空白
        if not ticker:
            ticker = _build_fallback_ticker()

        # ── Trend：过去 12 周累计曲线 ─────────────────────────────────────────
        now = datetime.now(timezone.utc)
        trend = []
        for weeks_ago in range(11, -1, -1):
            cutoff = now - timedelta(weeks=weeks_ago)
            cutoff_naive = cutoff.replace(tzinfo=None)

            c_cnt = db.session.query(db.func.count(Candidate.id)).filter(
                Candidate.created_at <= cutoff_naive,
                Candidate.availability_status.in_(["open", "passive"]),
            ).scalar() or 0

            j_cnt = db.session.query(db.func.count(Job.id)).filter(
                Job.created_at <= cutoff_naive,
                Job.status == "published",
            ).scalar() or 0

            trend.append({
                "date": cutoff.strftime("%Y-%m-%d"),
                "candidates": c_cnt,
                "jobs": j_cnt,
            })

        return jsonify({
            "success": True,
            "totals": {
                "candidates": total_candidates,
                "jobs": total_jobs,
            },
            "ticker": ticker,
            "trend": trend,
        }), 200

    except Exception:
        from flask import current_app
        current_app.logger.exception("Failed to fetch market snapshot")
        return jsonify({
            "success": False,
            "message": "Failed to fetch market snapshot",
            "totals": {"candidates": 0, "jobs": 0},
            "ticker": _build_fallback_ticker(),
            "trend": [],
        }), 500


def _build_fallback_ticker():
    items = []
    for fn in _FUNCTIONS[:4]:
        for area_code in ["EAST_CHINA", "SOUTH_CHINA", "NORTH_CHINA"]:
            area_info = BUSINESS_AREAS.get(area_code, {})
            items.append({
                "function_code": fn["code"],
                "function_name": fn["name"],
                "area_code": area_code,
                "area_name": area_info.get("name", area_code),
                "candidates": 0,
                "jobs": 0,
            })
    return items
