"""
诊断脚本：直接连 DB 查 chart SQL 的实际输出。
用法：
  cd backend
  python scripts/debug_chart.py
"""
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

import pymysql

DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_NAME = os.getenv("DB_NAME", "freight_talent")

conn = pymysql.connect(
    host=DB_HOST, port=DB_PORT, user=DB_USER,
    password=DB_PASSWORD, database=DB_NAME, charset="utf8mb4",
)
cur = conn.cursor(pymysql.cursors.DictCursor)

print("=" * 70)
print("MySQL 时区 / 当前时间")
print("=" * 70)
cur.execute("SELECT @@global.time_zone AS gtz, @@session.time_zone AS stz, NOW() AS now_, UTC_TIMESTAMP() AS utc_now")
print(cur.fetchone())

print()
print("=" * 70)
print("候选人表 — 总数 / 最近 5 条 created_at")
print("=" * 70)
cur.execute("SELECT COUNT(*) AS c FROM candidates")
print("总数:", cur.fetchone())
cur.execute("SELECT id, full_name, created_at FROM candidates ORDER BY created_at DESC LIMIT 5")
for r in cur.fetchall():
    print(r)

print()
print("=" * 70)
print("岗位表 — 总数 / 按 status 分布 / 最近 5 条")
print("=" * 70)
cur.execute("SELECT COUNT(*) AS c FROM jobs")
print("总数:", cur.fetchone())
cur.execute("SELECT status, COUNT(*) AS c FROM jobs GROUP BY status")
for r in cur.fetchall(): print(r)
cur.execute("SELECT id, title, status, created_at FROM jobs ORDER BY created_at DESC LIMIT 5")
for r in cur.fetchall(): print(r)

print()
print("=" * 70)
print("Chart SQL — candidate (无 tag 过滤，12 月)")
print("=" * 70)
cutoff = datetime.now(timezone.utc) - timedelta(days=12 * 32)
cur.execute(
    """SELECT DATE_FORMAT(c.created_at, '%%Y-%%m') AS period, COUNT(DISTINCT c.id) AS cnt
       FROM candidates c WHERE c.created_at >= %s
       GROUP BY period ORDER BY period""",
    (cutoff.replace(tzinfo=None),),
)
print(f"cutoff = {cutoff}")
rows = cur.fetchall()
print(f"返回 {len(rows)} 行：")
for r in rows: print(r)

print()
print("=" * 70)
print("Chart SQL — job (无 tag 过滤，12 月，published)")
print("=" * 70)
cur.execute(
    """SELECT DATE_FORMAT(c.created_at, '%%Y-%%m') AS period, COUNT(DISTINCT c.id) AS cnt
       FROM jobs c WHERE c.created_at >= %s AND c.status='published'
       GROUP BY period ORDER BY period""",
    (cutoff.replace(tzinfo=None),),
)
rows = cur.fetchall()
print(f"返回 {len(rows)} 行：")
for r in rows: print(r)

print()
print("=" * 70)
print("Junction 表 — candidate_tags / job_tags 数量")
print("=" * 70)
for t in ("candidate_tags", "job_tags"):
    cur.execute(f"SELECT COUNT(*) AS c FROM {t}")
    print(f"{t}: {cur.fetchone()['c']}")

print()
print("=" * 70)
print("Tags 表 — 按 status 分布")
print("=" * 70)
cur.execute("SELECT status, COUNT(*) AS c FROM tags GROUP BY status")
for r in cur.fetchall(): print(r)

conn.close()
