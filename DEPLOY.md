# FreightTalent — 服务器部署手册

目标环境：单台 Linux 服务器（Ubuntu 22.04 / Debian 12）+ Docker + Docker Compose

---

## 服务架构

```
Internet (80/443)
      │
   Nginx (frontend container)
   ├── /api/v2/*   → FastAPI   (fastapi:8000, 内网)
   ├── /api/*      → Flask     (backend:5000, 内网)
   ├── /socket.io/ → Flask     (backend:5000, 内网, WebSocket)
   └── /*          → React SPA (本地 dist/)

内网 (app_net, 不对外暴露):
  backend  ──┐
  fastapi  ──┤── db    (mysql:3306)
             └── redis (redis:6379)
```

**只暴露端口**：`80`（HTTP）、`443`（HTTPS，需 SSL 证书）

---

## 一、前置条件

```bash
# 安装 Docker + Docker Compose v2
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

# 验证
docker --version          # Docker 24+
docker compose version    # Docker Compose v2.x
```

---

## 二、首次部署

### 1. 拉取代码

```bash
git clone <your-repo-url> /opt/freight-talent
cd /opt/freight-talent
```

### 2. 配置环境变量

```bash
cp .env.example .env
nano .env     # 填入以下必填项：
```

| 变量 | 说明 | 示例 |
|------|------|------|
| `DB_PASSWORD` | MySQL root 密码（强随机字符串） | `openssl rand -hex 16` |
| `JWT_SECRET_KEY` | JWT 签名密钥（≥64字符） | `python3 -c "import secrets; print(secrets.token_hex(32))"` |
| `CORS_ORIGINS` | 你的生产域名 | `https://yourdomain.com` |

### 3. 构建并启动

```bash
# 首次构建（需要几分钟下载镜像和安装依赖）
docker compose build

# 启动所有服务
docker compose up -d

# 查看启动状态
docker compose ps

# 等待所有服务 healthy（通常 30-60 秒）
watch docker compose ps
```

### 4. 运行数据库迁移

```bash
# 首次建表（在 backend 容器内执行 flask db upgrade）
docker compose exec backend flask db upgrade
```

### 5. 创建管理员账号

```bash
docker compose exec backend flask auth create-admin
# 按提示输入邮箱和密码（密码至少 12 位）
```

### 6. 验证服务

```bash
# 健康检查
curl http://localhost/api/health          # Flask liveness
curl http://localhost/api/ready           # Flask readiness（DB + Redis）
curl http://localhost/api/v2/health       # FastAPI liveness
curl http://localhost/api/v2/ready        # FastAPI readiness（DB + Redis）

# 前端
curl -I http://localhost/                 # 200 + HTML
```

---

## 三、HTTPS 配置（Let's Encrypt）

### 前置：确保域名已解析到服务器 IP

```bash
# 安装 certbot（在宿主机）
sudo apt install certbot -y

# 临时停止 Nginx（certbot 需要占用 80 端口）
docker compose stop frontend

# 申请证书
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# 证书路径：/etc/letsencrypt/live/yourdomain.com/
```

### 修改 nginx.conf（启用 HTTPS + 重定向）

1. 在 `nginx.conf` 中取消 `return 301 https://...` 的注释
2. 取消 HTTPS server 块的注释，填入域名
3. 在 `docker-compose.yml` 中取消 `443:443` 和 volumes 的注释

```bash
# 重建前端镜像
docker compose build frontend
docker compose up -d frontend
```

### 自动续签（cron）

```bash
# 编辑 root crontab
sudo crontab -e

# 添加（每月 1 日凌晨 3 点续签）
0 3 1 * * certbot renew --quiet && docker compose -f /opt/freight-talent/docker-compose.yml restart frontend
```

---

## 四、日常运维

### 查看日志

```bash
docker compose logs -f              # 所有服务
docker compose logs -f backend      # Flask 日志
docker compose logs -f fastapi      # FastAPI 日志
docker compose logs -f frontend     # Nginx 访问日志
docker compose logs -f db           # MySQL 日志
```

### 更新部署

```bash
cd /opt/freight-talent
git pull

# 重新构建并重启
docker compose build
docker compose up -d

# 如果有数据库变更
docker compose exec backend flask db upgrade
```

### 备份数据库

```bash
# 导出
docker compose exec db mysqldump \
  -u root -p"${DB_PASSWORD}" freight_talent \
  > backup_$(date +%Y%m%d_%H%M%S).sql

# 恢复
docker compose exec -T db mysql \
  -u root -p"${DB_PASSWORD}" freight_talent \
  < backup_20240101_120000.sql
```

### 查看资源使用

```bash
docker stats                    # 实时 CPU/内存
docker compose ps               # 服务状态和健康检查结果
```

---

## 五、本地开发启动（Windows / Mac）

不需要 Docker，直接用 Python venv + npm：

```bash
# 前置：启动 Redis（Docker 一行命令）
docker run -d -p 6379:6379 --name redis redis:7-alpine

# 后端 Flask（backend/ 目录，激活 .venv）
cd backend
# Windows:
..\.venv\Scripts\activate
# Linux/Mac:
source ../.venv/bin/activate

pip install -r requirements.txt   # 首次
flask db upgrade                  # 首次建表
python run.py                     # 开发服务器，port 5000

# 后端 FastAPI（另开终端）
python fastapi_run.py             # 开发服务器，port 8000，--reload

# 前端（项目根目录，另开终端）
npm install                       # 首次
npm run dev                       # Vite，port 5173
```

Vite 已配置代理：
- `/api/*` → `http://127.0.0.1:5000`（Flask）
- `/api/v2/*` → `http://127.0.0.1:8000`（FastAPI）
- `/socket.io/*` → `http://127.0.0.1:5000`（WebSocket）

---

## 六、上线前检查清单

- [ ] `.env` 中 `JWT_SECRET_KEY` 已替换为随机 64 字符
- [ ] `.env` 中 `DB_PASSWORD` 已替换为强密码
- [ ] `.env` 中 `CORS_ORIGINS` 已设置为实际生产域名
- [ ] `docker compose ps` 显示所有服务 `healthy`
- [ ] `curl http://localhost/api/ready` 返回 `{"status":"ok",...,"database":"ok","redis":"ok"}`
- [ ] `curl http://localhost/api/v2/ready` 同上
- [ ] 管理员账号已通过 CLI 创建
- [ ] 数据库迁移 `flask db upgrade` 已执行
- [ ] WebSocket 连接可用（打开 /messages 页面，无 CORS/WS 错误）
- [ ] 服务器防火墙只开放 22、80、443 端口
- [ ] `.env` 文件权限为 `600`（`chmod 600 .env`）
- [ ] HTTPS 证书已配置（或有计划）

---

## 七、故障排查

### 服务无法启动

```bash
docker compose logs backend | tail -50   # 查看具体错误
docker compose logs db | tail -20        # 数据库启动日志
```

### 数据库连接失败

```bash
# 确认 db 容器 healthy
docker compose ps db

# 手动进入 db 容器测试连接
docker compose exec db mysql -u root -p"${DB_PASSWORD}" -e "SHOW DATABASES;"
```

### Redis 连接失败

```bash
docker compose exec redis redis-cli ping   # 应返回 PONG
```

### Nginx 502 Bad Gateway

```bash
# 检查 backend / fastapi 是否 healthy
docker compose ps

# 检查代理目标服务名是否匹配
# nginx.conf 中 proxy_pass http://backend:5000; → 对应 docker-compose service name "backend"
```

### Socket.IO 无法连接

```bash
# 确认 WebSocket upgrade 正常
curl -v --include \
  --no-buffer \
  --header "Connection: Upgrade" \
  --header "Upgrade: websocket" \
  http://localhost/socket.io/?EIO=4&transport=websocket

# nginx.conf 中必须有：
# proxy_set_header Upgrade $http_upgrade;
# proxy_set_header Connection "upgrade";
```
