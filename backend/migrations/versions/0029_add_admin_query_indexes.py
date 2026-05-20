"""add indexes for admin overview and trend queries

Revision ID: d5a8b1c2e3f4
Revises: c4e7f8a1b2d3
Create Date: 2026-05-19 10:30:00.000000

"""
from alembic import op

revision = 'd5a8b1c2e3f4'
down_revision = 'c4e7f8a1b2d3'
branch_labels = None
depends_on = None


def upgrade():
    # users.role: filter_by(role='employer') and filter_by(role='admin') in admin overview
    op.create_index('ix_users_role',       'users',       ['role'])
    # users.created_at: 7-day new-user trend in admin overview
    op.create_index('ix_users_created_at', 'users',       ['created_at'])
    # candidates.created_at: 7-day new-candidate trend in admin overview
    op.create_index('ix_candidates_created_at', 'candidates', ['created_at'])
    # invitations.created_at: global invitation count by date (no employer/candidate filter)
    op.create_index('ix_invitation_created_at', 'invitations', ['created_at'])


def downgrade():
    op.drop_index('ix_invitation_created_at', table_name='invitations')
    op.drop_index('ix_candidates_created_at', table_name='candidates')
    op.drop_index('ix_users_created_at',      table_name='users')
    op.drop_index('ix_users_role',            table_name='users')
