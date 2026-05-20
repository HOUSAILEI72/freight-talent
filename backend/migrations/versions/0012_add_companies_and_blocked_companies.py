"""add companies master data and candidate_blocked_companies

Revision ID: 0012_companies_blocked
Revises: 02055d4e5c99
Create Date: 2026-05-19

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime, timezone

revision = "0012_companies_blocked"
down_revision = "02055d4e5c99"
branch_labels = None
depends_on = None


def upgrade():
    # ── 1. companies 主数据表 ─────────────────────────────────────────────────
    op.create_table(
        "companies",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("name_en", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_companies_name"),
    )
    op.create_index("idx_companies_name", "companies", ["name"], unique=True)

    # ── 2. 从 users.company_name（雇主）填充主数据 ────────────────────────────
    conn = op.get_bind()
    now = datetime.now(timezone.utc)
    rows = conn.execute(
        sa.text(
            "SELECT DISTINCT company_name FROM users "
            "WHERE role = 'employer' AND company_name IS NOT NULL AND TRIM(company_name) != ''"
        )
    ).fetchall()
    for (name,) in rows:
        conn.execute(
            sa.text(
                "INSERT IGNORE INTO companies (name, created_at, updated_at) VALUES (:n, :t, :t)"
            ),
            {"n": name.strip(), "t": now},
        )

    # ── 3. candidate_blocked_companies 关联表 ─────────────────────────────────
    op.create_table(
        "candidate_blocked_companies",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("candidate_id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["candidate_id"], ["candidates.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["company_id"], ["companies.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "candidate_id", "company_id", name="uq_candidate_blocked_company"
        ),
    )
    op.create_index(
        "idx_blocked_candidate_id", "candidate_blocked_companies", ["candidate_id"]
    )
    op.create_index(
        "idx_blocked_company_id", "candidate_blocked_companies", ["company_id"]
    )


def downgrade():
    op.drop_table("candidate_blocked_companies")
    op.drop_index("idx_companies_name", table_name="companies")
    op.drop_table("companies")
