from datetime import datetime, timezone
from app.extensions import db


class JobApplication(db.Model):
    """Candidate-initiated application to a published job (CAND-4).

    Distinct from `invitations` (employer-initiated). The two relations
    co-exist: an employer may invite a candidate AND that candidate may
    have already applied — both unlock the privacy view (CAND-5).
    """
    __tablename__ = "job_applications"

    id           = db.Column(db.Integer, primary_key=True)
    job_id       = db.Column(db.Integer, db.ForeignKey("jobs.id",       ondelete="CASCADE"), nullable=False)
    candidate_id = db.Column(db.Integer, db.ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False)
    employer_id  = db.Column(db.Integer, db.ForeignKey("users.id",      ondelete="CASCADE"), nullable=False)

    status = db.Column(
        db.Enum(
            "submitted", "viewed", "shortlisted", "rejected", "withdrawn",
            name="job_application_status",
        ),
        nullable=False,
        default="submitted",
    )
    message = db.Column(db.Text, nullable=True)

    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        db.UniqueConstraint("job_id", "candidate_id", name="uq_job_application_job_candidate"),
        db.Index("idx_job_application_job_id",       "job_id"),
        db.Index("idx_job_application_candidate_id", "candidate_id"),
        db.Index("idx_job_application_employer_id",  "employer_id"),
        db.Index("idx_job_application_status",       "status"),
    )

    job       = db.relationship("Job",       backref=db.backref("applications", lazy="dynamic"))
    candidate = db.relationship("Candidate", backref=db.backref("applications", lazy="dynamic"))
    employer  = db.relationship("User",      backref=db.backref("received_applications", lazy="dynamic"))

    def to_dict(self):
        return {
            "id":           self.id,
            "job_id":       self.job_id,
            "candidate_id": self.candidate_id,
            "employer_id":  self.employer_id,
            "status":       self.status,
            "message":      self.message,
            "created_at":   self.created_at.isoformat() + "Z" if self.created_at else None,
            "updated_at":   self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }
