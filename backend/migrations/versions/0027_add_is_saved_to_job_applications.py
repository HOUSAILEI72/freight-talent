"""add is_saved to job_applications

Revision ID: 0027_add_is_saved_to_job_applications
"""
from alembic import op
import sqlalchemy as sa

revision = '0027_add_is_saved_to_job_applications'
down_revision = '0026_add_job_benefits'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'job_applications',
        sa.Column('is_saved', sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade():
    op.drop_column('job_applications', 'is_saved')
