# ── Flask + Gunicorn 生产镜像 ─────────────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# 系统依赖：MySQL client lib + curl（healthcheck 用）
RUN apt-get update && apt-get install -y --no-install-recommends \
    default-libmysqlclient-dev gcc pkg-config curl \
    && rm -rf /var/lib/apt/lists/*

# 先复制 requirements 利用 Docker 缓存层
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 再复制应用代码
COPY . .

# 创建 uploads 目录（生产应挂载 volume）
RUN mkdir -p uploads

# 非 root 用户运行
RUN adduser --disabled-password --gecos '' appuser \
    && chown -R appuser /app
USER appuser

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:5000/api/health || exit 1

# ── 启动说明 ────────────────────────────────────────────────────────────────
# 使用 app factory pattern（app:create_app()），不经过 run.py，
# 避免 run.py 里的 eventlet.monkey_patch 与 gunicorn eventlet worker 冲突。
# gunicorn.conf.py 管理所有 gunicorn 参数（worker_class, bind, timeout 等）。
CMD ["gunicorn", "-c", "gunicorn.conf.py", "app:create_app()"]
