"""
通知 API — /api/v2/notifications/*

GET    /notifications          列出当前用户通知（limit/before 游标分页）
PATCH  /notifications/read-all 全部标记已读
PATCH  /notifications/{id}/read 单条标记已读
DELETE /notifications/{id}     删除单条
"""
from datetime import datetime, timezone
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from fastapi_app.core.auth import get_current_user_id
from fastapi_app.core.database import get_db

router = APIRouter(tags=["notifications"])

UserID = Annotated[int, Depends(get_current_user_id)]
DB     = Annotated[Session, Depends(get_db)]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _get_notif(db: Session, notif_id: int, user_id: int):
    row = db.execute(
        text("SELECT id, user_id, is_read FROM notifications WHERE id = :id"),
        {"id": notif_id},
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="通知不存在")
    if row.user_id != user_id:
        raise HTTPException(status_code=403, detail="无权限")
    return row


@router.get("/notifications")
def list_notifications(
    db: DB,
    user_id: UserID,
    limit: int = Query(30, ge=1, le=50),
    before: Optional[int] = Query(None),
):
    params: dict = {"uid": user_id, "limit": limit + 1}
    before_clause = ""
    if before is not None:
        before_clause = "AND n.id < :before"
        params["before"] = before

    rows = db.execute(
        text(f"""
            SELECT id, type, title, body, data, is_read, created_at
            FROM notifications
            WHERE user_id = :uid {before_clause}
            ORDER BY created_at DESC
            LIMIT :limit
        """),
        params,
    ).fetchall()

    has_more = len(rows) > limit
    rows = rows[:limit]

    unread_count = db.execute(
        text("SELECT COUNT(*) FROM notifications WHERE user_id = :uid AND is_read = 0"),
        {"uid": user_id},
    ).scalar() or 0

    def _row(r):
        return {
            "id":         r.id,
            "type":       r.type,
            "title":      r.title,
            "body":       r.body,
            "data":       r.data or {},
            "is_read":    bool(r.is_read),
            "created_at": r.created_at.isoformat() + "Z" if r.created_at else None,
        }

    return {
        "success":       True,
        "notifications": [_row(r) for r in rows],
        "unread_count":  unread_count,
        "has_more":      has_more,
    }


@router.patch("/notifications/read-all")
def mark_all_read(db: DB, user_id: UserID):
    db.execute(
        text("UPDATE notifications SET is_read = 1 WHERE user_id = :uid AND is_read = 0"),
        {"uid": user_id},
    )
    db.commit()
    return {"success": True}


@router.patch("/notifications/{notif_id}/read")
def mark_read(notif_id: int, db: DB, user_id: UserID):
    _get_notif(db, notif_id, user_id)
    db.execute(
        text("UPDATE notifications SET is_read = 1 WHERE id = :id"),
        {"id": notif_id},
    )
    db.commit()
    return {"success": True}


@router.delete("/notifications/{notif_id}")
def dismiss(notif_id: int, db: DB, user_id: UserID):
    _get_notif(db, notif_id, user_id)
    db.execute(
        text("DELETE FROM notifications WHERE id = :id"),
        {"id": notif_id},
    )
    db.commit()
    return {"success": True}
