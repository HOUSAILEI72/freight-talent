"""add conversation_threads and messages (已降级为 noop，表已合并到 0001_baseline_schema)

Revision ID: 454b5c374e8a
Revises: fe77249f9144
Create Date: 2026-04-13 15:13:28.725821

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '454b5c374e8a'
down_revision = 'fe77249f9144'
branch_labels = None
depends_on = None


def upgrade():
    # conversation_threads / messages 已由 0001_baseline_schema 建好，此处为空操作
    pass


def downgrade():
    pass
