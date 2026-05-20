"""Add gender to candidates

Revision ID: 0015_candidate_gender
Revises: 0014_candidate_management_headcount
Create Date: 2026-05-13
"""

from alembic import op
import sqlalchemy as sa

revision = "0015_candidate_gender"
down_revision = "0014_candidate_management_headcount"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "candidates",
        sa.Column(
            "gender",
            sa.Enum("male", "female", "other", name="candidate_gender"),
            nullable=True,
        ),
    )


def downgrade():
    op.drop_column("candidates", "gender")
    op.execute("DROP TYPE IF EXISTS candidate_gender")
