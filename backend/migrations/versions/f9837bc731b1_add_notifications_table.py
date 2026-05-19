"""add_notifications_table

Revision ID: f9837bc731b1
Revises: 46765ffc5821
Create Date: 2026-05-18 17:14:59.928967

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f9837bc731b1'
down_revision = '46765ffc5821'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'notifications',
        sa.Column('id',         sa.Integer(),      nullable=False),
        sa.Column('user_id',    sa.Integer(),      nullable=False),
        sa.Column('type', sa.Enum(
            'new_message',
            'invitation_status_change',
            'application_status_change',
            'headhunting_request',
            name='notification_type',
        ), nullable=False),
        sa.Column('title',      sa.String(200),    nullable=False),
        sa.Column('body',       sa.String(500),    nullable=True),
        sa.Column('data',       sa.JSON(),         nullable=True),
        sa.Column('is_read',    sa.Boolean(),      nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(),     nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('notifications', schema=None) as batch_op:
        batch_op.create_index('ix_notifications_user_id', ['user_id'], unique=False)
        batch_op.create_index('ix_notifications_is_read', ['is_read'], unique=False)


def downgrade():
    with op.batch_alter_table('notifications', schema=None) as batch_op:
        batch_op.drop_index('ix_notifications_is_read')
        batch_op.drop_index('ix_notifications_user_id')
    op.drop_table('notifications')
    op.execute("DROP TYPE IF EXISTS notification_type")
