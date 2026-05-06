"""extend jobs/candidates + import_batch_tags

- jobs:       province / city_name / district
- candidates: age / work_experiences / education_experiences / certificates
- new table:  import_batch_tags

Revision ID: 0007_taxonomy_extensions
Revises: 0006_chart_junction_tables
Create Date: 2026-04-27
"""
from alembic import op
import sqlalchemy as sa


revision = "0007_taxonomy_extensions"
down_revision = "0006_chart_junction_tables"
branch_labels = None
depends_on = None


def upgrade():
    # ── jobs：三级行政区 ─────────────────────────────────────────────────────
    with op.batch_alter_table("jobs") as b:
        b.add_column(sa.Column("province",  sa.String(length=50), nullable=True))
        b.add_column(sa.Column("city_name", sa.String(length=50), nullable=True))
        b.add_column(sa.Column("district",  sa.String(length=50), nullable=True))
    op.create_index("ix_jobs_province",  "jobs", ["province"])
    op.create_index("ix_jobs_city_name", "jobs", ["city_name"])
    op.create_index("ix_jobs_district",  "jobs", ["district"])

    # ── candidates：年龄 + 多条经历 + 证书 ────────────────────────────────────
    with op.batch_alter_table("candidates") as b:
        b.add_column(sa.Column("age", sa.Integer(), nullable=True))
        b.add_column(sa.Column("work_experiences",      sa.JSON(), nullable=True))
        b.add_column(sa.Column("education_experiences", sa.JSON(), nullable=True))
        b.add_column(sa.Column("certificates",          sa.JSON(), nullable=True))

    # ── 新表 import_batch_tags ───────────────────────────────────────────────
    op.create_table(
        "import_batch_tags",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("batch_id", sa.Integer(), nullable=False),
        sa.Column("row_index", sa.Integer(), nullable=False),
        sa.Column("category",  sa.String(length=64),  nullable=False),
        sa.Column("tag_name",  sa.String(length=128), nullable=False),
        sa.Column("is_new_cat", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_new_tag", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["batch_id"], ["import_batches.id"], ondelete="CASCADE"),
    )
    op.create_index(
        "ix_import_batch_tags_batch_row",
        "import_batch_tags",
        ["batch_id", "row_index"],
    )
    op.create_index(
        "ix_import_batch_tags_batch_id",
        "import_batch_tags",
        ["batch_id"],
    )


def downgrade():
    op.drop_index("ix_import_batch_tags_batch_id",  table_name="import_batch_tags")
    op.drop_index("ix_import_batch_tags_batch_row", table_name="import_batch_tags")
    op.drop_table("import_batch_tags")

    with op.batch_alter_table("candidates") as b:
        b.drop_column("certificates")
        b.drop_column("education_experiences")
        b.drop_column("work_experiences")
        b.drop_column("age")

    op.drop_index("ix_jobs_district",  table_name="jobs")
    op.drop_index("ix_jobs_city_name", table_name="jobs")
    op.drop_index("ix_jobs_province",  table_name="jobs")
    with op.batch_alter_table("jobs") as b:
        b.drop_column("district")
        b.drop_column("city_name")
        b.drop_column("province")
