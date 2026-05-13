"""Remove 'other' from candidate_gender enum

Revision ID: 0016_candidate_gender_no_other
Revises: 0015_candidate_gender
Create Date: 2026-05-13
"""

from alembic import op
import sqlalchemy as sa

revision = "0016_candidate_gender_no_other"
down_revision = "0015_candidate_gender"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "candidates",
        "gender",
        type_=sa.Enum("male", "female", name="candidate_gender"),
        existing_nullable=True,
    )


def downgrade():
    op.alter_column(
        "candidates",
        "gender",
        type_=sa.Enum("male", "female", "other", name="candidate_gender"),
        existing_nullable=True,
    )
