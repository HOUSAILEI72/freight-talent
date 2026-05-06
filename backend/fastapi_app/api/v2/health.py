"""
/api/v2/health  — liveness probe（进程存活）
/api/v2/ready   — readiness probe（DB + Redis 可用）
"""
from fastapi import APIRouter, Response
from fastapi.responses import JSONResponse

from fastapi_app.core.database import check_db
from fastapi_app.core.redis import check_redis
from fastapi_app.core.config import get_settings

router = APIRouter(tags=["health"])
settings = get_settings()


@router.get("/health")
def health():
    """Liveness: 进程存活就返回 200。"""
    return {
        "status": "ok",
        "service": "freight-talent-fastapi",
        "version": settings.app_version,
    }


@router.get("/ready")
def ready(response: Response):
    """
    Readiness: 检查 DB + Redis 是否可用。
    任一 error 时返回 503，LB 应停止向此实例转发流量。
    """
    checks: dict[str, str] = {}

    checks["database"] = "ok" if check_db() else "error"

    if settings.redis_url and settings.redis_url.startswith("redis"):
        checks["redis"] = "ok" if check_redis() else "error"
    else:
        checks["redis"] = "not_configured"

    degraded = any(v == "error" for v in checks.values())
    status_str = "degraded" if degraded else "ok"
    http_code = 503 if degraded else 200

    response.status_code = http_code
    return JSONResponse(
        status_code=http_code,
        content={
            "status": status_str,
            "service": "freight-talent-fastapi",
            "checks": checks,
        },
    )
