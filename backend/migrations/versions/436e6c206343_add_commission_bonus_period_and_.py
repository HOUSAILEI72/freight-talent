"""add commission_bonus_period and commission_bonus_amount to jobs

Revision ID: 436e6c206343
Revises: 0012_job_application_saved_status
Create Date: 2026-05-11 11:03:15.848244

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '436e6c206343'
down_revision = '0012_job_application_saved_status'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('jobs', schema=None) as batch_op:
        batch_op.add_column(sa.Column('commission_bonus_period', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('commission_bonus_amount', sa.Float(), nullable=True))


def downgrade():
    with op.batch_alter_table('jobs', schema=None) as batch_op:
        batch_op.drop_column('commission_bonus_amount')
        batch_op.drop_column('commission_bonus_period')
