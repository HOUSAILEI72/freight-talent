"""
POST /api/v2/ai/diagnose-resume

功能：读取当前登录候选人的 profile，调用 DeepSeek，返回结构化简历诊断建议。

返回格式：
  {"items": [{"title": "...", "desc": "...", "priority": "high|medium"}]}
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from fastapi_app.core.auth import get_current_user_id
from fastapi_app.core.config import get_settings
from fastapi_app.core.database import get_db
from fastapi_app.core.redis import get_redis_client

logger = logging.getLogger("fastapi_app.ai_diagnosis")

router = APIRouter(tags=["AI 诊断"])

UserID = Annotated[int, Depends(get_current_user_id)]
DB = Annotated[Session, Depends(get_db)]

# ── 并发信号量 ─────────────────────────────────────────────────────────────────
_SEMAPHORE: asyncio.Semaphore | None = None


def _get_semaphore() -> asyncio.Semaphore:
    global _SEMAPHORE
    if _SEMAPHORE is None:
        _SEMAPHORE = asyncio.Semaphore(5)
    return _SEMAPHORE


# ── 每用户每日限流（10 次/天） ─────────────────────────────────────────────────
_DAILY_LIMIT = 20
_DAILY_WINDOW = 86400  # 24h


def _check_rate_limit(user_id: int) -> bool:
    """返回 True 表示允许，False 表示超限。Redis 不可用时放行。"""
    redis = get_redis_client()
    if redis is None:
        return True
    key = f"ratelimit:ai:diagnose:{user_id}"
    try:
        pipe = redis.pipeline()
        pipe.incr(key)
        pipe.expire(key, _DAILY_WINDOW)
        count = pipe.execute()[0]
        return count <= _DAILY_LIMIT
    except Exception:
        return True


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class DiagnosisItem(BaseModel):
    title: str
    desc: str
    priority: str  # "high" | "medium"


class DiagnoseResponse(BaseModel):
    items: list[DiagnosisItem]


# ── 数据库查询 ─────────────────────────────────────────────────────────────────

def _get_candidate_profile(db: Session, user_id: int) -> dict:
    """查询候选人所有诊断需要的字段，返回 dict；不存在时抛 404。"""
    row = db.execute(
        text(
            "SELECT full_name, availability_status, current_title, current_company, "
            "function_name, current_responsibilities, "
            "work_experiences, project_experiences, summary, "
            "education_experiences, certificates, "
            "knowledge_tags, hard_skill_tags, soft_skill_tags, "
            "expected_salary_min, expected_salary_max "
            "FROM candidates WHERE user_id = :uid"
        ),
        {"uid": user_id},
    ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="候选人档案不存在")

    def _json_len(val) -> int:
        if val is None:
            return 0
        if isinstance(val, list):
            return len(val)
        try:
            parsed = json.loads(val)
            return len(parsed) if isinstance(parsed, list) else 0
        except Exception:
            return 0

    return {
        "full_name": row.full_name or "",
        "availability_status": row.availability_status or "",
        "current_title": row.current_title or "",
        "current_company": row.current_company or "",
        "function_name": row.function_name or "",
        "has_responsibilities": bool(row.current_responsibilities and row.current_responsibilities.strip()),
        "work_exp_count": _json_len(row.work_experiences),
        "project_exp_count": _json_len(row.project_experiences),
        "has_summary": bool(row.summary and row.summary.strip()),
        "edu_count": _json_len(row.education_experiences),
        "cert_count": _json_len(row.certificates),
        "knowledge_tag_count": _json_len(row.knowledge_tags),
        "soft_skill_tag_count": _json_len(row.soft_skill_tags),
        "has_expected_salary": bool(row.expected_salary_min or row.expected_salary_max),
    }


# ── Prompt 构造 ────────────────────────────────────────────────────────────────

def _build_user_prompt(p: dict) -> str:
    return f"""候选人档案：
- 姓名：{p['full_name']}，求职状态：{p['availability_status']}
- 当前职位：{p['current_title']}，公司：{p['current_company']}
- 业务方向：{p['function_name']}
- 岗位描述：{"有" if p['has_responsibilities'] else "无"}
- 工作经历：{p['work_exp_count']} 段
- 项目经历：{p['project_exp_count']} 段
- 个人优势（summary）：{"有" if p['has_summary'] else "无"}
- 教育经历：{p['edu_count']} 条
- 资格证书：{p['cert_count']} 个
- 岗位标签：{p['knowledge_tag_count']} 个
- 软技能标签：{p['soft_skill_tag_count']} 个
- 期望薪资：{"有" if p['has_expected_salary'] else "无"}
请诊断档案，指出 2-5 个优先级最高的改进点。返回 JSON：
{{"items": [{{"title": "改进项标题（5字以内）", "desc": "具体建议（30-50字）", "priority": "high|medium"}}]}}"""


# ── DeepSeek 调用 ──────────────────────────────────────────────────────────────

async def _call_deepseek(
    client: httpx.AsyncClient,
    api_key: str,
    profile: dict,
) -> DiagnoseResponse:
    payload = {
        "model": "deepseek-chat",
        "messages": [
            {
                "role": "system",
                "content": (
                    "你是专业的货代行业简历顾问。请对候选人档案进行深度诊断，找出可提升的关键项。"
                    "只输出 JSON，不输出任何其他内容。"
                ),
            },
            {"role": "user", "content": _build_user_prompt(profile)},
        ],
        "stream": False,
        "temperature": 0.4,
        "max_tokens": 1500,
    }

    try:
        resp = await client.post(
            "https://api.deepseek.com/chat/completions",
            json=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="AI 服务超时，请稍后重试")
    except httpx.RequestError as e:
        logger.error("DeepSeek request error: %s", e)
        raise HTTPException(status_code=502, detail="AI 服务连接失败")

    if resp.status_code != 200:
        logger.error("DeepSeek API error %s: %s", resp.status_code, resp.text[:300])
        raise HTTPException(status_code=502, detail=f"AI 服务返回错误 {resp.status_code}")

    raw: str = resp.json()["choices"][0]["message"]["content"].strip()

    # 去掉可能的 ```json ... ``` 包裹
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        data = json.loads(raw)
        items = [
            DiagnosisItem(
                title=str(it.get("title", "")).strip(),
                desc=str(it.get("desc", "")).strip(),
                priority=str(it.get("priority", "medium")).strip(),
            )
            for it in data.get("items", [])
            if it.get("title") and it.get("desc")
        ]
        if not items:
            raise ValueError("empty items")
        return DiagnoseResponse(items=items)
    except Exception:
        logger.warning("DeepSeek diagnosis JSON parse failed, using fallback. raw=%s", raw[:300])
        return _fallback_diagnosis(profile)


# ── Fallback 诊断（JSON 解析失败时） ──────────────────────────────────────────

def _fallback_diagnosis(p: dict) -> DiagnoseResponse:
    """基于简单规则生成兜底诊断，避免因 DeepSeek 返回异常导致前端报错。"""
    items: list[DiagnosisItem] = []

    if not p["has_summary"]:
        items.append(DiagnosisItem(
            title="补充个人优势",
            desc="档案缺少个人优势简介，建议用 3-5 句话概括核心竞争力和行业经验，有助于提升曝光度。",
            priority="high",
        ))
    if not p["has_responsibilities"]:
        items.append(DiagnosisItem(
            title="完善岗位描述",
            desc="当前岗位描述为空，建议补充主要工作内容和职责，帮助雇主快速了解你的日常工作。",
            priority="high",
        ))
    if p["work_exp_count"] == 0:
        items.append(DiagnosisItem(
            title="添加工作经历",
            desc="未录入任何工作经历，建议至少填写最近一段工作经历（公司、职位、时间段、主要职责）。",
            priority="high",
        ))
    if p["cert_count"] == 0:
        items.append(DiagnosisItem(
            title="添加资格证书",
            desc="尚未填写行业资格证书，货代行业证书（如国际货代证、报关员证）能显著提升可信度。",
            priority="medium",
        ))
    if not p["has_expected_salary"]:
        items.append(DiagnosisItem(
            title="填写期望薪资",
            desc="未填写期望薪资区间，雇主在筛选时可能会优先考虑信息完整的候选人。",
            priority="medium",
        ))

    if not items:
        items.append(DiagnosisItem(
            title="保持档案更新",
            desc="档案整体较为完整，建议定期更新项目经历和技能标签，以保持档案新鲜度。",
            priority="medium",
        ))

    return DiagnoseResponse(items=items[:5])


# ── 路由 ───────────────────────────────────────────────────────────────────────

@router.post(
    "/ai/diagnose-resume",
    response_model=DiagnoseResponse,
    summary="AI 诊断候选人简历，返回结构化改进建议",
)
async def diagnose_resume(
    request: Request,
    user_id: UserID,
    db: DB,
):
    settings = get_settings()
    api_key = settings.deepseek_api_key
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="AI 功能未配置：请在 backend/.env 中设置 DEEPSEEK_API_KEY=sk-...",
        )

    if not _check_rate_limit(user_id):
        raise HTTPException(
            status_code=429,
            detail=f"今日 AI 诊断次数已达上限（{_DAILY_LIMIT} 次/天），请明天再试",
        )

    profile = _get_candidate_profile(db, user_id)

    client: httpx.AsyncClient = getattr(request.app.state, "deepseek_client", None)
    if client is None:
        raise HTTPException(status_code=503, detail="AI 客户端未初始化")

    async with _get_semaphore():
        result = await _call_deepseek(client, api_key, profile)

    return result
