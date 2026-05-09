"""Add saved status to job applications

Revision ID: 0012_job_application_saved_status
Revises: 0011_job_address
Create Date: 2026-05-09
"""

from alembic import op
import sqlalchemy as sa


revision = "0012_job_application_saved_status"
down_revision = "0011_job_address"
branch_labels = None
depends_on = None


old_status = sa.Enum(
    "submitted", "viewed", "shortlisted", "rejected", "withdrawn",
    name="job_application_status",
)
new_status = sa.Enum(
    "saved", "submitted", "viewed", "shortlisted", "rejected", "withdrawn",
    name="job_application_status",
)


def upgrade():
    with op.batch_alter_table("job_applications") as batch:
        batch.alter_column(
            "status",
            existing_type=old_status,
            type_=new_status,
            existing_nullable=False,
            existing_server_default="submitted",
        )


def downgrade():
    op.execute("UPDATE job_applications SET status = 'withdrawn' WHERE status = 'saved'")
    with op.batch_alter_table("job_applications") as batch:
        batch.alter_column(
            "status",
            existing_type=new_status,
            type_=old_status,
            existing_nullable=False,
            existing_server_default="submitted",
        )
