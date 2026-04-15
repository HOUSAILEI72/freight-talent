from datetime import datetime, timezone
from app.extensions import db


class Candidate(db.Model):
    __tablename__ = "candidates"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, unique=True, index=True
    )

    # 基本信息
    full_name = db.Column(db.String(60), nullable=False)
    current_title = db.Column(db.String(100), nullable=False)
    current_company = db.Column(db.String(100), nullable=True)
    current_city = db.Column(db.String(50), nullable=False)
    expected_city = db.Column(db.String(50), nullable=True)
    expected_salary_min = db.Column(db.Integer, nullable=True)   # 元/月
    expected_salary_max = db.Column(db.Integer, nullable=True)
    expected_salary_label = db.Column(db.String(30), nullable=True)  # "18k-25k" / "面议"

    experience_years = db.Column(db.Integer, nullable=True)
    education = db.Column(db.String(100), nullable=True)   # "本科 · 国际贸易"
    english_level = db.Column(db.String(30), nullable=True)  # "CET-6" / "流利" / "一般"

    summary = db.Column(db.Text, nullable=True)

    # 货代行业分类
    business_type = db.Column(db.String(50), nullable=True)   # "海运" / "空运"
    job_type = db.Column(db.String(50), nullable=True)         # "操作" / "销售"

    # 标签（JSON）
    route_tags = db.Column(db.JSON, nullable=True)   # ["美线","欧线"]
    skill_tags = db.Column(db.JSON, nullable=True)   # ["Cargowise","英语"]

    # 求职状态
    availability_status = db.Column(
        db.Enum("open", "passive", "closed", name="availability_status"),
        nullable=False,
        default="open",
    )

    # 简历文件
    resume_file_path = db.Column(db.String(300), nullable=True)
    resume_file_name = db.Column(db.String(200), nullable=True)   # 原始文件名
    resume_uploaded_at = db.Column(db.DateTime, nullable=True)

    # 时间戳
    profile_confirmed_at = db.Column(db.DateTime, nullable=True)  # 最近一次确认发布
    last_active_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = db.relationship("User", backref=db.backref("candidate_profile", uselist=False))

    def all_tags(self):
        return (self.skill_tags or []) + (self.route_tags or [])

    def freshness_days(self):
        """距最近一次档案确认的天数，用于鲜度显示。"""
        ref = self.profile_confirmed_at or self.created_at
        if not ref:
            return 999
        delta = datetime.now(timezone.utc) - ref.replace(tzinfo=timezone.utc)
        return max(0, delta.days)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "full_name": self.full_name,
            "current_title": self.current_title,
            "current_company": self.current_company,
            "current_city": self.current_city,
            "expected_city": self.expected_city,
            "expected_salary_min": self.expected_salary_min,
            "expected_salary_max": self.expected_salary_max,
            "expected_salary_label": self.expected_salary_label,
            "experience_years": self.experience_years,
            "education": self.education,
            "english_level": self.english_level,
            "summary": self.summary,
            "business_type": self.business_type,
            "job_type": self.job_type,
            "route_tags": self.route_tags or [],
            "skill_tags": self.skill_tags or [],
            "all_tags": self.all_tags(),
            "availability_status": self.availability_status,
            "resume_file_name": self.resume_file_name,
            "resume_uploaded_at": (
                self.resume_uploaded_at.isoformat() if self.resume_uploaded_at else None
            ),
            "profile_confirmed_at": (
                self.profile_confirmed_at.isoformat() if self.profile_confirmed_at else None
            ),
            "freshness_days": self.freshness_days(),
            "last_active_at": (
                self.last_active_at.isoformat() if self.last_active_at else None
            ),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
