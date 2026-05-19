"""
POST /api/v2/ai/analyze-job

功能：根据雇主填写的岗位基础信息，调用 DeepSeek 生成：
  1. 岗位职责（description）
  2. 从固定标签池中匹配的岗位标签（job_tags）
  3. 从固定软技能列表中匹配的软技能（soft_skills）

并发设计：
  - asyncio.Semaphore 限制同时调用 DeepSeek 的并发数（默认 5）
  - httpx.AsyncClient 全局复用（lifespan 管理），避免每次请求建立连接
  - 30 s 超时保护
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from fastapi_app.core.auth import get_current_user_id
from fastapi_app.core.config import get_settings
from fastapi_app.core.redis import get_redis_client

logger = logging.getLogger("fastapi_app.ai_analyze")

router = APIRouter(tags=["AI 分析"])

# ── 并发信号量（模块级单例，多 worker 各自独立） ─────────────────────────────
_SEMAPHORE: asyncio.Semaphore | None = None


def _get_semaphore() -> asyncio.Semaphore:
    global _SEMAPHORE
    if _SEMAPHORE is None:
        _SEMAPHORE = asyncio.Semaphore(5)
    return _SEMAPHORE


# ── 标签池（与 src/data/jobTagsData.js 保持一致） ────────────────────────────
JOB_TAGS_POOL: list[dict] = [
    {
        "category": "海运岗位知识",
        "tags": [
            "1. 运输类型：FCL 整箱、LCL 拼箱、散货、滚装船",
            "2. 集装箱：20GP/40GP/40HQ/OT/FR/ 冷藏柜、尺寸限重",
            "3. 船期与航线：ETA/ETD、船公司、航线优势、中转港",
            "4. 海运费用：O/F、THC、文件费、封条费、EBS、CIC、滞箱滞港费",
            "5. 操作流程：订舱→放 SO→提柜→装柜→还柜→报关→上船→签单",
            "6. 提单类型：MBL、HBL、正本、电放、SWB、目的港放货",
            "7. 特殊业务：VGM、ISF、ENS、ACI、舱单申报",
            "8. 风险点：亏舱、甩柜、改单、目的港费用争议",
        ],
    },
    {
        "category": "空运岗位知识",
        "tags": [
            "1. 空运基础：航空公司、航司代码、航班类型、舱位",
            "2. 计费规则：体积重 = 长 × 宽 × 高 / 6000、泡货 / 重货、最低收费",
            "3. 运单体系：MAWB 主单、HAWB 分单、随机文件",
            "4. 空运费用：空运费、燃油费、安全费、地面操作费、入仓费",
            "5. 操作流程：入仓→安检→报关→装机→中转→清关→派送",
            "6. 特殊货物：DGR 危险品、UN 编号、化工品、冷链、生鲜",
            "7. 时效与轨迹：直飞、中转、提取、派送时效",
            "8. 异常：扣货、查验、退件、中转延误",
        ],
    },
    {
        "category": "铁路运输（中欧班列）岗位知识",
        "tags": [
            "1. 班列线路：中欧 / 中俄 / 中亚、起点终点、时效、班期",
            "2. 铁路单证：铁路运单、舱单、转关单",
            "3. 跨境流程：口岸换装、转关、清关、舱单传输",
            "4. 费用构成：铁路运费、口岸费、清关费、中转费",
            "5. 优势场景：大件货、电商货、大批量、性价比运输",
            "6. 风险：口岸拥堵、换装延误、清关异常",
        ],
    },
    {
        "category": "跨境电商物流岗位知识",
        "tags": [
            "1. 物流模式：FBA 头程、海外仓、专线、快递、邮政小包",
            "2. 平台规则：亚马逊 FBA、Temu、SHEIN、速卖通、沃尔玛",
            "3. 头程操作：入仓、贴标、分货、合箱、中转",
            "4. 海外仓：入库、上架、拣货、打包、出库、库存管理",
            "5. 尾程配送：UPS、FedEx、DHL、本地邮政、海外清关",
            "6. 售后处理：退货、换标、销毁、重发、移仓",
            "7. 成本与时效：双清包税、门到门、渠道对比",
            "8. 合规：产品认证、海关编码、申报合规",
        ],
    },
    {
        "category": "关务 / 合规岗位知识",
        "tags": [
            "1. 报关报检：申报要素、HS 编码归类、审价、原产地",
            "2. 清关流程：出口报关、进口清关、转关、属地清关",
            "3. 监管条件：法检、商检、许可证、3C、配额、能效",
            "4. 单证：报关单、合同、发票、箱单、产地证、特殊单证",
            "5. 合规风控：查验、扣货、退运、改单、罚金、AEO 认证",
            "6. 贸易合规：反倾销、制裁合规、数据申报、舱单规范",
        ],
    },
    {
        "category": "仓储 / 配送岗位知识",
        "tags": [
            "1. 仓储管理：入库、上架、盘点、库位、库存预警、效期管理",
            "2. 装卸加固：叉车操作、堆码、防潮、防损、加固要求",
            "3. 配送调度：拖车、提柜、派送、路线规划、车辆管理",
            "4. 设备与系统：WMS、扫码、打单、打包、分拣",
            "5. 成本管控：人工、耗材、仓储费、操作费、异常成本",
            "6. 安全规范：防火、防潮、防盗、危险品存放",
        ],
    },
    {
        "category": "运输方式标签",
        "tags": [
            "海运", "空运", "铁路运输", "陆运 / 公路运输",
            "多式联运", "内河运输", "滚装运输",
            "冷链运输", "危险品运输（DGR/IMO）",
        ],
    },
    {
        "category": "海运细分标签",
        "tags": [
            "FCL（整箱）", "LCL（拼箱）", "散货船", "滚装船",
            "特种柜（开顶 / 框架 / 冷藏）", "内贸海运", "外贸海运",
            "驳船运输", "租船 / 包船",
        ],
    },
    {
        "category": "空运细分标签",
        "tags": [
            "普货空运", "快递空运", "包机", "跨境空运",
            "危险品空运", "冷链空运", "进口清关空运", "出口集货空运",
        ],
    },
    {
        "category": "航线 / 区域标签",
        "tags": [
            "全球航线", "欧地航线（欧洲 / 地中海）", "美加航线（北美）",
            "拉美航线（南美 / 中美）", "东南亚航线", "中东印巴航线",
            "澳洲新西兰航线", "非洲航线", "日韩航线",
            "俄罗斯 / 中亚航线", "红海 / 黑海航线", "加勒比航线",
            "近洋航线", "远洋航线", "区域航线", "国内航线",
        ],
    },
    {
        "category": "客户类型标签",
        "tags": [
            "直客", "同行", "大客户 / KA", "工厂客户",
            "贸易商", "电商客户", "海外代理", "政府 / 项目客户",
            "第三方物流（3PL）", "第四方物流（4PL）",
            "跨境电商卖家", "亚马逊卖家",
        ],
    },
    {
        "category": "业务模式标签",
        "tags": [
            "传统货代", "跨境电商物流", "合同物流（3PL）", "供应链管理",
            "项目物流", "大件 / 超重货物流", "展会物流", "展会运输",
            "搬家 / 私人物品", "保税物流", "仓储配送", "海外仓",
            "尾程配送", "专线物流", "门到门物流", "港到港",
            "港到门", "门到港", "进口物流", "出口物流", "进出口双清",
        ],
    },
    {
        "category": "服务类型标签",
        "tags": [
            "关务合规", "报关报检", "清关服务", "单证操作", "订舱操作",
            "拖车 / 陆运调度", "仓储管理", "库存管理", "订单处理",
            "物流客服", "物流销售", "商务拓展", "运价管理", "航线管理",
            "供应商管理", "海外代理管理", "运营管理", "流程优化",
            "数据分析", "理赔 / 异常处理",
        ],
    },
    {
        "category": "货型 / 产品标签",
        "tags": [
            "普货", "危险品", "化工品", "食品 / 冷链", "生鲜",
            "医药", "大件货", "超重货", "超长货", "易碎品",
            "电商包裹", "FBA 货物", "海外仓货物", "保税货物",
            "展会货物", "私人物品",
        ],
    },
]

ALL_SOFT_SKILLS = [
    "战略思维", "商业洞察力", "全球视野", "愿景驱动", "资源整合",
    "建设高效团队", "吸引顶尖人才", "发展人才", "构建人脉", "建立信任",
    "勇气", "优质决策", "管理复杂性", "计划协同", "结果驱动",
    "工作指导", "责任担当", "有效沟通", "说服影响", "协同合作",
    "坚韧抗压", "客户导向", "行动导向", "管理模糊", "流程优化",
    "人际敏锐", "冲突管理", "敏捷学习", "情境适应", "技术敏锐",
    "自我发展", "尊重差异",
]

# 扁平化的完整标签列表（用于 prompt）
_ALL_JOB_TAGS_FLAT: list[str] = [
    tag for group in JOB_TAGS_POOL for tag in group["tags"]
]


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class AnalyzeJobRequest(BaseModel):
    title: str = Field(..., description="岗位名称")
    function_code: str = Field(..., description="板块 key，如 SEA / AIR / CUSTOMS")
    location_name: str = Field(..., description="城市名，如 上海")
    experience_required: str | None = Field(None, description="经验要求")
    degree_required: str | None = Field(None, description="学历要求")
    employment_type: str | None = Field(None, description="用工类型")
    is_management_role: bool | None = Field(None, description="是否管理岗")
    management_headcount: int | None = Field(None, description="团队人数")
    job_level: str | None = Field(None, description="岗位层级")
    salary_min: int | None = Field(None, description="最低月薪（元）")
    salary_max: int | None = Field(None, description="最高月薪（元）")


class AnalyzeJobResponse(BaseModel):
    description: str
    job_tags: list[str]
    soft_skills: list[str]


# ── DeepSeek 调用核心 ─────────────────────────────────────────────────────────

def _build_prompt(req: AnalyzeJobRequest) -> str:
    """构造发送给 DeepSeek 的 user message。"""
    salary_str = ""
    if req.salary_min and req.salary_max:
        salary_str = f"，月薪 {req.salary_min}–{req.salary_max} 元"

    mgmt_str = ""
    if req.is_management_role:
        headcount = f"（约 {req.management_headcount} 人）" if req.management_headcount else ""
        mgmt_str = f"，管理岗{headcount}"
    elif req.is_management_role is False:
        mgmt_str = "，非管理岗"

    job_tags_pool_text = "\n".join(
        f"【{g['category']}】\n" + "\n".join(f"  - {t}" for t in g["tags"])
        for g in JOB_TAGS_POOL
    )

    soft_skills_text = "、".join(ALL_SOFT_SKILLS)

    return f"""你是一位资深货代行业 HR 专家，请根据以下岗位信息，生成结构化岗位内容。

## 岗位基础信息
- 岗位名称：{req.title}
- 所属板块：{req.function_code}
- 工作城市：{req.location_name}
- 经验要求：{req.experience_required or '不限'}
- 学历要求：{req.degree_required or '不限'}
- 用工类型：{req.employment_type or '未知'}{salary_str}{mgmt_str}
- 岗位层级：{req.job_level or '未填写'}

## 任务要求
请返回以下 JSON（不要有任何额外文字，不要代码块包裹）：

{{
  "description": "岗位职责，200-400 字，分点描述，语言专业，适合货代行业招聘 JD",
  "job_tags": ["从下方标签池中精选 5-12 个最匹配的标签，必须与原文完全一致"],
  "soft_skills": ["从下方软技能列表中精选 4-8 个最匹配的，必须与原文完全一致"]
}}

## 可选岗位标签池（必须原文精确匹配，不得自创）
{job_tags_pool_text}

## 可选软技能列表（必须原文精确匹配）
{soft_skills_text}

注意：
1. job_tags 必须来自上方标签池，字符串完全一致
2. soft_skills 必须来自上方软技能列表，字符串完全一致
3. 只返回 JSON，不要 markdown 代码块"""


async def _call_deepseek(client: httpx.AsyncClient, api_key: str, prompt: str) -> AnalyzeJobResponse:
    """实际调用 DeepSeek API，解析返回的 JSON。"""
    payload = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": "你是专业的货代行业 HR 专家，只输出 JSON，不输出任何其他内容。"},
            {"role": "user", "content": prompt},
        ],
        "stream": False,
        "temperature": 0.3,
        "max_tokens": 2000,
    }

    try:
        resp = await client.post(
            "https://api.deepseek.com/chat/completions",
            json=payload,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
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

    raw_content: str = resp.json()["choices"][0]["message"]["content"].strip()

    # 去掉可能的 ```json ... ``` 包裹
    raw_content = re.sub(r"^```(?:json)?\s*", "", raw_content)
    raw_content = re.sub(r"\s*```$", "", raw_content)

    try:
        data = json.loads(raw_content)
    except json.JSONDecodeError:
        logger.error("DeepSeek response not valid JSON: %s", raw_content[:300])
        raise HTTPException(status_code=502, detail="AI 返回格式异常，请重试")

    # 过滤：只保留标签池中真实存在的值，防止 hallucination
    valid_job_tags_set = set(_ALL_JOB_TAGS_FLAT)
    valid_soft_skills_set = set(ALL_SOFT_SKILLS)

    job_tags = [t for t in data.get("job_tags", []) if t in valid_job_tags_set]
    soft_skills = [s for s in data.get("soft_skills", []) if s in valid_soft_skills_set]

    return AnalyzeJobResponse(
        description=str(data.get("description", "")).strip(),
        job_tags=job_tags,
        soft_skills=soft_skills,
    )


# ── 限流（每个用户每分钟最多 5 次） ──────────────────────────────────────────

_AI_RATE_LIMIT = 5
_AI_RATE_WINDOW = 60  # seconds


def _check_rate_limit(user_id: int) -> bool:
    """返回 True 表示允许，False 表示超限。Redis 不可用时放行。"""
    redis = get_redis_client()
    if redis is None:
        return True
    key = f"ratelimit:ai:analyze:{user_id}"
    try:
        pipe = redis.pipeline()
        pipe.incr(key)
        pipe.expire(key, _AI_RATE_WINDOW)
        count = pipe.execute()[0]
        return count <= _AI_RATE_LIMIT
    except Exception:
        return True


# ── 路由 ──────────────────────────────────────────────────────────────────────

@router.post(
    "/ai/analyze-job",
    response_model=AnalyzeJobResponse,
    summary="AI 分析岗位信息，生成职责描述与标签推荐",
)
async def analyze_job(
    body: AnalyzeJobRequest,
    request: Request,
    user_id: Annotated[int, Depends(get_current_user_id)],
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
            detail=f"操作过于频繁，每分钟最多调用 {_AI_RATE_LIMIT} 次，请稍后再试",
        )

    # 从 app.state 取全局复用的 httpx.AsyncClient
    client: httpx.AsyncClient = getattr(request.app.state, "deepseek_client", None)
    if client is None:
        raise HTTPException(status_code=503, detail="AI 客户端未初始化")

    sem = _get_semaphore()
    async with sem:
        result = await _call_deepseek(client, api_key, _build_prompt(body))

    return result
