"""
导入基础设施模型

三张表：
  field_registry   — 动态字段注册表（控制字段元数据、权限、筛选能力）
  import_batches   — 每次上传/预检记录（审计可追溯）
  import_batch_rows — 行级问题记录
"""
from datetime import datetime, timezone
from app.extensions import db


class FieldRegistry(db.Model):
    """动态字段注册表。"""
    __tablename__ = "field_registry"

    id = db.Column(db.Integer, primary_key=True)

    # 归属实体：job | resume
    entity_type = db.Column(db.String(20), nullable=False, index=True)

    # 字段键名（英文标识符，来自 Excel 列头规范化后的结果）
    field_key = db.Column(db.String(100), nullable=False)

    # 显示名称（原始列头文字）
    label = db.Column(db.String(200), nullable=False)

    # 字段类型：text | number | date | datetime | boolean
    field_type = db.Column(db.String(20), nullable=False, default="text")

    # 是否可用于筛选
    is_filterable = db.Column(db.Boolean, nullable=False, default=False)

    # 哪些角色可见（JSON 数组，如 ["admin","employer"]）
    visible_roles = db.Column(db.JSON, nullable=True)

    # 订阅等级规则（预留，JSON 结构，当前不做收费逻辑）
    tier_rule_json = db.Column(db.JSON, nullable=True)

    # 状态：pending（待 admin 确认）| active | disabled
    status = db.Column(
        db.Enum("pending", "active", "disabled", name="field_registry_status"),
        nullable=False,
        default="pending",
    )

    # 首次出现在哪个批次
    first_seen_batch_id = db.Column(db.Integer, db.ForeignKey("import_batches.id"), nullable=True)

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        db.UniqueConstraint("entity_type", "field_key", name="uq_field_registry_entity_key"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "entity_type": self.entity_type,
            "field_key": self.field_key,
            "label": self.label,
            "field_type": self.field_type,
            "is_filterable": self.is_filterable,
            "visible_roles": self.visible_roles,
            "tier_rule_json": self.tier_rule_json,
            "status": self.status,
            "first_seen_batch_id": self.first_seen_batch_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class ImportBatch(db.Model):
    """一次 Excel 上传与预检记录。"""
    __tablename__ = "import_batches"

    id = db.Column(db.Integer, primary_key=True)

    # 上传人（admin user id）
    uploaded_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    # 导入类型：job | resume
    import_type = db.Column(db.String(20), nullable=False)

    # 原文件名
    original_filename = db.Column(db.String(300), nullable=False)

    # 文件 SHA-256 hash（用于去重检测）
    file_hash = db.Column(db.String(64), nullable=False, index=True)

    # 识别出的列头（JSON 数组）
    detected_columns = db.Column(db.JSON, nullable=True)

    # 新字段列表（JSON 数组，每项含 field_key / label / inferred_type）
    new_fields = db.Column(db.JSON, nullable=True)

    # 从行数据中检测到的标签（JSON 数组，每项含 {category, name}）
    detected_tags = db.Column(db.JSON, nullable=True)

    # 错误汇总（JSON）
    error_summary = db.Column(db.JSON, nullable=True)

    # 警告汇总（JSON）
    warning_summary = db.Column(db.JSON, nullable=True)

    # 预检统计（total_rows / ok_rows / error_rows / warning_rows / dup_rows）
    preview_stats = db.Column(db.JSON, nullable=True)

    # 是否已经由 admin 确认执行导入
    is_confirmed = db.Column(db.Boolean, nullable=False, default=False)

    # 标注文件保存路径（相对 uploads/）
    annotated_file_path = db.Column(db.String(300), nullable=True)

    # 状态：preview | confirmed | failed
    status = db.Column(
        db.Enum("preview", "confirmed", "failed", name="import_batch_status"),
        nullable=False,
        default="preview",
    )

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    uploader = db.relationship("User", foreign_keys=[uploaded_by])
    rows = db.relationship("ImportBatchRow", backref="batch", lazy="dynamic",
                           cascade="all, delete-orphan")

    def to_dict(self, include_rows=False):
        d = {
            "id": self.id,
            "uploaded_by": self.uploaded_by,
            "import_type": self.import_type,
            "original_filename": self.original_filename,
            "file_hash": self.file_hash,
            "detected_columns": self.detected_columns,
            "new_fields": self.new_fields,
            "detected_tags": self.detected_tags or [],
            "error_summary": self.error_summary,
            "warning_summary": self.warning_summary,
            "preview_stats": self.preview_stats,
            "is_confirmed": self.is_confirmed,
            "annotated_file_path": self.annotated_file_path,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_rows:
            d["rows"] = [r.to_dict() for r in self.rows.all()]
        return d


class ImportBatchRow(db.Model):
    """行级预检结果记录。"""
    __tablename__ = "import_batch_rows"

    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(
        db.Integer, db.ForeignKey("import_batches.id"), nullable=False, index=True
    )

    # Excel 中的行号（1-based，含表头则数据从 2 开始）
    row_index = db.Column(db.Integer, nullable=False)

    # 行状态：ok | warning | error | duplicate | skipped
    row_status = db.Column(db.String(20), nullable=False, default="ok")

    # 规范化行指纹（用于重复检测）
    row_fingerprint = db.Column(db.String(64), nullable=True, index=True)

    # 该行的所有问题列表（JSON 数组，每项含 field/issue_type/original_value/suggestion）
    issues = db.Column(db.JSON, nullable=True)

    # 原始行数据快照（JSON 对象，key=列头，value=原始值）
    raw_data = db.Column(db.JSON, nullable=True)

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "batch_id": self.batch_id,
            "row_index": self.row_index,
            "row_status": self.row_status,
            "row_fingerprint": self.row_fingerprint,
            "issues": self.issues or [],
            "raw_data": self.raw_data or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ImportBatchTag(db.Model):
    """
    Excel 解析阶段产生的"待入库标签"。

    每行 = 单元格里的一个 (category, tag_name) 对：
      - category   原样保留 Excel 列头（中文）
      - tag_name   单元格里某个值（多值会拆成多行）
    确认导入时再从这里聚合写入 tags + junction，避免 preview 阶段碰主表。
    """
    __tablename__ = "import_batch_tags"

    id        = db.Column(db.Integer, primary_key=True)
    batch_id  = db.Column(
        db.Integer, db.ForeignKey("import_batches.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    row_index = db.Column(db.Integer, nullable=False)
    category  = db.Column(db.String(64),  nullable=False)
    tag_name  = db.Column(db.String(128), nullable=False)
    is_new_cat = db.Column(db.Boolean, nullable=False, default=False)
    is_new_tag = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.Index("ix_import_batch_tags_batch_row", "batch_id", "row_index"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "batch_id": self.batch_id,
            "row_index": self.row_index,
            "category": self.category,
            "tag_name": self.tag_name,
            "is_new_cat": self.is_new_cat,
            "is_new_tag": self.is_new_tag,
        }
