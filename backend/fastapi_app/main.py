"""
FreightTalent FastAPI 服务入口。

路由前缀规范：
  /api/v2/*  — FastAPI 新增模块（本文件注册）
  /api/*     — Flask 存量接口（另一个进程，port 5000）

本地启动：
  cd backend
  source ../.venv/bin/activate        # Linux/Mac
  ../.venv/Scripts/activate           # Windows
  python fastapi_run.py               # --reload，port 8000

生产启动（Docker 内）：
  uvicorn fastapi_app.main:app --host 0.0.0.0 --port 8000 --workers 4
"""
import asyncio
import logging
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import httpx

from logging_config import setup_logging
from fastapi_app.core.config import get_settings
from fastapi_app.api.v2 import health, conversations, tags, chart, ai_analyze, notifications, users as users_router
from fastapi_app.api.v2 import settings as settings_router
from fastapi_app.api.v2 import ai_polish, resume as resume_router
from fastapi_app.api.v2 import ai_diagnosis

# FastAPI 启动时初始化日志（与 Flask 共用同一份配置，写入 fastapi.log）
setup_logging("fastapi")
_request_logger = logging.getLogger("fastapi.request")

_settings = get_settings()

import os as _os

_SENSITIVE_FA = {
    "authorization", "cookie", "set-cookie",
    "password", "token", "access_token", "refresh_token",
    "phone", "email", "resume", "file", "attachment", "id_card",
    "身份证", "手机号", "邮箱",
}


def _strip_sensitive_fa(d):
    if not isinstance(d, dict):
        return d
    result = {}
    for k, v in d.items():
        if k.lower() in _SENSITIVE_FA:
            result[k] = "[FILTERED]"
        elif isinstance(v, dict):
            result[k] = _strip_sensitive_fa(v)
        else:
            result[k] = v
    return result


def _before_send_fa(event, hint):
    if "request" in event:
        req = event["request"]
        if "headers" in req:
            req["headers"] = _strip_sensitive_fa(req["headers"])
        req["data"] = None
    if "extra" in event:
        event["extra"] = _strip_sensitive_fa(event["extra"])
    return event


_sentry_dsn = _os.getenv("SENTRY_DSN")
if _sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.starlette import StarletteIntegration
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    sentry_sdk.init(
        dsn=_sentry_dsn,
        integrations=[StarletteIntegration(), FastApiIntegration()],
        send_default_pii=False,
        max_request_body_size="never",
        environment="production",
        traces_sample_rate=0.05,
        before_send=_before_send_fa,
    )


def _flush_chart_cache():
    """每日 08:00 CST 清除所有柱状图缓存，确保数据新鲜。"""
    from fastapi_app.core.redis import get_redis_client
    import logging
    redis = get_redis_client()
    if redis:
        try:
            keys = redis.keys("chart:*")
            if keys:
                redis.delete(*keys)
            logging.getLogger("fastapi_app").info(f"Chart cache flushed: {len(keys)} keys")
        except Exception as e:
            logging.getLogger("fastapi_app").warning(f"Chart cache flush failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.cron import CronTrigger

    scheduler = BackgroundScheduler(timezone="Asia/Shanghai")
    scheduler.add_job(_flush_chart_cache, CronTrigger(hour=8, minute=0))
    scheduler.start()

    # 启动时预热 DB 连接池，尽早发现连通性问题
    from fastapi_app.core.database import engine
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as e:
        logging.getLogger("fastapi_app").warning(f"DB warmup failed: {e}")

    # 全局复用的 DeepSeek httpx 客户端（连接池 10，避免每次建连）
    app.state.deepseek_client = httpx.AsyncClient(
        limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
        timeout=httpx.Timeout(30.0),
    )

    _log = logging.getLogger("fastapi_app")
    if _settings.deepseek_api_key:
        _log.info("DeepSeek API key loaded (length=%d)", len(_settings.deepseek_api_key))
    else:
        _log.warning(
            "DeepSeek API key NOT set — add DEEPSEEK_API_KEY=sk-... to backend/.env"
        )

    yield
    scheduler.shutdown(wait=False)
    engine.dispose()
    await app.state.deepseek_client.aclose()


# 生产关闭 swagger docs，避免暴露接口信息
_docs_url   = "/api/v2/docs"        if _settings.debug else None
_redoc_url  = "/api/v2/redoc"       if _settings.debug else None
_openapi_url = "/api/v2/openapi.json" if _settings.debug else None

app = FastAPI(
    title=_settings.app_name,
    version=_settings.app_version,
    docs_url=_docs_url,
    redoc_url=_redoc_url,
    openapi_url=_openapi_url,
    lifespan=lifespan,
)

# CORS：从环境变量读取，开发用 localhost:5173，生产用实际域名
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 路由注册（/api/v2 前缀） ──────────────────────────────────────────────────
app.include_router(health.router,          prefix="/api/v2")
app.include_router(conversations.router,   prefix="/api/v2")
app.include_router(tags.router,            prefix="/api/v2")
app.include_router(settings_router.router, prefix="/api/v2")
app.include_router(chart.router,           prefix="/api/v2")
app.include_router(ai_analyze.router,      prefix="/api/v2")
app.include_router(notifications.router,   prefix="/api/v2")
app.include_router(users_router.router,    prefix="/api/v2")
app.include_router(ai_polish.router,       prefix="/api/v2")
app.include_router(resume_router.router,   prefix="/api/v2")
app.include_router(ai_diagnosis.router,    prefix="/api/v2")


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    try:
        response = await call_next(request)
    except Exception as exc:
        duration_ms = int((time.time() - start) * 1000)
        _request_logger.exception(
            "%s %s -> 500 (%dms) ip=%s :: %s",
            request.method, request.url.path, duration_ms,
            request.client.host if request.client else "-", exc,
        )
        raise

    duration_ms = int((time.time() - start) * 1000)
    level = logging.INFO
    if response.status_code >= 500:
        level = logging.ERROR
    elif response.status_code >= 400:
        level = logging.WARNING

    _request_logger.log(
        level,
        "%s %s -> %s (%dms) ip=%s",
        request.method, request.url.path, response.status_code,
        duration_ms, request.client.host if request.client else "-",
    )
    return response
