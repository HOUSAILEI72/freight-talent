"""
开发用入口 — 仅限本地调试。
生产环境请使用 gunicorn（eventlet worker，单进程）：
  gunicorn -k eventlet -w 1 -b 0.0.0.0:5000 "app:create_app()"
"""
import eventlet
eventlet.monkey_patch(os=True, select=True, socket=True, thread=False, time=True)

from app import create_app
from app.extensions import socketio

app = create_app()

if __name__ == '__main__':
    socketio.run(
        app,
        host='127.0.0.1',
        port=5000,
        debug=False,
        use_reloader=False,   # eventlet 模式下 reloader 会导致双 monkey_patch
    )
