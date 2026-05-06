"""Phase C — region / business_area + extended job-form fields

Revision ID: 0008_region_business_area_fields
Revises: 0007_taxonomy_extensions
Create Date: 2026-04-29

Adds the location / business_area / job-form columns introduced in
Phase A (rule layer) and Phase B (RegionSelector). All new columns are
nullable so existing rows keep working; legacy `city / province /
city_name / district / business_type / job_type / current_city /
expected_city` columns are NOT touched here.

Phase D will (later) flip these to required and migrate legacy data.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = "0008_region_business_area_fields"
down_revision = "0007_taxonomy_extensions"
branch_labels = None
depends_on = None


def upgrade():
    # ── jobs ────────────────────────────────────────────────────────────────
    with op.batch_alter_table("jobs") as batch:
        # Standard location fields
        batch.add_column(sa.Column("location_code",      sa.String(length=50),  nullable=True))
        batch.add_column(sa.Column("location_name",      sa.String(length=100), nullable=True))
        batch.add_column(sa.Column("location_path",      sa.String(length=255), nullable=True))
        batch.add_column(sa.Column("location_type",      sa.String(length=50),  nullable=True))

        # Computed business-area (server-side authoritative)
        batch.add_column(sa.Column("business_area_code", sa.String(length=50),  nullable=True))
        batch.add_column(sa.Column("business_area_name", sa.String(length=100), nullable=True))

        # Function (海运/空运/...) — replaces the implicit business_type field
        batch.add_column(sa.Column("function_code",      sa.String(length=50),  nullable=True))
        batch.add_column(sa.Column("function_name",      sa.String(length=100), nullable=True))

        # Management role flag
        batch.add_column(sa.Column("is_management_role", sa.Boolean,            nullable=True))

        # Knowledge / hard-skill / soft-skill arrays (separate from skill_tags)
        batch.add_column(sa.Column("knowledge_requirements",  sa.JSON,           nullable=True))
        batch.add_column(sa.Column("hard_skill_requirements", sa.JSON,           nullable=True))
        batch.add_column(sa.Column("soft_skill_requirements", sa.JSON,           nullable=True))

        # Salary structure
        batch.add_column(sa.Column("salary_months",          sa.Integer,         nullable=True))
        batch.add_column(sa.Column("average_bonus_percent",  sa.Float,           nullable=True))
        batch.add_column(sa.Column("has_year_end_bonus",     sa.Boolean,         nullable=True))
        batch.add_column(sa.Column("year_end_bonus_months",  sa.Float,           nullable=True))

    op.create_index("idx_jobs_location_code",       "jobs", ["location_code"])
    op.create_index("idx_jobs_business_area_code",  "jobs", ["business_area_code"])

    # ── candidates ──────────────────────────────────────────────────────────
    with op.batch_alter_table("candidates") as batch:
        batch.add_column(sa.Column("location_code",      sa.String(length=50),  nullable=True))
        batch.add_column(sa.Column("location_name",      sa.String(length=100), nullable=True))
        batch.add_column(sa.Column("location_path",      sa.String(length=255), nullable=True))
        batch.add_column(sa.Column("location_type",      sa.String(length=50),  nullable=True))
        batch.add_column(sa.Column("business_area_code", sa.String(length=50),  nullable=True))
        batch.add_column(sa.Column("business_area_name", sa.String(length=100), nullable=True))

    op.create_index("idx_candidate_location_code",      "candidates", ["location_code"])
    op.create_index("idx_candidate_business_area_code", "candidates", ["business_area_code"])


def downgrade():
    # ── candidates ──────────────────────────────────────────────────────────
    op.drop_index("idx_candidate_business_area_code", table_name="candidates")
    op.drop_index("idx_candidate_location_code",      table_name="candidates")

    with op.batch_alter_table("candidates") as batch:
        batch.drop_column("business_area_name")
        batch.drop_column("business_area_code")
        batch.drop_column("location_type")
        batch.drop_column("location_path")
        batch.drop_column("location_name")
        batch.drop_column("location_code")

    # ── jobs ────────────────────────────────────────────────────────────────
    op.drop_index("idx_jobs_business_area_code", table_name="jobs")
    op.drop_index("idx_jobs_location_code",      table_name="jobs")

    with op.batch_alter_table("jobs") as batch:
        batch.drop_column("year_end_bonus_months")
        batch.drop_column("has_year_end_bonus")
        batch.drop_column("average_bonus_percent")
        batch.drop_column("salary_months")
        batch.drop_column("soft_skill_requirements")
        batch.drop_column("hard_skill_requirements")
        batch.drop_column("knowledge_requirements")
        batch.drop_column("is_management_role")
        batch.drop_column("function_name")
        batch.drop_column("function_code")
        batch.drop_column("business_area_name")
        batch.drop_column("business_area_code")
        batch.drop_column("location_type")
        batch.drop_column("location_path")
        batch.drop_column("location_name")
        batch.drop_column("location_code")
