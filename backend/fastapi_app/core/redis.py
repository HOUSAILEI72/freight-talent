"""
FastAPI 专用 Redis 客户端（与 Flask 侧共享同一个 Redis，不共享连接池对象）。
"""
import redis
from functools import lru_cache
from .config import get_settings


@lru_cache
def get_redis_client() -> redis.Redis | None:
    settings = get_settings()
    if not settings.redis_url or not settings.redis_url.startswith("redis"):
        return None
    try:
        client = redis.from_url(settings.redis_url, decode_responses=True)
        client.ping()
        return client
    except Exception:
        return None


def check_redis() -> bool:
    """健康检查：验证 Redis 连通性。"""
    try:
        r = get_redis_client()
        if r is None:
            return False
        r.ping()
        return True
    except Exception:
        return False
