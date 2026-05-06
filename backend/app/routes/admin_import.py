"""
admin_import.py — Excel 导入预检 REST 接口

挂载于 Blueprint admin_import_bp，url_prefix=/api/admin/import

接口：
  POST /api/admin/import/preview
    — 上传 Excel，执行预检，返回预检结果 + batch_id
    — 同时将标注文件保存到 uploads/annotated/

  GET  /api/admin/import/batches
    — 查看历史导入批次列表

  GET  /api/admin/import/batches/<batch_id>
    — 查看单个批次详情（含行级结果）

  GET  /api/admin/import/batches/<batch_id>/download
    — 下载标注后的 Excel 文件

  GET  /api/admin/import/fields
    — 查看字段注册表

  PATCH /api/admin/import/fields/<field_id>
    — 启用/停用/审核字段（预留能力，本轮仅支持修改 status/is_filterable）

鉴权：所有接口仅 admin 角色可访问。

注意：
  - 本轮只做 preview，confirm 接口预留路由但返回 501
  - import_type 必须通过 multipart form 字段显式传递（不靠文件名猜测）
"""
import hashlib
import logging
import os

from flask import Blueprint, jsonify, request, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from sqlalchemy import text

from app.extensions import db
from app.models.user import User
from app.models.import_models import (
    FieldRegistry, ImportBatch, ImportBatchRow, ImportBatchTag,
)
from app.services.excel_preview import (
    run_preview,
    generate_annotated_excel,
    _to_field_key,
)
from app.services.import_taxonomy import parse_excel as taxonomy_parse

logger = logging.getLogger("admin_import")
admin_import_bp = Blueprint("admin_import", __name__)

ALLOWED_EXTENSIONS = {".xlsx"}
ANNOTATED_DIR_NAME = "annotated"


def _err(msg, code=400):
    return jsonify({"success": False, "message": msg}), code


def _require_admin():
    """从 JWT 取当前用户并校验 admin 角色，返回 (user, error_response)。"""
    uid = int(get_jwt_identity())
    user = db.session.get(User, uid)
    if not user or not user.is_active:
        return None, _err("用户不存在", 404)
    if user.role != "admin":
        return None, _err("仅 admin 可访问", 403)
    return user, None


def _annotated_dir():
    """确保标注文件目录存在，返回绝对路径。"""
    base = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", ANNOTATED_DIR_NAME)
    base = os.path.abspath(base)
    os.makedirs(base, exist_ok=True)
    return base


# ===========================================================================
# POST /api/admin/import/preview
# ===========================================================================

@admin_import_bp.post("/preview")
@jwt_required()
def preview_import():
    """
    上传 Excel 文件执行预检。

    Form 参数：
      file        — Excel 文件（.xlsx / .xls）
      import_type — "job" | "resume"（必填，不靠文件名判断）

    返回：
      batch_id, preview_stats, headers, inferred_types, type_conflicts,
      new_fields, errors, warnings, row_count 等摘要
    """
    user, err = _require_admin()
    if err:
        return err

    # ── 校验 import_type ─────────────────────────────────────────────────────
    import_type = (request.form.get("import_type") or "").strip().lower()
    if import_type not in ("job", "resume"):
        logger.warning("preview rejected: invalid import_type=%r by user=%s",
                       import_type, user.id)
        return _err("import_type 必须为 'job' 或 'resume'")

    # ── 校验上传文件 ─────────────────────────────────────────────────────────
    if "file" not in request.files:
        logger.warning("preview rejected: missing 'file' field, form_keys=%s",
                       list(request.form.keys()))
        return _err("请上传 Excel 文件（file 字段）")

    f = request.files["file"]
    if not f or not f.filename:
        logger.warning("preview rejected: empty filename")
        return _err("文件为空")

    ext = os.path.splitext(f.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        logger.warning("preview rejected: bad extension %r filename=%r", ext, f.filename)
        return _err(f"仅支持 .xlsx 格式，当前文件扩展名：{ext}")

    file_bytes = f.read()
    if len(file_bytes) == 0:
        logger.warning("preview rejected: file content empty filename=%r", f.filename)
        return _err("上传文件内容为空")
    if len(file_bytes) > 20 * 1024 * 1024:
        logger.warning("preview rejected: file too large %d bytes filename=%r",
                       len(file_bytes), f.filename)
        return _err("文件过大，最大支持 20 MB")

    file_hash = hashlib.sha256(file_bytes).hexdigest()
    logger.info("preview start: user=%s type=%s filename=%r size=%d hash=%s",
                user.id, import_type, f.filename, len(file_bytes), file_hash[:8])

    # ── 使用 taxonomy 模型解析 ──────────────────────────────────────────────
    # 已知 categories / tags（用于标记新旧）
    known_cat_rows = db.session.execute(
        text("SELECT DISTINCT category FROM tags WHERE status='active'")
    ).fetchall()
    known_tag_rows = db.session.execute(
        text("SELECT category, name FROM tags WHERE status IN ('active','pending')")
    ).fetchall()
    known_categories = {r.category for r in known_cat_rows}
    known_tags       = {(r.category, r.name) for r in known_tag_rows}

    try:
        tx = taxonomy_parse(
            file_bytes, import_type,
            known_categories=known_categories,
            known_tags=known_tags,
        )
    except Exception:
        logger.exception("taxonomy parse failed: filename=%r", f.filename)
        return _err("文件解析异常，请检查格式或查看服务日志", 500)

    # 文件级问题（重复列头 / 解析失败）
    fatal = next((i for i in tx.issues
                  if i.get("issue_type") in ("file_parse_error", "duplicate_header", "empty_file")),
                 None)
    if fatal:
        logger.warning("preview fatal: filename=%r issue=%s",
                       f.filename, fatal.get("issue_type"))
        return jsonify({
            "success": False,
            "message": fatal.get("suggestion", "文件不可解析"),
            "issue_type": fatal.get("issue_type"),
            "headers": tx.headers,
        }), 422

    logger.info("preview parsed: filename=%r rows=%d ok=%d err=%d categories=%d new_cats=%d",
                f.filename,
                tx.summary["total_rows"], tx.summary["ok_rows"],
                tx.summary["error_rows"], len(tx.categories),
                tx.summary["new_categories"])

    # ── 创建 batch ──────────────────────────────────────────────────────────
    batch = ImportBatch(
        uploaded_by=user.id,
        import_type=import_type,
        original_filename=f.filename,
        file_hash=file_hash,
        detected_columns=tx.headers,
        # 旧字段保留兼容前端（new_fields 现在等价于 free_columns）
        new_fields=[
            {"field_key": col, "label": col, "inferred_type": "text"}
            for col in tx.free_columns
        ],
        error_summary=[i for i in tx.issues if i.get("issue_type")],
        warning_summary=[],
        preview_stats=tx.summary,
        annotated_file_path=None,
        status="preview",
    )
    db.session.add(batch)
    db.session.flush()

    # ── 写入行级结果 ────────────────────────────────────────────────────────
    for p in tx.rows:
        status = "ok"
        if any(i.get("issue_type") == "missing_required" for i in p.issues):
            status = "error"
        elif any(i.get("issue_type") == "duplicate_row" for i in p.issues):
            status = "duplicate"
        elif p.issues:
            status = "warning"
        br = ImportBatchRow(
            batch_id=batch.id,
            row_index=p.row_index,
            row_status=status,
            row_fingerprint=p.fingerprint,
            issues=p.issues,
            raw_data={**p.raw_data, "_data_fields": p.data_fields},
        )
        db.session.add(br)

    # ── 写入 staging tag 表 ─────────────────────────────────────────────────
    new_cats   = {c.category for c in tx.categories if c.is_new}
    new_pairs  = {(c.category, t["name"])
                  for c in tx.categories for t in c.tags if t["is_new"]}
    for p in tx.rows:
        for cat, name in p.tags:
            db.session.add(ImportBatchTag(
                batch_id=batch.id,
                row_index=p.row_index,
                category=cat,
                tag_name=name,
                is_new_cat=(cat in new_cats),
                is_new_tag=((cat, name) in new_pairs),
            ))

    # detected_tags 兼容旧 UI（去重）
    seen = set()
    detected_tags = []
    for c in tx.categories:
        for t in c.tags:
            k = (c.category, t["name"])
            if k not in seen:
                seen.add(k)
                detected_tags.append({"category": c.category, "name": t["name"]})
    batch.detected_tags = detected_tags

    db.session.commit()
    logger.info("preview saved: batch_id=%d filename=%r tag_pairs=%d",
                batch.id, f.filename, len(detected_tags))

    return jsonify({
        "success": True,
        "batch_id": batch.id,
        "import_type": import_type,
        "original_filename": f.filename,
        "file_hash": file_hash,
        "headers": tx.headers,
        # 新结构 — 前端可逐步迁移
        "fixed_field_map": tx.fixed_field_map,
        "free_columns":    tx.free_columns,
        "categories": [
            {
                "category":  c.category,
                "is_new":    c.is_new,
                "tag_count": c.tag_count,
                "tags":      c.tags,
            }
            for c in tx.categories
        ],
        # 旧结构 — 保留兼容性
        "inferred_types": {h: "text" for h in tx.headers},
        "type_conflicts": [],
        "new_fields": batch.new_fields,
        "fields_registration_skipped": False,
        "preview_stats": batch.preview_stats,
        "errors":   [i for i in tx.issues] +
                    [{"row_index": p.row_index, **i}
                     for p in tx.rows for i in p.issues
                     if i.get("issue_type") == "missing_required"],
        "warnings": [],
        "annotated_download_url": None,
        "detected_tags": detected_tags,
    }), 200


# ===========================================================================
# 导入写入辅助函数
# ===========================================================================

def _safe_int(val):
    """将任意值安全转为 int，失败返回 None。"""
    try:
        return int(val) if val is not None and str(val).strip() != "" else None
    except (ValueError, TypeError):
        return None


def _safe_str(val):
    """将任意值转为去首尾空格的字符串，空值返回 None。"""
    if val is None:
        return None
    s = str(val).strip()
    return s or None


def _safe_list(val):
    """确保值为 list[str]。
    - 已是 list → 每项转 str 后过滤空值
    - 字符串 → 按中英文逗号分割（Excel 导入的标量值，中文场景常见全角逗号）
    - 其他/None → 空列表
    """
    if isinstance(val, list):
        return [str(x) for x in val if str(x).strip()]
    if isinstance(val, str):
        import re
        return [x.strip() for x in re.split(r'[,，]', val) if x.strip()]
    return []


def _parse_salary_label(label):
    """将 '20k-30k' 解析为 (20000, 30000)；'面议'/''/None 返回 (None, None)。"""
    if not label or str(label).strip() in ("面议", ""):
        return None, None
    try:
        parts = str(label).lower().replace("k", "000").split("-")
        lo = int(parts[0])
        hi = int(parts[1]) if len(parts) > 1 else lo
        return lo, hi
    except Exception:
        return None, None


# ── 标签自动检测辅助 ──────────────────────────────────────────────────────────

_TAG_COLUMNS = {
    "city":          "城市",
    "current_city":  "城市",
    "expected_city": "城市",
    "business_type": "业务类型",
    "job_type":      "岗位类型",
    "route_tags":    "航线",
    "skill_tags":    "技能",
}
_LIST_TAG_COLUMNS = {"route_tags", "skill_tags"}


def _detect_tags(raw_data_list: list) -> list:
    """从行原始数据中提取可能的标签，返回去重的 [{category, name}] 列表。"""
    seen: set = set()
    result = []
    for raw in raw_data_list:
        if not raw:
            continue
        for col, category in _TAG_COLUMNS.items():
            val = raw.get(col)
            if not val:
                continue
            names = _safe_list(val) if col in _LIST_TAG_COLUMNS else (
                [_safe_str(val)] if _safe_str(val) else []
            )
            for name in names:
                key = (category, name)
                if name and key not in seen:
                    seen.add(key)
                    result.append({"category": category, "name": name})
    return result


def _import_tags_to_db(tags: list, creator_id: int) -> int:
    """将检测到的标签插入 tags 表（跳过已存在的），返回新增数量。"""
    if not tags:
        return 0
    from sqlalchemy import text
    imported = 0
    for t in tags:
        try:
            res = db.session.execute(
                text(
                    "INSERT IGNORE INTO tags "
                    "(category, name, status, source, created_by, created_at) "
                    "VALUES (:category, :name, 'active', 'admin', :created_by, NOW())"
                ),
                {"category": t["category"], "name": t["name"], "created_by": creator_id},
            )
            if res.rowcount > 0:
                imported += 1
        except Exception:
            pass
    db.session.flush()
    return imported


def _confirm_jobs(rows: list, uploader_id: int) -> tuple[int, list, dict]:
    """
    rows: list[ImportBatchRow]，每行 raw_data 含 '_data_fields' 键（taxonomy 规范化结果）
    返回: (written, errors_detail, row_to_entity_id_map)
    """
    from app.models.job import Job

    written = 0
    errors_detail = []
    row_to_id: dict[int, int] = {}

    for row in rows:
        raw = row.raw_data or {}
        df  = raw.get("_data_fields") or {}

        title = _safe_str(df.get("title"))
        province = _safe_str(df.get("province"))
        city_name = _safe_str(df.get("city_name") or df.get("city"))
        district = _safe_str(df.get("district"))

        if not title:
            errors_detail.append({"row_index": row.row_index, "reason": "缺少岗位名称"})
            continue
        if not city_name:
            errors_detail.append({"row_index": row.row_index, "reason": "缺少省市区"})
            continue

        # 公司归属
        company_id = uploader_id
        company_email = _safe_str(df.get("company_email"))
        if company_email:
            owner = User.query.filter(
                db.func.lower(User.email) == company_email.lower()
            ).first()
            if owner and owner.role in ("employer", "admin"):
                company_id = owner.id

        salary_label = _safe_str(df.get("salary_label"))
        salary_min, salary_max = _parse_salary_label(salary_label)

        job = Job(
            company_id=company_id,
            title=title,
            city=city_name,
            province=province,
            city_name=city_name,
            district=district,
            description=_safe_str(df.get("description")) or "",
            requirements=_safe_str(df.get("requirements")),
            salary_label=salary_label,
            salary_min=salary_min,
            salary_max=salary_max,
            experience_required=_safe_str(df.get("experience_required")),
            degree_required=_safe_str(df.get("degree_required")),
            headcount=_safe_int(df.get("headcount")) or 1,
            urgency_level=2,
            status="published",
        )
        db.session.add(job)
        db.session.flush()
        row_to_id[row.row_index] = job.id
        written += 1

    return written, errors_detail, row_to_id


def _confirm_resumes(rows: list) -> tuple[int, list, dict]:
    """
    rows: list[ImportBatchRow]，每行 raw_data 含 '_data_fields' 键
    返回: (written, errors_detail, row_to_candidate_id_map)
    """
    from datetime import datetime, timezone
    from app.models.candidate import Candidate
    import secrets

    written = 0
    errors_detail = []
    row_to_id: dict[int, int] = {}
    now = datetime.now(timezone.utc)

    for row in rows:
        raw = row.raw_data or {}
        df  = raw.get("_data_fields") or {}

        full_name = _safe_str(df.get("full_name"))
        if not full_name:
            errors_detail.append({"row_index": row.row_index, "reason": "缺少姓名"})
            continue

        email = _safe_str(df.get("email"))
        phone = _safe_str(df.get("phone"))
        if not email and not phone:
            errors_detail.append({"row_index": row.row_index, "reason": "缺少电话或邮箱"})
            continue

        # 找现有 user 或建新 user。优先用 email；无 email 用 phone+占位邮箱
        if email:
            user = User.query.filter_by(email=email).first()
        else:
            user = None
        if not user:
            placeholder_email = email or f"import_{phone or secrets.token_hex(6)}@placeholder.invalid"
            user = User(
                email=placeholder_email,
                role="candidate",
                name=full_name,
                is_active=True,
            )
            user.set_password(secrets.token_urlsafe(16))
            db.session.add(user)
            db.session.flush()
        elif user.role != "candidate":
            errors_detail.append({
                "row_index": row.row_index,
                "reason": f"邮箱 {email!r} 已被 {user.role} 占用，跳过",
            })
            continue

        profile = Candidate.query.filter_by(user_id=user.id).first()
        if not profile:
            profile = Candidate(user_id=user.id, full_name=full_name,
                                current_title="", current_city="")
            db.session.add(profile)

        profile.full_name        = full_name
        profile.age              = _safe_int(df.get("age"))
        profile.experience_years = _safe_int(df.get("experience_years"))
        profile.education        = _safe_str(df.get("education"))
        profile.phone            = phone
        if email and not email.endswith("@placeholder.invalid"):
            profile.email        = email

        avail = _safe_str(df.get("availability_status")) or "open"
        if avail not in ("open", "passive", "closed"):
            avail = "open"
        profile.availability_status = avail

        profile.work_experiences      = df.get("work_experiences") or []
        profile.education_experiences = df.get("education_experiences") or []
        profile.certificates          = df.get("certificates") or []

        profile.profile_confirmed_at = now
        profile.last_active_at       = now
        profile.updated_at           = now

        db.session.flush()
        row_to_id[row.row_index] = profile.id
        written += 1

    return written, errors_detail, row_to_id


def _commit_tags_and_junction(batch_id: int, import_type: str,
                              row_to_id: dict[int, int],
                              creator_id: int) -> tuple[int, int]:
    """
    根据 import_batch_tags 把 (category, tag_name) 写入 tags 表（pending），
    并在 job_tags / candidate_tags 中链接到对应行的实体。
    返回 (新建 tag 数, junction 链接数)。
    """
    junction_table = "job_tags" if import_type == "job" else "candidate_tags"
    fk_col         = "job_id"   if import_type == "job" else "candidate_id"

    staging = db.session.query(ImportBatchTag).filter_by(batch_id=batch_id).all()
    if not staging:
        return 0, 0

    # 1. 写入 tags（pending，去重）
    seen_pairs: set[tuple[str, str]] = set()
    new_tag_count = 0
    for st in staging:
        key = (st.category, st.tag_name)
        if key in seen_pairs:
            continue
        seen_pairs.add(key)
        res = db.session.execute(
            text(
                "INSERT IGNORE INTO tags "
                "(category, name, status, source, created_by, created_at) "
                "VALUES (:c, :n, 'pending', 'excel', :u, NOW())"
            ),
            {"c": st.category, "n": st.tag_name, "u": creator_id},
        )
        if res.rowcount > 0:
            new_tag_count += 1

    db.session.flush()

    # 2. 取出所有相关 tag id
    tag_id_map: dict[tuple[str, str], int] = {}
    for cat, name in seen_pairs:
        r = db.session.execute(
            text("SELECT id FROM tags WHERE category=:c AND name=:n LIMIT 1"),
            {"c": cat, "n": name},
        ).fetchone()
        if r:
            tag_id_map[(cat, name)] = r.id

    # 3. 写 junction
    junction_count = 0
    for st in staging:
        entity_id = row_to_id.get(st.row_index)
        if not entity_id:
            continue
        tag_id = tag_id_map.get((st.category, st.tag_name))
        if not tag_id:
            continue
        res = db.session.execute(
            text(
                f"INSERT IGNORE INTO {junction_table} "
                f"({fk_col}, tag_id, created_at) VALUES (:e, :t, NOW())"
            ),
            {"e": entity_id, "t": tag_id},
        )
        if res.rowcount > 0:
            junction_count += 1

    return new_tag_count, junction_count


# ===========================================================================
# POST /api/admin/import/batches/<batch_id>/confirm
# ===========================================================================

@admin_import_bp.post("/batches/<int:batch_id>/confirm")
@jwt_required()
def confirm_import(batch_id):
    """
    admin 确认预检批次后执行真正的导入写入。

    行为：
      - 仅接受 status="preview" 且 is_confirmed=False 的批次
      - 跳过 row_status in ("error", "duplicate", "skipped") 的行
      - import_type="job"   → 写入 jobs 表（公司 id = 当前 admin user.id）
      - import_type="resume"→ 写入 users + candidates 表（以 full_name+email 作唯一键）
      - 全部成功后 batch.status → "confirmed"，batch.is_confirmed → True
      - 任何一行 DB 写入异常时回滚并返回 500

    Query params：
      skip_errors=true  — 跳过 warning 行（默认包含 warning 行）
      dry_run=true      — 不实际写入，返回将写入的行数统计（校验用）
    """
    user, err = _require_admin()
    if err:
        return err

    batch = db.session.get(ImportBatch, batch_id)
    if not batch:
        return _err("批次不存在", 404)
    if batch.is_confirmed:
        return _err("该批次已确认导入，不能重复执行", 409)
    if batch.status != "preview":
        return _err(f"批次状态为 {batch.status!r}，只有 preview 状态可以确认导入", 422)

    skip_warnings = request.args.get("skip_errors", "false").lower() == "true"
    dry_run = request.args.get("dry_run", "false").lower() == "true"

    # 收集可写入的行
    SKIP_STATUSES = {"error", "duplicate", "skipped"}
    if skip_warnings:
        SKIP_STATUSES.add("warning")

    rows = batch.rows.order_by(ImportBatchRow.row_index).all()
    writable = [r for r in rows if r.row_status not in SKIP_STATUSES]

    logger.info("confirm start: batch_id=%d type=%s user=%s dry_run=%s skip_warn=%s "
                "total=%d writable=%d",
                batch_id, batch.import_type, user.id, dry_run, skip_warnings,
                len(rows), len(writable))

    if dry_run:
        return jsonify({
            "success": True,
            "dry_run": True,
            "batch_id": batch_id,
            "import_type": batch.import_type,
            "total_rows": len(rows),
            "writable_rows": len(writable),
            "skipped_rows": len(rows) - len(writable),
        })

    written = 0
    errors_detail = []
    tags_imported = 0
    junctions_linked = 0

    try:
        if batch.import_type == "job":
            written, errors_detail, row_to_id = _confirm_jobs(writable, uploader_id=user.id)
        elif batch.import_type == "resume":
            written, errors_detail, row_to_id = _confirm_resumes(writable)
        else:
            return _err(f"未知 import_type: {batch.import_type!r}", 422)

        # 写入 tags + junction（pending 状态等待 admin 审批）
        if row_to_id:
            tags_imported, junctions_linked = _commit_tags_and_junction(
                batch_id, batch.import_type, row_to_id, creator_id=user.id,
            )

        batch.is_confirmed = True
        batch.status = "confirmed"
        db.session.commit()
        logger.info("confirm done: batch_id=%d written=%d tags=%d junctions=%d row_errors=%d",
                    batch_id, written, tags_imported, junctions_linked, len(errors_detail))

        # 数据有变 → 清掉 FastAPI 那侧的 chart 缓存
        try:
            from app.extensions import _get_redis
            r = _get_redis()
            if r:
                keys = r.keys("chart:*")
                if keys:
                    r.delete(*keys)
                    logger.info("flushed %d chart cache keys after import", len(keys))
        except Exception:
            logger.exception("chart cache flush failed (non-fatal)")
    except Exception as exc:
        db.session.rollback()
        logger.exception("confirm failed: batch_id=%d type=%s",
                         batch_id, batch.import_type)
        return jsonify({
            "success": False,
            "message": f"导入写入失败：{exc}",
            "batch_id": batch_id,
        }), 500

    return jsonify({
        "success": True,
        "batch_id": batch_id,
        "import_type": batch.import_type,
        "written": written,
        "skipped_rows": len(rows) - len(writable),
        "tags_imported": tags_imported,
        "junctions_linked": junctions_linked,
        "errors": errors_detail,
    })


# ===========================================================================
# GET /api/admin/import/batches
# ===========================================================================

@admin_import_bp.get("/batches")
@jwt_required()
def list_batches():
    """查看所有导入批次（分页，默认 20 条/页，倒序）。"""
    _, err = _require_admin()
    if err:
        return err

    page = max(int(request.args.get("page", 1)), 1)
    per_page = min(int(request.args.get("per_page", 20)), 100)
    import_type = request.args.get("import_type", "").strip()

    q = ImportBatch.query
    if import_type in ("job", "resume"):
        q = q.filter_by(import_type=import_type)
    q = q.order_by(ImportBatch.created_at.desc())
    pagination = q.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "success": True,
        "batches": [b.to_dict() for b in pagination.items],
        "total": pagination.total,
        "page": page,
        "per_page": per_page,
    })


# ===========================================================================
# GET /api/admin/import/batches/<batch_id>
# ===========================================================================

@admin_import_bp.get("/batches/<int:batch_id>")
@jwt_required()
def get_batch(batch_id):
    """查看单个批次详情（含行级结果，但行数可能较多，加 include_rows 参数控制）。"""
    _, err = _require_admin()
    if err:
        return err

    batch = db.session.get(ImportBatch, batch_id)
    if not batch:
        return _err("批次不存在", 404)

    include_rows = request.args.get("include_rows", "false").lower() == "true"
    return jsonify({
        "success": True,
        "batch": batch.to_dict(include_rows=include_rows),
    })


# ===========================================================================
# GET /api/admin/import/batches/<batch_id>/download
# ===========================================================================

@admin_import_bp.get("/batches/<int:batch_id>/download")
@jwt_required()
def download_annotated(batch_id):
    """下载标注后的 Excel 文件。"""
    _, err = _require_admin()
    if err:
        return err

    batch = db.session.get(ImportBatch, batch_id)
    if not batch:
        return _err("批次不存在", 404)

    if not batch.annotated_file_path:
        return _err("标注文件不存在", 404)

    base_uploads = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "uploads")
    )
    full_path = os.path.join(base_uploads, batch.annotated_file_path)
    if not os.path.exists(full_path):
        return _err("标注文件已丢失，请重新上传", 404)

    download_name = f"annotated_{batch.original_filename}"
    return send_file(full_path, as_attachment=True, download_name=download_name)


# ===========================================================================
# GET /api/admin/import/fields
# ===========================================================================

@admin_import_bp.get("/fields")
@jwt_required()
def list_fields():
    """查看字段注册表。"""
    _, err = _require_admin()
    if err:
        return err

    entity_type = request.args.get("entity_type", "").strip()
    status = request.args.get("status", "").strip()

    q = FieldRegistry.query
    if entity_type in ("job", "resume"):
        q = q.filter_by(entity_type=entity_type)
    if status in ("pending", "active", "disabled"):
        q = q.filter_by(status=status)
    fields = q.order_by(FieldRegistry.entity_type, FieldRegistry.field_key).all()

    return jsonify({
        "success": True,
        "fields": [f.to_dict() for f in fields],
        "total": len(fields),
    })


# ===========================================================================
# PATCH /api/admin/import/fields/<field_id>
# ===========================================================================

@admin_import_bp.patch("/fields/<int:field_id>")
@jwt_required()
def update_field(field_id):
    """
    修改字段注册表中的字段元数据。
    本轮支持：status / is_filterable / visible_roles / label
    """
    _, err = _require_admin()
    if err:
        return err

    field = db.session.get(FieldRegistry, field_id)
    if not field:
        return _err("字段不存在", 404)

    data = request.get_json(silent=True) or {}

    if "status" in data:
        s = data["status"]
        if s not in ("pending", "active", "disabled"):
            return _err("status 必须为 pending / active / disabled")
        field.status = s

    if "is_filterable" in data:
        if not isinstance(data["is_filterable"], bool):
            return _err("is_filterable 必须为布尔值")
        field.is_filterable = data["is_filterable"]

    if "visible_roles" in data:
        vr = data["visible_roles"]
        if not isinstance(vr, list) or not all(isinstance(r, str) for r in vr):
            return _err("visible_roles 必须为字符串数组")
        field.visible_roles = vr

    if "label" in data:
        lbl = str(data["label"]).strip()
        if not lbl:
            return _err("label 不能为空")
        field.label = lbl

    db.session.commit()
    return jsonify({"success": True, "field": field.to_dict()})


# ===========================================================================
# GET /api/admin/import/template?type=job|resume
# ===========================================================================

@admin_import_bp.get("/template")
@jwt_required()
def download_template():
    """下载岗位 / 候选人 Excel 模板。"""
    _, err = _require_admin()
    if err:
        return err

    t = (request.args.get("type") or "").strip().lower()
    if t not in ("job", "resume"):
        return _err("type 必须为 'job' 或 'resume'")

    fname = "job_template.xlsx" if t == "job" else "candidate_template.xlsx"
    base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "templates"))
    full = os.path.join(base, fname)
    if not os.path.exists(full):
        return _err("模板文件不存在，请联系开发", 500)
    download_name = "岗位导入模板.xlsx" if t == "job" else "候选人导入模板.xlsx"
    return send_file(full, as_attachment=True, download_name=download_name)
