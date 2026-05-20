"""add_employer_candidate_favorites

Revision ID: dd6fa3bff202
Revises: 0019
Create Date: 2026-05-13 16:51:50.912574

"""
from alembic import op
import sqlalchemy as sa

revision = 'dd6fa3bff202'
down_revision = '0020_create_headhunting_requests'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'employer_candidate_favorites',
        sa.Column('id',           sa.Integer(), primary_key=True),
        sa.Column('employer_id',  sa.Integer(), sa.ForeignKey('users.id',      ondelete='CASCADE'), nullable=False),
        sa.Column('candidate_id', sa.Integer(), sa.ForeignKey('candidates.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at',   sa.DateTime(), nullable=False),
        sa.UniqueConstraint('employer_id', 'candidate_id', name='uq_ecf_employer_candidate'),
    )
    op.create_index('idx_ecf_employer_created',  'employer_candidate_favorites', ['employer_id', 'created_at'])
    op.create_index('idx_ecf_candidate_id',      'employer_candidate_favorites', ['candidate_id'])


def downgrade():
    op.drop_table('employer_candidate_favorites')
