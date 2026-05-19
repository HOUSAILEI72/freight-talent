.PHONY: up down restart deploy logs migrate shell-flask shell-fastapi backup ps \
        prod-up prod-down prod-ps prod-logs prod-restart prod-migrate prod-backup

BACKUP_DIR ?= /opt/backups/freight-talent

# ── 开发 / 通用命令（别名指向 prod-* 以保持兼容） ──────────────────────────────
up:      prod-up
down:    prod-down
restart: prod-restart
logs:    prod-logs
ps:      prod-ps
migrate: prod-migrate
backup:  prod-backup

deploy:
	git pull origin main
	docker compose up -d --build --remove-orphans
	docker compose exec -T backend flask db upgrade

shell-flask:
	docker compose exec backend flask shell

shell-fastapi:
	docker compose exec fastapi bash

# ── prod-* 系列（生产运维标准命令） ────────────────────────────────────────────

# 启动所有服务（后台）
prod-up:
	docker compose up -d

# 停止所有服务（保留数据卷）
prod-down:
	docker compose down

# 查看容器状态
prod-ps:
	docker compose ps

# 实时日志（所有服务，最近 100 行起）
prod-logs:
	docker compose logs -f --tail=100

# 重启所有服务
prod-restart:
	docker compose restart

# 执行数据库迁移
prod-migrate:
	docker compose exec -T backend flask db upgrade

# 数据库备份到 /opt/backups/freight-talent/
prod-backup:
	@mkdir -p $(BACKUP_DIR)
	@export $$(grep -v '^#' .env | grep -v '^$$' | xargs) && \
	DATE=$$(date +%Y%m%d_%H%M%S) && \
	mysqldump -h $${DB_HOST} -P $${DB_PORT:-3306} -u $${DB_USER} -p$${DB_PASSWORD} $${DB_NAME} \
	  > $(BACKUP_DIR)/db_$${DATE}.sql && \
	echo "Backup saved: $(BACKUP_DIR)/db_$${DATE}.sql"
