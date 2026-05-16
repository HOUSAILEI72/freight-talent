"""add_job_benefits

Revision ID: 0026_add_job_benefits
Revises: 0025_add_expected_salary_period
Create Date: 2026-05-16 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '0026_add_job_benefits'
down_revision = '0025_add_expected_salary_period'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'jobs',
        sa.Column('benefits', sa.JSON(), nullable=True),
    )


def downgrade():
    op.drop_column('jobs', 'benefits')
