from datetime import datetime, timezone
from app.extensions import db


class MatchResult(db.Model):
    __tablename__ = "match_results"

    id = db.Column(db.Integer, primary_key=True)

    job_id = db.Column(
        db.Integer, db.ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    candidate_id = db.Column(
        db.Integer, db.ForeignKey("candidates.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    # 总分 0-100
    score = db.Column(db.Integer, nullable=False, default=0)

    # 命中的标签列表
    matched_tags = db.Column(db.JSON, nullable=True)

    # 各维度得分（可选，便于调试和展示）
    score_breakdown = db.Column(db.JSON, nullable=True)
    # e.g. {"skill_tags": 35, "route_tags": 10, "business_type": 10,
    #        "job_type": 10, "city": 10, "freshness": 10, "experience": 5}

    # 人类可读的推荐理由列表
    reason_list = db.Column(db.JSON, nullable=True)
    # e.g. ["技能标签命中 3 项：海运操作、Cargowise、英语", "城市匹配：上海"]

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # 关联（用于 JOIN 查 candidate 信息）
    candidate = db.relationship("Candidate", backref=db.backref("match_results", lazy="dynamic"))
    job = db.relationship("Job", backref=db.backref("match_results", lazy="dynamic"))

    __table_args__ = (
        db.UniqueConstraint("job_id", "candidate_id", name="uq_match_job_candidate"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "job_id": self.job_id,
            "candidate_id": self.candidate_id,
            "score": self.score,
            "matched_tags": self.matched_tags or [],
            "score_breakdown": self.score_breakdown or {},
            "reason_list": self.reason_list or [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
