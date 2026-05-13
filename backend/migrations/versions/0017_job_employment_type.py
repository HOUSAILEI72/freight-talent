"""Add employment_type to jobs

Revision ID: 0017_job_employment_type
Revises: 0016_candidate_gender_no_other
Create Date: 2026-05-13
"""

from alembic import op
import sqlalchemy as sa

revision = "0017_job_employment_type"
down_revision = "0016_candidate_gender_no_other"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "jobs",
        sa.Column("employment_type", sa.String(20), nullable=True),
    )


def downgrade():
    op.drop_column("jobs", "employment_type")
