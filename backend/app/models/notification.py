from datetime import datetime, timezone
from app.extensions import db


class Notification(db.Model):
    __tablename__ = 'notifications'

    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'),
                           nullable=False)
    type       = db.Column(
        db.Enum(
            'new_message',
            'invitation_status_change',
            'application_status_change',
            'headhunting_request',
            name='notification_type',
        ),
        nullable=False,
    )
    title      = db.Column(db.String(200), nullable=False)
    body       = db.Column(db.String(500), nullable=True)
    data       = db.Column(db.JSON, nullable=True)
    is_read    = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime,
                           default=lambda: datetime.now(timezone.utc),
                           nullable=False)

    __table_args__ = (
        db.Index('ix_notification_user_id',      'user_id'),
        db.Index('ix_notification_user_is_read', 'user_id', 'is_read'),
    )

    user = db.relationship('User', backref=db.backref('notifications', lazy='dynamic'))

    def to_dict(self):
        return {
            'id':         self.id,
            'user_id':    self.user_id,
            'type':       self.type,
            'title':      self.title,
            'body':       self.body,
            'data':       self.data or {},
            'is_read':    self.is_read,
            'created_at': self.created_at.isoformat() + 'Z' if self.created_at else None,
        }
