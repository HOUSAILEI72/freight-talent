"""
Seed 10 candidates + 10 jobs for local testing.
Usage: python seed_test_data.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from app.extensions import db
from app.models.user import User
from app.models.candidate import Candidate
from app.models.job import Job
from datetime import datetime, timezone

app = create_app()

CANDIDATES = [
    {"full_name": "张明远", "gender": "male", "current_title": "海运操作经理", "current_company": "中远海运物流",
     "current_city": "上海", "expected_city": "上海", "experience_years": 12, "age": 35,
     "education": "本科 · 国际航运管理", "english_level": "CET-6",
     "business_type": "海运", "job_type": "操作",
     "function_code": "Sea", "function_name": "Sea",
     "business_area_code": "EAST_CHINA", "business_area_name": "East China",
     "location_code": "CN-31-0115", "location_name": "上海", "location_path": "China/上海",
     "location_type": "mainland_china",
     "knowledge_tags": ["国际海运条约", "提单操作", "港口调度"],
     "hard_skill_tags": ["Cargowise", "Excel", "ERP"],
     "soft_skill_tags": ["团队管理", "沟通协调"],
     "work_experiences": [
         {"period": "2018-至今", "title": "海运操作经理", "company_name": "中远海运物流"},
         {"period": "2014-2018", "title": "海运操作主管", "company_name": "中外运"},
     ],
     "education_experiences": [
         {"period": "2010-2014", "school": "上海海事大学", "major": "国际航运管理", "degree": "本科"},
     ],
     "certificates": ["国际货运代理资格证"],
     "current_responsibilities": "负责海运出口全流程管理，团队15人，年操作量20万TEU",
     "is_management_role": True, "management_headcount": 15,
     "current_salary_min": 30000, "current_salary_max": 40000, "current_salary_months": 13,
     "current_average_bonus_percent": 20, "current_has_year_end_bonus": True, "current_year_end_bonus_months": 2},

    {"full_name": "李思雨", "gender": "female", "current_title": "空运销售代表", "current_company": "DHL Global Forwarding",
     "current_city": "深圳", "expected_city": "深圳", "experience_years": 5, "age": 28,
     "education": "大专 · 物流管理", "english_level": "流利",
     "business_type": "空运", "job_type": "销售",
     "function_code": "Air", "function_name": "Air",
     "business_area_code": "SOUTH_CHINA", "business_area_name": "South China",
     "location_code": "CN-44-0305", "location_name": "深圳", "location_path": "China/广东省/深圳",
     "location_type": "mainland_china",
     "knowledge_tags": ["空运航线", "危险品运输", "IATA规则"],
     "hard_skill_tags": ["Salesforce", "Excel", "Cargowise"],
     "soft_skill_tags": ["谈判能力", "客户关系维护"],
     "work_experiences": [
         {"period": "2021-至今", "title": "空运销售代表", "company_name": "DHL Global Forwarding"},
         {"period": "2019-2021", "title": "销售助理", "company_name": "顺丰国际"},
     ],
     "education_experiences": [
         {"period": "2016-2019", "school": "深圳职业技术学院", "major": "物流管理", "degree": "大专"},
     ],
     "certificates": ["IATA危险品证书"],
     "current_responsibilities": "开发华南区空运客户，年销售额800万",
     "is_management_role": False,
     "current_salary_min": 15000, "current_salary_max": 20000, "current_salary_months": 13,
     "current_average_bonus_percent": 30, "current_has_year_end_bonus": True, "current_year_end_bonus_months": 3},

    {"full_name": "王建国", "gender": "male", "current_title": "报关部主管", "current_company": "上海欣海报关",
     "current_city": "上海", "expected_city": "上海", "experience_years": 15, "age": 42,
     "education": "本科 · 国际贸易", "english_level": "CET-4",
     "business_type": "报关", "job_type": "客服",
     "function_code": "Custom", "function_name": "Customs",
     "business_area_code": "EAST_CHINA", "business_area_name": "East China",
     "location_code": "CN-31-0115", "location_name": "上海", "location_path": "China/上海",
     "location_type": "mainland_china",
     "knowledge_tags": ["HS编码", "海关法规", "进出口通关", "保税区操作"],
     "hard_skill_tags": ["金关二期", "单一窗口", "Excel"],
     "soft_skill_tags": ["细致认真", "沟通能力"],
     "work_experiences": [
         {"period": "2015-至今", "title": "报关部主管", "company_name": "上海欣海报关"},
         {"period": "2010-2015", "title": "报关员", "company_name": "上海外轮代理"},
     ],
     "education_experiences": [
         {"period": "2006-2010", "school": "上海对外经贸大学", "major": "国际贸易", "degree": "本科"},
     ],
     "certificates": ["报关员资格证", "报检员资格证"],
     "current_responsibilities": "管理报关部日常运营，审核进出口报关单，处理海关查验异常",
     "is_management_role": True, "management_headcount": 8,
     "current_salary_min": 20000, "current_salary_max": 28000, "current_salary_months": 13,
     "current_average_bonus_percent": 15, "current_has_year_end_bonus": True, "current_year_end_bonus_months": 1},

    {"full_name": "陈晓峰", "gender": "male", "current_title": "陆运调度员", "current_company": "德邦物流",
     "current_city": "广州", "expected_city": "广州", "experience_years": 6, "age": 30,
     "education": "大专 · 交通运输", "english_level": "一般",
     "business_type": "陆运", "job_type": "操作",
     "function_code": "Land", "function_name": "Land",
     "business_area_code": "SOUTH_CHINA", "business_area_name": "South China",
     "location_code": "CN-44-0104", "location_name": "广州", "location_path": "China/广东省/广州",
     "location_type": "mainland_china",
     "knowledge_tags": ["车辆调度", "路线优化", "GPS追踪"],
     "hard_skill_tags": ["TMS系统", "Excel"],
     "soft_skill_tags": ["抗压能力", "应急处理"],
     "work_experiences": [
         {"period": "2020-至今", "title": "陆运调度员", "company_name": "德邦物流"},
         {"period": "2018-2020", "title": "运输助理", "company_name": "安能物流"},
     ],
     "education_experiences": [
         {"period": "2015-2018", "school": "广东交通职业技术学院", "major": "交通运输", "degree": "大专"},
     ],
     "certificates": [],
     "current_responsibilities": "负责珠三角区域车辆调度，日均调配50+车次",
     "is_management_role": False,
     "current_salary_min": 10000, "current_salary_max": 15000, "current_salary_months": 12,
     "current_average_bonus_percent": 10, "current_has_year_end_bonus": True, "current_year_end_bonus_months": 1},

    {"full_name": "刘芳华", "gender": "female", "current_title": "跨境电商物流专员", "current_company": "菜鸟网络",
     "current_city": "杭州", "expected_city": "杭州", "experience_years": 4, "age": 26,
     "education": "本科 · 电子商务", "english_level": "CET-6",
     "business_type": "综合物流", "job_type": "销售",
     "function_code": "ECOMS", "function_name": "ECOMS",
     "business_area_code": "EAST_CHINA", "business_area_name": "East China",
     "location_code": "CN-33-0108", "location_name": "杭州", "location_path": "China/浙江省/杭州",
     "location_type": "mainland_china",
     "knowledge_tags": ["跨境电商", "FBA头程", "海外仓", "9610/9710报关"],
     "hard_skill_tags": ["ERP", "Excel", "Python"],
     "soft_skill_tags": ["学习能力", "数据分析"],
     "work_experiences": [
         {"period": "2022-至今", "title": "跨境电商物流专员", "company_name": "菜鸟网络"},
         {"period": "2020-2022", "title": "物流运营助理", "company_name": "百世国际"},
     ],
     "education_experiences": [
         {"period": "2016-2020", "school": "浙江工商大学", "major": "电子商务", "degree": "本科"},
     ],
     "certificates": [],
     "current_responsibilities": "管理跨境电商物流渠道，优化FBA头程时效和成本",
     "is_management_role": False,
     "current_salary_min": 12000, "current_salary_max": 18000, "current_salary_months": 14,
     "current_average_bonus_percent": 20, "current_has_year_end_bonus": True, "current_year_end_bonus_months": 2},

    {"full_name": "赵志强", "gender": "male", "current_title": "铁路货运经理", "current_company": "中铁集装箱运输",
     "current_city": "郑州", "expected_city": "郑州", "experience_years": 10, "age": 38,
     "education": "本科 · 铁道运输", "english_level": "CET-4",
     "business_type": "铁路", "job_type": "操作",
     "function_code": "Railway", "function_name": "Railway",
     "business_area_code": "CENTRAL_CHINA", "business_area_name": "Central China",
     "location_code": "CN-41-0105", "location_name": "郑州", "location_path": "China/河南省/郑州",
     "location_type": "mainland_china",
     "knowledge_tags": ["中欧班列", "铁路联运", "集装箱管理"],
     "hard_skill_tags": ["铁路TMIS系统", "Excel"],
     "soft_skill_tags": ["计划组织", "跨部门协调"],
     "work_experiences": [
         {"period": "2018-至今", "title": "铁路货运经理", "company_name": "中铁集装箱运输"},
         {"period": "2014-2018", "title": "货运主管", "company_name": "郑州铁路局"},
     ],
     "education_experiences": [
         {"period": "2008-2012", "school": "西南交通大学", "major": "铁道运输", "degree": "本科"},
     ],
     "certificates": ["铁路货运员资格证"],
     "current_responsibilities": "负责中欧班列线路运营，年发运量300列",
     "is_management_role": True, "management_headcount": 12,
     "current_salary_min": 22000, "current_salary_max": 30000, "current_salary_months": 13,
     "current_average_bonus_percent": 15, "current_has_year_end_bonus": True, "current_year_end_bonus_months": 2},

    {"full_name": "周美琪", "gender": "female", "current_title": "海运客服主管", "current_company": "马士基航运",
     "current_city": "青岛", "expected_city": "青岛", "experience_years": 8, "age": 32,
     "education": "本科 · 英语", "english_level": "专业八级",
     "business_type": "海运", "job_type": "客服",
     "function_code": "Sea", "function_name": "Sea",
     "business_area_code": "NORTH_CHINA", "business_area_name": "North China",
     "location_code": "CN-37-0203", "location_name": "青岛", "location_path": "China/山东省/青岛",
     "location_type": "mainland_china",
     "knowledge_tags": ["海运进出口", "客户服务", "订舱流程"],
     "hard_skill_tags": ["Cargowise", "SAP", "Excel"],
     "soft_skill_tags": ["英语沟通", "客户服务意识", "问题解决"],
     "work_experiences": [
         {"period": "2020-至今", "title": "海运客服主管", "company_name": "马士基航运"},
         {"period": "2016-2020", "title": "客服专员", "company_name": "地中海航运MSC"},
     ],
     "education_experiences": [
         {"period": "2012-2016", "school": "中国海洋大学", "major": "英语", "degree": "本科"},
     ],
     "certificates": ["英语专业八级"],
     "current_responsibilities": "对接海外代理，处理指定货客服事务，团队6人",
     "is_management_role": True, "management_headcount": 6,
     "current_salary_min": 18000, "current_salary_max": 25000, "current_salary_months": 13,
     "current_average_bonus_percent": 15, "current_has_year_end_bonus": True, "current_year_end_bonus_months": 1},

    {"full_name": "吴明辉", "gender": "male", "current_title": "合同物流项目经理", "current_company": "中外运合同物流",
     "current_city": "苏州", "expected_city": "苏州", "experience_years": 9, "age": 34,
     "education": "硕士 · 物流工程", "english_level": "CET-6",
     "business_type": "合同物流", "job_type": "管理",
     "function_code": "Contract Logistics", "function_name": "Contract Logistics",
     "business_area_code": "EAST_CHINA", "business_area_name": "East China",
     "location_code": "CN-32-0508", "location_name": "苏州", "location_path": "China/江苏省/苏州",
     "location_type": "mainland_china",
     "knowledge_tags": ["合同物流", "仓储管理", "运输优化", "KPI管理"],
     "hard_skill_tags": ["WMS", "TMS", "SQL", "PowerBI"],
     "soft_skill_tags": ["项目管理", "团队领导", "客户管理"],
     "work_experiences": [
         {"period": "2021-至今", "title": "合同物流项目经理", "company_name": "中外运合同物流"},
         {"period": "2017-2021", "title": "物流方案工程师", "company_name": "京东物流"},
     ],
     "education_experiences": [
         {"period": "2015-2017", "school": "北京交通大学", "major": "物流工程", "degree": "硕士"},
         {"period": "2011-2015", "school": "长安大学", "major": "物流管理", "degree": "本科"},
     ],
     "certificates": ["PMP项目管理认证"],
     "current_responsibilities": "负责500强客户合同物流项目管理，年合同额3000万",
     "is_management_role": True, "management_headcount": 20,
     "current_salary_min": 25000, "current_salary_max": 35000, "current_salary_months": 14,
     "current_average_bonus_percent": 25, "current_has_year_end_bonus": True, "current_year_end_bonus_months": 3},

    {"full_name": "孙丽萍", "gender": "female", "current_title": "货代操作员", "current_company": "深圳华运国际物流",
     "current_city": "深圳", "expected_city": "深圳", "experience_years": 3, "age": 25,
     "education": "大专 · 商务英语", "english_level": "CET-4",
     "business_type": "海运", "job_type": "操作",
     "function_code": "Sea", "function_name": "Sea",
     "business_area_code": "SOUTH_CHINA", "business_area_name": "South China",
     "location_code": "CN-44-0305", "location_name": "深圳", "location_path": "China/广东省/深圳",
     "location_type": "mainland_china",
     "knowledge_tags": ["海运操作", "订舱", "拖车报关"],
     "hard_skill_tags": ["Cargowise", "Excel"],
     "soft_skill_tags": ["细心", "执行力"],
     "work_experiences": [
         {"period": "2023-至今", "title": "货代操作员", "company_name": "深圳华运国际物流"},
         {"period": "2021-2023", "title": "操作助理", "company_name": "深圳鹏程物流"},
     ],
     "education_experiences": [
         {"period": "2018-2021", "school": "深圳信息职业技术学院", "major": "商务英语", "degree": "大专"},
     ],
     "certificates": [],
     "current_responsibilities": "负责美线海运出口操作，月均处理100票",
     "is_management_role": False,
     "current_salary_min": 8000, "current_salary_max": 12000, "current_salary_months": 12,
     "current_average_bonus_percent": 10, "current_has_year_end_bonus": True, "current_year_end_bonus_months": 1},

    {"full_name": "黄伟杰", "gender": "male", "current_title": "供应链分析师", "current_company": "UPS Supply Chain",
     "current_city": "香港", "expected_city": "香港", "experience_years": 7, "age": 31,
     "education": "硕士 · 供应链管理", "english_level": "流利",
     "business_type": "综合物流", "job_type": "管理",
     "function_code": "Contract Logistics", "function_name": "Contract Logistics",
     "business_area_code": "HONG_KONG", "business_area_name": "Hong Kong",
     "location_code": "HK", "location_name": "香港", "location_path": "Hong Kong",
     "location_type": "special_region",
     "knowledge_tags": ["供应链优化", "库存管理", "需求预测"],
     "hard_skill_tags": ["SAP", "SQL", "Tableau", "Python"],
     "soft_skill_tags": ["分析思维", "跨文化沟通", "汇报能力"],
     "work_experiences": [
         {"period": "2021-至今", "title": "供应链分析师", "company_name": "UPS Supply Chain"},
         {"period": "2019-2021", "title": "物流数据分析师", "company_name": "嘉里物流"},
     ],
     "education_experiences": [
         {"period": "2017-2019", "school": "香港理工大学", "major": "供应链管理", "degree": "硕士"},
         {"period": "2013-2017", "school": "中山大学", "major": "物流管理", "degree": "本科"},
     ],
     "certificates": ["CSCP供应链专业认证"],
     "current_responsibilities": "亚太区供应链网络优化，数据驱动决策支持",
     "is_management_role": False,
     "current_salary_min": 35000, "current_salary_max": 45000, "current_salary_months": 13,
     "current_average_bonus_percent": 20, "current_has_year_end_bonus": True, "current_year_end_bonus_months": 2},
]

JOBS = [
    {"title": "海运出口操作经理", "city": "上海",
     "business_type": "海运", "job_type": "操作",
     "function_code": "Sea", "function_name": "Sea",
     "business_area_code": "EAST_CHINA", "business_area_name": "East China",
     "location_code": "CN-31-0115", "location_name": "上海", "location_path": "China/上海",
     "location_type": "mainland_china",
     "description": "负责海运出口操作团队管理，包括订舱、报关、拖车全流程协调，确保货物准时出运。",
     "experience_required": "5-10年", "degree_required": "本科",
     "headcount": 2, "urgency_level": 2,
     "salary_min": 25000, "salary_max": 35000, "salary_months": 13,
     "average_bonus_percent": 20, "has_year_end_bonus": True, "year_end_bonus_months": 2,
     "is_management_role": True, "management_headcount": 10,
     "knowledge_requirements": ["国际海运条约", "提单操作", "港口调度"],
     "hard_skill_requirements": ["Cargowise", "ERP"],
     "soft_skill_requirements": ["团队管理", "沟通协调"],
     "commission_bonus_period": "not_applicable"},

    {"title": "空运销售经理", "city": "深圳",
     "business_type": "空运", "job_type": "销售",
     "function_code": "Air", "function_name": "Air",
     "business_area_code": "SOUTH_CHINA", "business_area_name": "South China",
     "location_code": "CN-44-0305", "location_name": "深圳", "location_path": "China/广东省/深圳",
     "location_type": "mainland_china",
     "description": "开拓华南区空运市场，维护大客户关系，完成年度销售指标。",
     "experience_required": "3-5年", "degree_required": "大专",
     "headcount": 3, "urgency_level": 1,
     "salary_min": 12000, "salary_max": 20000, "salary_months": 13,
     "average_bonus_percent": 40, "has_year_end_bonus": True, "year_end_bonus_months": 3,
     "is_management_role": False,
     "knowledge_requirements": ["空运航线", "危险品运输"],
     "hard_skill_requirements": ["Salesforce", "Cargowise"],
     "soft_skill_requirements": ["谈判能力", "客户关系维护"],
     "commission_bonus_period": "quarterly", "commission_bonus_amount": 5000},

    {"title": "报关主管", "city": "上海",
     "business_type": "报关", "job_type": "客服",
     "function_code": "Custom", "function_name": "Customs",
     "business_area_code": "EAST_CHINA", "business_area_name": "East China",
     "location_code": "CN-31-0115", "location_name": "上海", "location_path": "China/上海",
     "location_type": "mainland_china",
     "description": "管理报关团队，审核进出口报关单，处理海关查验及异常，确保合规通关。",
     "experience_required": "5-10年", "degree_required": "大专",
     "headcount": 1, "urgency_level": 2,
     "salary_min": 18000, "salary_max": 25000, "salary_months": 13,
     "average_bonus_percent": 15, "has_year_end_bonus": True, "year_end_bonus_months": 1,
     "is_management_role": True, "management_headcount": 5,
     "knowledge_requirements": ["HS编码", "海关法规", "进出口通关"],
     "hard_skill_requirements": ["金关二期", "单一窗口"],
     "soft_skill_requirements": ["细致认真", "沟通能力"],
     "commission_bonus_period": "not_applicable"},

    {"title": "跨境电商物流运营", "city": "杭州",
     "business_type": "综合物流", "job_type": "销售",
     "function_code": "ECOMS", "function_name": "ECOMS",
     "business_area_code": "EAST_CHINA", "business_area_name": "East China",
     "location_code": "CN-33-0108", "location_name": "杭州", "location_path": "China/浙江省/杭州",
     "location_type": "mainland_china",
     "description": "负责跨境电商物流渠道运营，优化FBA头程及海外仓配送方案。",
     "experience_required": "1-3年", "degree_required": "本科",
     "headcount": 2, "urgency_level": 1,
     "salary_min": 10000, "salary_max": 18000, "salary_months": 14,
     "average_bonus_percent": 25, "has_year_end_bonus": True, "year_end_bonus_months": 2,
     "is_management_role": False,
     "knowledge_requirements": ["跨境电商", "FBA头程", "海外仓"],
     "hard_skill_requirements": ["ERP", "Python"],
     "soft_skill_requirements": ["学习能力", "数据分析"],
     "commission_bonus_period": "quarterly", "commission_bonus_amount": 3000},

    {"title": "中欧班列运营经理", "city": "郑州",
     "business_type": "铁路", "job_type": "操作",
     "function_code": "Railway", "function_name": "Railway",
     "business_area_code": "CENTRAL_CHINA", "business_area_name": "Central China",
     "location_code": "CN-41-0105", "location_name": "郑州", "location_path": "China/河南省/郑州",
     "location_type": "mainland_china",
     "description": "负责中欧班列线路规划与运营管理，协调铁路、海关及境外合作伙伴。",
     "experience_required": "5-10年", "degree_required": "本科",
     "headcount": 1, "urgency_level": 2,
     "salary_min": 20000, "salary_max": 30000, "salary_months": 13,
     "average_bonus_percent": 15, "has_year_end_bonus": True, "year_end_bonus_months": 2,
     "is_management_role": True, "management_headcount": 8,
     "knowledge_requirements": ["中欧班列", "铁路联运", "集装箱管理"],
     "hard_skill_requirements": ["铁路TMIS系统"],
     "soft_skill_requirements": ["计划组织", "跨部门协调"],
     "commission_bonus_period": "not_applicable"},

    {"title": "海运客服专员", "city": "青岛",
     "business_type": "海运", "job_type": "客服",
     "function_code": "Sea", "function_name": "Sea",
     "business_area_code": "NORTH_CHINA", "business_area_name": "North China",
     "location_code": "CN-37-0203", "location_name": "青岛", "location_path": "China/山东省/青岛",
     "location_type": "mainland_china",
     "description": "对接海外代理及直客，处理订舱、跟踪、异常反馈等全流程客服工作。",
     "experience_required": "1-3年", "degree_required": "大专",
     "headcount": 2, "urgency_level": 2,
     "salary_min": 8000, "salary_max": 12000, "salary_months": 13,
     "average_bonus_percent": 15, "has_year_end_bonus": True, "year_end_bonus_months": 1,
     "is_management_role": False,
     "knowledge_requirements": ["海运进出口", "客户服务", "订舱流程"],
     "hard_skill_requirements": ["Cargowise", "SAP"],
     "soft_skill_requirements": ["英语沟通", "客户服务意识"],
     "commission_bonus_period": "not_applicable"},

    {"title": "合同物流项目经理", "city": "苏州",
     "business_type": "合同物流", "job_type": "管理",
     "function_code": "Contract Logistics", "function_name": "Contract Logistics",
     "business_area_code": "EAST_CHINA", "business_area_name": "East China",
     "location_code": "CN-32-0508", "location_name": "苏州", "location_path": "China/江苏省/苏州",
     "location_type": "mainland_china",
     "description": "负责大客户合同物流项目全生命周期管理，包括方案设计、实施落地及KPI达成。",
     "experience_required": "5-10年", "degree_required": "本科",
     "headcount": 1, "urgency_level": 2,
     "salary_min": 25000, "salary_max": 38000, "salary_months": 14,
     "average_bonus_percent": 25, "has_year_end_bonus": True, "year_end_bonus_months": 3,
     "is_management_role": True, "management_headcount": 15,
     "knowledge_requirements": ["合同物流", "仓储管理", "运输优化"],
     "hard_skill_requirements": ["WMS", "TMS", "SQL"],
     "soft_skill_requirements": ["项目管理", "团队领导", "客户管理"],
     "commission_bonus_period": "semi_annual", "commission_bonus_amount": 10000},

    {"title": "陆运调度主管", "city": "广州",
     "business_type": "陆运", "job_type": "操作",
     "function_code": "Land", "function_name": "Land",
     "business_area_code": "SOUTH_CHINA", "business_area_name": "South China",
     "location_code": "CN-44-0104", "location_name": "广州", "location_path": "China/广东省/广州",
     "location_type": "mainland_china",
     "description": "负责珠三角区域陆运调度管理，优化路线降低成本，确保时效达标。",
     "experience_required": "3-5年", "degree_required": "大专",
     "headcount": 1, "urgency_level": 1,
     "salary_min": 12000, "salary_max": 18000, "salary_months": 12,
     "average_bonus_percent": 10, "has_year_end_bonus": True, "year_end_bonus_months": 1,
     "is_management_role": True, "management_headcount": 4,
     "knowledge_requirements": ["车辆调度", "路线优化", "GPS追踪"],
     "hard_skill_requirements": ["TMS系统"],
     "soft_skill_requirements": ["抗压能力", "应急处理"],
     "commission_bonus_period": "not_applicable"},

    {"title": "供应链数据分析师", "city": "香港",
     "business_type": "综合物流", "job_type": "管理",
     "function_code": "Contract Logistics", "function_name": "Contract Logistics",
     "business_area_code": "HONG_KONG", "business_area_name": "Hong Kong",
     "location_code": "HK", "location_name": "香港", "location_path": "Hong Kong",
     "location_type": "special_region",
     "description": "亚太区供应链数据分析，支持网络优化决策，搭建BI看板。",
     "experience_required": "3-5年", "degree_required": "硕士",
     "headcount": 1, "urgency_level": 2,
     "salary_min": 30000, "salary_max": 45000, "salary_months": 13,
     "average_bonus_percent": 20, "has_year_end_bonus": True, "year_end_bonus_months": 2,
     "is_management_role": False,
     "knowledge_requirements": ["供应链优化", "库存管理", "需求预测"],
     "hard_skill_requirements": ["SAP", "SQL", "Tableau", "Python"],
     "soft_skill_requirements": ["分析思维", "跨文化沟通"],
     "commission_bonus_period": "not_applicable"},

    {"title": "货代销售代表", "city": "上海",
     "business_type": "海运", "job_type": "销售",
     "function_code": "Sea", "function_name": "Sea",
     "business_area_code": "EAST_CHINA", "business_area_name": "East China",
     "location_code": "CN-31-0115", "location_name": "上海", "location_path": "China/上海",
     "location_type": "mainland_china",
     "description": "开发新客户，维护老客户关系，推广公司海运/空运/铁路全线产品。",
     "experience_required": "1年以内", "degree_required": "大专",
     "headcount": 5, "urgency_level": 1,
     "salary_min": 6000, "salary_max": 12000, "salary_months": 12,
     "average_bonus_percent": 60, "has_year_end_bonus": False, "year_end_bonus_months": 0,
     "is_management_role": False,
     "knowledge_requirements": ["海运进出口", "空运基础"],
     "hard_skill_requirements": ["Excel"],
     "soft_skill_requirements": ["沟通能力", "抗压能力"],
     "commission_bonus_period": "monthly", "commission_bonus_amount": 2000},
]


def seed():
    with app.app_context():
        now = datetime.now(timezone.utc)

        # ── Create employer ──────────────────────────────────────────────
        emp = User.query.filter_by(email="employer@test.com").first()
        if not emp:
            emp = User(email="employer@test.com", role="employer",
                       name="测试企业", company_name="ACE Logistics 测试公司",
                       is_active=True)
            emp.set_password("test123456")
            db.session.add(emp)
            db.session.commit()
            print(f"[OK] Employer created: employer@test.com / test123456 (id={emp.id})")
        else:
            print(f"[SKIP] Employer exists: id={emp.id}")

        # ── Create candidates ────────────────────────────────────────────
        created_candidates = 0
        for i, c in enumerate(CANDIDATES, start=1):
            email = f"candidate{i:02d}@test.com"
            user = User.query.filter_by(email=email).first()
            if user:
                print(f"[SKIP] Candidate user exists: {email}")
                continue

            user = User(email=email, role="candidate", name=c["full_name"], is_active=True)
            user.set_password("test123456")
            db.session.add(user)
            db.session.flush()

            profile = Candidate(
                user_id=user.id,
                full_name=c["full_name"],
                gender=c.get("gender"),
                current_title=c["current_title"],
                current_company=c["current_company"],
                current_city=c["current_city"],
                expected_city=c["expected_city"],
                experience_years=c["experience_years"],
                age=c["age"],
                education=c["education"],
                english_level=c["english_level"],
                business_type=c["business_type"],
                job_type=c["job_type"],
                function_code=c.get("function_code"),
                function_name=c.get("function_name"),
                business_area_code=c.get("business_area_code"),
                business_area_name=c.get("business_area_name"),
                location_code=c.get("location_code"),
                location_name=c.get("location_name"),
                location_path=c.get("location_path"),
                location_type=c.get("location_type"),
                knowledge_tags=c.get("knowledge_tags", []),
                hard_skill_tags=c.get("hard_skill_tags", []),
                soft_skill_tags=c.get("soft_skill_tags", []),
                work_experiences=c.get("work_experiences", []),
                education_experiences=c.get("education_experiences", []),
                certificates=c.get("certificates", []),
                current_responsibilities=c.get("current_responsibilities"),
                is_management_role=c.get("is_management_role"),
                management_headcount=c.get("management_headcount"),
                current_salary_min=c.get("current_salary_min"),
                current_salary_max=c.get("current_salary_max"),
                current_salary_months=c.get("current_salary_months"),
                current_average_bonus_percent=c.get("current_average_bonus_percent"),
                current_has_year_end_bonus=c.get("current_has_year_end_bonus"),
                current_year_end_bonus_months=c.get("current_year_end_bonus_months"),
                availability_status="open",
                email=email,
                phone=f"1380000{i:04d}",
                contact_visible=True,
                profile_status="complete",
                profile_confirmed_at=now,
                last_active_at=now,
            )
            db.session.add(profile)
            created_candidates += 1
            print(f"[OK] Candidate #{i}: {c['full_name']} ({email})")

        db.session.commit()
        print(f"\n[OK] {created_candidates} candidates created")

        # ── Create jobs ──────────────────────────────────────────────────
        created_jobs = 0
        for i, j in enumerate(JOBS, start=1):
            job = Job(
                company_id=emp.id,
                title=j["title"],
                city=j["city"],
                business_type=j["business_type"],
                job_type=j["job_type"],
                function_code=j.get("function_code"),
                function_name=j.get("function_name"),
                business_area_code=j.get("business_area_code"),
                business_area_name=j.get("business_area_name"),
                location_code=j.get("location_code"),
                location_name=j.get("location_name"),
                location_path=j.get("location_path"),
                location_type=j.get("location_type"),
                description=j["description"],
                experience_required=j.get("experience_required"),
                degree_required=j.get("degree_required"),
                headcount=j.get("headcount", 1),
                urgency_level=j.get("urgency_level", 2),
                salary_min=j.get("salary_min"),
                salary_max=j.get("salary_max"),
                salary_months=j.get("salary_months"),
                average_bonus_percent=j.get("average_bonus_percent"),
                has_year_end_bonus=j.get("has_year_end_bonus"),
                year_end_bonus_months=j.get("year_end_bonus_months"),
                is_management_role=j.get("is_management_role"),
                management_headcount=j.get("management_headcount"),
                knowledge_requirements=j.get("knowledge_requirements", []),
                hard_skill_requirements=j.get("hard_skill_requirements", []),
                soft_skill_requirements=j.get("soft_skill_requirements", []),
                commission_bonus_period=j.get("commission_bonus_period"),
                commission_bonus_amount=j.get("commission_bonus_amount"),
                status="published",
            )
            db.session.add(job)
            created_jobs += 1
            print(f"[OK] Job #{i}: {j['title']}")

        db.session.commit()
        print(f"\n[OK] {created_jobs} jobs created")

        print("\n=== SEED COMPLETE ===")
        print("Login accounts (password: test123456):")
        print("  employer@test.com   — 企业账号")
        for i in range(1, 11):
            print(f"  candidate{i:02d}@test.com — 候选人账号")


if __name__ == "__main__":
    seed()
