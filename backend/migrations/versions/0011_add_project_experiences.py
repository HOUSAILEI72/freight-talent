"""add project_experiences column to candidates

Revision ID: 0011_add_project_experiences
Revises: f9837bc731b1
Create Date: 2026-05-19

Adds the project_experiences JSON array column that mirrors
work_experiences — each entry: {"name", "role", "link", "start",
"end", "description", "achievements"}.  Nullable so existing rows
are unaffected.
"""

from alembic import op
import sqlalchemy as sa


revision = "0011_add_project_experiences"
down_revision = "f9837bc731b1"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("candidates") as batch:
        batch.add_column(sa.Column("project_experiences", sa.JSON, nullable=True))


def downgrade():
    with op.batch_alter_table("candidates") as batch:
        batch.drop_column("project_experiences")
