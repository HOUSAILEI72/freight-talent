"""
Flask 请求生命周期日志中间件

记录每个请求的：方法、路径、状态码、耗时、JWT user_id、客户端 IP。
未捕获异常会带 traceback 进入 error 日志。
"""
import time
import logging
from flask import request, g

logger = logging.getLogger("flask.request")


def init_request_logging(app):
    """安装 before/after/teardown 钩子。在 create_app 中调用。"""

    @app.before_request
    def _start_timer():
        g._start_time = time.time()

    @app.after_request
    def _log_response(response):
        try:
            duration_ms = int((time.time() - g.get("_start_time", time.time())) * 1000)
            user_id = _maybe_user_id()
            ip = request.headers.get("X-Forwarded-For", request.remote_addr) or "-"

            level = logging.INFO
            if response.status_code >= 500:
                level = logging.ERROR
            elif response.status_code >= 400:
                level = logging.WARNING

            logger.log(
                level,
                "%s %s -> %s (%dms) user=%s ip=%s",
                request.method,
                request.full_path.rstrip("?"),
                response.status_code,
                duration_ms,
                user_id or "-",
                ip,
            )
        except Exception:
            logger.exception("after_request logging failed")
        return response

    @app.errorhandler(Exception)
    def _log_exception(err):
        """
        记录未捕获异常的 traceback。

        HTTPException（包括 404、403 等）原样返回，不包装成 500。
        普通未捕获异常记录 traceback 后重新抛出。
        """
        from werkzeug.exceptions import HTTPException

        # HTTPException 是 Flask/Werkzeug 的标准 HTTP 错误（404、403、500 等）
        # 这些已经有正确的状态码，不需要记录 traceback，直接返回
        if isinstance(err, HTTPException):
            # 记录简单日志即可，不需要 traceback
            logger.warning(
                "HTTP error on %s %s: %s %s",
                request.method,
                request.path,
                err.code,
                err.description,
            )
            # 返回原始 HTTPException 响应
            return err

        # 普通未捕获异常：记录完整 traceback
        logger.exception(
            "Unhandled exception on %s %s: %s",
            request.method,
            request.path,
            err,
        )
        # 重新抛出，由 Flask 默认处理器返回 500
        raise err


def _maybe_user_id():
    """从 JWT 提取 user_id；未登录或解析失败返回 None。"""
    try:
        from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
        verify_jwt_in_request(optional=True)
        return get_jwt_identity()
    except Exception:
        return None
