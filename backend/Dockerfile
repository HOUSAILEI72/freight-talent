# ── Flask + Gunicorn 生产镜像 ─────────────────────────────────────────────────
FROM python:3.11-slim

ARG APT_DEBIAN_MIRROR=http://mirrors.aliyun.com/debian
ARG APT_DEBIAN_SECURITY_MIRROR=http://mirrors.aliyun.com/debian-security
ARG PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/

WORKDIR /app

# 系统依赖：MySQL client lib + curl（healthcheck 用）
RUN set -eux; \
    if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
      sed -i \
        -e "s|http://deb.debian.org/debian|${APT_DEBIAN_MIRROR}|g" \
        -e "s|http://security.debian.org/debian-security|${APT_DEBIAN_SECURITY_MIRROR}|g" \
        /etc/apt/sources.list.d/debian.sources; \
    else \
      sed -i \
        -e "s|http://deb.debian.org/debian|${APT_DEBIAN_MIRROR}|g" \
        -e "s|http://security.debian.org/debian-security|${APT_DEBIAN_SECURITY_MIRROR}|g" \
        /etc/apt/sources.list; \
    fi; \
    apt-get update && apt-get install -y --no-install-recommends \
    default-libmysqlclient-dev gcc pkg-config curl \
    && rm -rf /var/lib/apt/lists/*

# 先复制 requirements 利用 Docker 缓存层
COPY requirements.txt .
RUN pip install --no-cache-dir -i "$PIP_INDEX_URL" -r requirements.txt

# 清理构建依赖（减小镜像体积 & 攻击面）
RUN apt-get purge -y gcc pkg-config && apt-get autoremove -y

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
  CMD curl -fsS http://127.0.0.1:5000/api/health || exit 1

# ── 启动说明 ────────────────────────────────────────────────────────────────
# 使用 app factory pattern（app:create_app()），不经过 run.py，
# 避免 run.py 里的 eventlet.monkey_patch 与 gunicorn eventlet worker 冲突。
# gunicorn.conf.py 管理所有 gunicorn 参数（worker_class, bind, timeout 等）。
CMD ["gunicorn", "-c", "gunicorn.conf.py", "app:create_app()"]
