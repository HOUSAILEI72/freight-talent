# ── 后端生产镜像（gunicorn + Flask）────────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# 系统依赖（pymysql 需要 libmariadb-dev 或 default-libmysqlclient-dev）
RUN apt-get update && apt-get install -y --no-install-recommends \
    default-libmysqlclient-dev gcc pkg-config curl \
    && rm -rf /var/lib/apt/lists/*

# 依赖安装（先 COPY requirements 利用缓存层）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 拷贝应用代码
COPY . .

# 创建 uploads 目录（生产应挂载卷或使用对象存储）
RUN mkdir -p uploads

# 非 root 用户运行
RUN adduser --disabled-password --gecos '' appuser && chown -R appuser /app
USER appuser

EXPOSE 5000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -fsS http://localhost:5000/api/health || exit 1

# gunicorn：4 worker，超时 120s
CMD ["gunicorn", "-k", "eventlet", "-w", "1", "-b", "0.0.0.0:5000", "--timeout", "120", \
     "--access-logfile", "-", "--error-logfile", "-", \
     "run:app"]
