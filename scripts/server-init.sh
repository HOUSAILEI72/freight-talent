#!/usr/bin/env bash
# =============================================================================
# server-init.sh — CVM 首次部署初始化脚本（只需执行一次）
#
# 使用方法（在 CVM 上执行）：
#   curl -fsSL https://raw.githubusercontent.com/your-org/your-repo/main/scripts/server-init.sh | bash
#   # 或 scp 上传后：
#   chmod +x server-init.sh && sudo bash server-init.sh
#
# 执行完毕后按提示：
#   1. 把打印出的 SSH 公钥填到 GitHub Secrets (SSH_PRIVATE_KEY 对应私钥)
#   2. 编辑 /opt/freight-talent/.env 填写真实配置
#   3. 把 SSL 证书放到 /etc/ssl/cert/
#   4. 运行 make deploy 完成首次启动
# =============================================================================
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/your-org/your-repo.git}"
APP_DIR="/opt/freight-talent"
BACKUP_DIR="/opt/backups/freight-talent"
DEPLOY_USER="deploy"
DEPLOY_KEY_PATH="/home/${DEPLOY_USER}/.ssh/freight_talent_deploy"
APP_USER="${SUDO_USER:-$(whoami)}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── 1. 系统依赖 ──────────────────────────────────────────────────────────────
info "安装系统依赖..."
apt-get update -qq
apt-get install -y -qq curl git make ufw mysql-client

# ── 2. 创建 deploy 专用用户 ────────────────────────────────────────────────────
if ! id "$DEPLOY_USER" &>/dev/null; then
    info "创建 deploy 用户..."
    useradd -m -s /bin/bash -c "FreightTalent deploy user" "$DEPLOY_USER"
    # 禁止 deploy 用户使用密码登录（仅允许 SSH 密钥）
    passwd -l "$DEPLOY_USER"
    info "deploy 用户已创建（密码登录已禁用，仅 SSH 密钥）"
else
    info "deploy 用户已存在，跳过"
fi

# ── 3. 安装 Docker ────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
    info "安装 Docker..."
    curl -fsSL https://get.docker.com | sh
fi
usermod -aG docker "$DEPLOY_USER"
usermod -aG docker "$APP_USER" 2>/dev/null || true
info "Docker 已就绪：$(docker --version)"

# ── 3. 配置防火墙 ─────────────────────────────────────────────────────────────
info "配置防火墙（UFW）..."
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   comment "SSH"
ufw allow 80/tcp   comment "HTTP"
ufw allow 443/tcp  comment "HTTPS"
ufw --force enable
info "UFW 状态：$(ufw status | head -1)"

# ── 5. 创建应用目录与备份目录 ──────────────────────────────────────────────────
info "创建应用目录 ${APP_DIR} ..."
mkdir -p "$APP_DIR"
chown "$DEPLOY_USER":"$DEPLOY_USER" "$APP_DIR"

info "创建备份目录 ${BACKUP_DIR} ..."
mkdir -p "$BACKUP_DIR"
chown "$DEPLOY_USER":"$DEPLOY_USER" "$BACKUP_DIR"

# ── 6. 克隆代码 ───────────────────────────────────────────────────────────────
if [ ! -d "${APP_DIR}/.git" ]; then
    info "克隆代码仓库..."
    sudo -u "$DEPLOY_USER" git clone "$REPO_URL" "$APP_DIR"
else
    info "代码仓库已存在，跳过克隆"
fi

# ── 7. SSL 证书目录 ────────────────────────────────────────────────────────────
info "创建 SSL 证书目录 /etc/ssl/cert/..."
mkdir -p /etc/ssl/cert
chmod 700 /etc/ssl/cert
info "证书目录已创建。请把 fullchain.pem + privkey.pem 上传到 /etc/ssl/cert/"

# ── 8. 生成 GitHub Actions 部署专用 SSH 密钥 ──────────────────────────────────
if [ ! -f "${DEPLOY_KEY_PATH}" ]; then
    info "生成 deploy 用户部署专用 SSH 密钥对..."
    sudo -u "$DEPLOY_USER" bash -c "
        mkdir -p ~/.ssh && chmod 700 ~/.ssh
        ssh-keygen -t ed25519 -C 'github-actions-deploy' -f '${DEPLOY_KEY_PATH}' -N ''
        cat '${DEPLOY_KEY_PATH}.pub' >> ~/.ssh/authorized_keys
        chmod 600 ~/.ssh/authorized_keys
    "
else
    info "部署密钥已存在，跳过生成"
fi

# ── 9. 初始化 .env ─────────────────────────────────────────────────────────────
if [ ! -f "${APP_DIR}/.env" ]; then
    if [ -f "${APP_DIR}/.env.example" ]; then
        sudo -u "$DEPLOY_USER" cp "${APP_DIR}/.env.example" "${APP_DIR}/.env"
        warn ".env 已从 .env.example 复制，请编辑填写真实配置：nano ${APP_DIR}/.env"
    else
        warn "未找到 .env.example，请手动创建 ${APP_DIR}/.env"
    fi
else
    info ".env 已存在，跳过"
fi

# ── 10. 配置 logrotate ────────────────────────────────────────────────────────
cat > /etc/logrotate.d/freight-talent << 'LOGROTATE'
/opt/freight-talent/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    sharedscripts
}
LOGROTATE
info "logrotate 配置完成"

# ── 11. 配置系统级 Docker 日志轮转 ────────────────────────────────────────────
mkdir -p /etc/docker
cat > /etc/docker/daemon.json << 'DOCKERJSON'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "20m",
    "max-file": "5"
  }
}
DOCKERJSON
systemctl reload docker 2>/dev/null || true
info "Docker 日志轮转配置完成（单文件最大 20MB，保留 5 份）"

# ── 完成 ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  初始化完成！接下来需要手动完成：${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "GitHub Actions 需要配置以下 Secrets（仓库 → Settings → Secrets → Actions）："
echo "  SERVER_HOST      = <CVM 公网 IP>"
echo "  SERVER_USER      = ${DEPLOY_USER}"
echo "  SSH_PRIVATE_KEY  = 以下私钥全文（含 -----BEGIN/END----- 行）"
echo ""
cat "${DEPLOY_KEY_PATH}"
echo ""
echo "2. 编辑 .env 填写真实数据库地址等配置（DB_HOST=10.0.4.9）："
echo "   nano ${APP_DIR}/.env"
echo ""
echo "3. 上传 SSL 证书到 /etc/ssl/cert/："
echo "   scp fullchain.pem privkey.pem <user>@<ip>:/etc/ssl/cert/"
echo ""
echo "4. 首次启动："
echo "   cd ${APP_DIR} && make prod-up && make prod-migrate"
echo ""
echo "之后每次 git push main 将自动触发 GitHub Actions 部署。"
echo "备份路径：${BACKUP_DIR}/"
