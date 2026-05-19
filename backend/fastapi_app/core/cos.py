"""
腾讯 COS 客户端封装 — 头像上传/删除。

依赖：cos-python-sdk-v5（pip install cos-python-sdk-v5）
SDK 是同步调用，通过 asyncio.to_thread 包装，避免阻塞 FastAPI 事件循环。

若 COS 凭证未配置（开发环境），上传会抛出 RuntimeError。
"""
import asyncio
import logging
import uuid
from urllib.parse import urlparse

_log = logging.getLogger(__name__)

_ALLOWED_EXTS = {"jpg", "jpeg", "png", "webp"}
_MAX_SIZE = 3 * 1024 * 1024  # 3 MB


def _get_cos_client():
    from qcloud_cos import CosConfig, CosS3Client
    from fastapi_app.core.config import get_settings
    s = get_settings()
    if not s.cos_secret_id or not s.cos_secret_key or not s.cos_bucket:
        raise RuntimeError("腾讯 COS 凭证未配置，请在 .env 中设置 COS_SECRET_ID / COS_SECRET_KEY / COS_BUCKET")
    config = CosConfig(Region=s.cos_region, SecretId=s.cos_secret_id, SecretKey=s.cos_secret_key)
    return CosS3Client(config), s


def _build_avatar_url(bucket: str, region: str, key: str, cdn_domain: str) -> str:
    if cdn_domain:
        domain = cdn_domain.rstrip("/")
        return f"https://{domain}/{key}"
    return f"https://{bucket}.cos.{region}.myqcloud.com/{key}"


def _sync_upload(user_id: int, file_bytes: bytes, ext: str) -> str:
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
        client, s = _get_cos_client()
        parsed = urlparse(old_url)
        key = parsed.path.lstrip("/")
        # 安全检查：只删除属于该用户的头像
        if not key.startswith(f"avatars/{user_id}/"):
            return
        client.delete_object(Bucket=s.cos_bucket, Key=key)
    except Exception as e:
        _log.warning("删除旧头像失败（静默忽略）：%s", e)


async def upload_avatar(user_id: int, file_bytes: bytes, ext: str) -> str:
    """上传头像到 COS，返回公开 URL。ext 为 jpg/png/webp。"""
    return await asyncio.to_thread(_sync_upload, user_id, file_bytes, ext)


async def delete_avatar(old_url: str, user_id: int):
    """删除旧头像（静默失败，不影响主流程）。"""
    if not old_url:
        return
    await asyncio.to_thread(_sync_delete, old_url, user_id)
