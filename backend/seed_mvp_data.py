"""
MVP pre-launch seed script.

Actions:
  1. Clear all dirty test data (preserves system_settings, alembic_version, field_registry, tags)
  2. Create 1 admin + 15 employer users (with active subscriptions)
  3. Create 200 candidate users + full profiles
  4. Create 200 published jobs spread across employers
  5. Create 10 personal headhunting requests
  6. Create 10 team headhunting requests

Usage:
    cd backend
    python seed_mvp_data.py
"""

import sys, os, random
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from app.extensions import db, bcrypt
from app.models.user import User
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.headhunting_request import HeadhuntingRequest
from app.models.subscription import Subscription
from sqlalchemy import text

app = create_app()

# ── Seed data pools ────────────────────────────────────────────────────────────

SURNAMES = ["张", "李", "王", "陈", "刘", "杨", "黄", "赵", "周", "吴",
            "徐", "孙", "马", "朱", "胡", "郭", "何", "高", "林", "罗",
            "郑", "梁", "谢", "宋", "唐", "许", "邓", "冯", "曹", "彭"]

MALE_NAMES = ["明远", "志强", "建国", "伟豪", "晓明", "宇航", "浩然", "俊杰",
              "思远", "子轩", "博文", "智勇", "鹏飞", "文杰", "海涛",
              "世杰", "国栋", "雄飞", "天宇", "振华", "景行", "彦明",
              "荣轩", "永年", "立行", "昱铭", "文轩", "光明", "彬华", "勇毅"]

FEMALE_NAMES = ["思雨", "晓燕", "雅婷", "欣怡", "嘉欣", "梦琦", "雪晴", "文慧",
                "婷婷", "燕萍", "秀丽", "淑慧", "美云", "盈盈", "玉洁",
                "静怡", "佳颖", "雨晴", "诗涵", "若冰", "诺涵", "子萱",
                "惠芳", "丽萍", "依依", "颖如", "芸芸", "慧君", "菁菁", "恩琪"]

EMPLOYERS = [
    {"name": "中远海运物流有限公司", "domain": "cosco"},
    {"name": "德迅货运（中国）有限公司", "domain": "kuehne"},
    {"name": "泛亚班拿物流有限公司", "domain": "panalpina"},
    {"name": "海华融泰物流有限公司", "domain": "sinotrans"},
    {"name": "马士基（中国）航运有限公司", "domain": "maersk"},
    {"name": "联邦快递（中国）有限公司", "domain": "fedex"},
    {"name": "DHL 全球货运中国", "domain": "dhl"},
    {"name": "新加坡大华国际货运", "domain": "uob_freight"},
    {"name": "宏达国际货运代理有限公司", "domain": "hongda"},
    {"name": "振华物流集团有限公司", "domain": "zhenhua"},
    {"name": "长荣海运中国区", "domain": "evergreen"},
    {"name": "东方海外货柜（中国）", "domain": "oocl"},
    {"name": "南方航空物流股份公司", "domain": "csair_cargo"},
    {"name": "安通物流集团有限公司", "domain": "antong"},
    {"name": "富士康跨境物流有限公司", "domain": "foxconn_logistics"},
]

CANDIDATE_COMPANIES = [
    "中远海运物流", "马士基中国", "德迅货运", "DHL全球货运", "联邦快递",
    "海华融泰", "泛亚班拿", "中外运", "宝供物流", "嘉里大通",
    "中铁物流", "顺丰国际", "百世物流", "安能物流", "壹米滴答",
    "新加坡大华", "振华物流", "东方海外", "长荣海运", "阳明海运",
    "太平洋航运", "赫伯罗特中国", "美森轮船", "万邦国际", "明远货运",
    "华南货代有限公司", "上海仁为物流", "广州协和货运", "天津跨驰物流", "武汉丰达货代",
]

LOCATIONS = [
    {"location_code": "CN-31-0115", "location_name": "上海", "location_path": "China/上海",
     "location_type": "mainland_china", "business_area_code": "EAST_CHINA", "business_area_name": "East China",
     "province": "上海", "city_name": "上海"},
    {"location_code": "CN-44-0116", "location_name": "广州", "location_path": "China/广东/广州",
     "location_type": "mainland_china", "business_area_code": "SOUTH_CHINA", "business_area_name": "South China",
     "province": "广东", "city_name": "广州"},
    {"location_code": "CN-44-0117", "location_name": "深圳", "location_path": "China/广东/深圳",
     "location_type": "mainland_china", "business_area_code": "SOUTH_CHINA", "business_area_name": "South China",
     "province": "广东", "city_name": "深圳"},
    {"location_code": "CN-11-0111", "location_name": "北京", "location_path": "China/北京",
     "location_type": "mainland_china", "business_area_code": "NORTH_CHINA", "business_area_name": "North China",
     "province": "北京", "city_name": "北京"},
    {"location_code": "CN-12-0112", "location_name": "天津", "location_path": "China/天津",
     "location_type": "mainland_china", "business_area_code": "NORTH_CHINA", "business_area_name": "North China",
     "province": "天津", "city_name": "天津"},
    {"location_code": "CN-33-0113", "location_name": "宁波", "location_path": "China/浙江/宁波",
     "location_type": "mainland_china", "business_area_code": "EAST_CHINA", "business_area_name": "East China",
     "province": "浙江", "city_name": "宁波"},
    {"location_code": "CN-35-0114", "location_name": "厦门", "location_path": "China/福建/厦门",
     "location_type": "mainland_china", "business_area_code": "SOUTH_CHINA", "business_area_name": "South China",
     "province": "福建", "city_name": "厦门"},
    {"location_code": "CN-50-0118", "location_name": "重庆", "location_path": "China/重庆",
     "location_type": "mainland_china", "business_area_code": "WEST_CHINA", "business_area_name": "West China",
     "province": "重庆", "city_name": "重庆"},
    {"location_code": "CN-51-0119", "location_name": "成都", "location_path": "China/四川/成都",
     "location_type": "mainland_china", "business_area_code": "WEST_CHINA", "business_area_name": "West China",
     "province": "四川", "city_name": "成都"},
    {"location_code": "CN-42-0120", "location_name": "武汉", "location_path": "China/湖北/武汉",
     "location_type": "mainland_china", "business_area_code": "CENTRAL_CHINA", "business_area_name": "Central China",
     "province": "湖北", "city_name": "武汉"},
    {"location_code": "HK-0001", "location_name": "香港", "location_path": "Hong Kong",
     "location_type": "hong_kong", "business_area_code": "HONG_KONG", "business_area_name": "Hong Kong",
     "province": None, "city_name": "香港"},
    {"location_code": "CN-32-0121", "location_name": "南京", "location_path": "China/江苏/南京",
     "location_type": "mainland_china", "business_area_code": "EAST_CHINA", "business_area_name": "East China",
     "province": "江苏", "city_name": "南京"},
    {"location_code": "CN-37-0122", "location_name": "青岛", "location_path": "China/山东/青岛",
     "location_type": "mainland_china", "business_area_code": "NORTH_CHINA", "business_area_name": "North China",
     "province": "山东", "city_name": "青岛"},
    {"location_code": "CN-21-0123", "location_name": "大连", "location_path": "China/辽宁/大连",
     "location_type": "mainland_china", "business_area_code": "NORTH_CHINA", "business_area_name": "North China",
     "province": "辽宁", "city_name": "大连"},
]

FUNCTIONS = [
    {"code": "Sea",               "label": "海运板块"},
    {"code": "Air",               "label": "空运板块"},
    {"code": "CrossBorder",       "label": "跨境电商物流"},
    {"code": "Railway",           "label": "铁路/中欧班列"},
    {"code": "Road",              "label": "陆路运输"},
    {"code": "ContractLogistics", "label": "合同物流/3PL"},
    {"code": "Warehousing",       "label": "仓储/海外仓"},
    {"code": "Customs",           "label": "关务/合规"},
]

BUSINESS_TYPES = ["海运", "空运", "跨境电商", "铁路/中欧班列", "陆运", "合同物流", "仓储", "关务"]
JOB_TYPES = ["操作", "销售", "客服", "管理", "业务拓展", "单证", "报关"]

KNOWLEDGE_POOL = {
    "Sea":               ["国际海运条约", "提单操作", "港口调度", "集装箱管理", "SOLAS公约", "拼箱拆箱", "船期管理", "舱位协调"],
    "Air":               ["航空运输协议", "危险品法规", "IATA规定", "航班管理", "货物安检", "ULD管理", "航空单证", "空运关税"],
    "CrossBorder":       ["跨境电商物流", "亚马逊FBA", "平台合规", "海外仓操作", "末端配送", "退货处理", "关税优化", "多平台运营"],
    "Railway":           ["中欧班列操作", "国际铁路规程", "多式联运", "铁路订舱", "内陆运输协调", "门到门方案", "一带一路政策", "运费核算"],
    "Road":              ["公路运输法规", "跨境陆运", "车辆调度", "路线规划", "整车零担", "危险品运输", "冷链运输", "TIR公约"],
    "ContractLogistics": ["合同物流运营", "3PL管理", "供应链规划", "需求预测", "库存优化", "供应商管理", "精益管理", "S&OP"],
    "Warehousing":       ["仓库管理", "WMS系统", "库存控制", "货物分拣", "冷链仓储", "危险品仓储", "VMI管理", "海外仓运营"],
    "Customs":           ["海关法规", "HS编码分类", "原产地规则", "海关申报", "贸易合规", "检验检疫", "AEO认证", "关税管理"],
}

HARD_SKILL_POOL = {
    "Sea":               ["Cargowise", "Excel", "SAP", "港口EDI", "提单制作", "Navisphere"],
    "Air":               ["Cargowise", "COSYS", "GHX", "航空订舱", "Excel", "OPUS系统"],
    "CrossBorder":       ["ERP跨境系统", "亚马逊后台", "旺店通", "Excel", "海外仓WMS", "数据分析"],
    "Railway":           ["Cargowise", "SAP", "Excel", "TMS", "全链路可视化", "铁路EDI"],
    "Road":              ["TMS系统", "GPS调度", "Excel", "车辆管理软件", "ERP"],
    "ContractLogistics": ["SAP", "Oracle", "Excel", "Power BI", "ERP系统", "数据分析"],
    "Warehousing":       ["WMS系统", "RF枪操作", "Excel", "SAP EWM", "叉车证", "海外仓平台"],
    "Customs":           ["报关软件", "H2000", "EDI申报", "Excel", "税则查询系统", "AEO系统"],
}

SOFT_SKILL_POOL = ["英语沟通", "团队协作", "抗压能力", "客户关系管理", "沟通协调",
                   "谈判能力", "问题解决", "跨部门合作", "时间管理", "细致耐心",
                   "主动性强", "学习能力强", "数据分析思维", "项目管理", "结果导向"]

ROUTE_TAGS_POOL = ["美线", "欧线", "亚线", "中东线", "南美线", "非洲线",
                   "东南亚线", "日韩线", "澳洲线", "印度线", "墨西哥线"]

CERTIFICATES_POOL = [
    "国际货运代理资格证", "报关员资格证", "危险品航空运输培训证",
    "报检员证", "AEO高级认证", "叉车操作证", "IATA危险品证",
    "国际商务师", "物流师资格证", "仓储管理师"
]

DEGREE_OPTIONS = [
    "本科 · 国际贸易", "本科 · 物流管理", "本科 · 国际航运管理",
    "本科 · 商务英语", "本科 · 供应链管理", "本科 · 工商管理",
    "专科 · 国际货运代理", "专科 · 报关与国际货运", "专科 · 物流管理",
    "硕士 · 物流与供应链管理", "硕士 · 国际商务", "本科 · 交通运输"
]

UNIVERSITIES = [
    "上海海事大学", "大连海事大学", "上海对外经贸大学", "广东外语外贸大学",
    "天津外国语大学", "南京航空航天大学", "武汉理工大学", "浙江大学",
    "同济大学", "厦门大学", "中山大学", "北京交通大学"
]

ENGLISH_LEVELS = ["CET-4", "CET-6", "流利", "一般", "托福95分", "雅思6.5", "商务英语"]

AVAILABILITY = ["open", "passive_now", "passive", "open", "open", "passive_now"]  # weighted

JOB_TITLES = {
    "Sea": [
        "海运操作经理", "海运出口主管", "海运操作专员", "整箱出口操作", "拼箱操作员",
        "海运进口主管", "海运操作总监", "集装箱调度专员", "海运客服主管", "船代业务员"
    ],
    "Air": [
        "空运操作经理", "空运出口主管", "空运操作专员", "危险品操作员", "空运进口主管",
        "空运报价专员", "航空货运代理", "空运业务总监", "空运客服专员", "空运清关专员"
    ],
    "CrossBorder": [
        "跨境电商物流经理", "海外仓运营主管", "FBA操作专员", "跨境物流BD", "平台物流专员",
        "末端配送主管", "跨境供应链经理", "海外仓总监", "电商物流操作员", "跨境电商客服主管"
    ],
    "Railway": [
        "中欧班列操作经理", "多式联运主管", "铁路货运专员", "一带一路物流专员",
        "全链路物流经理", "国际物流规划师", "门到门运营主管", "内陆运输协调员",
        "铁路操作总监", "国际多式联运经理"
    ],
    "Road": [
        "陆运调度经理", "车辆调度员", "跨境陆运专员", "干线运输主管", "城配配送主管",
        "冷链运输专员", "危险品运输主管", "整车运输经理", "零担业务主管", "国际陆运经理"
    ],
    "ContractLogistics": [
        "合同物流经理", "3PL运营总监", "供应链经理", "采购主管", "计划与预测专员",
        "供应商管理经理", "物流规划师", "S&OP分析师", "ERP项目经理", "物流成本分析师"
    ],
    "Warehousing": [
        "仓库经理", "仓库主管", "WMS操作员", "仓储运营总监", "库存控制主管",
        "收发货主管", "VMI管理专员", "冷链仓储主管", "海外仓运营经理", "物料控制经理"
    ],
    "Customs": [
        "报关员", "高级报关员", "报关部主管", "AEO合规专员", "进出口合规经理",
        "清关操作专员", "贸易合规主管", "海关事务专员", "报关总监", "通关主任"
    ],
}

JOB_DESCRIPTIONS = {
    "Sea":               "负责海运出口/进口业务的全流程操作管理，包括订舱、提单制作、协调港口提货、跟踪货物动态，与船司、港口、内陆运输等各方协调沟通，确保货物按时安全交付。",
    "Air":               "负责空运业务操作，包括订舱、订位、危险品处理、航班跟踪、到货通知及对账，协调航空公司、地勤及清关团队，确保货物准时运达。",
    "CrossBorder":       "负责跨境电商物流全链路运营，涵盖头程、海外仓入库、FBA操作、末端配送及退货处理，协调多平台出货计划，优化跨境物流成本与时效。",
    "Railway":           "统筹铁路及多式联运业务，负责中欧班列订舱、内陆运输协调、门到门方案设计，对接境内外代理，确保一带一路货物安全准时运达。",
    "Road":              "负责陆运业务调度与运营管理，协调车辆资源，处理干线/支线运输，跟踪货物全程，确保货物按时、安全到达，并控制运营成本。",
    "ContractLogistics": "负责合同物流/3PL项目全周期管理，包括客户方案设计、运营落地、供应链优化及成本控制，推动数字化和精益改善。",
    "Warehousing":       "负责仓库/海外仓日常运营管理，包括收发货、库存盘点、人员调度、WMS系统操作，确保准确率和效率达标，协调物流各环节。",
    "Customs":           "负责进出口货物申报、归类、审价，熟悉海关法规和税则，处理税收争议及合规审查，确保货物顺利清关，并维护与海关的良好关系。",
}

REQUIREMENTS_POOL = {
    "Sea":               "1. 3年以上海运操作经验；2. 熟悉提单、舱单制作流程；3. 具备船司或港口工作经验优先；4. 英语读写能力较强；5. 熟练使用 Cargowise 或同类 TMS。",
    "Air":               "1. 2年以上空运操作经验；2. 了解IATA危险品规定；3. 有航空公司或地面代理工作经验优先；4. 英语沟通能力良好；5. 能在快节奏环境下高效工作。",
    "CrossBorder":       "1. 2年以上跨境电商物流经验；2. 熟悉亚马逊FBA操作流程；3. 有海外仓运营经验者优先；4. 了解各平台合规要求；5. 数据分析能力强。",
    "Railway":           "1. 3年以上多式联运或国际物流经验；2. 了解中欧班列操作流程；3. 跨境电商物流经验者优先；4. 英语良好；5. 具备方案设计和客户沟通能力。",
    "Road":              "1. 2年以上陆运调度或运营经验；2. 熟悉TMS调度系统；3. 有危险品或冷链运输经验者加分；4. 抗压能力强、沟通协调能力好；5. 可接受弹性工作时间。",
    "ContractLogistics": "1. 5年以上合同物流或3PL运营经验；2. 熟练使用SAP或Oracle ERP；3. 具备数据分析和建模能力；4. 有精益管理或六西格玛认证者优先；5. 英语流利。",
    "Warehousing":       "1. 2年以上仓储运营或管理经验；2. 熟练使用WMS系统；3. 有冷链或危险品仓储经验者加分；4. 具备团队管理能力；5. 工作认真、责任心强。",
    "Customs":           "1. 持有报关员资格证；2. 3年以上报关实操经验；3. 熟悉H.S编码分类和估价；4. 有AEO认证经历者优先；5. 工作细心、合规意识强。",
}

TEAM_SUMMARIES = [
    "希望招募一支专注于亚太区海运业务的销售和操作团队，团队规模约 6-10 人，核心职能包括：海运出口销售、操作及客服，期望团队具有稳定的船司资源和客户基础。",
    "计划在上海或深圳建立一支跨境电商空运团队，规模 5-8 人，团队需具备亚马逊 FBA、Shopify 等主流平台物流经验，熟悉危险品航空运输规定。",
    "寻找一支拥有 AEO 认证经验的报关合规团队，计划在广州落地，规模约 4-6 人，核心职能包括进出口申报、贸易合规、关税咨询，要求具备制造业或贸易公司背景。",
    "需要组建一支面向欧美线整箱出口的运营团队，驻地上海，团队规模 8-12 人，涵盖销售开发、操作、文档和客户服务，希望候选人来自马士基或中远背景。",
    "在北京或天津招募一支专注中欧班列及一带一路项目的多式联运团队，规模 5-8 人，需要有铁路货运、内陆运输协调和中亚通关的实操经验。",
    "计划在香港建立一支服务于全球大型零售客户的供应链管理团队，规模 6-8 人，核心工作包括供应商协调、货量预测、库存管理，需有香港工作经验或英语流利。",
    "寻找一支专注于华南地区仓储及末端配送的运营团队，广州或深圳驻点，规模 10-15 人，需有电商仓、VMI 或冷链运营经验，团队负责人需具备 WMS 系统实施经验。",
    "招募一支成熟的空运进出口操作团队入驻上海浦东，团队规模约 5-7 人，要求具备稳定的货量基础，特别是对美线、欧线空运有丰富操作经验。",
    "在天津自贸区招募一支专注进口整柜清关和保税仓运营的团队，规模 4-6 人，需具备海关 AEO 认证和保税区操作经验，负责人要有超过 8 年的海关事务经验。",
    "寻找一支深耕东南亚市场的货代销售团队在深圳或广州落地，规模 6-10 人，团队负责人需有大型 NVO 或船公司背景，成员具备泰国、越南、印尼等市场资源。",
]

BUSINESS_FOCUS_OPTIONS = [
    ["海运", "FCL", "LCL", "跨境"],
    ["空运", "快件", "危险品", "亚马逊FBA"],
    ["报关", "进口", "出口", "保税"],
    ["陆运", "整车", "零担", "冷链"],
    ["多式联运", "中欧班列", "一带一路", "铁路"],
    ["仓储", "电商仓", "保税仓", "VMI"],
    ["供应链", "采购", "计划", "S&OP"],
    ["海运", "美线", "欧线", "整箱出口"],
    ["空运", "美线", "欧线", "进口"],
    ["多式联运", "东南亚", "跨境电商", "FBA"],
]


def rand_date_in_past(days_back_min, days_back_max):
    offset = random.randint(days_back_min, days_back_max)
    return datetime.now(timezone.utc) - timedelta(days=offset)


def make_name(gender):
    surname = random.choice(SURNAMES)
    given = random.choice(MALE_NAMES if gender == "male" else FEMALE_NAMES)
    return surname + given


def make_candidate(i, user_id, func_key):
    gender = "male" if random.random() < 0.55 else "female"
    name = make_name(gender)
    loc = random.choice(LOCATIONS)
    exp = random.randint(1, 18)
    age = exp + random.randint(22, 28)
    degree = random.choice(DEGREE_OPTIONS)
    uni = random.choice(UNIVERSITIES)
    company = random.choice(CANDIDATE_COMPANIES)
    company2 = random.choice([c for c in CANDIDATE_COMPANIES if c != company])

    titles = JOB_TITLES.get(func_key, JOB_TITLES["Sea"])
    title_now = random.choice(titles)
    title_prev = random.choice([t for t in titles if t != title_now])

    func_obj = next((f for f in FUNCTIONS if f["code"] == func_key), FUNCTIONS[0])
    func_idx = next((i for i, f in enumerate(FUNCTIONS) if f["code"] == func_key), 0)
    biz_type = BUSINESS_TYPES[func_idx % len(BUSINESS_TYPES)]

    job_type = random.choice(JOB_TYPES)
    english = random.choice(ENGLISH_LEVELS)
    avail = random.choice(AVAILABILITY)

    knowledge = random.sample(KNOWLEDGE_POOL.get(func_key, KNOWLEDGE_POOL["Sea"]), min(4, len(KNOWLEDGE_POOL.get(func_key, KNOWLEDGE_POOL["Sea"]))))
    hard_skills = random.sample(HARD_SKILL_POOL.get(func_key, HARD_SKILL_POOL["Sea"]), min(4, len(HARD_SKILL_POOL.get(func_key, HARD_SKILL_POOL["Sea"]))))
    soft_skills = random.sample(SOFT_SKILL_POOL, 3)
    certs = random.sample(CERTIFICATES_POOL, random.randint(0, 2))
    route_tags = random.sample(ROUTE_TAGS_POOL, random.randint(1, 3))

    sal_base = random.choice([8000, 10000, 12000, 15000, 18000, 20000, 25000, 30000])
    sal_min = sal_base
    sal_max = int(sal_base * random.uniform(1.2, 1.8))
    cur_sal = int(sal_base * random.uniform(0.9, 1.1))

    is_mgmt = random.random() < 0.35
    mgmt_count = random.randint(3, 30) if is_mgmt else None

    start_year = 2024 - exp
    work_exp = [
        {"period": f"{start_year + max(0, exp-4)}-至今", "title": title_now, "company_name": company},
    ]
    if exp >= 4:
        work_exp.append({"period": f"{start_year}-{start_year + max(1, exp-4)}", "title": title_prev, "company_name": company2})

    edu_year = 2024 - exp - 4
    edu_exp = [{"period": f"{edu_year}-{edu_year+4}", "school": uni, "major": degree.split(" · ")[1] if " · " in degree else "物流管理", "degree": degree.split(" · ")[0] if " · " in degree else "本科"}]

    confirmed_at = rand_date_in_past(1, 60)
    created_at = rand_date_in_past(30, 180)

    return Candidate(
        user_id=user_id,
        full_name=name,
        gender=gender,
        current_title=title_now,
        current_company=company,
        current_city=loc["location_name"],
        expected_city=loc["location_name"],
        expected_salary_min=sal_min,
        expected_salary_max=sal_max,
        expected_salary_label=f"{sal_min//1000}k-{sal_max//1000}k",
        experience_years=exp,
        age=age,
        birth_year=2024 - age,
        birth_month=random.randint(1, 12),
        education=degree,
        english_level=english,
        summary=f"从事{biz_type}行业{exp}年，目前担任{title_now}，{('拥有丰富的团队管理经验，带过' + str(mgmt_count) + '人团队') if is_mgmt else '专注于业务执行与客户服务'}，熟悉{func_obj['label']}全流程操作。",
        business_type=biz_type,
        job_type=job_type,
        function_code=func_key,
        function_name=func_obj["label"],
        is_management_role=is_mgmt,
        management_headcount=mgmt_count,
        location_code=loc["location_code"],
        location_name=loc["location_name"],
        location_path=loc["location_path"],
        location_type=loc["location_type"],
        business_area_code=loc["business_area_code"],
        business_area_name=loc["business_area_name"],
        knowledge_tags=knowledge,
        hard_skill_tags=hard_skills,
        soft_skill_tags=soft_skills,
        skill_tags=hard_skills,
        route_tags=route_tags,
        certificates=certs,
        work_experiences=work_exp,
        education_experiences=edu_exp,
        current_responsibilities=f"负责{biz_type}{job_type}相关工作{', 管理团队' + str(mgmt_count) + '人' if is_mgmt else ''}，年处理货量约 {random.randint(5, 50)}万 {'TEU' if 'Sea' in func_key else 'KG' if 'Air' in func_key else '票'}。",
        current_salary_min=cur_sal,
        current_salary_max=int(cur_sal * 1.1),
        current_salary_months=random.choice([12, 13, 14]),
        current_has_year_end_bonus=random.random() < 0.6,
        current_year_end_bonus_months=random.choice([1.0, 1.5, 2.0, 3.0]) if random.random() < 0.6 else None,
        availability_status=avail,
        email=f"candidate_{i:04d}@test.acetalent.com",
        phone=f"+86 138 {random.randint(1000,9999)} {random.randint(1000,9999)}",
        contact_visible=random.random() < 0.3,
        profile_status="complete",
        profile_completed_at=created_at,
        profile_confirmed_at=confirmed_at,
        last_active_at=rand_date_in_past(0, 14),
        created_at=created_at,
        updated_at=confirmed_at,
    )


def make_job(i, employer_user, func_key):
    func_obj = next((f for f in FUNCTIONS if f["code"] == func_key), FUNCTIONS[0])
    func_idx = next((idx for idx, f in enumerate(FUNCTIONS) if f["code"] == func_key), 0)
    biz_type = BUSINESS_TYPES[func_idx % len(BUSINESS_TYPES)]
    loc = random.choice(LOCATIONS)
    job_type = random.choice(JOB_TYPES)

    titles = JOB_TITLES.get(func_key, JOB_TITLES["Sea"])
    title = random.choice(titles)

    sal_base = random.choice([8000, 10000, 12000, 15000, 18000, 20000, 25000, 30000, 35000])
    sal_min = sal_base
    sal_max = int(sal_base * random.uniform(1.3, 2.0))
    sal_label = f"{sal_min//1000}k-{sal_max//1000}k"

    exp_req = random.choice(["不限", "1-3年", "3-5年", "5-10年", "10年以上"])
    degree_req = random.choice(["不限", "大专", "本科", "硕士"])
    headcount = random.randint(1, 5)
    urgency = random.randint(1, 3)

    knowledge = random.sample(KNOWLEDGE_POOL.get(func_key, KNOWLEDGE_POOL["Sea"]), min(3, len(KNOWLEDGE_POOL.get(func_key, KNOWLEDGE_POOL["Sea"]))))
    hard_skills = random.sample(HARD_SKILL_POOL.get(func_key, HARD_SKILL_POOL["Sea"]), min(3, len(HARD_SKILL_POOL.get(func_key, HARD_SKILL_POOL["Sea"]))))
    soft_skills = random.sample(SOFT_SKILL_POOL, 2)
    route_tags = random.sample(ROUTE_TAGS_POOL, random.randint(1, 3))
    skill_tags = hard_skills[:2]

    is_mgmt = random.random() < 0.3
    mgmt_count = random.randint(3, 20) if is_mgmt else None
    employment_type = random.choice(["全职", "全职", "全职", "兼职"])

    created_at = rand_date_in_past(1, 120)

    return Job(
        company_id=employer_user.id,
        title=title,
        city=loc["location_name"],
        province=loc.get("province"),
        city_name=loc["city_name"],
        salary_min=sal_min,
        salary_max=sal_max,
        salary_label=sal_label,
        experience_required=exp_req,
        degree_required=degree_req,
        headcount=headcount,
        description=JOB_DESCRIPTIONS.get(func_key, JOB_DESCRIPTIONS["Sea"]),
        requirements=REQUIREMENTS_POOL.get(func_key, REQUIREMENTS_POOL["Sea"]),
        business_type=biz_type,
        job_type=job_type,
        route_tags=route_tags,
        skill_tags=skill_tags,
        urgency_level=urgency,
        location_code=loc["location_code"],
        location_name=loc["location_name"],
        location_path=loc["location_path"],
        location_type=loc["location_type"],
        business_area_code=loc["business_area_code"],
        business_area_name=loc["business_area_name"],
        function_code=func_key,
        function_name=func_obj["label"],
        is_management_role=is_mgmt,
        management_headcount=mgmt_count,
        knowledge_requirements=knowledge,
        hard_skill_requirements=hard_skills,
        soft_skill_requirements=soft_skills,
        salary_months=random.choice([12, 13, 14]),
        has_year_end_bonus=random.random() < 0.6,
        year_end_bonus_months=random.choice([1.0, 2.0, 3.0]) if random.random() < 0.6 else None,
        employment_type=employment_type,
        status="published",
        created_at=created_at,
        updated_at=created_at,
    )


def make_personal_headhunting(i, employer_user):
    func_obj = random.choice(FUNCTIONS)
    loc = random.choice(LOCATIONS)
    func_key = func_obj["code"]
    titles = JOB_TITLES.get(func_key, JOB_TITLES["Sea"])
    title = random.choice(titles)
    sal_min = random.choice([15000, 18000, 20000, 25000, 30000])
    sal_max = int(sal_min * random.uniform(1.4, 2.0))
    salary_months = random.choice([12, 13, 14])
    has_bonus = random.random() < 0.65
    bonus_months = random.choice([1.0, 2.0, 3.0]) if has_bonus else None

    knowledge = random.sample(KNOWLEDGE_POOL.get(func_key, KNOWLEDGE_POOL["Sea"]), 3)
    hard_skills = random.sample(HARD_SKILL_POOL.get(func_key, HARD_SKILL_POOL["Sea"]), 3)
    soft_skills = random.sample(SOFT_SKILL_POOL, 3)

    is_mgmt = random.random() < 0.5
    mgmt_count = random.randint(5, 20) if is_mgmt else None

    acc = random.random() < 0.25
    bg_check = random.random() < 0.35
    personality = random.random() < 0.2

    base_rate = 0.28 if acc else 0.23
    annual = sal_min * salary_months + (bonus_months * sal_min if has_bonus else 0)
    fee_low = annual * base_rate if sal_min >= 10000 else sal_min
    fee_high = int(sal_max * salary_months * base_rate)
    addon = (500 if bg_check else 0) + (100 if personality else 0)

    statuses = ["submitted", "submitted", "submitted", "reviewing", "reviewing", "matched"]
    contact_idx = i % len(EMPLOYERS)

    return HeadhuntingRequest(
        employer_id=employer_user.id,
        service_type="personal",
        status=random.choice(statuses),
        job_payload={
            "title": title,
            "function_code": func_key,
            "function_name": func_obj["label"],
            "business_type": func_obj["label"],
            "is_management_role": is_mgmt,
            "management_headcount": mgmt_count,
            "employment_type": "全职",
            "location_code": loc["location_code"],
            "location_name": loc["location_name"],
            "location_path": loc["location_path"],
            "location_type": loc["location_type"],
            "experience_required": random.choice(["3-5年", "5-10年", "10年以上"]),
            "degree_required": random.choice(["本科", "硕士", "不限"]),
            "description": JOB_DESCRIPTIONS.get(func_key, JOB_DESCRIPTIONS["Sea"]),
            "knowledge_requirements": knowledge,
            "hard_skill_requirements": hard_skills,
            "soft_skill_requirements": soft_skills,
            "salary_min": sal_min,
            "salary_max": sal_max,
            "salary_months": salary_months,
            "commission_bonus_period": "not_applicable",
            "has_year_end_bonus": has_bonus,
            "year_end_bonus_months": bonus_months,
        },
        terms_payload={
            "type_a": True, "type_b": True, "income_scope": True,
            "replacement": True, "advertising": True, "invoice": True,
        },
        add_ons_payload={
            "accelerated": acc,
            "background_check": bg_check,
            "background_check_count": 1 if bg_check else 0,
            "personality_report": personality,
            "personality_report_count": 1 if personality else 0,
        },
        fee_snapshot={
            "feeLow": fee_low,
            "feeHigh": fee_high,
            "firstPayLow": fee_low * 0.6,
            "firstPayHigh": fee_high * 0.6,
            "balanceLow": fee_low * 0.4,
            "balanceHigh": fee_high * 0.4,
            "typeLabel": "A",
            "guaranteeLabel": "3 个月",
            "addonFee": addon,
            "totalLow": fee_low + addon,
            "totalHigh": fee_high + addon,
        },
        contact_name=employer_user.name,
        contact_phone=f"+86 138 {random.randint(1000,9999)} {random.randint(1000,9999)}",
        contact_email=employer_user.email,
        contact_wechat=f"wx_{employer_user.name}_{i:02d}",
        created_at=rand_date_in_past(1, 60),
        updated_at=rand_date_in_past(0, 30),
    )


def make_team_headhunting(i, employer_user):
    bf_idx = i % len(BUSINESS_FOCUS_OPTIONS)
    loc = random.choice(LOCATIONS)
    acc = random.random() < 0.3
    base_total = 210000 if acc else 180000
    monthly_fee = 17500 if acc else 15000
    lbg = random.random() < 0.4
    mbg = random.random() < 0.35
    mpr = random.random() < 0.25
    addon = (500 if lbg else 0) + (500 if mbg else 0) + (100 if mpr else 0)

    onboard_year = 2026
    onboard_month = random.randint(6, 12)
    statuses = ["submitted", "submitted", "reviewing", "reviewing", "matched"]

    return HeadhuntingRequest(
        employer_id=employer_user.id,
        service_type="team",
        status=random.choice(statuses),
        job_payload={
            "team_requirement": {
                "summary": TEAM_SUMMARIES[i % len(TEAM_SUMMARIES)],
                "preferred_cities": [
                    {
                        "location_code": loc["location_code"],
                        "location_name": loc["location_name"],
                        "location_path": loc["location_path"],
                        "location_type": loc["location_type"],
                        "business_area_code": loc["business_area_code"],
                        "business_area_name": loc["business_area_name"],
                    }
                ],
                "business_focus": BUSINESS_FOCUS_OPTIONS[bf_idx],
                "customer_focus": ["制造业客户", "贸易商", "跨境电商"],
                "supply_resource_focus": ["船司资源", "海外代理", "港口资源"],
                "member_structure_focus": ["销售负责人", "操作主管", "客服"],
                "commission_model_preference": ["团队提成", "个人提成"],
                "assessment_model_preference": ["利润额", "新客户数"],
                "expected_onboard_time": f"{onboard_year}-{onboard_month}",
                "benchmark_companies": random.choice(["马士基, 中远, DHL", "德迅, 泛亚, 大华", "中外运, 宝供, 嘉里"]),
            }
        },
        terms_payload={
            "team_fixed_fee": True,
            "team_departure_clause": True,
            "team_invoice": True,
        },
        add_ons_payload={
            "accelerated": acc,
            "leader_background_check": lbg,
            "leader_background_check_count": 1 if lbg else 0,
            "member_background_check": mbg,
            "member_background_check_count": 3 if mbg else 0,
            "member_personality_report": mpr,
            "member_personality_report_count": 3 if mpr else 0,
        },
        fee_snapshot={
            "baseTotal": base_total,
            "monthlyFee": monthly_fee,
            "months": 12,
            "addonFee": addon,
            "total": base_total + addon,
        },
        contact_name=employer_user.name,
        contact_phone=f"+86 135 {random.randint(1000,9999)} {random.randint(1000,9999)}",
        contact_email=employer_user.email,
        contact_wechat=f"wx_team_{i:02d}",
        created_at=rand_date_in_past(1, 45),
        updated_at=rand_date_in_past(0, 20),
    )


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    random.seed(42)

    with app.app_context():
        print("=" * 60)
        print("ACE-Talent MVP Seed Script")
        print("=" * 60)

        # ── Step 1: Clear dirty test data ──────────────────────────────
        print("\n[1/6] Clearing old test data...")

        db.session.execute(text("DELETE FROM match_results"))
        db.session.execute(text("DELETE FROM messages"))
        db.session.execute(text("DELETE FROM conversation_threads"))
        db.session.execute(text("DELETE FROM invitations"))
        db.session.execute(text("DELETE FROM job_applications"))
        db.session.execute(text("DELETE FROM employer_candidate_favorites"))
        db.session.execute(text("DELETE FROM candidate_tags"))
        db.session.execute(text("DELETE FROM job_tags"))
        db.session.execute(text("DELETE FROM headhunting_requests"))
        db.session.execute(text("DELETE FROM subscriptions"))
        db.session.execute(text("DELETE FROM candidates"))
        db.session.execute(text("DELETE FROM jobs"))
        db.session.execute(text("DELETE FROM users"))
        db.session.commit()
        print("  → All test data cleared.")

        # ── Step 2: Admin user ─────────────────────────────────────────
        print("\n[2/6] Creating admin user...")
        admin = User(
            email="admin@acetalent.com",
            role="admin",
            name="平台管理员",
            company_name=None,
        )
        admin.set_password("Admin@2026!")
        db.session.add(admin)
        db.session.flush()
        print(f"  → Admin: {admin.email} / Admin@2026!")

        # ── Step 3: Employer users + subscriptions ─────────────────────
        print("\n[3/6] Creating employer users + subscriptions...")
        employer_users = []
        for idx, emp in enumerate(EMPLOYERS):
            u = User(
                email=f"{emp['domain']}@{emp['domain']}.acetalent.com",
                role="employer",
                name=f"{emp['name'][:4]}HR负责人",
                company_name=emp["name"],
            )
            u.set_password("Employer@2026!")
            db.session.add(u)
            db.session.flush()

            # active subscription covering all functions and all areas
            sub = Subscription(
                employer_id=u.id,
                status="active",
                plan_type="annual",
                tier="enterprise",
                function_codes=["ALL"],
                business_area_codes=["ALL"],
                starts_at=datetime.now(timezone.utc) - timedelta(days=30),
                ends_at=datetime.now(timezone.utc) + timedelta(days=335),
            )
            db.session.add(sub)
            employer_users.append(u)
        db.session.commit()
        print(f"  → Created {len(employer_users)} employers, each with an active enterprise subscription.")

        # ── Step 4: 200 Candidate users + profiles ─────────────────────
        print("\n[4/6] Creating 200 candidates...")
        func_keys = [f["code"] for f in FUNCTIONS]
        # distribute evenly across functions
        func_distribution = []
        per_func = 200 // len(func_keys)
        for fk in func_keys:
            func_distribution.extend([fk] * per_func)
        # fill remainder
        while len(func_distribution) < 200:
            func_distribution.append(random.choice(func_keys))
        random.shuffle(func_distribution)

        for i in range(200):
            func_key = func_distribution[i]
            cu = User(
                email=f"candidate_{i+1:04d}@test.acetalent.com",
                role="candidate",
                name=make_name("male" if random.random() < 0.55 else "female"),
            )
            cu.set_password("Cand@2026!")
            db.session.add(cu)
            db.session.flush()

            c = make_candidate(i + 1, cu.id, func_key)
            if i < 25:
                # 前 25 个：本周内（THIS WEEK 统计用）
                this_week_dt = rand_date_in_past(0, 4)
                c.created_at = this_week_dt
                c.updated_at = this_week_dt
                c.profile_confirmed_at = this_week_dt
            elif i < 85:
                # 25-84（共 60 个）：2025 年内，给 YTD 一个非零基数
                dt_2025 = rand_date_in_past(200, 500)
                c.created_at = dt_2025
                c.updated_at = dt_2025
                c.profile_confirmed_at = dt_2025
            db.session.add(c)

            if (i + 1) % 50 == 0:
                db.session.commit()
                print(f"  → {i+1}/200 candidates done")

        db.session.commit()
        print("  → 200 candidates created.")

        # ── Step 5: 200 Jobs distributed across employers ──────────────
        print("\n[5/6] Creating 200 jobs...")
        job_func_distribution = []
        per_func_job = 200 // len(func_keys)
        for fk in func_keys:
            job_func_distribution.extend([fk] * per_func_job)
        while len(job_func_distribution) < 200:
            job_func_distribution.append(random.choice(func_keys))
        random.shuffle(job_func_distribution)

        for i in range(200):
            employer = employer_users[i % len(employer_users)]
            func_key = job_func_distribution[i]
            j = make_job(i + 1, employer, func_key)
            if i < 25:
                # 前 25 个：本周内（THIS WEEK 统计用）
                this_week_dt = rand_date_in_past(0, 4)
                j.created_at = this_week_dt
                j.updated_at = this_week_dt
            elif i < 75:
                # 25-74（共 50 个）：2025 年内，给 YTD 一个非零基数
                dt_2025 = rand_date_in_past(200, 500)
                j.created_at = dt_2025
                j.updated_at = dt_2025
            db.session.add(j)

            if (i + 1) % 50 == 0:
                db.session.commit()
                print(f"  → {i+1}/200 jobs done")

        db.session.commit()
        print("  → 200 jobs created.")

        # ── Step 6: Headhunting requests ──────────────────────────────
        print("\n[6/6] Creating headhunting requests...")
        # 10 personal
        for i in range(10):
            employer = employer_users[i % len(employer_users)]
            hr = make_personal_headhunting(i, employer)
            db.session.add(hr)
        # 10 team
        for i in range(10):
            employer = employer_users[(i + 3) % len(employer_users)]
            hr = make_team_headhunting(i, employer)
            db.session.add(hr)
        db.session.commit()
        print("  → 10 personal + 10 team headhunting requests created.")

        # ── Summary ────────────────────────────────────────────────────
        print("\n" + "=" * 60)
        print("SEED COMPLETE")
        print("=" * 60)
        from app.models.candidate import Candidate as C
        from app.models.job import Job as J
        print(f"  Users:                {User.query.count()}")
        print(f"    - admin:            {User.query.filter_by(role='admin').count()}")
        print(f"    - employer:         {User.query.filter_by(role='employer').count()}")
        print(f"    - candidate:        {User.query.filter_by(role='candidate').count()}")
        print(f"  Candidates:           {C.query.count()}")
        print(f"  Jobs (published):     {J.query.filter_by(status='published').count()}")
        print(f"  HeadhuntingRequests:  {HeadhuntingRequest.query.count()}")
        print(f"    - personal:         {HeadhuntingRequest.query.filter_by(service_type='personal').count()}")
        print(f"    - team:             {HeadhuntingRequest.query.filter_by(service_type='team').count()}")
        print(f"  Subscriptions:        {Subscription.query.count()}")
        print("\nTest logins:")
        print("  Admin:    admin@acetalent.com / Admin@2026!")
        print("  Employer: cosco@cosco.acetalent.com / Employer@2026!")
        print("  Candidate: candidate_0001@test.acetalent.com / Cand@2026!")


if __name__ == "__main__":
    main()
