from datetime import datetime, timezone, timedelta

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.user import User

candidate_dashboard_bp = Blueprint(
    "candidate_dashboard",
    __name__,
    url_prefix="/api/candidate",
)


def _ytd_growth(model, date_field):
    now = datetime.now(timezone.utc)
    year_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    last_year_start = year_start.replace(year=year_start.year - 1)
    last_year_end = year_start

    this_year_count = db.session.query(model).filter(date_field >= year_start).count()
    last_year_count = (
        db.session.query(model)
        .filter(date_field >= last_year_start, date_field < last_year_end)
        .count()
    )

    if last_year_count == 0:
        return 0.0
    return round((this_year_count / last_year_count - 1) * 100, 1)


def _week_growth(model, date_field):
    now = datetime.now(timezone.utc)
    this_week_start = now - timedelta(days=now.weekday())
    this_week_start = this_week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    last_week_start = this_week_start - timedelta(weeks=1)

    this_week_count = db.session.query(model).filter(date_field >= this_week_start).count()
    last_week_count = (
        db.session.query(model)
        .filter(date_field >= last_week_start, date_field < this_week_start)
        .count()
    )

    if last_week_count == 0:
        return 0.0
    return round((this_week_count / last_week_count - 1) * 100, 1)


@candidate_dashboard_bp.get("/dashboard-summary")
@jwt_required()
def get_dashboard_summary():
    identity = get_jwt_identity()
    user = db.session.get(User, identity)
    if not user or user.role != "candidate":
        return jsonify({"success": False, "message": "仅候选人可访问"}), 403

    total_candidates = db.session.query(Candidate).filter_by(profile_status="complete").count()
    total_jobs = db.session.query(Job).filter_by(status="published").count()
    total_teams = db.session.query(User).filter_by(role="employer").count()

    return jsonify({
        "platform_totals": {
            "candidates": total_candidates,
            "jobs": total_jobs,
            "teams": total_teams,
        },
        "growth": {
            "jobs": {
                "ytd_percent": _ytd_growth(Job, Job.created_at),
                "week_percent": _week_growth(Job, Job.created_at),
            },
            "candidates": {
                "ytd_percent": _ytd_growth(Candidate, Candidate.created_at),
                "week_percent": _week_growth(Candidate, Candidate.created_at),
            },
        },
    })
