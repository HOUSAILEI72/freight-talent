"""Rename Great China to China in location_path and business_area_name;
add HK/TW under China path; add MO (Macau) support.

Revision ID: 0018_rename_great_china_to_china
Revises: 0017_job_employment_type
Create Date: 2026-05-13
"""

from alembic import op
import sqlalchemy as sa

revision = "0018_rename_great_china_to_china"
down_revision = "0017_job_employment_type"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # ── jobs table ────────────────────────────────────────────────────────────
    conn.execute(sa.text(
        "UPDATE jobs SET location_path = CONCAT('China/', SUBSTRING(location_path, 13)) "
        "WHERE location_path LIKE 'Great China/%'"
    ))
    conn.execute(sa.text(
        "UPDATE jobs SET location_path = 'China' "
        "WHERE location_path = 'Great China'"
    ))
    conn.execute(sa.text(
        "UPDATE jobs SET location_path = 'China/Hong Kong' "
        "WHERE location_path = 'Hong Kong'"
    ))
    conn.execute(sa.text(
        "UPDATE jobs SET location_path = 'China/Taiwan' "
        "WHERE location_path = 'Taiwan'"
    ))
    conn.execute(sa.text(
        "UPDATE jobs SET business_area_name = 'China' "
        "WHERE business_area_name = 'Great China'"
    ))

    # ── candidates table ──────────────────────────────────────────────────────
    conn.execute(sa.text(
        "UPDATE candidates SET location_path = CONCAT('China/', SUBSTRING(location_path, 13)) "
        "WHERE location_path LIKE 'Great China/%'"
    ))
    conn.execute(sa.text(
        "UPDATE candidates SET location_path = 'China' "
        "WHERE location_path = 'Great China'"
    ))
    conn.execute(sa.text(
        "UPDATE candidates SET location_path = 'China/Hong Kong' "
        "WHERE location_path = 'Hong Kong'"
    ))
    conn.execute(sa.text(
        "UPDATE candidates SET location_path = 'China/Taiwan' "
        "WHERE location_path = 'Taiwan'"
    ))
    conn.execute(sa.text(
        "UPDATE candidates SET business_area_name = 'China' "
        "WHERE business_area_name = 'Great China'"
    ))


def downgrade():
    conn = op.get_bind()

    # jobs
    conn.execute(sa.text(
        "UPDATE jobs SET location_path = CONCAT('Great China/', SUBSTRING(location_path, 7)) "
        "WHERE location_path LIKE 'China/%'"
    ))
    conn.execute(sa.text(
        "UPDATE jobs SET location_path = 'Great China' "
        "WHERE location_path = 'China'"
    ))
    conn.execute(sa.text(
        "UPDATE jobs SET location_path = 'Hong Kong' "
        "WHERE location_path = 'China/Hong Kong'"
    ))
    conn.execute(sa.text(
        "UPDATE jobs SET location_path = 'Taiwan' "
        "WHERE location_path = 'China/Taiwan'"
    ))
    conn.execute(sa.text(
        "UPDATE jobs SET business_area_name = 'Great China' "
        "WHERE business_area_name = 'China'"
    ))

    # candidates
    conn.execute(sa.text(
        "UPDATE candidates SET location_path = CONCAT('Great China/', SUBSTRING(location_path, 7)) "
        "WHERE location_path LIKE 'China/%'"
    ))
    conn.execute(sa.text(
        "UPDATE candidates SET location_path = 'Great China' "
        "WHERE location_path = 'China'"
    ))
    conn.execute(sa.text(
        "UPDATE candidates SET location_path = 'Hong Kong' "
        "WHERE location_path = 'China/Hong Kong'"
    ))
    conn.execute(sa.text(
        "UPDATE candidates SET location_path = 'Taiwan' "
        "WHERE location_path = 'China/Taiwan'"
    ))
    conn.execute(sa.text(
        "UPDATE candidates SET business_area_name = 'Great China' "
        "WHERE business_area_name = 'China'"
    ))
