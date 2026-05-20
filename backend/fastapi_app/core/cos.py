"""
腾讯 COS 客户端封装 — 头像上传/删除。

依赖：cos-python-sdk-v5（pip install cos-python-sdk-v5）
SDK 是同步调用，通过 asyncio.to_thread 包装，避免阻塞 FastAPI 事件循环。

本地开发：COS 凭证未配置时自动 fallback 到本地文件系统
  存储路径：backend/uploads/avatars/{user_id}/{uuid}.{ext}
  访问 URL：/uploads/avatars/{user_id}/{uuid}.{ext}
  FastAPI 挂载静态路由 /uploads，Vite proxy 转发 /uploads → port 8000
"""
import asyncio
import logging
import pathlib
import uuid
from urllib.parse import urlparse

_log = logging.getLogger(__name__)

_ALLOWED_EXTS = {"jpg", "jpeg", "png", "webp"}
_MAX_SIZE = 3 * 1024 * 1024  # 3 MB

# backend/ 目录（此文件在 backend/fastapi_app/core/cos.py，上溯三级）
_BACKEND_DIR = pathlib.Path(__file__).parent.parent.parent
_LOCAL_UPLOADS = _BACKEND_DIR / "uploads"


def _cos_configured() -> bool:
    from fastapi_app.core.config import get_settings
    s = get_settings()
    return bool(s.cos_secret_id and s.cos_secret_key and s.cos_bucket)


def _get_cos_client():
    from qcloud_cos import CosConfig, CosS3Client
    from fastapi_app.core.config import get_settings
    s = get_settings()
    config = CosConfig(Region=s.cos_region, SecretId=s.cos_secret_id, SecretKey=s.cos_secret_key)
    return CosS3Client(config), s


def _build_avatar_url(bucket: str, region: str, key: str, cdn_domain: str) -> str:
    if cdn_domain:
        domain = cdn_domain.rstrip("/")
        return f"https://{domain}/{key}"
    return f"https://{bucket}.cos.{region}.myqcloud.com/{key}"


# ── 本地 fallback ──────────────────────────────────────────────────────────────

def _sync_upload_local(user_id: int, file_bytes: bytes, ext: str) -> str:
    dest_dir = _LOCAL_UPLOADS / "avatars" / str(user_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.{ext}"
    (dest_dir / filename).write_bytes(file_bytes)
    _log.info("本地头像已保存（开发模式）：%s", dest_dir / filename)
    return f"/uploads/avatars/{user_id}/{filename}"


def _sync_delete_local(old_url: str, user_id: int):
    try:
        # old_url 形如 /uploads/avatars/{user_id}/{file}
        path = _BACKEND_DIR / old_url.lstrip("/")
        if str(path).find(f"avatars/{user_id}/") == -1:
            return
        if path.exists():
            path.unlink()
    except Exception as e:
        _log.warning("删除本地旧头像失败（静默忽略）：%s", e)


# ── COS 路径 ───────────────────────────────────────────────────────────────────

def _sync_upload(user_id: int, file_bytes: bytes, ext: str) -> str:
    if not _cos_configured():
        return _sync_upload_local(user_id, file_bytes, ext)
    client, s = _get_cos_client()
    key = f"avatars/{user_id}/{uuid.uuid4().hex}.{ext}"
    client.put_object(
        Bucket=s.cos_bucket,
        Body=file_bytes,
        Key=key,
        ContentType=f"image/{'jpeg' if ext == 'jpg' else ext}",
        ACL="public-read",
    )
    return _build_avatar_url(s.cos_bucket, s.cos_region, key, s.cos_cdn_domain)


def _sync_delete(old_url: str, user_id: int):
    try:
        if old_url.startswith("/uploads/"):
            _sync_delete_local(old_url, user_id)
            return
        client, s = _get_cos_client()
        parsed = urlparse(old_url)
        key = parsed.path.lstrip("/")
        if not key.startswith(f"avatars/{user_id}/"):
            return
        client.delete_object(Bucket=s.cos_bucket, Key=key)
    except Exception as e:
        _log.warning("删除旧头像失败（静默忽略）：%s", e)


async def upload_avatar(user_id: int, file_bytes: bytes, ext: str) -> str:
    """上传头像，COS 已配置走 COS，否则存本地 uploads/。"""
    return await asyncio.to_thread(_sync_upload, user_id, file_bytes, ext)


async def delete_avatar(old_url: str, user_id: int):
    """删除旧头像（静默失败，不影响主流程）。"""
    if not old_url:
        return
    await asyncio.to_thread(_sync_delete, old_url, user_id)


def get_presigned_download_url(cos_url: str, expires: int = 300) -> str:
    """为私有 COS 文件生成预签名下载 URL。"""
    client, s = _get_cos_client()
    parsed = urlparse(cos_url)
    key = parsed.path.lstrip("/")
    return client.get_presigned_url(
        Method="GET",
        Bucket=s.cos_bucket,
        Key=key,
        Expired=expires,
    )
