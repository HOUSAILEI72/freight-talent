from datetime import datetime, timezone
from app.extensions import db


class CandidateTag(db.Model):
    __tablename__ = "candidate_tags"

    id           = db.Column(db.Integer, primary_key=True)
    candidate_id = db.Column(db.Integer, db.ForeignKey("candidates.id", ondelete="CASCADE"),
                             nullable=False, index=True)
    tag_id       = db.Column(db.Integer, db.ForeignKey("tags.id", ondelete="CASCADE"),
                             nullable=False, index=True)
    created_at   = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.UniqueConstraint("candidate_id", "tag_id", name="uq_candidate_tag"),
    )


class JobTag(db.Model):
    __tablename__ = "job_tags"

    id       = db.Column(db.Integer, primary_key=True)
    job_id   = db.Column(db.Integer, db.ForeignKey("jobs.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    tag_id   = db.Column(db.Integer, db.ForeignKey("tags.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.UniqueConstraint("job_id", "tag_id", name="uq_job_tag"),
    )
