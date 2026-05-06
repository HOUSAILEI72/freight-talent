"""CAND-4 — job_applications table

Revision ID: 0010_job_applications
Revises: 0009_candidate_profile_builder_fields
Create Date: 2026-05-05

Candidate-initiated applications. Distinct from `invitations` (employer-
initiated). CAND-5 will read from both this table and `invitations` to
decide whether an employer can see a candidate's private fields.
"""

from alembic import op
import sqlalchemy as sa


revision = "0010_job_applications"
down_revision = "0009_candidate_profile_builder_fields"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "job_applications",
        sa.Column("id",           sa.Integer, primary_key=True),
        sa.Column("job_id",       sa.Integer, sa.ForeignKey("jobs.id",       ondelete="CASCADE"), nullable=False),
        sa.Column("candidate_id", sa.Integer, sa.ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("employer_id",  sa.Integer, sa.ForeignKey("users.id",      ondelete="CASCADE"), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "submitted", "viewed", "shortlisted", "rejected", "withdrawn",
                name="job_application_status",
            ),
            nullable=False,
            server_default="submitted",
        ),
        sa.Column("message",    sa.Text,     nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("job_id", "candidate_id", name="uq_job_application_job_candidate"),
    )
    op.create_index("idx_job_application_job_id",       "job_applications", ["job_id"])
    op.create_index("idx_job_application_candidate_id", "job_applications", ["candidate_id"])
    op.create_index("idx_job_application_employer_id",  "job_applications", ["employer_id"])
    op.create_index("idx_job_application_status",       "job_applications", ["status"])


def downgrade():
    op.drop_index("idx_job_application_status",       table_name="job_applications")
    op.drop_index("idx_job_application_employer_id",  table_name="job_applications")
    op.drop_index("idx_job_application_candidate_id", table_name="job_applications")
    op.drop_index("idx_job_application_job_id",       table_name="job_applications")
    op.drop_table("job_applications")
    # Drop the MySQL ENUM type
    sa.Enum(name="job_application_status").drop(op.get_bind(), checkfirst=True)
