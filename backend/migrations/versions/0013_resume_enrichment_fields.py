"""add resume enrichment fields: hukou_city, desired_positions, expected_salary_months,
language_abilities, training_experiences, certificate_entries

Revision ID: 0013_resume_enrichment_fields
Revises: 0012_companies_blocked
Create Date: 2026-05-20

"""
from alembic import op
import sqlalchemy as sa

revision = "0013_resume_enrichment_fields"
down_revision = "0012_companies_blocked"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("candidates") as batch_op:
        batch_op.add_column(sa.Column("hukou_city", sa.String(50), nullable=True))
        batch_op.add_column(sa.Column("desired_positions", sa.JSON, nullable=True))
        batch_op.add_column(sa.Column("expected_salary_months", sa.Integer, nullable=True))
        batch_op.add_column(sa.Column("language_abilities", sa.JSON, nullable=True))
        batch_op.add_column(sa.Column("training_experiences", sa.JSON, nullable=True))
        batch_op.add_column(sa.Column("certificate_entries", sa.JSON, nullable=True))


def downgrade():
    with op.batch_alter_table("candidates") as batch_op:
        batch_op.drop_column("certificate_entries")
        batch_op.drop_column("training_experiences")
        batch_op.drop_column("language_abilities")
        batch_op.drop_column("expected_salary_months")
        batch_op.drop_column("desired_positions")
        batch_op.drop_column("hukou_city")
