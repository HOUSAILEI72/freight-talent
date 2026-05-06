"""chart junction tables — candidate_tags / job_tags

新增两张联结表：
  candidate_tags — 候选人与标签的 M:N 关系，用于柱状图按标签筛选
  job_tags       — 岗位与标签的 M:N 关系，同上

Revision ID: 0006_chart_junction_tables
Revises: 0005_import_batch_detected_tags
Create Date: 2026-04-27
"""
from datetime import datetime, timezone
from alembic import op
import sqlalchemy as sa

revision = '0006_chart_junction_tables'
down_revision = '0005_import_batch_detected_tags'
branch_labels = None
depends_on = None


def upgrade():
    # ── candidate_tags ────────────────────────────────────────────────────────
    op.create_table(
        'candidate_tags',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('candidate_id', sa.Integer(), nullable=False),
        sa.Column('tag_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['candidate_id'], ['candidates.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tag_id'], ['tags.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('candidate_id', 'tag_id', name='uq_candidate_tag'),
    )
    op.create_index('ix_candidate_tags_candidate_id', 'candidate_tags', ['candidate_id'])
    op.create_index('ix_candidate_tags_tag_id',       'candidate_tags', ['tag_id'])

    # ── job_tags ──────────────────────────────────────────────────────────────
    op.create_table(
        'job_tags',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('job_id', sa.Integer(), nullable=False),
        sa.Column('tag_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tag_id'], ['tags.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('job_id', 'tag_id', name='uq_job_tag'),
    )
    op.create_index('ix_job_tags_job_id', 'job_tags', ['job_id'])
    op.create_index('ix_job_tags_tag_id', 'job_tags', ['tag_id'])


def downgrade():
    op.drop_index('ix_job_tags_tag_id',       table_name='job_tags')
    op.drop_index('ix_job_tags_job_id',        table_name='job_tags')
    op.drop_table('job_tags')

    op.drop_index('ix_candidate_tags_tag_id',       table_name='candidate_tags')
    op.drop_index('ix_candidate_tags_candidate_id', table_name='candidate_tags')
    op.drop_table('candidate_tags')
