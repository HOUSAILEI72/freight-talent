"""add current commission bonus fields to candidate

Revision ID: 46765ffc5821
Revises: 67ae45b5f831
Create Date: 2026-05-18 11:11:53.524225

"""
from alembic import op
import sqlalchemy as sa

revision = '46765ffc5821'
down_revision = '67ae45b5f831'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('candidates', schema=None) as batch_op:
        batch_op.add_column(sa.Column('current_commission_bonus_period', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('current_commission_bonus_amount', sa.Float(), nullable=True))


def downgrade():
    with op.batch_alter_table('candidates', schema=None) as batch_op:
        batch_op.drop_column('current_commission_bonus_amount')
        batch_op.drop_column('current_commission_bonus_period')
