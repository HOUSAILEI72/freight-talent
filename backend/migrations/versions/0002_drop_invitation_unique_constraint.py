"""drop uq_invitation_job_candidate — 允许 declined 后重邀

路由层已实现幂等逻辑：
  - pending / accepted → 返回已有记录，不重复插入
  - declined → 允许新建邀约（重邀）
DB 层的唯一约束会让第二次插入直接 500，需要删除。

Revision ID: 0002_drop_invitation_unique_constraint
Revises: 454b5c374e8a
Create Date: 2026-04-14
"""
from alembic import op

revision = '0002_drop_invitation_unique_constraint'
down_revision = '454b5c374e8a'
branch_labels = None
depends_on = None


def upgrade():
    # MySQL 1553: 删除 unique 约束前需先建立替代索引（支撑 job_id FK）。
    # 使用原生 SQL 在同一 DDL 语句中完成两步操作，避免 Alembic batch 模式
    # 多次往返导致中间状态下 MySQL 校验失败。
    op.execute(
        "ALTER TABLE invitations "
        "ADD INDEX ix_invitations_job_id (job_id), "
        "DROP INDEX uq_invitation_job_candidate"
    )


def downgrade():
    op.execute(
        "ALTER TABLE invitations "
        "ADD UNIQUE KEY uq_invitation_job_candidate (job_id, candidate_id), "
        "DROP INDEX ix_invitations_job_id"
    )
