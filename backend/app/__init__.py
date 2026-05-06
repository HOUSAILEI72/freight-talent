import os
from flask import Flask, jsonify, send_from_directory
from app.config import get_config
from app.extensions import db, jwt, bcrypt, cors, migrate, limiter, socketio, blocklist_contains
from app.logging_config import setup_logging
from app.request_logging import init_request_logging


def create_app(config_class=None):
    setup_logging("flask")
    if config_class is None:
        config_class = get_config()
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Extensions
    db.init_app(app)
    jwt.init_app(app)
    bcrypt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})
    migrate.init_app(app, db)
    limiter.init_app(app)

    # message_queue: Redis URL — 空字符串或 None 时单进程模式，多实例需要设置
    _mq = app.config.get("SOCKETIO_MESSAGE_QUEUE") or None
    socketio.init_app(
        app,
        cors_allowed_origins='*',
        async_mode='eventlet',
        message_queue=_mq,
        logger=False,
        engineio_logger=False,
        ping_timeout=20,
        ping_interval=10,
    )

    # JWT blocklist callback — 拦截已撤销的 token（Redis 优先，降级到内存 set）
    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        return blocklist_contains(jwt_payload.get("jti", ""))

    @jwt.revoked_token_loader
    def revoked_token_response(jwt_header, jwt_payload):
        return jsonify({"success": False, "message": "Token 已失效，请重新登录"}), 401

    # Uniform 429 JSON response (Flask-Limiter default sends HTML)
    @app.errorhandler(429)
    def ratelimit_handler(e):
        return jsonify({
            "success": False,
            "message": "请求过于频繁，请稍后再试",
            "retry_after": getattr(e, "retry_after", None),
        }), 429

    # Blueprints
    from app.routes.auth import auth_bp
    from app.routes.jobs import jobs_bp
    from app.routes.candidates import candidates_bp
    from app.routes.invitations import invitations_bp
    from app.routes.applications import applications_bp
    from app.routes.admin import admin_bp
    from app.routes.conversations import conversations_bp
    from app.routes.admin_import import admin_import_bp
    from app.routes.employer_dashboard import employer_dashboard_bp
    app.register_blueprint(auth_bp)
    app.register_blueprint(jobs_bp)
    app.register_blueprint(candidates_bp)
    app.register_blueprint(invitations_bp, url_prefix='/api/invitations')
    app.register_blueprint(applications_bp)
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(conversations_bp, url_prefix='/api/conversations')
    app.register_blueprint(admin_import_bp, url_prefix='/api/admin/import')
    app.register_blueprint(employer_dashboard_bp)

    # 安装请求日志中间件（每个请求的方法、路径、状态、耗时、user_id、IP）
    init_request_logging(app)

    # Socket.IO 事件处理器
    from app.routes.socket_events import register_socket_events
    register_socket_events(socketio)

    # Ensure all models are imported so Flask-Migrate can detect them
    with app.app_context():
        from app.models import user         # noqa: F401
        from app.models import job          # noqa: F401
        from app.models import candidate    # noqa: F401
        from app.models import match_result # noqa: F401
        from app.models import invitation   # noqa: F401
        from app.models import job_application  # noqa: F401
        from app.models import conversation # noqa: F401
        from app.models import import_models  # noqa: F401
        from app.models import tag          # noqa: F401
        from app.models import junction_tags  # noqa: F401

    @app.get("/api/health")
    def health():
        """Liveness probe：快速检查进程存活。"""
        return jsonify({"status": "ok", "service": "freight-talent-flask"}), 200

    @app.get("/api/ready")
    def ready():
        """Readiness probe：检查数据库和 Redis 连通性，503 时 LB 摘流量。"""
        checks = {}

        try:
            db.session.execute(db.text("SELECT 1"))
            checks["database"] = "ok"
        except Exception:
            checks["database"] = "error"

        redis_url = app.config.get("REDIS_URL", "")
        if redis_url and redis_url.startswith("redis"):
            try:
                from app.extensions import _get_redis
                r = _get_redis()
                if r:
                    r.ping()
                    checks["redis"] = "ok"
                else:
                    checks["redis"] = "unavailable"
            except Exception:
                checks["redis"] = "error"
        else:
            checks["redis"] = "not_configured"

        degraded = any(v == "error" for v in checks.values())
        return jsonify({
            "status": "degraded" if degraded else "ok",
            "service": "freight-talent-flask",
            "checks": checks,
        }), (503 if degraded else 200)

    # ── 生产环境：Flask 托管前端 dist（SERVE_STATIC=true 时启用） ────────────
    if app.config.get("SERVE_STATIC"):
        static_folder = app.config.get("STATIC_FOLDER",
                                       os.path.join(os.path.dirname(__file__), "..", "..", "dist"))

        @app.route("/", defaults={"path": ""})
        @app.route("/<path:path>")
        def serve_spa(path):
            file_path = os.path.join(static_folder, path)
            if path and os.path.exists(file_path):
                return send_from_directory(static_folder, path)
            return send_from_directory(static_folder, "index.html")

    return app
