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
    # 全新库中 uq_invitation_job_candidate 不存在，需先检查再删除
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_invitations_job_id ON invitations (job_id)"
    )
    op.execute(
        "ALTER TABLE invitations DROP INDEX IF EXISTS uq_invitation_job_candidate"
    )


def downgrade():
    op.execute(
        "ALTER TABLE invitations "
        "ADD UNIQUE KEY uq_invitation_job_candidate (job_id, candidate_id), "
        "DROP INDEX ix_invitations_job_id"
    )
