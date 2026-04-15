# 数据库迁移说明

## 当前状态（2026-04-14）

**生产/开发库**中 `alembic_version` 目前为 `454b5c374e8a`，  
对应旧的两个片段迁移（`fe77249f9144` → `454b5c374e8a`），  
但这两个文件**仅创建了 invitations / conversation_threads / messages**，  
`users / jobs / candidates / match_results` 是手动建表的，迁移历史已漂移。

## 上线前必做：重建迁移基线

### 步骤 1：备份现有数据

```bash
mysqldump -u root -p freight_talent > freight_talent_backup_$(date +%Y%m%d).sql
```

### 步骤 2：在现有库上手动打基线标记

无需重建数据库，只需告诉 Alembic "当前库已对应 baseline"：

```bash
cd backend
# 将 alembic_version 表改写为新 baseline 版本号
flask db stamp 0001_baseline_schema
```

### 步骤 3：验证

```bash
flask db current   # 应显示 0001_baseline_schema (head)
flask db history   # 应只有一条记录
```

### 全新环境部署

```bash
# 创建空数据库
mysql -u root -p -e "CREATE DATABASE freight_talent CHARACTER SET utf8mb4;"
# 执行迁移（会创建所有 8 张表 + 业务索引）
flask db upgrade
# 创建初始管理员
flask auth create-admin --email admin@example.com
```

## 旧迁移文件处理

`versions/fe77249f9144_initial_schema.py` 和  
`versions/454b5c374e8a_add_conversation_threads_and_messages.py`  
已被 `versions/0001_baseline_schema.py` 取代。  
旧文件在 `stamp` 命令执行后不再被 Alembic 使用，可以删除或归档。
