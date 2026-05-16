"""add_is_template

Revision ID: 0024_add_is_template
Revises: e9488bd37920
Create Date: 2026-05-16 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '0024_add_is_template'
down_revision = 'e9488bd37920'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'jobs',
        sa.Column('is_template', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index('ix_jobs_is_template', 'jobs', ['is_template'], unique=False)


def downgrade():
    op.drop_index('ix_jobs_is_template', table_name='jobs')
    op.drop_column('jobs', 'is_template')
