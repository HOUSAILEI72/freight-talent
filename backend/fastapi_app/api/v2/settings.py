"""系统设置接口 — /api/v2/settings/*"""
from datetime import datetime, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from fastapi_app.core.auth import get_current_user_id
from fastapi_app.core.database import get_db
from fastapi_app.schemas.settings import TagApprovalUpdate

router = APIRouter(tags=["settings"])

UserID = Annotated[int, Depends(get_current_user_id)]
DB     = Annotated[Session, Depends(get_db)]


def _require_admin(db: Session, user_id: int):
    row = db.execute(
        text("SELECT role, is_active FROM users WHERE id = :uid"),
        {"uid": user_id},
    ).fetchone()
    if not row or not row.is_active:
        raise HTTPException(status_code=404, detail="用户不存在")
    if row.role != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可操作")


@router.get("/settings/tag-approval")
def get_tag_approval(db: DB, user_id: UserID):
    _require_admin(db, user_id)
    row = db.execute(
        text("SELECT value FROM system_settings WHERE `key` = 'tag_approval_required'"),
    ).fetchone()
    enabled = (row.value.lower() == "true") if row else True
    return {"success": True, "enabled": enabled}


@router.patch("/settings/tag-approval")
def set_tag_approval(body: TagApprovalUpdate, db: DB, user_id: UserID):
    _require_admin(db, user_id)
    value = "true" if body.enabled else "false"
    db.execute(
        text("""
            INSERT INTO system_settings (`key`, value, updated_by, updated_at)
            VALUES ('tag_approval_required', :val, :uid, :now)
            ON DUPLICATE KEY UPDATE
                value = :val, updated_by = :uid, updated_at = :now
        """),
        {"val": value, "uid": user_id, "now": datetime.now(timezone.utc)},
    )
    db.commit()
    return {"success": True, "enabled": body.enabled}
