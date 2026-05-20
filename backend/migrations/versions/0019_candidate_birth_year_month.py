"""add birth_year and birth_month to candidates

Revision ID: 0019
Revises: 0018_rename_great_china_to_china
Create Date: 2026-05-13
"""
from alembic import op
import sqlalchemy as sa


revision = '0019'
down_revision = '0018_rename_great_china_to_china'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('candidates', schema=None) as batch_op:
        batch_op.add_column(sa.Column('birth_year', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('birth_month', sa.Integer(), nullable=True))


def downgrade():
    with op.batch_alter_table('candidates', schema=None) as batch_op:
        batch_op.drop_column('birth_month')
        batch_op.drop_column('birth_year')
