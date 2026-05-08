from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_migrate import Migrate
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_socketio import SocketIO
import os

db = SQLAlchemy()
jwt = JWTManager()
bcrypt = Bcrypt()
cors = CORS()
migrate = Migrate()
limiter = Limiter(key_func=get_remote_address, default_limits=[])
socketio = SocketIO()

# ── JWT Blocklist ─────────────────────────────────────────────────────────────
# 生产：使用 Redis Set，跨 worker、跨重启均有效。
# 开发（REDIS_URL 未设置）：回退到进程内 set（单 worker 场景可用）。
#
# 用法：
#   from app.extensions import blocklist_add, blocklist_contains
#
_redis_client = None
_fallback_blocklist: set[str] = set()


def _get_redis():
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    redis_url = os.getenv('REDIS_URL') or os.getenv('RATELIMIT_STORAGE_URI', '')
    if redis_url and redis_url.startswith('redis'):
        try:
            import redis as _redis
            _redis_client = _redis.from_url(redis_url, decode_responses=True)
            _redis_client.ping()          # 立即验证连通性
            return _redis_client
        except Exception:
            _redis_client = None          # 连接失败，退回 fallback
    return None


def blocklist_add(jti: str, expires_in_seconds: int = 60 * 60 * 24 * 8) -> None:
    """把 jti 加入黑名单；expires_in_seconds 默认 8 天（稍长于 refresh token 7 天）。"""
    r = _get_redis()
    if r is not None:
        try:
            r.setex(f'jwt_bl:{jti}', expires_in_seconds, '1')
            return
        except Exception:
            pass
    _fallback_blocklist.add(jti)


def blocklist_contains(jti: str) -> bool:
    """检查 jti 是否在黑名单中。"""
    r = _get_redis()
    if r is not None:
        try:
            return bool(r.exists(f'jwt_bl:{jti}'))
        except Exception:
            pass
    return jti in _fallback_blocklist


# 向后兼容：旧代码直接 import jwt_blocklist 的地方仍可用（仅 fallback set）
jwt_blocklist = _fallback_blocklist


# ── 邮件发送 ──────────────────────────────────────────────────────────────────

def send_mail(to, subject, html_body):
    """发送 HTML 邮件。若 MAIL_ENABLED=false 则静默返回。"""
    import smtplib
    import logging
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    from flask import current_app

    cfg = current_app.config
    if not cfg.get('MAIL_ENABLED'):
        return

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = cfg['MAIL_DEFAULT_SENDER']
    msg['To'] = to
    msg.attach(MIMEText(html_body, 'html', 'utf-8'))

    try:
        if cfg.get('MAIL_USE_SSL'):
            server = smtplib.SMTP_SSL(cfg['MAIL_HOST'], cfg['MAIL_PORT'], timeout=10)
        else:
            server = smtplib.SMTP(cfg['MAIL_HOST'], cfg['MAIL_PORT'], timeout=10)
            server.starttls()
        server.login(cfg['MAIL_USERNAME'], cfg['MAIL_PASSWORD'])
        server.sendmail(cfg['MAIL_DEFAULT_SENDER'], [to], msg.as_string())
        server.quit()
    except Exception as e:
        logging.getLogger(__name__).error(f"Failed to send email to {to}: {e}")
        raise   # 让调用方感知 SMTP 失败

