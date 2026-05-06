"""
Gunicorn 生产配置 — Flask + Flask-SocketIO（eventlet worker）

启动命令：
  cd backend
  gunicorn -c gunicorn.conf.py "app:create_app()"

注意：
  - Flask-SocketIO + eventlet 必须使用单 worker（-w 1）
  - eventlet worker class 会自动调用 monkey_patch()，无需在代码里重复调用
  - 多实例横向扩展需要设置 REDIS_URL（SocketIO message_queue）
"""
import os

bind = os.getenv("GUNICORN_BIND", "0.0.0.0:5000")

# Flask-SocketIO 要求单 worker（eventlet 协程处理高并发）
workers = 1
worker_class = "eventlet"
worker_connections = 1000

# 超时
timeout = int(os.getenv("GUNICORN_TIMEOUT", "60"))
keepalive = 5

# 日志
loglevel = os.getenv("GUNICORN_LOG_LEVEL", "info")
accesslog = "-"       # stdout
errorlog  = "-"       # stderr
access_log_format = '%(h)s "%(r)s" %(s)s %(b)s %(D)sus'

# 进程标题
proc_name = "freight-talent-flask"

# 优雅重启
graceful_timeout = 30
preload_app = False   # eventlet worker 不能 preload（fork 后 monkey_patch 会失效）
