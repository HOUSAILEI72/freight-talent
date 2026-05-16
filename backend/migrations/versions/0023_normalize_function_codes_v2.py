"""normalize function codes to new 8-value enum

将 candidates、jobs 及 subscriptions 中的旧 function_code 映射到新的 8 项枚举：
  Sea / Air / CrossBorder / Railway / Road / ContractLogistics / Warehousing / Customs

旧 → 新:
  Contract Logistics → ContractLogistics
  Land               → Road
  MultiModal         → Railway
  Supply             → ContractLogistics
  CL                 → ContractLogistics
  ECOMS              → CrossBorder
  Custom             → Customs

Revision ID: 0023_normalize_function_codes_v2
Revises: 0022_candidate_email_actions
Create Date: 2026-05-15
"""
from alembic import op
import json

revision = '0023_normalize_function_codes_v2'
down_revision = '0022_candidate_email_actions'
branch_labels = None
depends_on = None

# (old_code, new_code)
_REMAP = [
    ("Contract Logistics", "ContractLogistics"),
    ("Land",               "Road"),
    ("MultiModal",         "Railway"),
    ("Supply",             "ContractLogistics"),
    ("CL",                 "ContractLogistics"),
    ("ECOMS",              "CrossBorder"),
    ("Custom",             "Customs"),
]


def _update_string_col(table, col):
    """UPDATE table SET col = new WHERE col = old for each remap pair."""
    conn = op.get_bind()
    for old, new in _REMAP:
        conn.execute(
            op.inline_literal(
                f"UPDATE `{table}` SET `{col}` = '{new}' WHERE `{col}` = '{old}'"
            )
        )


def _update_string_col_safe(table, col):
    conn = op.get_bind()
    for old, new in _REMAP:
        conn.execute(
            sa_text(f"UPDATE `{table}` SET `{col}` = :new WHERE `{col}` = :old"),
            {"old": old, "new": new},
        )


def upgrade():
    from sqlalchemy import text as sa_text
    conn = op.get_bind()

    # 1. candidates.function_code / function_name
    for old, new in _REMAP:
        conn.execute(sa_text(
            "UPDATE candidates SET function_code = :new WHERE function_code = :old"
        ), {"old": old, "new": new})
        conn.execute(sa_text(
            "UPDATE candidates SET function_name = :new WHERE function_name = :old"
        ), {"old": old, "new": new})

    # 2. jobs.function_code / function_name
    for old, new in _REMAP:
        conn.execute(sa_text(
            "UPDATE jobs SET function_code = :new WHERE function_code = :old"
        ), {"old": old, "new": new})
        conn.execute(sa_text(
            "UPDATE jobs SET function_name = :new WHERE function_name = :old"
        ), {"old": old, "new": new})

    # 3. subscriptions.function_codes (JSON 列) — 逐行 Python 更新
    remap_dict = dict(_REMAP)
    rows = conn.execute(sa_text(
        "SELECT id, function_codes FROM subscriptions WHERE function_codes IS NOT NULL"
    )).fetchall()
    for row in rows:
        raw = row[1]
        try:
            codes = json.loads(raw) if isinstance(raw, str) else raw
        except Exception:
            continue
        if not isinstance(codes, list):
            continue
        new_codes = [remap_dict.get(c, c) for c in codes]
        if new_codes != codes:
            conn.execute(sa_text(
                "UPDATE subscriptions SET function_codes = :val WHERE id = :id"
            ), {"val": json.dumps(new_codes, ensure_ascii=False), "id": row[0]})


def downgrade():
    pass
