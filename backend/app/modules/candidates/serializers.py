from app.models.candidate import Candidate


def build_public_dict(profile: Candidate, include_contact: bool = False,
                      include_private: bool = False,
                      tags_by_category: dict[str, list[str]] | None = None) -> dict:
    """返回候选人公开信息（CAND-5 重整后）。

    `include_private=True` 时暴露隐私字段（候选人本人 / admin / 已解锁的 employer）。
    `include_contact` 与 `include_private` 同步，因 CAND-5 起两者总是一起开关 ——
    保留参数仅是为了减少 call-site 改动。

    永远公开（用于列表筛选、卡片展示、匹配）：
      function_code / function_name / is_management_role / location_* /
      business_area_* / knowledge_tags / hard_skill_tags / soft_skill_tags /
      route_tags / skill_tags / job_type / business_type / expected_* /
      english_level / summary / profile_status / freshness_days / 时间戳

    隐私字段（仅 include_private=True 时返回真实值）：
      full_name / age / experience_years / education / availability_status /
      work_experiences / education_experiences / certificates /
      current_company / current_responsibilities / current_salary_min/max/months /
      current_average_bonus_percent / current_has_year_end_bonus /
      current_year_end_bonus_months / email / phone / address
    """
    data = {
        "id": profile.id,
        "avatar_url": profile.user.avatar_url if profile.user else None,
        # 公开字段（永远返回）
        "current_title": profile.current_title,
        "desired_position": profile.desired_position,
        "current_city": profile.current_city,
        "expected_city": profile.expected_city,
        "expected_salary_min": profile.expected_salary_min,
        "expected_salary_max": profile.expected_salary_max,
        "expected_salary_label": profile.expected_salary_label,
        "english_level": profile.english_level,
        "summary": profile.summary,
        "business_type": profile.business_type,
        "job_type": profile.job_type,
        "route_tags": profile.route_tags or [],
        "skill_tags": profile.skill_tags or [],
        "all_tags": profile.all_tags(),
        "contact_visible": profile.contact_visible,
        "gender": profile.gender,
        # Phase C: standard location
        "location_code": profile.location_code,
        "location_name": profile.location_name,
        "location_path": profile.location_path,
        "location_type": profile.location_type,
        "business_area_code": profile.business_area_code,
        "business_area_name": profile.business_area_name,
        # CAND-2A: capability profile (always public; used by matching)
        "function_code": profile.function_code,
        "function_name": profile.function_name,
        "is_management_role": profile.is_management_role,
        "knowledge_tags": profile.knowledge_tags or [],
        "hard_skill_tags": profile.hard_skill_tags or [],
        "soft_skill_tags": profile.soft_skill_tags or [],
        "profile_status": profile.profile_status,
        "profile_completed_at": (
            profile.profile_completed_at.isoformat()
            if profile.profile_completed_at else None
        ),
        "freshness_days": profile.freshness_days(),
        "resume_file_name": profile.resume_file_name,
        "resume_uploaded_at": (
            profile.resume_uploaded_at.isoformat() if profile.resume_uploaded_at else None
        ),
        "profile_confirmed_at": (
            profile.profile_confirmed_at.isoformat() if profile.profile_confirmed_at else None
        ),
        "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
    }

    if include_private:
        data.update({
            "full_name": profile.full_name,
            "age": profile.age,
            "experience_years": profile.experience_years,
            "education": profile.education,
            "availability_status": profile.availability_status,
            "work_experiences": profile.work_experiences or [],
            "education_experiences": profile.education_experiences or [],
            "certificates": profile.certificates or [],
            # CAND-5: 当前任职敏感字段
            "current_company": profile.current_company,
            "current_responsibilities": profile.current_responsibilities,
            "current_salary_min": profile.current_salary_min,
            "current_salary_max": profile.current_salary_max,
            "current_salary_months": profile.current_salary_months,
            "current_average_bonus_percent": profile.current_average_bonus_percent,
            "current_has_year_end_bonus": profile.current_has_year_end_bonus,
            "current_year_end_bonus_months": profile.current_year_end_bonus_months,
            "private_visible": True,
        })
    else:
        data.update({
            "full_name": (
                (profile.full_name[0] + ("先生" if profile.gender == "male" else "女士" if profile.gender == "female" else "先生"))
                if profile.full_name else f"候选人 #{profile.id}"
            ),
            "age": None,
            "experience_years": None,
            "education": None,
            "availability_status": None,
            "work_experiences": [],
            "education_experiences": [],
            "certificates": [],
            "current_company": None,
            "current_responsibilities": None,
            "current_salary_min": None,
            "current_salary_max": None,
            "current_salary_months": None,
            "current_average_bonus_percent": None,
            "current_has_year_end_bonus": None,
            "current_year_end_bonus_months": None,
            "private_visible": False,
        })

    if include_contact and include_private:
        data["email"] = profile.email
        data["phone"] = profile.phone
        data["address"] = profile.address
    else:
        data["email"] = None
        data["phone"] = None
        data["address"] = None

    # 注入按分类聚合的标签（含 pending）— 供前端按分类展示
    data["tags_by_category"] = tags_by_category or {}
    return data
