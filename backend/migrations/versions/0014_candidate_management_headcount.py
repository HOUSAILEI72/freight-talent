"""Add management_headcount to candidates

Revision ID: 0014_candidate_management_headcount
Revises: 0013_employer_subscriptions
Create Date: 2026-05-13
"""

from alembic import op
import sqlalchemy as sa

revision = "0014_candidate_management_headcount"
down_revision = "0013_employer_subscriptions"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "candidates",
        sa.Column("management_headcount", sa.Integer(), nullable=True),
    )


def downgrade():
    op.drop_column("candidates", "management_headcount")
