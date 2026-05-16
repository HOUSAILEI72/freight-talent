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
            "1. 报关流程：舱单、报关单、查验、放行、转关",
            "2. HS 编码：归类、查询、申报规范",
            "3. 贸易术语：FOB、CIF、DDP、DAP 等",
            "4. 证书与许可：原产地证、商检、配额、许可证",
            "5. 风险合规：反倾销、制裁名单、禁运商品",
            "6. AEO / 企业认证：高级认证、优惠措施",
        ],
    },
    {
        "category": "仓储 / 配送岗位知识",
        "tags": [
            "1. 仓储运营：收货、上架、盘点、出库、库存准确率",
            "2. WMS 系统：波次管理、拣货策略、库位管理",
            "3. 配送管理：路线规划、末端配送、时效追踪",
            "4. 包装标准：防护、标签、危险品包装规范",
            "5. 成本管控：库存周转率、库龄分析、货损率",
            "6. 安全生产：消防、装卸规范、特种作业证",
        ],
    },
    {
        "category": "运输方式标签",
        "tags": [
            "海运", "空运", "铁路运输 / 中欧班列", "公路运输",
            "多式联运", "快递 / 快件", "散货运输", "滚装运输",
            "危险品运输",
        ],
    },
    {
        "category": "海运细分标签",
        "tags": [
            "FCL 整箱", "LCL 拼箱", "散货",
            "冷藏货", "超重 / 超尺寸货", "危险品（IMO）",
            "港到港", "门到门", "CY-CY", "FBA 头程",
        ],
    },
    {
        "category": "空运细分标签",
        "tags": [
            "普货空运", "快件 / 快递", "危险品（IATA）",
            "冷链空运", "生鲜运输", "超规格货", "包板", "包机",
        ],
    },
    {
        "category": "航线 / 区域标签",
        "tags": [
            "亚欧航线", "跨太平洋航线", "中东 / 南亚航线",
            "东南亚航线", "非洲航线", "南美航线", "澳新航线",
            "北美东岸", "北美西岸", "欧洲（地中海）",
            "日韩", "中欧班列（陆路）",
            "华东区域", "华南区域", "华北区域", "全国覆盖",
        ],
    },
    {
        "category": "客户类型标签",
        "tags": [
            "外贸工厂", "贸易商", "电商卖家", "跨境电商平台",
            "Amazon 卖家", "Temu / SHEIN 卖家",
            "品牌出海", "采购商 / 进口商", "大型企业",
            "中小企业 SME", "国际货代同行", "个人客户",
        ],
    },
    {
        "category": "业务模式标签",
        "tags": [
            "开发新客户", "维护老客户", "大客户 KA 管理",
            "渠道代理", "直客销售", "电话销售", "线上获客",
            "展会拓客", "海外市场", "国内市场",
            "一单一结", "月结客户", "合同制合作",
            "代理销售", "自营操作", "操作 + 销售一体",
            "报价与谈判", "竞标 / 招投标", "合同谈判",
            "商务拜访", "客诉处理",
            "数字化 / SaaS 工具使用",
        ],
    },
    {
        "category": "服务类型标签",
        "tags": [
            "进口清关", "出口报关", "双清包税",
            "门到门", "仓配一体", "跨境物流全链路",
            "供应链管理", "项目货运输", "展会物流",
            "应急物流", "VIP 专属服务", "客服 / 跟单",
            "保险服务", "仓储增值服务", "贴标 / 分拣",
            "国际快递代理", "集运服务", "包税服务",
            "退货处理", "逆向物流",
        ],
    },
    {
        "category": "货型 / 产品标签",
        "tags": [
            "普通货", "危险品", "冷链 / 冷藏", "生鲜",
            "超大件 / 重货", "高价值货", "文件 / 单据",
            "汽车及配件", "机械设备", "消费电子",
            "服装 / 纺织品", "家具 / 家居", "化工品",
            "医疗器械 / 药品", "农产品 / 食品",
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
