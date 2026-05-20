"""add avatar_url to users

Revision ID: a03043a16b52
Revises: f9837bc731b1
Create Date: 2026-05-18 17:18:34.511812

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a03043a16b52'
down_revision = 'f9837bc731b1'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('avatar_url', sa.String(length=500), nullable=True))


def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('avatar_url')
