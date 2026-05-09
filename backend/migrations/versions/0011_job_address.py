"""Add detailed address and management headcount to jobs

Revision ID: 0011_job_address
Revises: 0010_job_applications
Create Date: 2026-05-09
"""

from alembic import op
import sqlalchemy as sa


revision = "0011_job_address"
down_revision = "0010_job_applications"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("jobs") as batch:
        batch.add_column(sa.Column("address", sa.String(length=200), nullable=True))
        batch.add_column(sa.Column("management_headcount", sa.Integer(), nullable=True))


def downgrade():
    with op.batch_alter_table("jobs") as batch:
        batch.drop_column("management_headcount")
        batch.drop_column("address")
