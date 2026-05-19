from datetime import datetime, timezone
from app.extensions import db


class CandidateBlockedCompany(db.Model):
    __tablename__ = "candidate_blocked_companies"

    id = db.Column(db.Integer, primary_key=True)
    candidate_id = db.Column(
        db.Integer,
        db.ForeignKey("candidates.id", ondelete="CASCADE"),
        nullable=False,
    )
    company_id = db.Column(
        db.Integer,
        db.ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.UniqueConstraint("candidate_id", "company_id", name="uq_candidate_blocked_company"),
        db.Index("idx_blocked_candidate_id", "candidate_id"),
        db.Index("idx_blocked_company_id", "company_id"),
    )
