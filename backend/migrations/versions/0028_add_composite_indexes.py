"""add composite indexes for hot query paths

Revision ID: c4e7f8a1b2d3
Revises: a03043a16b52
Create Date: 2026-05-19 10:00:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'c4e7f8a1b2d3'
down_revision = 'a03043a16b52'
branch_labels = None
depends_on = None


def upgrade():
    # conversation_threads: employer_id and candidate_id had no indexes at all
    op.create_index('ix_conv_thread_employer_id',       'conversation_threads', ['employer_id'])
    op.create_index('ix_conv_thread_candidate_id',      'conversation_threads', ['candidate_id'])
    op.create_index('ix_conv_thread_employer_updated',  'conversation_threads', ['employer_id', 'updated_at'])
    op.create_index('ix_conv_thread_candidate_updated', 'conversation_threads', ['candidate_id', 'updated_at'])

    # messages: composite indexes for unread-count aggregation and id-based pagination
    op.create_index('ix_message_thread_read_sender', 'messages', ['thread_id', 'is_read', 'sender_user_id'])
    op.create_index('ix_message_thread_id_page',     'messages', ['thread_id', 'id'])

    # invitations: composite indexes for duplicate-check, quota counts, and sorted lists
    op.create_index('ix_invitation_job_candidate',    'invitations', ['job_id', 'candidate_id'])
    op.create_index('ix_invitation_employer_status',  'invitations', ['employer_id', 'status'])
    op.create_index('ix_invitation_employer_created', 'invitations', ['employer_id', 'created_at'])
    op.create_index('ix_invitation_candidate_created','invitations', ['candidate_id', 'created_at'])

    # subscriptions: composite for active-subscription lookup on every resume unlock
    op.create_index('ix_subscription_employer_status', 'subscriptions', ['employer_id', 'status'])

    # notifications: composite replaces two single-column indexes for unread badge query
    op.create_index('ix_notification_user_is_read', 'notifications', ['user_id', 'is_read'])

    # job_applications: composite for employer filtered list and candidate sorted list
    op.create_index('ix_job_app_employer_status',   'job_applications', ['employer_id', 'status'])
    op.create_index('ix_job_app_candidate_created', 'job_applications', ['candidate_id', 'created_at'])

    # jobs: function_code was missing (candidates table already has it)
    op.create_index('ix_jobs_function_code', 'jobs', ['function_code'])

    # candidates: triple-filter composite for candidate pool main query
    op.create_index('ix_candidate_avail_func_area', 'candidates',
                    ['availability_status', 'function_code', 'business_area_code'])

    # headhunting_requests: status filter
    op.create_index('ix_headhunting_status', 'headhunting_requests', ['status'])


def downgrade():
    op.drop_index('ix_headhunting_status',           table_name='headhunting_requests')
    op.drop_index('ix_candidate_avail_func_area',    table_name='candidates')
    op.drop_index('ix_jobs_function_code',           table_name='jobs')
    op.drop_index('ix_job_app_candidate_created',    table_name='job_applications')
    op.drop_index('ix_job_app_employer_status',      table_name='job_applications')
    op.drop_index('ix_notification_user_is_read',    table_name='notifications')
    op.drop_index('ix_subscription_employer_status', table_name='subscriptions')
    op.drop_index('ix_invitation_candidate_created', table_name='invitations')
    op.drop_index('ix_invitation_employer_created',  table_name='invitations')
    op.drop_index('ix_invitation_employer_status',   table_name='invitations')
    op.drop_index('ix_invitation_job_candidate',     table_name='invitations')
    op.drop_index('ix_message_thread_id_page',       table_name='messages')
    op.drop_index('ix_message_thread_read_sender',   table_name='messages')
    op.drop_index('ix_conv_thread_candidate_updated',table_name='conversation_threads')
    op.drop_index('ix_conv_thread_employer_updated', table_name='conversation_threads')
    op.drop_index('ix_conv_thread_candidate_id',     table_name='conversation_threads')
    op.drop_index('ix_conv_thread_employer_id',      table_name='conversation_threads')
