"""merge_0023_heads

Revision ID: e9488bd37920
Revises: 0023_add_job_level, 0023_normalize_function_codes_v2
Create Date: 2026-05-16 08:52:53.976111

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e9488bd37920'
down_revision = ('0023_add_job_level', '0023_normalize_function_codes_v2')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
