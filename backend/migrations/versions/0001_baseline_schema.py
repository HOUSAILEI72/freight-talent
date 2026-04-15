"""baseline schema — 全量建表

此迁移是按照真实库结构（2026-04-14 导出）重新做的基线，替代此前
零散的 fe77249f9144 / 454b5c374e8a 两个片段迁移。

在全新空库上执行本文件后，数据库应与当前生产库结构完全一致：
  users / jobs / candidates / match_results /
  invitations / conversation_threads / messages

升级步骤（新环境）：
  1. 备份旧库数据（mysqldump freight_talent > backup.sql）
  2. 在新空库执行：flask db upgrade
  3. 确认 alembic_version = 0001_baseline_schema
  4. 导入旧数据（按表依赖顺序）

Revision ID: 0001_baseline_schema
Revises:
Create Date: 2026-04-14
"""
from alembic import op
import sqlalchemy as sa

revision = '0001_baseline_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # ── 1. users ──────────────────────────────────────────────────────────────
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(120), nullable=False),
        sa.Column('password_hash', sa.String(128), nullable=False),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('name', sa.String(60), nullable=False),
        sa.Column('company_name', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('last_login', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.create_index('ix_users_email', ['email'], unique=True)

    # ── 2. jobs ───────────────────────────────────────────────────────────────
    op.create_table(
        'jobs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('company_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(100), nullable=False),
        sa.Column('city', sa.String(50), nullable=False),
        sa.Column('salary_min', sa.Integer(), nullable=True),
        sa.Column('salary_max', sa.Integer(), nullable=True),
        sa.Column('salary_label', sa.String(30), nullable=True),
        sa.Column('experience_required', sa.String(50), nullable=True),
        sa.Column('degree_required', sa.String(30), nullable=True),
        sa.Column('headcount', sa.Integer(), nullable=True),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('requirements', sa.Text(), nullable=True),
        sa.Column('business_type', sa.String(50), nullable=True),
        sa.Column('job_type', sa.String(50), nullable=True),
        sa.Column('route_tags', sa.JSON(), nullable=True),
        sa.Column('skill_tags', sa.JSON(), nullable=True),
        sa.Column('urgency_level', sa.Integer(), nullable=True),
        sa.Column('status', sa.Enum('draft', 'published', 'paused', 'closed',
                                    name='job_status'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('jobs', schema=None) as batch_op:
        batch_op.create_index('ix_jobs_company_id', ['company_id'], unique=False)
        # 业务索引
        batch_op.create_index('ix_jobs_status', ['status'], unique=False)
        batch_op.create_index('ix_jobs_city', ['city'], unique=False)
        batch_op.create_index('ix_jobs_created_at', ['created_at'], unique=False)

    # ── 3. candidates ─────────────────────────────────────────────────────────
    op.create_table(
        'candidates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('full_name', sa.String(60), nullable=False),
        sa.Column('current_title', sa.String(100), nullable=False),
        sa.Column('current_company', sa.String(100), nullable=True),
        sa.Column('current_city', sa.String(50), nullable=False),
        sa.Column('expected_city', sa.String(50), nullable=True),
        sa.Column('expected_salary_min', sa.Integer(), nullable=True),
        sa.Column('expected_salary_max', sa.Integer(), nullable=True),
        sa.Column('expected_salary_label', sa.String(30), nullable=True),
        sa.Column('experience_years', sa.Integer(), nullable=True),
        sa.Column('education', sa.String(100), nullable=True),
        sa.Column('english_level', sa.String(30), nullable=True),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('business_type', sa.String(50), nullable=True),
        sa.Column('job_type', sa.String(50), nullable=True),
        sa.Column('route_tags', sa.JSON(), nullable=True),
        sa.Column('skill_tags', sa.JSON(), nullable=True),
        sa.Column('availability_status', sa.Enum('open', 'passive', 'closed',
                                                  name='availability_status'),
                  nullable=False),
        sa.Column('resume_file_path', sa.String(300), nullable=True),
        sa.Column('resume_file_name', sa.String(200), nullable=True),
        sa.Column('resume_uploaded_at', sa.DateTime(), nullable=True),
        sa.Column('profile_confirmed_at', sa.DateTime(), nullable=True),
        sa.Column('last_active_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id'),
    )
    with op.batch_alter_table('candidates', schema=None) as batch_op:
        batch_op.create_index('ix_candidates_user_id', ['user_id'], unique=True)
        # 业务索引
        batch_op.create_index('ix_candidates_availability_status',
                               ['availability_status'], unique=False)
        batch_op.create_index('ix_candidates_profile_confirmed_at',
                               ['profile_confirmed_at'], unique=False)
        batch_op.create_index('ix_candidates_current_city', ['current_city'], unique=False)

    # ── 4. match_results ──────────────────────────────────────────────────────
    op.create_table(
        'match_results',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('job_id', sa.Integer(), nullable=False),
        sa.Column('candidate_id', sa.Integer(), nullable=False),
        sa.Column('score', sa.Integer(), nullable=False),
        sa.Column('matched_tags', sa.JSON(), nullable=True),
        sa.Column('score_breakdown', sa.JSON(), nullable=True),
        sa.Column('reason_list', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['candidate_id'], ['candidates.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('job_id', 'candidate_id', name='uq_match_job_candidate'),
    )
    with op.batch_alter_table('match_results', schema=None) as batch_op:
        batch_op.create_index('ix_match_results_job_id', ['job_id'], unique=False)
        batch_op.create_index('ix_match_results_candidate_id', ['candidate_id'], unique=False)

    # ── 5. invitations ────────────────────────────────────────────────────────
    op.create_table(
        'invitations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('job_id', sa.Integer(), nullable=False),
        sa.Column('candidate_id', sa.Integer(), nullable=False),
        sa.Column('employer_id', sa.Integer(), nullable=False),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('status', sa.Enum('pending', 'accepted', 'declined',
                                    name='invitation_status'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['candidate_id'], ['candidates.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['employer_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('job_id', 'candidate_id', name='uq_invitation_job_candidate'),
    )
    with op.batch_alter_table('invitations', schema=None) as batch_op:
        # 业务索引
        batch_op.create_index('ix_invitations_status', ['status'], unique=False)
        batch_op.create_index('ix_invitations_employer_id', ['employer_id'], unique=False)
        batch_op.create_index('ix_invitations_candidate_id', ['candidate_id'], unique=False)
        batch_op.create_index('ix_invitations_created_at', ['created_at'], unique=False)

    # ── 6. conversation_threads ───────────────────────────────────────────────
    op.create_table(
        'conversation_threads',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('invitation_id', sa.Integer(), nullable=False),
        sa.Column('job_id', sa.Integer(), nullable=False),
        sa.Column('candidate_id', sa.Integer(), nullable=False),
        sa.Column('employer_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['candidate_id'], ['candidates.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['employer_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['invitation_id'], ['invitations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('invitation_id'),
    )
    with op.batch_alter_table('conversation_threads', schema=None) as batch_op:
        batch_op.create_index('ix_conv_threads_employer_id', ['employer_id'], unique=False)
        batch_op.create_index('ix_conv_threads_candidate_id', ['candidate_id'], unique=False)
        batch_op.create_index('ix_conv_threads_updated_at', ['updated_at'], unique=False)

    # ── 7. messages ───────────────────────────────────────────────────────────
    op.create_table(
        'messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('thread_id', sa.Integer(), nullable=False),
        sa.Column('sender_user_id', sa.Integer(), nullable=False),
        sa.Column('sender_role', sa.String(20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('is_read', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['sender_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['thread_id'], ['conversation_threads.id'],
                                ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('messages', schema=None) as batch_op:
        batch_op.create_index('ix_messages_thread_id', ['thread_id'], unique=False)


def downgrade():
    with op.batch_alter_table('messages', schema=None) as batch_op:
        batch_op.drop_index('ix_messages_thread_id')
    op.drop_table('messages')

    with op.batch_alter_table('conversation_threads', schema=None) as batch_op:
        batch_op.drop_index('ix_conv_threads_updated_at')
        batch_op.drop_index('ix_conv_threads_candidate_id')
        batch_op.drop_index('ix_conv_threads_employer_id')
    op.drop_table('conversation_threads')

    with op.batch_alter_table('invitations', schema=None) as batch_op:
        batch_op.drop_index('ix_invitations_created_at')
        batch_op.drop_index('ix_invitations_candidate_id')
        batch_op.drop_index('ix_invitations_employer_id')
        batch_op.drop_index('ix_invitations_status')
    op.drop_table('invitations')

    with op.batch_alter_table('match_results', schema=None) as batch_op:
        batch_op.drop_index('ix_match_results_candidate_id')
        batch_op.drop_index('ix_match_results_job_id')
    op.drop_table('match_results')

    with op.batch_alter_table('candidates', schema=None) as batch_op:
        batch_op.drop_index('ix_candidates_current_city')
        batch_op.drop_index('ix_candidates_profile_confirmed_at')
        batch_op.drop_index('ix_candidates_availability_status')
        batch_op.drop_index('ix_candidates_user_id')
    op.drop_table('candidates')

    with op.batch_alter_table('jobs', schema=None) as batch_op:
        batch_op.drop_index('ix_jobs_created_at')
        batch_op.drop_index('ix_jobs_city')
        batch_op.drop_index('ix_jobs_status')
        batch_op.drop_index('ix_jobs_company_id')
    op.drop_table('jobs')

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_index('ix_users_email')
    op.drop_table('users')

    # 清理 Enum 类型（MySQL 不需要，PostgreSQL 需要）
    op.execute('DROP TYPE IF EXISTS job_status')
    op.execute('DROP TYPE IF EXISTS availability_status')
    op.execute('DROP TYPE IF EXISTS invitation_status')
