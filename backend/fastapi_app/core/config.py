"""
FastAPI 服务配置 — 复用 backend/.env，与 Flask 共享同一套环境变量。
"""
import os
import pathlib
from functools import lru_cache
from pydantic_settings import BaseSettings

# backend/.env 的绝对路径：fastapi_app/core/ -> fastapi_app/ -> backend/
_ENV_FILE = pathlib.Path(__file__).parent.parent.parent / ".env"


class Settings(BaseSettings):
    # ── 数据库（与 Flask 共用） ───────────────────────────────────────────────
    db_user: str = "root"
    db_password: str = ""
    db_host: str = "127.0.0.1"
    db_port: int = 3306
    db_name: str = "freight_talent"

    @property
    def database_url(self) -> str:
        return (
            f"mysql+pymysql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}?charset=utf8mb4"
        )

    # ── JWT（与 Flask 共用同一个 secret，tokens 互通） ────────────────────────
    jwt_secret_key: str = ""
    jwt_algorithm: str = "HS256"

    # ── Redis ─────────────────────────────────────────────────────────────────
    redis_url: str = ""

    # ── CORS ──────────────────────────────────────────────────────────────────
    # 生产：CORS_ORIGINS=https://yourdomain.com
    # 开发：CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    # ── 服务元信息 ────────────────────────────────────────────────────────────
    app_name: str = "FreightTalent FastAPI"
    app_version: str = "0.1.0"
    debug: bool = False

    class Config:
        env_file = str(_ENV_FILE)       # backend/.env 绝对路径
        env_file_encoding = "utf-8"
        case_sensitive = False          # DB_HOST → db_host
        extra = "ignore"               # 忽略 .env 中 Flask 专用的字段


@lru_cache
def get_settings() -> Settings:
    """单例，避免重复读取 .env。"""
    return Settings()
