"""
Gunicorn 生产配置 — Flask

启动命令：
  cd backend
  gunicorn -c gunicorn.conf.py "app:create_app()"

注意：
  - 消息功能已禁用（ENABLE_SOCKETIO 默认 false）
  - ENABLE_SOCKETIO=false：使用 sync worker，可多开进程（workers = CPU * 2 + 1）
  - ENABLE_SOCKETIO=true：必须使用 eventlet 单进程（workers = 1）
  - 多实例横向扩展需要设置 REDIS_URL
"""
import os
import multiprocessing

bind = os.getenv("GUNICORN_BIND", "0.0.0.0:5000")

_enable_socketio = os.getenv("ENABLE_SOCKETIO", "false").lower() == "true"

if _enable_socketio:
    # Flask-SocketIO 要求单 worker（eventlet 协程处理高并发）
    workers = 1
    worker_class = "eventlet"
    worker_connections = 1000
else:
    # 消息功能关闭时：sync worker，多进程提升并发
    workers = int(os.getenv("GUNICORN_WORKERS", multiprocessing.cpu_count() * 2 + 1))
    worker_class = "sync"
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
preload_app = False
