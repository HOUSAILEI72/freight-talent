"""add expected_salary_period to candidates

Revision ID: 0025_add_expected_salary_period
Revises: 0024_add_is_template
Create Date: 2026-05-16
"""
from alembic import op
import sqlalchemy as sa

revision = '0025_add_expected_salary_period'
down_revision = '0024_add_is_template'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('candidates', sa.Column('expected_salary_period', sa.String(10), nullable=True))


def downgrade():
    op.drop_column('candidates', 'expected_salary_period')
