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
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
