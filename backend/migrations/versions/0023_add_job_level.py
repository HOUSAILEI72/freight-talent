"""add job_level column to jobs table

Revision ID: 0023_add_job_level
Revises: 0022_candidate_email_actions
Create Date: 2026-05-15
"""
from alembic import op
import sqlalchemy as sa

revision = '0023_add_job_level'
down_revision = '0022_candidate_email_actions'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('jobs', sa.Column('job_level', sa.String(30), nullable=True))


def downgrade():
    op.drop_column('jobs', 'job_level')
