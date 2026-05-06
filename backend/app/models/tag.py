"""Tag 模型 — 只读引用，实际 CRUD 由 FastAPI 侧处理。

tags 表由 FastAPI 的 Alembic migration 创建和管理。
Flask 侧定义此模型仅为了让 junction_tags 的外键引用能通过 SQLAlchemy metadata 验证。
不要在 Flask 路由中直接操作此模型，所有标签 CRUD 走 /api/v2/tags（FastAPI）。
"""
from datetime import datetime, timezone
from app.extensions import db


class Tag(db.Model):
    """标签表（FastAPI 管理，Flask 只读引用）。"""
    __tablename__ = "tags"

    id = db.Column(db.Integer, primary_key=True)
    category = db.Column(db.String(64), nullable=False)
    name = db.Column(db.String(128), nullable=False)
    status = db.Column(
        db.Enum("pending", "active", "disabled", name="tag_status"),
        nullable=False,
        default="active",
    )
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        db.UniqueConstraint("category", "name", name="uq_tag_category_name"),
        db.Index("idx_tag_category", "category"),
        db.Index("idx_tag_status", "status"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "category": self.category,
            "name": self.name,
            "status": self.status,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updated_at": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }


class TagNote(db.Model):
    """标签描述表（FastAPI 管理，Flask 只读引用）。"""
    __tablename__ = "tag_notes"

    id = db.Column(db.Integer, primary_key=True)
    tag_id = db.Column(db.Integer, db.ForeignKey("tags.id", ondelete="CASCADE"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(
        db.Enum("pending", "active", "disabled", name="tag_note_status"),
        nullable=False,
        default="active",
    )
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        db.UniqueConstraint("tag_id", "user_id", name="uq_tag_note_tag_user"),
        db.Index("idx_tag_note_tag_id", "tag_id"),
        db.Index("idx_tag_note_user_id", "user_id"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "tag_id": self.tag_id,
            "user_id": self.user_id,
            "description": self.description,
            "status": self.status,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updated_at": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }
