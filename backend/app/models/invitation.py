from datetime import datetime, timezone
from ..extensions import db


class Invitation(db.Model):
    __tablename__ = 'invitations'

    id           = db.Column(db.Integer, primary_key=True)
    job_id       = db.Column(db.Integer, db.ForeignKey('jobs.id', ondelete='CASCADE'), nullable=False)
    candidate_id = db.Column(db.Integer, db.ForeignKey('candidates.id', ondelete='CASCADE'), nullable=False)
    employer_id  = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    message      = db.Column(db.Text, nullable=True)
    status       = db.Column(
        db.Enum('pending', 'accepted', 'declined', name='invitation_status'),
        nullable=False,
        default='pending',
    )
    created_at   = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at   = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                             onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    job       = db.relationship('Job',       backref=db.backref('invitations', lazy='dynamic'))
    candidate = db.relationship('Candidate', backref=db.backref('invitations', lazy='dynamic'))
    employer  = db.relationship('User',      backref=db.backref('sent_invitations', lazy='dynamic'))

    # uq_invitation_job_candidate 已由迁移 0002 删除：
    # declined 状态的邀约允许重发，去重逻辑在路由层实现。

    def to_dict(self):
        return {
            'id':           self.id,
            'job_id':       self.job_id,
            'candidate_id': self.candidate_id,
            'employer_id':  self.employer_id,
            'message':      self.message,
            'status':       self.status,
            'created_at':   self.created_at.isoformat() + 'Z' if self.created_at else None,
            'updated_at':   self.updated_at.isoformat() + 'Z' if self.updated_at else None,
        }

