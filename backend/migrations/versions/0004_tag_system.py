"""tag system — tags / tag_user_notes / system_settings + candidates contact fields

新增三张表 + 扩展 candidates 表：
  tags              — 动态标签词条（admin 直接 active，用户申请 pending）
  tag_user_notes    — 用户对标签的自定义描述
  system_settings   — 系统开关（tag_approval_required 默认 true）
  candidates        — 新增 email / phone / address / contact_visible

Revision ID: 0004_tag_system
Revises: 0003_import_infrastructure
Create Date: 2026-04-27
"""
from datetime import datetime, timezone
from alembic import op
import sqlalchemy as sa

revision = '0004_tag_system'
down_revision = '0003_import_infrastructure'
branch_labels = None
depends_on = None


def upgrade():
    # ── tags ──────────────────────────────────────────────────────────────────
    op.create_table(
        'tags',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('category', sa.String(50), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status',
                  sa.Enum('active', 'pending', 'rejected', name='tag_status'),
                  nullable=False, server_default='pending'),
        sa.Column('source',
                  sa.Enum('admin', 'user', name='tag_source'),
                  nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('reviewed_by', sa.Integer(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(), nullable=True),
        sa.Column('reject_reason', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['reviewed_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('category', 'name', name='uq_tag_category_name'),
    )
    with op.batch_alter_table('tags', schema=None) as batch_op:
        batch_op.create_index('ix_tags_category', ['category'], unique=False)
        batch_op.create_index('ix_tags_status', ['status'], unique=False)

    # ── tag_user_notes ────────────────────────────────────────────────────────
    op.create_table(
        'tag_user_notes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tag_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('note', sa.String(200), nullable=False),
        sa.Column('status',
                  sa.Enum('active', 'pending', 'rejected', name='tag_note_status'),
                  nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('reviewed_by', sa.Integer(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['tag_id'], ['tags.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['reviewed_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tag_id', 'user_id', name='uq_tag_note_tag_user'),
    )
    with op.batch_alter_table('tag_user_notes', schema=None) as batch_op:
        batch_op.create_index('ix_tag_user_notes_tag_id', ['tag_id'], unique=False)
        batch_op.create_index('ix_tag_user_notes_user_id', ['user_id'], unique=False)
        batch_op.create_index('ix_tag_user_notes_status', ['status'], unique=False)

    # ── system_settings ───────────────────────────────────────────────────────
    op.create_table(
        'system_settings',
        sa.Column('key', sa.String(50), nullable=False),
        sa.Column('value', sa.Text(), nullable=False),
        sa.Column('updated_by', sa.Integer(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('key'),
    )
    op.execute(
        "INSERT INTO system_settings (`key`, `value`, updated_at) "
        "VALUES ('tag_approval_required', 'true', NOW())"
    )

    # ── candidates: new contact fields ────────────────────────────────────────
    with op.batch_alter_table('candidates', schema=None) as batch_op:
        batch_op.add_column(sa.Column('email', sa.String(120), nullable=True))
        batch_op.add_column(sa.Column('phone', sa.String(30), nullable=True))
        batch_op.add_column(sa.Column('address', sa.String(200), nullable=True))
        batch_op.add_column(
            sa.Column('contact_visible', sa.Boolean(), nullable=False,
                      server_default=sa.false())
        )


def downgrade():
    with op.batch_alter_table('candidates', schema=None) as batch_op:
        batch_op.drop_column('contact_visible')
        batch_op.drop_column('address')
        batch_op.drop_column('phone')
        batch_op.drop_column('email')

    op.drop_table('system_settings')

    with op.batch_alter_table('tag_user_notes', schema=None) as batch_op:
        batch_op.drop_index('ix_tag_user_notes_status')
        batch_op.drop_index('ix_tag_user_notes_user_id')
        batch_op.drop_index('ix_tag_user_notes_tag_id')
    op.drop_table('tag_user_notes')

    with op.batch_alter_table('tags', schema=None) as batch_op:
        batch_op.drop_index('ix_tags_status')
        batch_op.drop_index('ix_tags_category')
    op.drop_table('tags')

    op.execute('DROP TYPE IF EXISTS tag_note_status')
    op.execute('DROP TYPE IF EXISTS tag_source')
    op.execute('DROP TYPE IF EXISTS tag_status')
