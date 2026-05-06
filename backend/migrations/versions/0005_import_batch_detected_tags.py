"""import_batches.detected_tags column

Revision ID: 0005_import_batch_detected_tags
Revises: 0004_tag_system
Create Date: 2026-04-27
"""
from alembic import op
import sqlalchemy as sa

revision = "0005_import_batch_detected_tags"
down_revision = "0004_tag_system"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "import_batches",
        sa.Column("detected_tags", sa.JSON(), nullable=True),
    )


def downgrade():
    op.drop_column("import_batches", "detected_tags")
