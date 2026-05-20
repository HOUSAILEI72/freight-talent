"""
Flask 侧腾讯 COS 工具 — 简历附件上传 / 删除 / 预签名 URL。

与 fastapi_app/core/cos.py（头像专用）平行存在，供 Flask 路由同步调用。
COS SDK 是同步的，Flask 中直接调用无需包装。

若 COS 凭证未配置（本地开发），上传返回 None，调用方降级到本地磁盘存储。
"""
import logging
import os
import uuid
from urllib.parse import urlparse

_log = logging.getLogger(__name__)

_MIME = {
    "pdf": "application/pdf",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def _client_and_settings():
    """返回 (CosS3Client, bucket, region, cdn_domain) 或 (None, ...) 若未配置。"""
    secret_id = os.getenv("COS_SECRET_ID", "")
    secret_key = os.getenv("COS_SECRET_KEY", "")
    bucket = os.getenv("COS_BUCKET", "")
    region = os.getenv("COS_REGION", "ap-guangzhou")
    cdn_domain = os.getenv("COS_CDN_DOMAIN", "")

    if not secret_id or not secret_key or not bucket:
        return None, bucket, region, cdn_domain

    from qcloud_cos import CosConfig, CosS3Client
    config = CosConfig(Region=region, SecretId=secret_id, SecretKey=secret_key)
    return CosS3Client(config), bucket, region, cdn_domain


def _build_url(bucket: str, region: str, key: str, cdn_domain: str) -> str:
    if cdn_domain:
        return f"https://{cdn_domain.rstrip('/')}/{key}"
    return f"https://{bucket}.cos.{region}.myqcloud.com/{key}"


def _extract_key(cos_url: str, bucket: str, region: str, cdn_domain: str) -> str:
    """从 COS URL 提取 object key。"""
    prefixes = []
    if cdn_domain:
        prefixes.append(f"https://{cdn_domain.rstrip('/')}/")
    prefixes.append(f"https://{bucket}.cos.{region}.myqcloud.com/")
    for p in prefixes:
        if cos_url.startswith(p):
            return cos_url[len(p):]
    # 兜底：解析 path
    return urlparse(cos_url).path.lstrip("/")


def upload_resume(file_bytes: bytes, user_id: int, original_filename: str) -> str | None:
    """
    上传简历附件到 COS，返回对象 URL（私有读权限）。
    COS 未配置时返回 None，调用方需降级到本地存储。
    """
    client, bucket, region, cdn_domain = _client_and_settings()
    if client is None:
        return None

    ext = original_filename.rsplit(".", 1)[-1].lower() if "." in original_filename else "pdf"
    key = f"resumes/{user_id}/{uuid.uuid4().hex}.{ext}"

    client.put_object(
        Bucket=bucket,
        Body=file_bytes,
        Key=key,
        ContentType=_MIME.get(ext, "application/octet-stream"),
    )
    _log.info("简历上传 COS 成功 user_id=%s key=%s", user_id, key)
    return _build_url(bucket, region, key, cdn_domain)


def delete_resume(cos_url: str) -> None:
    """删除 COS 上的旧简历（静默失败，不影响主流程）。"""
    if not cos_url or not cos_url.startswith("https://"):
        return
    try:
        client, bucket, region, cdn_domain = _client_and_settings()
        if client is None:
            return
        key = _extract_key(cos_url, bucket, region, cdn_domain)
        if not key:
            return
        client.delete_object(Bucket=bucket, Key=key)
        _log.info("旧简历已从 COS 删除 key=%s", key)
    except Exception as e:
        _log.warning("删除 COS 简历失败（静默忽略）：%s", e)


def get_presigned_url(cos_url: str, expires: int = 3600) -> str:
    """
    生成预签名临时访问 URL（默认 1 小时有效）。
    COS 未配置时原样返回 cos_url。
    """
    if not cos_url or not cos_url.startswith("https://"):
        return cos_url
    try:
        client, bucket, region, cdn_domain = _client_and_settings()
        if client is None:
            return cos_url
        key = _extract_key(cos_url, bucket, region, cdn_domain)
        if not key:
            return cos_url
        return client.get_presigned_url(
            Method="GET",
            Bucket=bucket,
            Key=key,
            Expired=expires,
        )
    except Exception as e:
        _log.warning("生成预签名 URL 失败，回退原 URL：%s", e)
        return cos_url
