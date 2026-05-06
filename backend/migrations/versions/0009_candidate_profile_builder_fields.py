"""CAND-2A — candidate profile builder fields

Revision ID: 0009_candidate_profile_builder_fields
Revises: 0008_region_business_area_fields
Create Date: 2026-05-05

Adds the columns the CandidateProfileBuilder writes to. All columns are
nullable so existing rows (current candidates / mock data) keep working;
the front-end gate from CAND-1 already steers users into the builder when
the new fields are missing on read.

Mirrors the "salary structure" + "function/management" + "tag arrays"
pattern that 0008 introduced for jobs, plus a server-computed
profile_status / profile_completed_at pair that future phases (CAND-4
applications, CAND-5 unlock rule) will read.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = "0009_candidate_profile_builder_fields"
down_revision = "0008_region_business_area_fields"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("candidates") as batch:
        # Current-job richer fields
        batch.add_column(sa.Column("current_responsibilities",      sa.Text,           nullable=True))
        batch.add_column(sa.Column("function_code",                 sa.String(length=50),  nullable=True))
        batch.add_column(sa.Column("function_name",                 sa.String(length=100), nullable=True))
        batch.add_column(sa.Column("is_management_role",            sa.Boolean,        nullable=True))

        # Capability-profile arrays (separate from legacy skill_tags / route_tags)
        batch.add_column(sa.Column("knowledge_tags",                sa.JSON,           nullable=True))
        batch.add_column(sa.Column("hard_skill_tags",               sa.JSON,           nullable=True))
        batch.add_column(sa.Column("soft_skill_tags",               sa.JSON,           nullable=True))

        # Current-salary structure (distinct from legacy expected_salary_*)
        batch.add_column(sa.Column("current_salary_min",            sa.Integer,        nullable=True))
        batch.add_column(sa.Column("current_salary_max",            sa.Integer,        nullable=True))
        batch.add_column(sa.Column("current_salary_months",         sa.Integer,        nullable=True))
        batch.add_column(sa.Column("current_average_bonus_percent", sa.Float,          nullable=True))
        batch.add_column(sa.Column("current_has_year_end_bonus",    sa.Boolean,        nullable=True))
        batch.add_column(sa.Column("current_year_end_bonus_months", sa.Float,          nullable=True))

        # Server-computed completeness state
        batch.add_column(sa.Column("profile_status",                sa.String(length=30), nullable=True))
        batch.add_column(sa.Column("profile_completed_at",          sa.DateTime,       nullable=True))

    op.create_index("idx_candidate_profile_status", "candidates", ["profile_status"])
    op.create_index("idx_candidate_function_code",  "candidates", ["function_code"])


def downgrade():
    op.drop_index("idx_candidate_function_code",  table_name="candidates")
    op.drop_index("idx_candidate_profile_status", table_name="candidates")

    with op.batch_alter_table("candidates") as batch:
        batch.drop_column("profile_completed_at")
        batch.drop_column("profile_status")
        batch.drop_column("current_year_end_bonus_months")
        batch.drop_column("current_has_year_end_bonus")
        batch.drop_column("current_average_bonus_percent")
        batch.drop_column("current_salary_months")
        batch.drop_column("current_salary_max")
        batch.drop_column("current_salary_min")
        batch.drop_column("soft_skill_tags")
        batch.drop_column("hard_skill_tags")
        batch.drop_column("knowledge_tags")
        batch.drop_column("is_management_role")
        batch.drop_column("function_name")
        batch.drop_column("function_code")
        batch.drop_column("current_responsibilities")
