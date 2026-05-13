"""Add employer subscriptions table

Revision ID: 0013_employer_subscriptions
Revises: 0012_job_application_saved_status
Create Date: 2026-05-11
"""

from alembic import op
import sqlalchemy as sa

revision = "0013_employer_subscriptions"
down_revision = "436e6c206343"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "subscriptions",
        sa.Column("id",          sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("employer_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("status",
                  sa.Enum("active", "expired", "cancelled", "pending",
                          name="subscription_status"),
                  nullable=False, server_default="pending"),
        sa.Column("plan_type",  sa.String(30), nullable=False, server_default="standard"),
        sa.Column("tier",       sa.String(30), nullable=False, server_default="basic"),
        sa.Column("function_codes",      sa.JSON, nullable=False),
        sa.Column("business_area_codes", sa.JSON, nullable=False),
        sa.Column("starts_at",  sa.DateTime(timezone=True), nullable=True),
        sa.Column("ends_at",    sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now(), onupdate=sa.func.now()),
    )


def downgrade():
    op.drop_table("subscriptions")
    # MySQL stores the Enum type inline, so no separate type to drop.
