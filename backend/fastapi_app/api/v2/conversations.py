"""
GET /api/v2/conversations — 高性能会话列表（纯 SQL，固定 3 次查询，无 ORM 懒加载）

此接口是 Flask /api/conversations 的 FastAPI 等价版，
实现逻辑与优化后的 Flask 版相同，但使用原生 SQLAlchemy Core + text()，
完全不依赖 Flask-SQLAlchemy 的 db.Model。
"""
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text, bindparam
from sqlalchemy.orm import Session

from fastapi_app.core.auth import get_current_user_id
from fastapi_app.core.database import get_db

router = APIRouter(tags=["conversations"])

UserID = Annotated[int, Depends(get_current_user_id)]
DB = Annotated[Session, Depends(get_db)]


@router.get("/conversations")
def get_conversations(user_id: UserID, db: DB):
    """
    返回当前用户的所有会话列表。
    查询策略：3 次固定 SQL，与 N（会话数量）无关。
    """
    # ── 1. 获取用户角色 ───────────────────────────────────────────────────────
    user_row = db.execute(
        text("SELECT id, role, is_active FROM users WHERE id = :uid"),
        {"uid": user_id},
    ).fetchone()

    if not user_row or not user_row.is_active:
        raise HTTPException(status_code=404, detail="用户不存在")

    role = user_row.role

    # ── 2. 根据角色确定过滤条件 ───────────────────────────────────────────────
    if role == "employer":
        where_clause = "ct.employer_id = :filter_id"
        filter_id = user_id
    elif role == "candidate":
        cand_row = db.execute(
            text("SELECT id FROM candidates WHERE user_id = :uid"),
            {"uid": user_id},
        ).fetchone()
        if not cand_row:
            return {"success": True, "conversations": [], "total_unread": 0}
        where_clause = "ct.candidate_id = :filter_id"
        filter_id = cand_row.id
    elif role == "admin":
        where_clause = "1=1"
        filter_id = 0   # unused
    else:
        raise HTTPException(status_code=403, detail="无权限")

    # ── 3. 主查询：一次 JOIN 取所有 thread + 关联数据 ────────────────────────
    threads_sql = text(f"""
        SELECT
            ct.id,
            ct.invitation_id,
            ct.job_id,
            ct.candidate_id,
            ct.employer_id,
            ct.updated_at,
            i.status  AS invitation_status,
            j.title   AS job_title,
            u.company_name,
            c.full_name AS candidate_name
        FROM conversation_threads ct
        LEFT JOIN invitations  i ON i.id = ct.invitation_id
        LEFT JOIN jobs         j ON j.id = ct.job_id
        LEFT JOIN users        u ON u.id = j.company_id
        LEFT JOIN candidates   c ON c.id = ct.candidate_id
        WHERE {where_clause}
        ORDER BY ct.updated_at DESC
    """)
    threads = db.execute(threads_sql, {"filter_id": filter_id}).fetchall()

    if not threads:
        return {"success": True, "conversations": [], "total_unread": 0}

    thread_ids = [t.id for t in threads]

    # ── 4. 批量：每个 thread 的最新消息 ──────────────────────────────────────
    latest_sql = text("""
        SELECT m.thread_id, m.content, m.created_at
        FROM messages m
        INNER JOIN (
            SELECT thread_id, MAX(id) AS max_id
            FROM messages
            WHERE thread_id IN :ids
            GROUP BY thread_id
        ) sub ON m.id = sub.max_id
    """).bindparams(bindparam("ids", expanding=True))
    latest_rows = db.execute(latest_sql, {"ids": thread_ids}).fetchall()
    latest_map = {r.thread_id: r for r in latest_rows}

    # ── 5. 批量：每个 thread 的未读数 ────────────────────────────────────────
    unread_sql = text("""
        SELECT thread_id, COUNT(*) AS cnt
        FROM messages
        WHERE thread_id IN :ids
          AND is_read = FALSE
          AND sender_user_id != :uid
        GROUP BY thread_id
    """).bindparams(bindparam("ids", expanding=True))
    unread_rows = db.execute(unread_sql, {"ids": thread_ids, "uid": user_id}).fetchall()
    unread_map = {r.thread_id: r.cnt for r in unread_rows}

    # ── 6. 组装（纯 Python）────────────────────────────────────────────────────
    summaries = []
    for t in threads:
        latest = latest_map.get(t.id)
        summaries.append({
            "id":                t.id,
            "invitation_id":     t.invitation_id,
            "invitation_status": t.invitation_status or "pending",
            "job_id":            t.job_id,
            "job_title":         t.job_title or "—",
            "company_name":      t.company_name or "—",
            "candidate_id":      t.candidate_id,
            "candidate_name":    t.candidate_name or "—",
            "employer_id":       t.employer_id,
            "latest_message":    latest.content[:60] if latest else None,
            "latest_message_at": latest.created_at.isoformat() if latest else None,
            "updated_at":        t.updated_at.isoformat() if t.updated_at else None,
            "unread_count":      unread_map.get(t.id, 0),
        })

    total_unread = sum(s["unread_count"] for s in summaries)
    return {
        "success":       True,
        "conversations": summaries,
        "total_unread":  total_unread,
    }
