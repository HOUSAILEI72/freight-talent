"""import infrastructure — field_registry / import_batches / import_batch_rows

新增三张表支持 Excel 导入预检基础设施：
  field_registry    — 动态字段注册表
  import_batches    — 导入批次审计记录
  import_batch_rows — 行级预检结果

Revision ID: 0003_import_infrastructure
Revises: 0002_drop_invitation_unique_constraint
Create Date: 2026-04-22
"""
from alembic import op
import sqlalchemy as sa

revision = '0003_import_infrastructure'
down_revision = '0002_drop_invitation_unique_constraint'
branch_labels = None
depends_on = None


def upgrade():
    # ── import_batches（先建，因为 field_registry 有 FK 指向它）────────────
    op.create_table(
        'import_batches',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('uploaded_by', sa.Integer(), nullable=False),
        sa.Column('import_type', sa.String(20), nullable=False),
        sa.Column('original_filename', sa.String(300), nullable=False),
        sa.Column('file_hash', sa.String(64), nullable=False),
        sa.Column('detected_columns', sa.JSON(), nullable=True),
        sa.Column('new_fields', sa.JSON(), nullable=True),
        sa.Column('error_summary', sa.JSON(), nullable=True),
        sa.Column('warning_summary', sa.JSON(), nullable=True),
        sa.Column('preview_stats', sa.JSON(), nullable=True),
        sa.Column('is_confirmed', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('annotated_file_path', sa.String(300), nullable=True),
        sa.Column('status',
                  sa.Enum('preview', 'confirmed', 'failed', name='import_batch_status'),
                  nullable=False, server_default='preview'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('import_batches', schema=None) as batch_op:
        batch_op.create_index('ix_import_batches_uploaded_by', ['uploaded_by'], unique=False)
        batch_op.create_index('ix_import_batches_file_hash', ['file_hash'], unique=False)

    # ── field_registry ────────────────────────────────────────────────────────
    op.create_table(
        'field_registry',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('entity_type', sa.String(20), nullable=False),
        sa.Column('field_key', sa.String(100), nullable=False),
        sa.Column('label', sa.String(200), nullable=False),
        sa.Column('field_type', sa.String(20), nullable=False, server_default='text'),
        sa.Column('is_filterable', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('visible_roles', sa.JSON(), nullable=True),
        sa.Column('tier_rule_json', sa.JSON(), nullable=True),
        sa.Column('status',
                  sa.Enum('pending', 'active', 'disabled', name='field_registry_status'),
                  nullable=False, server_default='pending'),
        sa.Column('first_seen_batch_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['first_seen_batch_id'], ['import_batches.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('entity_type', 'field_key', name='uq_field_registry_entity_key'),
    )
    with op.batch_alter_table('field_registry', schema=None) as batch_op:
        batch_op.create_index('ix_field_registry_entity_type', ['entity_type'], unique=False)

    # ── import_batch_rows ─────────────────────────────────────────────────────
    op.create_table(
        'import_batch_rows',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('batch_id', sa.Integer(), nullable=False),
        sa.Column('row_index', sa.Integer(), nullable=False),
        sa.Column('row_status', sa.String(20), nullable=False, server_default='ok'),
        sa.Column('row_fingerprint', sa.String(64), nullable=True),
        sa.Column('issues', sa.JSON(), nullable=True),
        sa.Column('raw_data', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['batch_id'], ['import_batches.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('import_batch_rows', schema=None) as batch_op:
        batch_op.create_index('ix_import_batch_rows_batch_id', ['batch_id'], unique=False)
        batch_op.create_index('ix_import_batch_rows_row_fingerprint',
                               ['row_fingerprint'], unique=False)


def downgrade():
    with op.batch_alter_table('import_batch_rows', schema=None) as batch_op:
        batch_op.drop_index('ix_import_batch_rows_row_fingerprint')
        batch_op.drop_index('ix_import_batch_rows_batch_id')
    op.drop_table('import_batch_rows')

    with op.batch_alter_table('field_registry', schema=None) as batch_op:
        batch_op.drop_index('ix_field_registry_entity_type')
    op.drop_table('field_registry')

    with op.batch_alter_table('import_batches', schema=None) as batch_op:
        batch_op.drop_index('ix_import_batches_file_hash')
        batch_op.drop_index('ix_import_batches_uploaded_by')
    op.drop_table('import_batches')

    op.execute('DROP TYPE IF EXISTS import_batch_status')
    op.execute('DROP TYPE IF EXISTS field_registry_status')
