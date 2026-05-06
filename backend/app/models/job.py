from datetime import datetime, timezone
from app.extensions import db


class Job(db.Model):
    __tablename__ = "jobs"

    id = db.Column(db.Integer, primary_key=True)

    # 发布者（employers 对应 users 表）
    company_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    # 基本信息
    title = db.Column(db.String(100), nullable=False)
    city = db.Column(db.String(50), nullable=False)
    # 三级行政区（来自 "省市区" 字段，用 - 分隔上传）。city 字段保留兼容用，等同于 city_name。
    province  = db.Column(db.String(50), nullable=True, index=True)
    city_name = db.Column(db.String(50), nullable=True, index=True)
    district  = db.Column(db.String(50), nullable=True, index=True)
    salary_min = db.Column(db.Integer, nullable=True)   # 单位：元/月
    salary_max = db.Column(db.Integer, nullable=True)
    salary_label = db.Column(db.String(30), nullable=True)   # 原始薪资文字，如 "20k-30k" / "面议"

    experience_required = db.Column(db.String(50), nullable=True)   # 如 "3年以上"
    degree_required = db.Column(db.String(30), nullable=True)        # 如 "本科"
    headcount = db.Column(db.Integer, nullable=True, default=1)

    description = db.Column(db.Text, nullable=False)
    requirements = db.Column(db.Text, nullable=True)

    # 货代行业分类
    business_type = db.Column(db.String(50), nullable=True)   # 如 "海运" / "空运" / "报关"
    job_type = db.Column(db.String(50), nullable=True)         # 如 "操作" / "销售" / "客服"

    # 标签（JSON 数组存字符串，简单实用）
    route_tags = db.Column(db.JSON, nullable=True)    # 如 ["美线","欧线"]
    skill_tags = db.Column(db.JSON, nullable=True)    # 如 ["Cargowise","英语"]

    urgency_level = db.Column(db.Integer, nullable=True, default=2)   # 1紧急 2正常 3不急

    # ── Phase C: Standard location + business area ──
    location_code      = db.Column(db.String(50), nullable=True, index=True)
    location_name      = db.Column(db.String(100), nullable=True)
    location_path      = db.Column(db.String(255), nullable=True)
    location_type      = db.Column(db.String(50), nullable=True)
    business_area_code = db.Column(db.String(50), nullable=True, index=True)
    business_area_name = db.Column(db.String(100), nullable=True)

    # ── Phase C: Function (sector) ──
    function_code      = db.Column(db.String(50), nullable=True)
    function_name      = db.Column(db.String(100), nullable=True)

    # ── Phase C: Management flag ──
    is_management_role = db.Column(db.Boolean, nullable=True)

    # ── Phase C: Knowledge / skill arrays ──
    knowledge_requirements  = db.Column(db.JSON, nullable=True)
    hard_skill_requirements = db.Column(db.JSON, nullable=True)
    soft_skill_requirements = db.Column(db.JSON, nullable=True)

    # ── Phase C: Salary structure ──
    salary_months         = db.Column(db.Integer, nullable=True)
    average_bonus_percent = db.Column(db.Float, nullable=True)
    has_year_end_bonus    = db.Column(db.Boolean, nullable=True)
    year_end_bonus_months = db.Column(db.Float, nullable=True)

    # 状态
    status = db.Column(
        db.Enum("draft", "published", "paused", "closed", name="job_status"),
        nullable=False,
        default="published",
    )

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # 关联 user（方便 JOIN 取公司名）
    company = db.relationship("User", backref=db.backref("jobs", lazy="dynamic"))

    def to_dict(self):
        return {
            "id": self.id,
            "company_id": self.company_id,
            "company_name": self.company.company_name if self.company else None,
            "title": self.title,
            "city": self.city,
            "province": self.province,
            "city_name": self.city_name,
            "district": self.district,
            "salary_min": self.salary_min,
            "salary_max": self.salary_max,
            "salary_label": self.salary_label,
            "experience_required": self.experience_required,
            "degree_required": self.degree_required,
            "headcount": self.headcount,
            "description": self.description,
            "requirements": self.requirements,
            "business_type": self.business_type,
            "job_type": self.job_type,
            "route_tags": self.route_tags or [],
            "skill_tags": self.skill_tags or [],
            "urgency_level": self.urgency_level,
            "location_code": self.location_code,
            "location_name": self.location_name,
            "location_path": self.location_path,
            "location_type": self.location_type,
            "business_area_code": self.business_area_code,
            "business_area_name": self.business_area_name,
            "function_code": self.function_code,
            "function_name": self.function_name,
            "is_management_role": self.is_management_role,
            "knowledge_requirements": self.knowledge_requirements or [],
            "hard_skill_requirements": self.hard_skill_requirements or [],
            "soft_skill_requirements": self.soft_skill_requirements or [],
            "salary_months": self.salary_months,
            "average_bonus_percent": self.average_bonus_percent,
            "has_year_end_bonus": self.has_year_end_bonus,
            "year_end_bonus_months": self.year_end_bonus_months,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
