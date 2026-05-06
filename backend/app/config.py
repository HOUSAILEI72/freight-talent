import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()


class Config:
    # ── 数据库 ────────────────────────────────────────────────────────────────
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_HOST = os.getenv("DB_HOST", "127.0.0.1")   # 默认 127.0.0.1，避免 localhost DNS 解析超时
    DB_PORT = os.getenv("DB_PORT", "3306")
    DB_NAME = os.getenv("DB_NAME", "freight_talent")
    SQLALCHEMY_DATABASE_URI = (
        f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
        "?charset=utf8mb4"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # 生产级连接池：避免空闲连接被 MySQL 断开（wait_timeout），加快请求响应
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,       # 每次取连接前 SELECT 1，自动剔除死连接
        "pool_recycle": 1800,        # 30 分钟强制回收，短于 MySQL 默认 wait_timeout(8h)
        "pool_timeout": 30,          # 等待可用连接的最长秒数
        "pool_size": 10,             # 常驻连接数（单进程够用）
        "max_overflow": 20,          # 峰值时最多额外开 20 个短暂连接
    }

    # ── JWT ───────────────────────────────────────────────────────────────────
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
    if not JWT_SECRET_KEY:
        raise ValueError(
            "JWT_SECRET_KEY is not set. "
            "Add it to backend/.env (at least 32 random characters)."
        )
    _access_minutes = os.getenv("JWT_ACCESS_TOKEN_EXPIRES_MINUTES")
    _access_hours   = os.getenv("JWT_ACCESS_TOKEN_EXPIRES_HOURS")
    if _access_minutes is not None:
        JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=int(_access_minutes))
    elif _access_hours is not None:
        JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=int(_access_hours))
    else:
        JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(
        days=int(os.getenv("JWT_REFRESH_TOKEN_EXPIRES_DAYS", 7))
    )

    # ── CORS ──────────────────────────────────────────────────────────────────
    CORS_ORIGINS = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_URL = os.getenv("REDIS_URL", "")

    # Flask-SocketIO 多实例广播消息队列（单进程可留空，多进程/多机必须设置）
    SOCKETIO_MESSAGE_QUEUE = os.getenv("REDIS_URL", "") or None

    # ── 限流 ──────────────────────────────────────────────────────────────────
    RATELIMIT_STORAGE_URI = os.getenv("RATELIMIT_STORAGE_URI", "memory://")
    RATELIMIT_HEADERS_ENABLED = True
    RATELIMIT_DEFAULT_ERROR_MESSAGE = "请求过于频繁，请稍后再试"
    RATELIMIT_SWALLOW_ERRORS = True   # Redis 不可用时降级为不限流而非报错

    # ── 文件上传 ──────────────────────────────────────────────────────────────
    UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "..", "uploads")
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024   # 10 MB
    ALLOWED_EXTENSIONS = {"pdf", "doc", "docx"}

    # ── 静态资源（生产托管前端 dist） ─────────────────────────────────────────
    SERVE_STATIC = os.getenv("SERVE_STATIC", "false").lower() == "true"
    STATIC_FOLDER = os.path.join(os.path.dirname(__file__), "..", "..", "dist")

    # ── 邮件 ──────────────────────────────────────────────────────────────────
    MAIL_ENABLED = os.getenv("MAIL_ENABLED", "true").lower() == "true"
    MAIL_HOST = os.getenv("MAIL_HOST", "smtp.exmail.qq.com")
    MAIL_PORT = int(os.getenv("MAIL_PORT", "465"))
    MAIL_USE_SSL = os.getenv("MAIL_USE_SSL", "true").lower() == "true"
    MAIL_USERNAME = os.getenv("MAIL_USERNAME", "")
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", "")
    MAIL_DEFAULT_SENDER = os.getenv("MAIL_DEFAULT_SENDER", "ACE-Talent <ace_talent@globalogin.com>")
    PUBLIC_SITE_URL = os.getenv("PUBLIC_SITE_URL", "https://globalogin.com")


class DevelopmentConfig(Config):
    """本地开发配置。"""
    DEBUG = True


class ProductionConfig(Config):
    """生产配置（通过环境变量 FLASK_ENV=production 激活）。"""
    DEBUG = False

    # 生产必须用 Redis 限流（避免多进程内存隔离）
    RATELIMIT_STORAGE_URI = os.getenv("RATELIMIT_STORAGE_URI")
    if not RATELIMIT_STORAGE_URI:
        raise ValueError(
            "生产环境必须设置 RATELIMIT_STORAGE_URI（如 redis://127.0.0.1:6379/0）"
        )

    # 生产必须用 Redis JWT blocklist（跨 worker 生效）
    REDIS_URL = os.getenv("REDIS_URL")
    if not REDIS_URL:
        raise ValueError(
            "生产环境必须设置 REDIS_URL（如 redis://127.0.0.1:6379/0）"
        )

    # 连接池在生产用更保守配置
    SQLALCHEMY_ENGINE_OPTIONS = {
        **Config.SQLALCHEMY_ENGINE_OPTIONS,
        "pool_size": 5,        # gunicorn 单进程，5 个常驻连接足够
        "max_overflow": 10,
    }


def get_config():
    env = os.getenv("FLASK_ENV", "development")
    if env == "production":
        return ProductionConfig
    return DevelopmentConfig
