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
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from fastapi_app.core.auth import get_current_user_id
from fastapi_app.core.config import get_settings
from fastapi_app.core.database import get_db
from fastapi_app.core.redis import get_redis_client

logger = logging.getLogger("fastapi_app.resume")

router = APIRouter(tags=["简历预览"])

UserID = Annotated[int, Depends(get_current_user_id)]
DB = Annotated[Session, Depends(get_db)]

# ── 每用户每日 AI 解析限流（5 次/天） ─────────────────────────────────────────
_PARSE_DAILY_LIMIT = 20
_PARSE_DAILY_WINDOW = 86400


def _check_parse_rate_limit(user_id: int) -> bool:
    """返回 True 表示允许，False 表示超限。Redis 不可用时放行。"""
    redis = get_redis_client()
    if redis is None:
        return True
    key = f"ratelimit:ai:resume_parse:{user_id}"
    try:
        pipe = redis.pipeline()
        pipe.incr(key)
        pipe.expire(key, _PARSE_DAILY_WINDOW)
        count = pipe.execute()[0]
        return count <= _PARSE_DAILY_LIMIT
    except Exception:
        return True


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
    """
    Walk the DOCX XML body in document order, collecting paragraphs and table
    rows — including nested tables inside cells (common in 51job DOCX format).
    python-docx's cell.text only joins top-level cell paragraphs and silently
    drops content that lives inside a nested table.
    """
    from docx import Document

    W_T   = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t"
    W_P   = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"
    W_TBL = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tbl"
    W_TR  = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tr"
    W_TC  = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tc"
    W_BR  = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}br"

    doc = Document(io.BytesIO(file_bytes))

    def _para_text(p_elem) -> str:
        # elem.text gives text BEFORE the first child; child.tail gives text AFTER
        # that child. 51job uses <w:t>line1<w:br/>line2</w:t>, so we must collect
        # tails too — otherwise everything after the first <w:br/> is silently lost.
        parts: list[str] = []
        for n in p_elem.iter(W_T):
            if n.text:
                parts.append(n.text)
            for child in n:
                if child.tail:
                    sep = "\n" if child.tag == W_BR else ""
                    parts.append(sep + child.tail)
        return "".join(parts)

    def _cell_text(tc_elem) -> str:
        """Return all text from a cell, recursing into nested tables."""
        lines: list[str] = []
        for child in tc_elem:
            if child.tag == W_P:
                t = _para_text(child)
                if t.strip():
                    lines.append(t)
            elif child.tag == W_TBL:
                # Nested table — flatten each nested row
                for tr2 in child:
                    if tr2.tag != W_TR:
                        continue
                    row_parts: list[str] = []
                    seen2: set[str] = set()
                    for tc2 in tr2:
                        if tc2.tag != W_TC:
                            continue
                        t2 = "".join(n.text for n in tc2.iter(W_T) if n.text).strip()
                        if t2 and t2 not in seen2:
                            seen2.add(t2)
                            row_parts.append(t2)
                    if row_parts:
                        lines.append(" ".join(row_parts))
        return "\n".join(lines)

    parts: list[str] = []

    def _walk(elem) -> None:
        for child in elem:
            if child.tag == W_P:
                t = _para_text(child)
                if t.strip():
                    parts.append(t)
            elif child.tag == W_TBL:
                for tr in child:
                    if tr.tag != W_TR:
                        continue
                    seen: set[str] = set()
                    row_cells: list[str] = []
                    for tc in tr:
                        if tc.tag != W_TC:
                            continue
                        ct = _cell_text(tc).strip()
                        if ct and ct not in seen:
                            seen.add(ct)
                            row_cells.append(ct)
                    if row_cells:
                        # Multi-line cell content: emit each cell on its own line
                        # to avoid burying long descriptions behind a pipe separator.
                        if any("\n" in c for c in row_cells):
                            for rc in row_cells:
                                parts.append(rc)
                        else:
                            parts.append(" | ".join(row_cells))

    _walk(doc.element.body)
    return "\n".join(parts)


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

_BENEFIT_OPTIONS = [
    "五险一金", "带薪年假", "法定节假日", "节日福利", "生日福利",
    "年度体检", "团建旅游", "商业保险", "股权激励", "期权激励",
    "弹性上下班", "晚班交通补贴", "高温补贴",
]

_FUNCTION_CODES = {
    "Sea":               "海运板块（海运操作、海运销售、海运单证等）",
    "Air":               "空运板块（空运操作、空运销售、空运单证等）",
    "CrossBorder":       "跨境电商物流（FBA、海外仓备货、跨境快递等）",
    "Railway":           "铁路/中欧班列",
    "Road":              "陆路运输（国内陆运、跨境陆运等）",
    "ContractLogistics": "合同物流/3PL（供应链管理、仓配一体等）",
    "Warehousing":       "仓储/海外仓（仓库管理、海外仓运营等）",
    "Customs":           "关务/合规（报关、HS编码、AEO认证等）",
}

_PARSE_SYSTEM = f"""你是专业的货代行业简历解析助手。
用户会提供一份简历原文，请从中提取以下字段并以 JSON 格式返回，不要输出任何其他内容。
缺失的字段填 null，数组字段没有内容填 []。

【求职状态】availability_status 映射规则：
  "open"        = 离职、待业、随时到岗
  "passive_now" = 在职且明确表示一个月内可到岗
  "passive"     = 在职，仅考虑机会或未明确到岗时间

【业务方向】function_code 规则：
  - 仅当候选人主要从事货运/物流业务岗位时才填，从以下 key 中选一个：
{chr(10).join(f'    {k}: {v}' for k, v in _FUNCTION_CODES.items())}
  - 若候选人主要从事 HR/招聘、财务、IT、互联网等非货运物流岗位，填 null。

【日期格式】所有日期字段统一使用 YYYY-MM（如 2022-10）。
  简历中的 "2022.10" 或 "2022年10月" 均需转换为 "2022-10"。
  教育经历 period 字段使用 "YYYY-YYYY"（如 "2012-2016"）。

【出生年份】若简历未直接给出出生年份，可用当前年份减去年龄推算（当前年为 2026）。

福利字段（benefits）只能从以下选项中选择，不得自行造词：
{", ".join(_BENEFIT_OPTIONS)}

返回格式（严格 JSON，key 保持英文）：
{{
  "full_name": "姓名",
  "phone": "手机号码字符串或null",
  "email": "邮箱地址或null",
  "gender": "male或female或null",
  "birth_year": 出生年份数字或null,
  "birth_month": 出生月份数字(1-12)或null,
  "current_city": "当前居住城市（如'上海'、'北京'），只写城市名，不含区县，无则null",
  "availability_status": "open或passive_now或passive或null",
  "function_code": "货代业务方向key或null（HR/招聘/财务/IT等非货运候选人填null）",
  "is_management_role": true或false或null（是否有带团队管理职责）,
  "management_headcount": 团队人数数字或null,
  "current_responsibilities": "当前或最近岗位主要职责原文，不超过300字，没有则null",
  "current_salary": 当前/最近工作月薪数字（元）或null,
  "current_salary_months": 当前薪资月数12或13或14或null,
  "current_has_year_end_bonus": true或false或null（当前是否有年终奖）,
  "education": "最高学历·专业，如 本科·国际贸易",
  "english_level": "CET-4/CET-6/流利/一般/null",
  "desired_position": "期望岗位名称",
  "expected_salary_min": 期望月薪最低数字（元）或null,
  "expected_salary_max": 期望月薪最高数字（元）或null,
  "expected_salary_period": "month或year",
  "work_experiences": [
    {{
      "company_name": "公司名",
      "industry": "所属行业，如 国际物流",
      "title": "职位",
      "start_month": "YYYY-MM（如2022-10）",
      "end_month": "YYYY-MM或null（在职/至今填null）",
      "responsibilities": "工作内容",
      "achievements": "业绩成果或null",
      "salary": 月薪数字（元）或null,
      "salary_months": 12或13或14或null,
      "has_year_end_bonus": true或false或null,
      "benefits": ["五险一金", "带薪年假"]
    }}
  ],
  "education_experiences": [
    {{
      "school": "学校名",
      "major": "专业",
      "degree": "大专或本科或硕士或博士或高中或初中及以下",
      "period": "YYYY-YYYY（如2012-2016）"
    }}
  ],
  "project_experiences": [
    {{
      "name": "项目名",
      "role": "角色",
      "start": "YYYY-MM",
      "end": "YYYY-MM或null",
      "description": "项目描述",
      "achievements": "项目成果或null"
    }}
  ],
  "certificates": ["证书1", "证书2"],
  "hard_skill_tags": ["技能标签1", "技能标签2"],
  "soft_skill_tags": ["软技能1", "软技能2"],
  "summary": "简历中的自我评价/个人优势原文，不超过500字，没有则null"
}}"""


async def _call_deepseek_parse(client: httpx.AsyncClient, resume_text: str, api_key: str) -> dict:
    payload = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": _PARSE_SYSTEM},
            {"role": "user", "content": f"以下是简历原文：\n\n{resume_text[:18000]}"},
        ],
        "temperature": 0.2,
        "max_tokens": 6000,
        "response_format": {"type": "json_object"},
    }
    try:
        resp = await client.post(
            "https://api.deepseek.com/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
            timeout=60.0,
        )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="AI 解析超时，请稍后重试")
    except httpx.RequestError as e:
        logger.error("DeepSeek request error: %s", e)
        raise HTTPException(status_code=502, detail="AI 服务连接失败，请稍后重试")
    if resp.status_code != 200:
        logger.error("DeepSeek error %s: %s", resp.status_code, resp.text[:300])
        raise HTTPException(status_code=502, detail="AI 解析服务暂时不可用，请稍后重试")
    content = resp.json()["choices"][0]["message"]["content"]
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
async def resume_ai_parse(request: Request, db: DB, user_id: UserID):
    """读取候选人已上传的简历文件，提取文字后交给 DeepSeek 解析档案字段。"""
    settings = get_settings()
    if not settings.deepseek_api_key:
        raise HTTPException(status_code=503, detail="AI 解析功能未配置，请联系管理员")

    if not _check_parse_rate_limit(user_id):
        raise HTTPException(
            status_code=429,
            detail=f"今日 AI 解析次数已达上限（{_PARSE_DAILY_LIMIT} 次/天），请明天再试",
        )

    row = _get_candidate_row(db, user_id)
    if not row.resume_file_path or not row.resume_file_name:
        raise HTTPException(status_code=404, detail="请先上传简历附件再使用 AI 解析")

    deepseek_client: httpx.AsyncClient = getattr(request.app.state, "deepseek_client", None)
    if deepseek_client is None:
        raise HTTPException(status_code=503, detail="AI 客户端未初始化")

    # 读取文件内容（支持 COS 和本地）
    if row.resume_file_path.startswith("https://"):
        try:
            from fastapi_app.core.cos import get_presigned_download_url
            presigned = get_presigned_download_url(row.resume_file_path, expires=300)
            r = await deepseek_client.get(presigned, timeout=30.0)
            r.raise_for_status()
            file_bytes = r.content
        except Exception as e:
            logger.error("COS download failed: %s", e)
            raise HTTPException(status_code=502, detail="简历文件下载失败，请重试")
    else:
        if not os.path.exists(row.resume_file_path):
            raise HTTPException(status_code=404, detail="简历文件不存在，请重新上传")
        import asyncio
        file_bytes = await asyncio.to_thread(
            lambda: open(row.resume_file_path, "rb").read()
        )

    resume_text = _extract_text(file_bytes, row.resume_file_name)
    parsed = await _call_deepseek_parse(deepseek_client, resume_text, settings.deepseek_api_key)
    return {"ok": True, "data": parsed}
