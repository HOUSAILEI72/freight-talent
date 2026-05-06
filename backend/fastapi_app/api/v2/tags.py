"""
标签体系 API — /api/v2/tags/*

路由顺序关键：静态路径必须在 /{id} 参数路径之前注册。
"""
from datetime import datetime, timezone
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy import text, bindparam
from sqlalchemy.orm import Session
import openpyxl
import io

from fastapi_app.core.auth import get_current_user_id
from fastapi_app.core.database import get_db
from fastapi_app.schemas.tags import TagCreate, TagReview, TagNoteUpsert, NoteReview
from pydantic import BaseModel


class TagBulkReview(BaseModel):
    tag_ids:       list[int]
    action:        str   # 'approve' | 'reject'
    reject_reason: str | None = None


router = APIRouter(tags=["tags"])

UserID = Annotated[int, Depends(get_current_user_id)]
DB     = Annotated[Session, Depends(get_db)]


# ─── 工具函数 ──────────────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _get_user(db: Session, user_id: int) -> dict:
    row = db.execute(
        text("SELECT id, role, is_active FROM users WHERE id = :uid"),
        {"uid": user_id},
    ).fetchone()
    if not row or not row.is_active:
        raise HTTPException(status_code=404, detail="用户不存在")
    return {"id": row.id, "role": row.role}


def _require_roles(user: dict, *roles: str):
    if user["role"] not in roles:
        raise HTTPException(status_code=403, detail="权限不足")


def _approval_required(db: Session) -> bool:
    row = db.execute(
        text("SELECT value FROM system_settings WHERE `key` = 'tag_approval_required'"),
    ).fetchone()
    if not row:
        return True
    return row.value.lower() == "true"


# ─── 标签接口 ──────────────────────────────────────────────────────────────────

@router.get("/tags/categories")
def get_categories(db: DB, user_id: UserID):
    """返回所有有 active 词条的 category 列表（有序）。"""
    rows = db.execute(
        text("SELECT DISTINCT category FROM tags WHERE status = 'active' ORDER BY category"),
    ).fetchall()
    return {"success": True, "categories": [r.category for r in rows]}


@router.get("/tags/pending")
def get_pending_tags(db: DB, user_id: UserID):
    """admin：待审批标签列表。"""
    user = _get_user(db, user_id)
    _require_roles(user, "admin")

    rows = db.execute(
        text("""
            SELECT t.id, t.category, t.name, t.description, t.created_at,
                   u.name AS creator_name, u.role AS creator_role
            FROM tags t
            LEFT JOIN users u ON u.id = t.created_by
            WHERE t.status = 'pending'
            ORDER BY t.created_at ASC
        """),
    ).fetchall()
    return {
        "success": True,
        "tags": [
            {
                "id": r.id, "category": r.category, "name": r.name,
                "description": r.description,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "creator_name": r.creator_name, "creator_role": r.creator_role,
            }
            for r in rows
        ],
    }


@router.get("/tags/mine")
def get_my_tags(db: DB, user_id: UserID):
    """当前用户提交过的全部标签（含 pending / active / rejected），最新在前。"""
    rows = db.execute(
        text("""
            SELECT id, category, name, description, status, reject_reason,
                   created_at, reviewed_at
            FROM tags
            WHERE created_by = :uid
            ORDER BY created_at DESC
        """),
        {"uid": user_id},
    ).fetchall()
    return {
        "success": True,
        "tags": [
            {
                "id": r.id, "category": r.category, "name": r.name,
                "description": r.description, "status": r.status,
                "reject_reason": r.reject_reason,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
            }
            for r in rows
        ],
    }


@router.get("/tags")
def list_tags(
    db: DB,
    user_id: UserID,
    category: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    include_pending: bool = Query(False, description="包含 pending 标签（admin 用）"),
):
    """返回标签。默认仅 active；include_pending=true 时含 pending（admin 标签库视图用）。"""
    statuses = ("active", "pending") if include_pending else ("active",)
    where_parts = ["status IN :statuses"]
    params: dict = {"statuses": list(statuses)}

    if category:
        where_parts.append("category = :category")
        params["category"] = category.strip()
    if q:
        where_parts.append("(name LIKE :q OR description LIKE :q)")
        params["q"] = f"%{q.strip()}%"

    where_sql = " AND ".join(where_parts)
    rows = db.execute(
        text(f"""
            SELECT id, category, name, description, status, created_at
            FROM tags
            WHERE {where_sql}
            ORDER BY status DESC, category, name
        """).bindparams(bindparam("statuses", expanding=True)),
        params,
    ).fetchall()

    return {
        "success": True,
        "tags": [
            {
                "id": r.id, "category": r.category, "name": r.name,
                "description": r.description,
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


@router.post("/tags", status_code=201)
def create_tag(body: TagCreate, db: DB, user_id: UserID):
    """
    申请或创建标签。
    - admin：直接 active
    - employer/candidate：pending（审批开关 ON）或 active（审批开关 OFF）
    """
    user = _get_user(db, user_id)
    _require_roles(user, "admin", "employer", "candidate")

    # 检查重复
    existing = db.execute(
        text("SELECT id, status FROM tags WHERE category = :cat AND name = :name"),
        {"cat": body.category, "name": body.name},
    ).fetchone()
    if existing:
        if existing.status == "active":
            raise HTTPException(status_code=409, detail="该标签已存在")
        if existing.status == "pending":
            raise HTTPException(status_code=409, detail="该标签正在审核中")
        # rejected 时允许重新申请 — 插入新记录

    now = _now()
    if user["role"] == "admin":
        status = "active"
        source = "admin"
    else:
        approval = _approval_required(db)
        status = "pending" if approval else "active"
        source = "user"

    result = db.execute(
        text("""
            INSERT INTO tags (category, name, description, status, source, created_by, created_at)
            VALUES (:cat, :name, :desc, :status, :source, :uid, :now)
        """),
        {
            "cat": body.category, "name": body.name, "desc": body.description,
            "status": status, "source": source, "uid": user_id, "now": now,
        },
    )
    db.commit()

    tag_id = result.lastrowid
    msg = "标签已创建" if status == "active" else "标签申请已提交，等待审批"
    return {"success": True, "id": tag_id, "status": status, "message": msg}


@router.patch("/tags/{tag_id}/review")
def review_tag(tag_id: int, body: TagReview, db: DB, user_id: UserID):
    """admin：审批标签申请（通过/拒绝）。"""
    user = _get_user(db, user_id)
    _require_roles(user, "admin")

    tag = db.execute(
        text("SELECT id, status FROM tags WHERE id = :id"),
        {"id": tag_id},
    ).fetchone()
    if not tag:
        raise HTTPException(status_code=404, detail="标签不存在")
    if tag.status != "pending":
        raise HTTPException(status_code=400, detail="只能审批 pending 状态的标签")

    if body.action == "approve":
        new_status = "active"
        db.execute(
            text("""
                UPDATE tags
                SET status = 'active', reviewed_by = :uid, reviewed_at = :now,
                    reject_reason = NULL
                WHERE id = :id
            """),
            {"uid": user_id, "now": _now(), "id": tag_id},
        )
    else:
        if not body.reject_reason or not body.reject_reason.strip():
            raise HTTPException(status_code=400, detail="拒绝时必须填写原因")
        new_status = "rejected"
        db.execute(
            text("""
                UPDATE tags
                SET status = 'rejected', reviewed_by = :uid, reviewed_at = :now,
                    reject_reason = :reason
                WHERE id = :id
            """),
            {"uid": user_id, "now": _now(), "reason": body.reject_reason.strip(), "id": tag_id},
        )

    db.commit()
    # 审批后清掉柱状图缓存（可能包含 stale 计数）
    try:
        from fastapi_app.api.v2.chart import flush_chart_cache
        flush_chart_cache()
    except Exception:
        pass
    return {"success": True, "id": tag_id, "status": new_status}


@router.patch("/tags/review-bulk")
def review_tags_bulk(body: TagBulkReview, db: DB, user_id: UserID):
    """
    admin：批量审批 pending 标签。
    body: { tag_ids: [int], action: 'approve'|'reject', reject_reason?: str }
    """
    user = _get_user(db, user_id)
    _require_roles(user, "admin")

    if body.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action 必须为 approve / reject")
    if not body.tag_ids:
        return {"success": True, "updated": 0}
    if body.action == "reject" and not (body.reject_reason and body.reject_reason.strip()):
        raise HTTPException(status_code=400, detail="拒绝时必须填写原因")

    now = _now()
    if body.action == "approve":
        stmt = text("""
            UPDATE tags
            SET status='active', reviewed_by=:uid, reviewed_at=:now, reject_reason=NULL
            WHERE status='pending' AND id IN :ids
        """).bindparams(bindparam("ids", expanding=True))
        res = db.execute(stmt, {"uid": user_id, "now": now, "ids": list(body.tag_ids)})
    else:
        stmt = text("""
            UPDATE tags
            SET status='rejected', reviewed_by=:uid, reviewed_at=:now, reject_reason=:r
            WHERE status='pending' AND id IN :ids
        """).bindparams(bindparam("ids", expanding=True))
        res = db.execute(stmt, {
            "uid": user_id, "now": now,
            "r": body.reject_reason.strip(), "ids": list(body.tag_ids),
        })

    db.commit()
    try:
        from fastapi_app.api.v2.chart import flush_chart_cache
        flush_chart_cache()
    except Exception:
        pass
    return {"success": True, "updated": res.rowcount or 0, "action": body.action}
def import_tags_excel(db: DB, user_id: UserID, file: UploadFile = File(...)):
    """
    admin：上传 Excel，批量导入标签。
    Excel 格式：第一行为列名（= category），每列下方为该分类的标签 name。
    同一 (category, name) 已存在则跳过（幂等）。
    """
    user = _get_user(db, user_id)
    _require_roles(user, "admin")

    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="仅支持 .xlsx / .xls 格式")

    content = file.file.read()
    try:
        wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    except Exception:
        raise HTTPException(status_code=400, detail="Excel 文件解析失败，请确认格式正确")

    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        raise HTTPException(status_code=400, detail="Excel 文件为空")

    header_row = rows[0]
    categories = []
    for cell in header_row:
        cat = str(cell).strip() if cell is not None else ""
        categories.append(cat if cat else None)

    now = _now()
    imported = 0
    skipped = 0
    new_categories: set = set()

    # 预加载已存在的 active/pending (category, name) 组合，用于幂等检查
    existing_set: set = set()
    existing_rows = db.execute(
        text("SELECT category, name FROM tags WHERE status IN ('active', 'pending')")
    ).fetchall()
    for er in existing_rows:
        existing_set.add((er.category, er.name))

    batch_inserts = []
    for data_row in rows[1:]:
        for col_idx, cell_val in enumerate(data_row):
            if col_idx >= len(categories):
                break
            cat = categories[col_idx]
            if not cat:
                continue
            val = str(cell_val).strip() if cell_val is not None else ""
            if not val or val == "None":
                continue
            if len(cat) > 50 or len(val) > 100:
                skipped += 1
                continue
            if (cat, val) in existing_set:
                skipped += 1
                continue
            existing_set.add((cat, val))
            batch_inserts.append({"cat": cat, "name": val, "uid": user_id, "now": now})
            new_categories.add(cat)

    for ins in batch_inserts:
        db.execute(
            text("""
                INSERT IGNORE INTO tags
                    (category, name, status, source, created_by, created_at)
                VALUES
                    (:cat, :name, 'active', 'admin', :uid, :now)
            """),
            ins,
        )
        imported += 1

    db.commit()

    return {
        "success": True,
        "imported_count": imported,
        "skipped_count": skipped,
        "categories_touched": sorted(new_categories),
    }


# ─── 标签描述接口 ──────────────────────────────────────────────────────────────

@router.get("/tags/notes/pending")
def get_pending_notes(db: DB, user_id: UserID):
    """admin：待审批的标签描述列表。"""
    user = _get_user(db, user_id)
    _require_roles(user, "admin")

    rows = db.execute(
        text("""
            SELECT tn.id, tn.tag_id, tn.note, tn.created_at,
                   t.category, t.name AS tag_name,
                   u.name AS user_name, u.role AS user_role
            FROM tag_user_notes tn
            JOIN tags  t ON t.id = tn.tag_id
            JOIN users u ON u.id = tn.user_id
            WHERE tn.status = 'pending'
            ORDER BY tn.created_at ASC
        """),
    ).fetchall()

    return {
        "success": True,
        "notes": [
            {
                "id": r.id, "tag_id": r.tag_id, "note": r.note,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "tag_category": r.category, "tag_name": r.tag_name,
                "user_name": r.user_name, "user_role": r.user_role,
            }
            for r in rows
        ],
    }


@router.patch("/tags/notes/{note_id}/review")
def review_note(note_id: int, body: NoteReview, db: DB, user_id: UserID):
    """admin：审批标签描述申请。"""
    user = _get_user(db, user_id)
    _require_roles(user, "admin")

    note = db.execute(
        text("SELECT id, status FROM tag_user_notes WHERE id = :id"),
        {"id": note_id},
    ).fetchone()
    if not note:
        raise HTTPException(status_code=404, detail="描述不存在")
    if note.status != "pending":
        raise HTTPException(status_code=400, detail="只能审批 pending 状态的描述")

    if body.action == "approve":
        new_status = "active"
        db.execute(
            text("""
                UPDATE tag_user_notes
                SET status = 'active', reviewed_by = :uid, reviewed_at = :now
                WHERE id = :id
            """),
            {"uid": user_id, "now": _now(), "id": note_id},
        )
    else:
        if not body.reject_reason or not body.reject_reason.strip():
            raise HTTPException(status_code=400, detail="拒绝时必须填写原因")
        new_status = "rejected"
        db.execute(
            text("""
                UPDATE tag_user_notes
                SET status = 'rejected', reviewed_by = :uid, reviewed_at = :now
                WHERE id = :id
            """),
            {"uid": user_id, "now": _now(), "id": note_id},
        )

    db.commit()
    return {"success": True, "id": note_id, "status": new_status}


@router.get("/tags/{tag_id}/notes")
def get_tag_notes(tag_id: int, db: DB, user_id: UserID):
    """返回某标签的所有 active 描述（公开可见）。"""
    _get_user(db, user_id)

    tag = db.execute(
        text("SELECT id FROM tags WHERE id = :id AND status = 'active'"),
        {"id": tag_id},
    ).fetchone()
    if not tag:
        raise HTTPException(status_code=404, detail="标签不存在")

    rows = db.execute(
        text("""
            SELECT tn.id, tn.note, tn.created_at,
                   u.name AS user_name, u.role AS user_role
            FROM tag_user_notes tn
            JOIN users u ON u.id = tn.user_id
            WHERE tn.tag_id = :tid AND tn.status = 'active'
            ORDER BY tn.created_at DESC
        """),
        {"tid": tag_id},
    ).fetchall()

    return {
        "success": True,
        "notes": [
            {
                "id": r.id, "note": r.note,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "user_name": r.user_name, "user_role": r.user_role,
            }
            for r in rows
        ],
    }


@router.get("/tags/{tag_id}/notes/me")
def get_my_note(tag_id: int, db: DB, user_id: UserID):
    """返回当前用户对某标签的描述（任意状态）。"""
    _get_user(db, user_id)

    row = db.execute(
        text("""
            SELECT id, note, status, created_at
            FROM tag_user_notes
            WHERE tag_id = :tid AND user_id = :uid
        """),
        {"tid": tag_id, "uid": user_id},
    ).fetchone()

    if not row:
        return {"success": True, "note": None}

    return {
        "success": True,
        "note": {
            "id": row.id, "note": row.note, "status": row.status,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        },
    }


@router.post("/tags/{tag_id}/notes", status_code=201)
def upsert_tag_note(tag_id: int, body: TagNoteUpsert, db: DB, user_id: UserID):
    """
    为标签写/改自定义描述（每用户每标签只有一条）。
    - admin：直接 active
    - 其他：根据审批开关决定 pending 或 active
    """
    user = _get_user(db, user_id)
    _require_roles(user, "admin", "employer", "candidate")

    tag = db.execute(
        text("SELECT id FROM tags WHERE id = :id AND status = 'active'"),
        {"id": tag_id},
    ).fetchone()
    if not tag:
        raise HTTPException(status_code=404, detail="标签不存在")

    if user["role"] == "admin":
        new_status = "active"
    else:
        new_status = "pending" if _approval_required(db) else "active"

    now = _now()
    existing = db.execute(
        text("SELECT id FROM tag_user_notes WHERE tag_id = :tid AND user_id = :uid"),
        {"tid": tag_id, "uid": user_id},
    ).fetchone()

    if existing:
        db.execute(
            text("""
                UPDATE tag_user_notes
                SET note = :note, status = :status, created_at = :now,
                    reviewed_by = NULL, reviewed_at = NULL
                WHERE id = :id
            """),
            {"note": body.note, "status": new_status, "now": now, "id": existing.id},
        )
        note_id = existing.id
    else:
        result = db.execute(
            text("""
                INSERT INTO tag_user_notes (tag_id, user_id, note, status, created_at)
                VALUES (:tid, :uid, :note, :status, :now)
            """),
            {"tid": tag_id, "uid": user_id, "note": body.note, "status": new_status, "now": now},
        )
        note_id = result.lastrowid

    db.commit()

    msg = "描述已保存" if new_status == "active" else "描述已提交，等待审批"
    return {"success": True, "id": note_id, "status": new_status, "message": msg}
