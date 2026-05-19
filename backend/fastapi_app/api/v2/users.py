"""用户接口 — /api/v2/users/*"""
import io
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from fastapi_app.core.auth import get_current_user_id
from fastapi_app.core.database import get_db
from fastapi_app.schemas.users import AvatarUploadResponse, UserProfileResponse

router = APIRouter(tags=["users"])
_log = logging.getLogger(__name__)

UserID = Annotated[int, Depends(get_current_user_id)]
DB = Annotated[Session, Depends(get_db)]

_MAX_SIZE = 3 * 1024 * 1024  # 3 MB
_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
# 图片 magic bytes（前 12 字节）
_MAGIC = {
    b"\xff\xd8\xff": "jpg",
    b"\x89PNG\r\n\x1a\n": "png",
    b"RIFF": None,  # WEBP：RIFF????WEBP，需进一步检查
}


def _detect_ext(data: bytes) -> str | None:
    """根据 magic bytes 检测图片格式，返回 jpg/png/webp 或 None。"""
    if data[:3] == b"\xff\xd8\xff":
        return "jpg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def _get_user_row(db: Session, user_id: int):
    row = db.execute(
        text("SELECT id, email, name, role, company_name, avatar_url, created_at FROM users WHERE id = :uid AND is_active = 1"),
        {"uid": user_id},
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="用户不存在")
    return row


@router.get("/users/me", response_model=UserProfileResponse)
def get_me(db: DB, user_id: UserID):
    row = _get_user_row(db, user_id)
    return UserProfileResponse(
        id=row.id,
        email=row.email,
        name=row.name,
        role=row.role,
        company_name=row.company_name,
        avatar_url=row.avatar_url,
        created_at=row.created_at.strftime("%Y-%m-%dT%H:%M:%SZ") if row.created_at else None,
    )


@router.post("/users/me/avatar", response_model=AvatarUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_avatar(db: DB, user_id: UserID, avatar: UploadFile = File(...)):
    # 1. 读取内容（限制大小）
    data = await avatar.read(_MAX_SIZE + 1)
    if len(data) > _MAX_SIZE:
        raise HTTPException(status_code=413, detail="头像文件不得超过 3 MB")

    # 2. magic bytes 验证（不信任扩展名和 Content-Type header）
    ext = _detect_ext(data)
    if ext is None:
        raise HTTPException(status_code=400, detail="仅支持 JPEG、PNG、WebP 格式的图片")

    # 3. 用 Pillow 二次验证（确保文件内容可解析为图片）
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(data))
        img.verify()
    except Exception:
        raise HTTPException(status_code=400, detail="图片文件损坏或格式不支持")

    # 4. 获取当前头像 URL（用于删除旧文件）
    row = _get_user_row(db, user_id)
    old_url = row.avatar_url

    # 5. 上传到 COS
    try:
        from fastapi_app.core.cos import upload_avatar as cos_upload, delete_avatar as cos_delete
        new_url = await cos_upload(user_id, data, ext)
    except RuntimeError as e:
        _log.error("COS 配置错误：%s", e)
        raise HTTPException(status_code=503, detail="头像服务暂时不可用，请联系管理员")
    except Exception as e:
        _log.error("COS 上传失败 user_id=%d：%s", user_id, e)
        raise HTTPException(status_code=502, detail="头像上传失败，请稍后重试")

    # 6. 更新数据库
    db.execute(
        text("UPDATE users SET avatar_url = :url WHERE id = :uid"),
        {"url": new_url, "uid": user_id},
    )
    db.commit()

    # 7. 删除旧头像（异步，静默失败）
    if old_url:
        try:
            await cos_delete(old_url, user_id)
        except Exception:
            pass

    return AvatarUploadResponse(success=True, avatar_url=new_url)


@router.delete("/users/me/avatar", status_code=status.HTTP_200_OK)
async def delete_avatar(db: DB, user_id: UserID):
    row = _get_user_row(db, user_id)
    old_url = row.avatar_url

    if not old_url:
        return {"success": True, "message": "头像已是默认状态"}

    # 从 DB 清空
    db.execute(
        text("UPDATE users SET avatar_url = NULL WHERE id = :uid"),
        {"uid": user_id},
    )
    db.commit()

    # 从 COS 删除
    try:
        from fastapi_app.core.cos import delete_avatar as cos_delete
        await cos_delete(old_url, user_id)
    except Exception:
        pass

    return {"success": True, "message": "头像已删除"}
