"""create headhunting_requests table

Revision ID: 0020_create_headhunting_requests
Revises: 0019
Create Date: 2026-05-13
"""
from alembic import op
import sqlalchemy as sa

revision = '0020_create_headhunting_requests'
down_revision = '0019'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'headhunting_requests',
        sa.Column('id',            sa.Integer(),     primary_key=True),
        sa.Column('employer_id',   sa.Integer(),     sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('service_type',  sa.String(32),    nullable=False, server_default='personal'),
        sa.Column('status',        sa.String(32),    nullable=False, server_default='submitted'),
        sa.Column('job_payload',   sa.JSON(),        nullable=True),
        sa.Column('terms_payload', sa.JSON(),        nullable=True),
        sa.Column('add_ons_payload', sa.JSON(),      nullable=True),
        sa.Column('fee_snapshot',  sa.JSON(),        nullable=True),
        sa.Column('contact_name',  sa.String(128),   nullable=False),
        sa.Column('contact_phone', sa.String(64),    nullable=False),
        sa.Column('contact_email', sa.String(256),   nullable=False),
        sa.Column('contact_wechat',sa.String(128),   nullable=True),
        sa.Column('created_at',    sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at',    sa.DateTime(timezone=True), nullable=False),
    )


def downgrade():
    op.drop_table('headhunting_requests')
