from datetime import datetime, timezone
from app.extensions import db


class CandidateEmailAction(db.Model):
    __tablename__ = 'candidate_email_actions'

    id             = db.Column(db.Integer, primary_key=True)
    employer_id    = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    candidate_id   = db.Column(db.Integer, db.ForeignKey('candidates.id', ondelete='CASCADE'), nullable=False, index=True)
    job_id         = db.Column(db.Integer, db.ForeignKey('jobs.id', ondelete='CASCADE'), nullable=False)
    thread_id      = db.Column(db.Integer, db.ForeignKey('conversation_threads.id', ondelete='SET NULL'), nullable=True)
    action         = db.Column(db.String(40), nullable=False)   # interview / not_fit / resume_update / interview_address
    status         = db.Column(db.String(20), nullable=False, default='pending')  # pending / sent / failed
    subject        = db.Column(db.String(200), nullable=True)
    body           = db.Column(db.Text, nullable=True)
    error_message  = db.Column(db.Text, nullable=True)
    sent_at        = db.Column(db.DateTime, nullable=True)
    created_at     = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at     = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                               onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        db.UniqueConstraint('employer_id', 'candidate_id', 'job_id', 'action',
                            name='uq_candidate_email_action_scope'),
    )

    employer  = db.relationship('User',      foreign_keys=[employer_id])
    candidate = db.relationship('Candidate', foreign_keys=[candidate_id])
    job       = db.relationship('Job',       foreign_keys=[job_id])

    def to_dict(self):
        return {
            'id':          self.id,
            'action':      self.action,
            'status':      self.status,
            'sent_at':     self.sent_at.isoformat() if self.sent_at else None,
            'updated_at':  self.updated_at.isoformat() if self.updated_at else None,
        }
