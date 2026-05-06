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
    age              = db.Column(db.Integer, nullable=True)
    education = db.Column(db.String(100), nullable=True)   # "本科 · 国际贸易"
    english_level = db.Column(db.String(30), nullable=True)  # "CET-6" / "流利" / "一般"

    summary = db.Column(db.Text, nullable=True)

    # 多条结构化经历（JSON 数组）
    # 每条 work_experience: {"period": "2020-2024", "title": "...", "company": "..."}
    # 每条 education_experience: {"period": "2014-2018", "school": "...", "major": "...", "degree": "..."}
    work_experiences      = db.Column(db.JSON, nullable=True)
    education_experiences = db.Column(db.JSON, nullable=True)
    certificates          = db.Column(db.JSON, nullable=True)   # ["国际货代证","报关员"]

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

    # 联系信息（候选人控制是否对企业可见）
    email = db.Column(db.String(120), nullable=True)
    phone = db.Column(db.String(30), nullable=True)
    address = db.Column(db.String(200), nullable=True)
    contact_visible = db.Column(db.Boolean, nullable=False, default=False)

    # ── Phase C: Standard location + business area ──
    location_code      = db.Column(db.String(50), nullable=True, index=True)
    location_name      = db.Column(db.String(100), nullable=True)
    location_path      = db.Column(db.String(255), nullable=True)
    location_type      = db.Column(db.String(50), nullable=True)
    business_area_code = db.Column(db.String(50), nullable=True, index=True)
    business_area_name = db.Column(db.String(100), nullable=True)

    # ── CAND-2A: Profile builder fields ──
    current_responsibilities      = db.Column(db.Text, nullable=True)
    function_code                 = db.Column(db.String(50), nullable=True, index=True)
    function_name                 = db.Column(db.String(100), nullable=True)
    is_management_role            = db.Column(db.Boolean, nullable=True)

    # 能力画像（独立于 legacy skill_tags / route_tags）
    knowledge_tags                = db.Column(db.JSON, nullable=True)
    hard_skill_tags               = db.Column(db.JSON, nullable=True)
    soft_skill_tags               = db.Column(db.JSON, nullable=True)

    # 当前薪酬结构（与 expected_salary_* 分离）
    current_salary_min            = db.Column(db.Integer, nullable=True)
    current_salary_max            = db.Column(db.Integer, nullable=True)
    current_salary_months         = db.Column(db.Integer, nullable=True)
    current_average_bonus_percent = db.Column(db.Float, nullable=True)
    current_has_year_end_bonus    = db.Column(db.Boolean, nullable=True)
    current_year_end_bonus_months = db.Column(db.Float, nullable=True)

    # 服务端计算的档案完整度状态
    profile_status                = db.Column(db.String(30), nullable=True, index=True)
    profile_completed_at          = db.Column(db.DateTime, nullable=True)

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

    def to_dict(self, include_contact=False, include_private=False):
        """
        include_private = True 时暴露 9 个隐私字段：
          full_name / age / experience_years / education / phone /
          availability_status / work_experiences / education_experiences / certificates
        企业方仅当与该候选人之间存在 accepted 邀约时才允许 True。
        """
        data = {
            "id": self.id,
            "user_id": self.user_id,
            "current_title": self.current_title,
            "current_company": self.current_company,
            "current_city": self.current_city,
            "expected_city": self.expected_city,
            "expected_salary_min": self.expected_salary_min,
            "expected_salary_max": self.expected_salary_max,
            "expected_salary_label": self.expected_salary_label,
            "english_level": self.english_level,
            "summary": self.summary,
            "business_type": self.business_type,
            "job_type": self.job_type,
            "route_tags": self.route_tags or [],
            "skill_tags": self.skill_tags or [],
            "all_tags": self.all_tags(),
            "contact_visible": self.contact_visible,
            "location_code": self.location_code,
            "location_name": self.location_name,
            "location_path": self.location_path,
            "location_type": self.location_type,
            "business_area_code": self.business_area_code,
            "business_area_name": self.business_area_name,
            # ── CAND-2A: capability profile (always public) ──
            "function_code":      self.function_code,
            "function_name":      self.function_name,
            "is_management_role": self.is_management_role,
            "knowledge_tags":     self.knowledge_tags or [],
            "hard_skill_tags":    self.hard_skill_tags or [],
            "soft_skill_tags":    self.soft_skill_tags or [],
            "profile_status":     self.profile_status,
            "profile_completed_at": (
                self.profile_completed_at.isoformat() if self.profile_completed_at else None
            ),
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

        if include_private:
            data.update({
                "full_name":            self.full_name,
                "age":                  self.age,
                "experience_years":     self.experience_years,
                "education":            self.education,
                "availability_status":  self.availability_status,
                "work_experiences":     self.work_experiences or [],
                "education_experiences": self.education_experiences or [],
                "certificates":         self.certificates or [],
                # ── CAND-2A: current-company sensitive fields ──
                "current_responsibilities":      self.current_responsibilities,
                "current_salary_min":            self.current_salary_min,
                "current_salary_max":            self.current_salary_max,
                "current_salary_months":         self.current_salary_months,
                "current_average_bonus_percent": self.current_average_bonus_percent,
                "current_has_year_end_bonus":    self.current_has_year_end_bonus,
                "current_year_end_bonus_months": self.current_year_end_bonus_months,
                "private_visible":      True,
            })
        else:
            # 隐私模式：脱敏的占位
            data.update({
                "full_name":            f"候选人 #{self.id}",
                "age":                  None,
                "experience_years":     None,
                "education":            None,
                "availability_status":  None,
                "work_experiences":     [],
                "education_experiences": [],
                "certificates":         [],
                "current_responsibilities":      None,
                "current_salary_min":            None,
                "current_salary_max":            None,
                "current_salary_months":         None,
                "current_average_bonus_percent": None,
                "current_has_year_end_bonus":    None,
                "current_year_end_bonus_months": None,
                "private_visible":      False,
            })

        if include_contact and include_private:
            data["email"] = self.email
            data["phone"] = self.phone
            data["address"] = self.address
        else:
            data["email"] = None
            data["phone"] = None
            data["address"] = None

        return data
