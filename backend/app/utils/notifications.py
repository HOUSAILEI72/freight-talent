from datetime import datetime, timezone
from app.extensions import db, socketio
from app.models.notification import Notification


def create_and_push_notification(user_id, type, title, body=None, data=None):
    """Persist a notification row and push it via Socket.IO to user_{user_id}."""
    notif = Notification(
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        data=data or {},
        created_at=datetime.now(timezone.utc),
    )
    db.session.add(notif)
    db.session.commit()
    socketio.emit('notification', notif.to_dict(), room=f'user_{user_id}')
    return notif
