from typing import Optional
from pydantic import BaseModel, field_validator


class TagCreate(BaseModel):
    category: str
    name: str
    description: Optional[str] = None

    @field_validator("category", "name")
    @classmethod
    def strip_and_nonempty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("不能为空")
        return v

    @field_validator("category")
    @classmethod
    def category_length(cls, v: str) -> str:
        if len(v) > 50:
            raise ValueError("分类名不能超过 50 个字符")
        return v

    @field_validator("name")
    @classmethod
    def name_length(cls, v: str) -> str:
        if len(v) > 100:
            raise ValueError("标签名不能超过 100 个字符")
        return v


class TagReview(BaseModel):
    action: str          # "approve" | "reject"
    reject_reason: Optional[str] = None

    @field_validator("action")
    @classmethod
    def valid_action(cls, v: str) -> str:
        if v not in ("approve", "reject"):
            raise ValueError("action 只能是 approve 或 reject")
        return v


class TagNoteUpsert(BaseModel):
    note: str

    @field_validator("note")
    @classmethod
    def note_length(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("描述不能为空")
        if len(v) > 200:
            raise ValueError("描述不能超过 200 个字符")
        return v


class NoteReview(BaseModel):
    action: str
    reject_reason: Optional[str] = None

    @field_validator("action")
    @classmethod
    def valid_action(cls, v: str) -> str:
        if v not in ("approve", "reject"):
            raise ValueError("action 只能是 approve 或 reject")
        return v
