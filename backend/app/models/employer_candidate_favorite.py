from datetime import datetime, timezone
from app.extensions import db


class EmployerCandidateFavorite(db.Model):
    __tablename__ = "employer_candidate_favorites"

    id = db.Column(db.Integer, primary_key=True)
    employer_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    candidate_id = db.Column(db.Integer, db.ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        db.UniqueConstraint("employer_id", "candidate_id", name="uq_ecf_employer_candidate"),
        db.Index("idx_ecf_employer_created", "employer_id", "created_at"),
    )
