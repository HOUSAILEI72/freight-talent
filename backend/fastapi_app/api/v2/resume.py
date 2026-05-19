"""
GET  /api/v2/candidates/me/resume-preview  — 返回简历预览链接
GET  /api/v2/candidates/me/resume-file     — 本地文件直接 stream
POST /api/v2/candidates/me/resume/ai-parse — 解析已上传简历，用 DeepSeek 提取档案字段
"""

from __future__ import annotations

import io
import json
import logging
import os
import re
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from fastapi_app.core.auth import get_current_user_id
from fastapi_app.core.config import get_settings
from fastapi_app.core.database import get_db

logger = logging.getLogger("fastapi_app.resume")

router = APIRouter(tags=["简历预览"])

UserID = Annotated[int, Depends(get_current_user_id)]
DB = Annotated[Session, Depends(get_db)]


class ResumePreviewResponse(BaseModel):
    url: str
    filename: str
    type: str   # "cos" | "local"


def _get_candidate_row(db: Session, user_id: int):
    row = db.execute(
        text(
            "SELECT resume_file_path, resume_file_name "
            "FROM candidates WHERE user_id = :uid"
        ),
        {"uid": user_id},
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="候选人档案不存在")
    return row


# ── Text extraction helpers ───────────────────────────────────────────────────

def _extract_text_pdf(file_bytes: bytes) -> str:
    import pdfplumber
    text_parts: list[str] = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                text_parts.append(t)
    return "\n".join(text_parts)


def _extract_text_docx(file_bytes: bytes) -> str:
    from docx import Document
    doc = Document(io.BytesIO(file_bytes))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


def _extract_text(file_bytes: bytes, filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext == "pdf":
        text = _extract_text_pdf(file_bytes)
        if len(text.strip()) < 50:
            raise HTTPException(
                status_code=422,
                detail="该 PDF 为扫描图片格式，无法直接提取文字。请上传可选择文字的 PDF 或 Word 文档。",
            )
        return text
    if ext in ("docx",):
        return _extract_text_docx(file_bytes)
    if ext == "doc":
        raise HTTPException(
            status_code=422,
            detail="暂不支持旧版 .doc 格式，请将文件另存为 .docx 或 PDF 后重新上传。",
        )
    raise HTTPException(status_code=422, detail=f"不支持的文件格式：{ext}")


# ── DeepSeek parse ────────────────────────────────────────────────────────────

_PARSE_SYSTEM = """你是专业的货代行业简历解析助手。
用户会提供一份简历原文，请从中提取以下字段并以 JSON 格式返回，不要输出任何其他内容。
缺失的字段填 null，数组字段没有内容填 []。

返回格式（严格 JSON，key 保持英文）：
{
  "full_name": "姓名",
  "age": 数字或null,
  "experience_years": 数字或null,
  "education": "最高学历·专业，如 本科·国际贸易",
  "english_level": "CET-4/CET-6/流利/一般/null",
  "expected_city": "期望工作城市",
  "desired_position": "期望岗位名称",
  "expected_salary_min": 月薪最低数字（元）或null,
  "expected_salary_max": 月薪最高数字（元）或null,
  "expected_salary_period": "month或year",
  "summary": "个人优势/自我介绍段落，原文摘录或整理，不超过500字",
  "work_experiences": [
    {
      "company_name": "公司名",
      "title": "职位",
      "start_month": "YYYY-MM",
      "end_month": "YYYY-MM或至今",
      "responsibilities": "工作内容",
      "achievements": "业绩成果"
    }
  ],
  "education_experiences": [
    {
      "school": "学校名",
      "major": "专业",
      "degree": "学历",
      "period": "YYYY-YYYY"
    }
  ],
  "project_experiences": [
    {
      "name": "项目名",
      "role": "角色",
      "start": "YYYY-MM",
      "end": "YYYY-MM",
      "description": "项目描述",
      "achievements": "项目成果"
    }
  ],
  "certificates": ["证书1", "证书2"],
  "hard_skill_tags": ["技能标签1", "技能标签2"],
  "soft_skill_tags": ["软技能1", "软技能2"]
}"""


def _call_deepseek_parse(resume_text: str, api_key: str) -> dict:
    payload = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": _PARSE_SYSTEM},
            {"role": "user", "content": f"以下是简历原文：\n\n{resume_text[:12000]}"},
        ],
        "temperature": 0.2,
        "max_tokens": 3000,
        "response_format": {"type": "json_object"},
    }
    with httpx.Client(timeout=60) as client:
        resp = client.post(
            "https://api.deepseek.com/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
        )
    if resp.status_code != 200:
        logger.error("DeepSeek error %s: %s", resp.status_code, resp.text[:300])
        raise HTTPException(status_code=502, detail="AI 解析服务暂时不可用，请稍后重试")
    content = resp.json()["choices"][0]["message"]["content"]
    # strip possible markdown fences
    content = re.sub(r"^```(?:json)?\s*", "", content.strip())
    content = re.sub(r"\s*```$", "", content)
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        logger.error("DeepSeek returned invalid JSON: %s", content[:300])
        raise HTTPException(status_code=502, detail="AI 返回格式异常，请重试")


@router.get("/candidates/me/resume-preview", response_model=ResumePreviewResponse)
def resume_preview(db: DB, user_id: UserID):
    row = _get_candidate_row(db, user_id)

    if not row.resume_file_path or not row.resume_file_name:
        raise HTTPException(status_code=404, detail="暂未上传附件简历")

    if row.resume_file_path.startswith("https://"):
        try:
            from app.utils.cos_storage import get_presigned_url
            url = get_presigned_url(row.resume_file_path, expires=3600)
        except Exception as e:
            logger.error("COS presign failed: %s", e)
            raise HTTPException(status_code=502, detail="生成预览链接失败")
        return ResumePreviewResponse(url=url, filename=row.resume_file_name, type="cos")

    if not os.path.exists(row.resume_file_path):
        raise HTTPException(status_code=404, detail="简历文件不存在，请重新上传")

    return ResumePreviewResponse(
        url="/api/v2/candidates/me/resume-file",
        filename=row.resume_file_name,
        type="local",
    )


@router.get("/candidates/me/resume-file")
def resume_file(db: DB, user_id: UserID):
    row = _get_candidate_row(db, user_id)

    if not row.resume_file_path or not row.resume_file_name:
        raise HTTPException(status_code=404, detail="暂未上传附件简历")

    if row.resume_file_path.startswith("https://"):
        raise HTTPException(status_code=400, detail="COS 文件请使用 /resume-preview 获取链接")

    if not os.path.exists(row.resume_file_path):
        raise HTTPException(status_code=404, detail="简历文件不存在")

    ext = row.resume_file_name.rsplit(".", 1)[-1].lower() if "." in row.resume_file_name else ""
    media_map = {
        "pdf": "application/pdf",
        "doc": "application/msword",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    return FileResponse(
        path=row.resume_file_path,
        media_type=media_map.get(ext, "application/octet-stream"),
        filename=row.resume_file_name,
    )


@router.post("/candidates/me/resume/ai-parse")
def resume_ai_parse(db: DB, user_id: UserID):
    """读取候选人已上传的简历文件，提取文字后交给 DeepSeek 解析档案字段。"""
    settings = get_settings()
    if not settings.deepseek_api_key:
        raise HTTPException(status_code=503, detail="AI 解析功能未配置，请联系管理员")

    row = _get_candidate_row(db, user_id)
    if not row.resume_file_path or not row.resume_file_name:
        raise HTTPException(status_code=404, detail="请先上传简历附件再使用 AI 解析")

    # 读取文件内容（支持 COS 和本地）
    if row.resume_file_path.startswith("https://"):
        try:
            with httpx.Client(timeout=30) as client:
                r = client.get(row.resume_file_path)
            r.raise_for_status()
            file_bytes = r.content
        except Exception as e:
            logger.error("COS download failed: %s", e)
            raise HTTPException(status_code=502, detail="简历文件下载失败，请重试")
    else:
        if not os.path.exists(row.resume_file_path):
            raise HTTPException(status_code=404, detail="简历文件不存在，请重新上传")
        with open(row.resume_file_path, "rb") as f:
            file_bytes = f.read()

    resume_text = _extract_text(file_bytes, row.resume_file_name)
    parsed = _call_deepseek_parse(resume_text, settings.deepseek_api_key)
    return {"ok": True, "data": parsed}
