"""normalize_function_codes.py — 历史 function_code 修复脚本（v2）。

将 candidates 和 jobs 表中的旧 function_code 映射到新的 8 项标准枚举：
  Sea / Air / CrossBorder / Railway / Road / ContractLogistics / Warehousing / Customs

映射规则 (旧 → 新):
  Land              → Road
  MultiModal        → Railway
  Supply            → ContractLogistics
  Contract Logistics→ ContractLogistics
  CL                → ContractLogistics
  ECOMS             → CrossBorder
  Custom            → Customs

用法:
  python scripts/normalize_function_codes.py          # dry-run，仅输出统计
  python scripts/normalize_function_codes.py --apply   # 真正写入 DB

可重复运行：已为标准值的行不会重复修改。
"""
import argparse
import os
import sys

# Ensure backend/ is on path so we can import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from app import create_app
from app.extensions import db

# ── Mapping table ────────────────────────────────────────────────────────────
# (old_code, new_code)  — 顺序重要：长值优先匹配
FUNCTION_REMAP = [
    ("Contract Logistics", "ContractLogistics"),
    ("Land",               "Road"),
    ("MultiModal",         "Railway"),
    ("Supply",             "ContractLogistics"),
    ("CL",                 "ContractLogistics"),
    ("ECOMS",              "CrossBorder"),
    ("Custom",             "Customs"),
]

# ── Normalize helpers ────────────────────────────────────────────────────────


def _build_case_stmt(table, col, remap):
    """Build a SQL CASE WHEN statement for the given remap list."""
    whens = []
    for i, (old_val, new_val) in enumerate(remap):
        whens.append(f"WHEN {col} = :old_{i} THEN :new_{i}")
    if not whens:
        return None, {}
    stmt = f"CASE {' '.join(whens)} ELSE {col} END"
    params = {}
    for i, (old_val, new_val) in enumerate(remap):
        params[f"old_{i}"] = old_val
        params[f"new_{i}"] = new_val
    return stmt, params


def _count_and_list(conn, table, col, remap):
    """Return (count, [(id, old_val), ...]) of rows that would be changed."""
    old_vals = [old for old, _ in remap]
    placeholders = ", ".join(f":v{i}" for i in range(len(old_vals)))
    params = {f"v{i}": v for i, v in enumerate(old_vals)}

    sql = f"SELECT id, {col} FROM {table} WHERE {col} IN ({placeholders}) ORDER BY id"
    rows = conn.execute(db.text(sql), params).fetchall()
    return len(rows), [(r.id, getattr(r, col)) for r in rows]


def run(dry_run=True):
    app = create_app()
    with app.app_context():
        conn = db.session

        # 1. Count candidates
        cand_count, cand_rows = _count_and_list(conn, "candidates", "function_code", FUNCTION_REMAP)
        cand_name_count = 0
        cand_name_rows = []
        # Also check function_name column with same mapping
        _name_count, _name_rows = _count_and_list(conn, "candidates", "function_name", FUNCTION_REMAP)
        cand_name_count = _name_count
        cand_name_rows = _name_rows

        # 2. Count jobs
        job_count, job_rows = _count_and_list(conn, "jobs", "function_code", FUNCTION_REMAP)
        job_name_count = 0
        job_name_rows = []
        _jname_count, _jname_rows = _count_and_list(conn, "jobs", "function_name", FUNCTION_REMAP)
        job_name_count = _jname_count
        job_name_rows = _jname_rows

        total = cand_count + cand_name_count + job_count + job_name_count

        print("=" * 60)
        print("Function Code Normalization Report")
        print("=" * 60)
        print(f"  candidates.function_code : {cand_count} row(s)")
        for rid, old in cand_rows:
            new = dict(FUNCTION_REMAP).get(old, old)
            print(f"    id={rid}: {old} → {new}")
        print(f"  candidates.function_name : {cand_name_count} row(s)")
        for rid, old in cand_name_rows:
            new = dict(FUNCTION_REMAP).get(old, old)
            print(f"    id={rid}: {old} → {new}")
        print(f"  jobs.function_code      : {job_count} row(s)")
        for rid, old in job_rows:
            new = dict(FUNCTION_REMAP).get(old, old)
            print(f"    id={rid}: {old} → {new}")
        print(f"  jobs.function_name      : {job_name_count} row(s)")
        for rid, old in job_name_rows:
            new = dict(FUNCTION_REMAP).get(old, old)
            print(f"    id={rid}: {old} → {new}")
        print(f"  TOTAL                   : {total} row(s)")
        print()

        if total == 0:
            print("No legacy function codes found. Nothing to do.")
            return

        if dry_run:
            print("DRY RUN — no changes made. Re-run with --apply to commit.")
            return

        # ── Apply ──────────────────────────────────────────────────────
        print("Applying changes...")
        for table in ("candidates", "jobs"):
            for col in ("function_code", "function_name"):
                stmt, params = _build_case_stmt(conn, table, col, FUNCTION_REMAP)
                if stmt is None:
                    continue
                old_vals = [old for old, _ in FUNCTION_REMAP]
                placeholders = ", ".join(f":v{i}" for i in range(len(old_vals)))
                filter_params = {f"v{i}": v for i, v in enumerate(old_vals)}
                full_params = {**params, **filter_params}

                sql = (
                    f"UPDATE {table} SET {col} = {stmt} "
                    f"WHERE {col} IN ({placeholders})"
                )
                result = conn.execute(db.text(sql), full_params)
                # result.rowcount may be -1 with some drivers; we already counted above

        conn.commit()
        print(f"Committed {total} change(s).")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Normalize legacy function codes to new 6-value enum")
    p.add_argument("--apply", action="store_true", help="Actually write changes (default: dry-run)")
    args = p.parse_args()
    run(dry_run=not args.apply)
