"""add passive_now to availability_status enum and desired_position field

Revision ID: 0021_availability_passive_now_desired_position
Revises: dd6fa3bff202
Create Date: 2026-05-15
"""
from alembic import op
import sqlalchemy as sa

revision = '0021_availability_passive_now_desired_position'
down_revision = 'dd6fa3bff202'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE candidates
        MODIFY COLUMN availability_status
        ENUM('open','passive_now','passive','closed')
        DEFAULT 'open'
    """)
    op.add_column('candidates', sa.Column('desired_position', sa.String(100), nullable=True))


def downgrade():
    op.drop_column('candidates', 'desired_position')
    op.execute("""
        ALTER TABLE candidates
        MODIFY COLUMN availability_status
        ENUM('open','passive','closed')
        DEFAULT 'open'
    """)
