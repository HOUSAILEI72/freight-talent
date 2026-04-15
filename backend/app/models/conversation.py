from datetime import datetime, timezone
from app.extensions import db


class ConversationThread(db.Model):
    __tablename__ = 'conversation_threads'

    id            = db.Column(db.Integer, primary_key=True)
    invitation_id = db.Column(db.Integer, db.ForeignKey('invitations.id', ondelete='CASCADE'),
                              nullable=False, unique=True)
    job_id        = db.Column(db.Integer, db.ForeignKey('jobs.id', ondelete='CASCADE'), nullable=False)
    candidate_id  = db.Column(db.Integer, db.ForeignKey('candidates.id', ondelete='CASCADE'), nullable=False)
    employer_id   = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    created_at    = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at    = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                              onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    invitation = db.relationship('Invitation', backref=db.backref('thread', uselist=False))
    job        = db.relationship('Job',        backref=db.backref('threads', lazy='dynamic'))
    candidate  = db.relationship('Candidate',  backref=db.backref('threads', lazy='dynamic'))
    employer   = db.relationship('User',       backref=db.backref('threads', lazy='dynamic'))
    messages   = db.relationship('Message',    backref='thread', lazy='dynamic',
                                 order_by='Message.created_at', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id':            self.id,
            'invitation_id': self.invitation_id,
            'job_id':        self.job_id,
            'candidate_id':  self.candidate_id,
            'employer_id':   self.employer_id,
            'created_at':    self.created_at.isoformat() if self.created_at else None,
            'updated_at':    self.updated_at.isoformat() if self.updated_at else None,
        }


class Message(db.Model):
    __tablename__ = 'messages'

    id             = db.Column(db.Integer, primary_key=True)
    thread_id      = db.Column(db.Integer, db.ForeignKey('conversation_threads.id', ondelete='CASCADE'),
                               nullable=False, index=True)
    sender_user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    sender_role    = db.Column(db.String(20), nullable=False)   # 'employer' | 'candidate' | 'admin'
    content        = db.Column(db.Text, nullable=False)
    is_read        = db.Column(db.Boolean, default=False, nullable=False)
    created_at     = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    sender = db.relationship('User', backref=db.backref('messages', lazy='dynamic'))

    def to_dict(self):
        sender = self.sender
        if sender:
            sender_name = (sender.company_name or sender.name) if sender.role == 'employer' else sender.name
        else:
            sender_name = None
        return {
            'id':             self.id,
            'thread_id':      self.thread_id,
            'sender_user_id': self.sender_user_id,
            'sender_role':    self.sender_role,
            'sender_name':    sender_name,
            'content':        self.content,
            'is_read':        self.is_read,
            'created_at':     self.created_at.isoformat() if self.created_at else None,
        }
