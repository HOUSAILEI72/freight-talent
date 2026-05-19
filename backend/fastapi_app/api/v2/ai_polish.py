"""
POST /api/v2/ai/polish

根据用户已填写的上下文，调用 DeepSeek 对指定文本字段进行流式润色。

输入:
  { "field": "responsibilities", "content": "...", "context": { "title": "...", "company": "..." } }

输出:
  text/event-stream — 每条 SSE 数据行格式: data: <片段文字>\n\n
  结束时发送: data: [DONE]\n\n
"""

from __future__ import annotations

import asyncio
import logging
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from fastapi_app.core.auth import get_current_user_id
from fastapi_app.core.config import get_settings

logger = logging.getLogger("fastapi_app.ai_polish")

router = APIRouter(tags=["AI 润色"])

_SEMAPHORE: asyncio.Semaphore | None = None


def _get_semaphore() -> asyncio.Semaphore:
    global _SEMAPHORE
    if _SEMAPHORE is None:
        _SEMAPHORE = asyncio.Semaphore(5)
    return _SEMAPHORE


_FIELD_PROMPTS: dict[str, str] = {
    "responsibilities": "工作内容",
    "achievements": "工作业绩",
    "project_description": "项目描述",
    "project_achievements": "项目业绩",
    "education_experience": "在校经历",
    "summary": "个人简介",
}


class PolishRequest(BaseModel):
    field: str
    content: str
    context: dict | None = None


async def _stream_deepseek(
    client: httpx.AsyncClient,
    api_key: str,
    prompt: str,
) -> asyncio.AsyncGenerator[str, None]:
    payload = {
        "model": "deepseek-chat",
        "messages": [
            {
                "role": "system",
                "content": (
                    "你是专业的货代行业简历顾问。用户会给你一段简历文本，"
                    "请帮助润色使其更专业、简洁、有说服力。"
                    "保留原意，不要编造虚假经历。"
                    "直接输出润色后的文本，不要输出解释或前言。"
                ),
            },
            {"role": "user", "content": prompt},
        ],
        "stream": True,
        "temperature": 0.6,
        "max_tokens": 800,
    }

    async with client.stream(
        "POST",
        "https://api.deepseek.com/chat/completions",
        json=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        timeout=30.0,
    ) as resp:
        if resp.status_code != 200:
            body = await resp.aread()
            logger.error("DeepSeek polish error %s: %s", resp.status_code, body[:200])
            yield "data: [ERROR]\n\n"
            return

        async for line in resp.aiter_lines():
            if not line.startswith("data:"):
                continue
            chunk = line[5:].strip()
            if chunk == "[DONE]":
                yield "data: [DONE]\n\n"
                return
            try:
                import json
                data = json.loads(chunk)
                delta = data["choices"][0]["delta"].get("content", "")
                if delta:
                    yield f"data: {delta}\n\n"
            except Exception:
                pass


@router.post("/ai/polish")
async def polish_text(
    body: PolishRequest,
    request: Request,
    user_id: Annotated[int, Depends(get_current_user_id)],
):
    settings = get_settings()
    api_key = settings.deepseek_api_key
    if not api_key:
        return StreamingResponse(
            iter(["data: [ERROR: DeepSeek API key not configured]\n\n"]),
            media_type="text/event-stream",
        )

    field_label = _FIELD_PROMPTS.get(body.field, body.field)
    ctx_parts = []
    if body.context:
        for k, v in body.context.items():
            if v:
                ctx_parts.append(f"{k}: {v}")
    ctx_str = "、".join(ctx_parts) if ctx_parts else ""

    prompt = f"请润色以下【{field_label}】内容"
    if ctx_str:
        prompt += f"（背景：{ctx_str}）"
    prompt += f"：\n\n{body.content}"

    client: httpx.AsyncClient = request.app.state.deepseek_client

    async def event_generator():
        async with _get_semaphore():
            try:
                async for chunk in _stream_deepseek(client, api_key, prompt):
                    yield chunk
            except httpx.TimeoutException:
                yield "data: [ERROR: timeout]\n\n"
            except Exception as e:
                logger.error("Polish stream error: %s", e)
                yield "data: [ERROR]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
