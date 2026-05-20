"""
开发用入口 — 仅限本地调试。
生产环境请使用 gunicorn（eventlet worker，单进程）：
  gunicorn -k eventlet -w 1 -b 0.0.0.0:5000 "app:create_app()"

MESSAGES FEATURE DISABLED: 设置 ENABLE_SOCKETIO=true 可重新启用 Socket.IO。
默认以普通 Flask dev server 启动（不需要 eventlet）。
"""
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

_enable_socketio = os.getenv("ENABLE_SOCKETIO", "false").lower() == "true"

if _enable_socketio:
    import eventlet
    eventlet.monkey_patch(os=True, select=True, socket=True, thread=False, time=True)

from app import create_app
from app.extensions import socketio

app = create_app()

if __name__ == '__main__':
    if _enable_socketio:
        socketio.run(
            app,
            host='0.0.0.0',
            port=5000,
            debug=False,
            use_reloader=False,
        )
    else:
        app.run(host='0.0.0.0', port=5000, debug=False)
