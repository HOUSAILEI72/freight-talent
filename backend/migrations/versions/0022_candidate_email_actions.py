"""add candidate_email_actions table

Revision ID: 0022_candidate_email_actions
Revises: 0021_availability_passive_now_desired_position
Create Date: 2026-05-15
"""
from alembic import op
import sqlalchemy as sa

revision = '0022_candidate_email_actions'
down_revision = '0021_availability_passive_now_desired_position'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'candidate_email_actions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('employer_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('candidate_id', sa.Integer(), sa.ForeignKey('candidates.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('job_id', sa.Integer(), sa.ForeignKey('jobs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('thread_id', sa.Integer(), sa.ForeignKey('conversation_threads.id', ondelete='SET NULL'), nullable=True),
        sa.Column('action', sa.String(40), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('subject', sa.String(200), nullable=True),
        sa.Column('body', sa.Text(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('sent_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(),
                  onupdate=sa.func.now()),
        sa.UniqueConstraint('employer_id', 'candidate_id', 'job_id', 'action',
                            name='uq_candidate_email_action_scope'),
    )


def downgrade():
    op.drop_table('candidate_email_actions')
