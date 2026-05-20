"""add resume_views_used to subscriptions

Revision ID: 67ae45b5f831
Revises: 0027_add_is_saved_to_job_applications
Create Date: 2026-05-18 11:08:42.016820

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '67ae45b5f831'
down_revision = '0027_add_is_saved_to_job_applications'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('subscriptions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('resume_views_used', sa.Integer(), nullable=False, server_default='0'))


def downgrade():
    with op.batch_alter_table('subscriptions', schema=None) as batch_op:
        batch_op.drop_column('resume_views_used')
