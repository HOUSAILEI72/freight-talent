import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()


class Config:
    # ── 数据库 ────────────────────────────────────────────────────────────────
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "3306")
    DB_NAME = os.getenv("DB_NAME", "freight_talent")
    SQLALCHEMY_DATABASE_URI = (
        f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
        "?charset=utf8mb4"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # ── JWT ───────────────────────────────────────────────────────────────────
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
    if not JWT_SECRET_KEY:
        raise ValueError(
            "JWT_SECRET_KEY is not set. "
            "Add it to backend/.env (at least 32 random characters)."
        )
    # access token 过期时间：优先读 JWT_ACCESS_TOKEN_EXPIRES_MINUTES（分钟），
    # 若未设置则读 JWT_ACCESS_TOKEN_EXPIRES_HOURS（小时），默认 15 分钟。
    _access_minutes = os.getenv("JWT_ACCESS_TOKEN_EXPIRES_MINUTES")
    _access_hours   = os.getenv("JWT_ACCESS_TOKEN_EXPIRES_HOURS")
    if _access_minutes is not None:
        JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=int(_access_minutes))
    elif _access_hours is not None:
        JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=int(_access_hours))
    else:
        JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)
    # refresh token 7 天
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(
        days=int(os.getenv("JWT_REFRESH_TOKEN_EXPIRES_DAYS", 7))
    )

    # ── CORS ──────────────────────────────────────────────────────────────────
    CORS_ORIGINS = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")

    # ── 文件上传 ──────────────────────────────────────────────────────────────
    UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "..", "uploads")
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024   # 10 MB
    ALLOWED_EXTENSIONS = {"pdf", "doc", "docx"}

    # ── 限流 ──────────────────────────────────────────────────────────────────
    RATELIMIT_STORAGE_URI = os.getenv("RATELIMIT_STORAGE_URI", "memory://")
    RATELIMIT_HEADERS_ENABLED = True
    RATELIMIT_DEFAULT_ERROR_MESSAGE = "请求过于频繁，请稍后再试"

    # ── 静态资源（生产托管前端 dist） ─────────────────────────────────────────
    SERVE_STATIC = os.getenv("SERVE_STATIC", "false").lower() == "true"
    STATIC_FOLDER = os.path.join(os.path.dirname(__file__), "..", "..", "dist")


class DevelopmentConfig(Config):
    """本地开发配置。"""
    DEBUG = True


class ProductionConfig(Config):
    """生产配置（通过环境变量 FLASK_ENV=production 激活）。"""
    DEBUG = False
    # 生产必须用 Redis 限流（避免多进程内存隔离问题）
    RATELIMIT_STORAGE_URI = os.getenv("RATELIMIT_STORAGE_URI")
    if not RATELIMIT_STORAGE_URI:
        raise ValueError(
            "生产环境必须设置 RATELIMIT_STORAGE_URI（如 redis://localhost:6379/0）"
        )


def get_config():
    env = os.getenv("FLASK_ENV", "development")
    if env == "production":
        return ProductionConfig
    return DevelopmentConfig
