"""
匹配算法服务 — CAND-7B 双边匹配增强

从单向"岗位找候选人"升级为双边匹配：
- employer_fit_score：候选人是否满足企业岗位要求（满分 100）
- candidate_fit_score：岗位是否满足候选人求职期望（满分 100）
- final score = employer_fit * 0.65 + candidate_fit * 0.35

保持向后兼容：
- compute_match() 仍然返回 score/matched_tags/score_breakdown/reason_list
- 缺字段时给 0 分或合理 fallback，不抛异常
"""
import re


def extract_exp_min(exp_str):
    """从 '3年以上' '5年' 等字符串提取最小年限数字，失败返回 0。"""
    if not exp_str:
        return 0
    m = re.search(r"(\d+)", exp_str)
    return int(m.group(1)) if m else 0


def _safe_set(value):
    """安全转换为 set，处理 None 和空值"""
    if not value:
        return set()
    if isinstance(value, (list, set)):
        return set(value)
    return set()


def _text_overlap_score(text1, text2, max_score=5):
    """简单文本重叠度评分：token 交集占比"""
    if not text1 or not text2:
        return 0
    tokens1 = set(text1.lower().split())
    tokens2 = set(text2.lower().split())
    if not tokens1 or not tokens2:
        return 0
    overlap = len(tokens1 & tokens2)
    union = len(tokens1 | tokens2)
    ratio = overlap / union if union > 0 else 0
    return min(int(ratio * max_score * 2), max_score)


def compute_employer_fit(job, candidate) -> dict:
    """
    计算候选人对岗位的匹配度（企业视角）。

    权重分配（总分 100）：
    - function_match: 10
    - location_match: 10
    - experience_match: 12
    - degree_certificate_match: 8
    - knowledge_match: 15
    - hard_skill_match: 20
    - soft_skill_match: 10
    - management_match: 5
    - freshness: 5
    - responsibilities_overlap: 5
    """
    breakdown = {}
    reasons = []
    matched_tags = []

    # 1. function_match (10)
    func_score = 0
    if getattr(job, 'function_code', None) and getattr(candidate, 'function_code', None):
        if job.function_code == candidate.function_code:
            func_score = 10
            reasons.append(f"职能匹配：{getattr(candidate, 'function_name', job.function_code)}")
    elif getattr(job, 'business_type', None) and getattr(candidate, 'business_type', None):
        if job.business_type == candidate.business_type:
            func_score = 6
            reasons.append(f"业务板块匹配：{job.business_type}")
    breakdown['function_match'] = func_score

    # 2. location_match (10)
    loc_score = 0
    if getattr(job, 'business_area_code', None) and getattr(candidate, 'business_area_code', None):
        if job.business_area_code == candidate.business_area_code:
            loc_score = 10
            reasons.append(f"业务区域匹配：{getattr(job, 'business_area_name', job.business_area_code)}")
    elif getattr(job, 'location_code', None) and getattr(candidate, 'location_code', None):
        if job.location_code == candidate.location_code:
            loc_score = 10
            reasons.append(f"地点匹配：{getattr(job, 'location_name', job.location_code)}")
    elif getattr(job, 'city', None):
        if getattr(candidate, 'current_city', None) == job.city:
            loc_score = 8
            reasons.append(f"当前城市匹配：{job.city}")
        elif getattr(candidate, 'expected_city', None) == job.city:
            loc_score = 5
            reasons.append(f"期望城市匹配：{job.city}")
    breakdown['location_match'] = loc_score

    # 3. experience_match (12)
    exp_score = 0
    exp_min = extract_exp_min(getattr(job, 'experience_required', None))
    cand_exp = getattr(candidate, 'experience_years', None)
    if exp_min == 0:
        exp_score = 12
    elif cand_exp is not None:
        if cand_exp >= exp_min:
            exp_score = 12
            reasons.append(f"{cand_exp} 年经验满足要求（≥{exp_min}年）")
        elif cand_exp >= exp_min - 1:
            exp_score = 8
            reasons.append(f"{cand_exp} 年经验接近要求（{exp_min}年）")
    breakdown['experience_match'] = exp_score

    # 4. degree_certificate_match (8)
    deg_score = 0
    job_degree = getattr(job, 'degree_required', None)
    cand_edu = getattr(candidate, 'education', None)
    if not job_degree:
        deg_score = 4
    elif cand_edu:
        if any(kw in cand_edu for kw in ['硕士', '研究生', 'Master']):
            deg_score = 8
        elif any(kw in cand_edu for kw in ['本科', '学士', 'Bachelor']):
            deg_score = 6
        elif any(kw in cand_edu for kw in ['大专', '专科']):
            deg_score = 4
    if getattr(candidate, 'certificates', None):
        deg_score = min(deg_score + 2, 8)
    breakdown['degree_certificate_match'] = deg_score

    # 5. knowledge_match (15)
    j_know = _safe_set(getattr(job, 'knowledge_requirements', None))
    c_know = _safe_set(getattr(candidate, 'knowledge_tags', None))
    know_hit = list(j_know & c_know)
    know_score = min(len(know_hit) * 5, 15)
    breakdown['knowledge_match'] = know_score
    matched_tags.extend(know_hit)
    if know_hit:
        reasons.append(f"知识领域命中 {len(know_hit)} 项：{'、'.join(know_hit[:3])}")

    # 6. hard_skill_match (20)
    j_hard = _safe_set(getattr(job, 'hard_skill_requirements', None))
    c_hard = _safe_set(getattr(candidate, 'hard_skill_tags', None))
    if not j_hard:
        j_hard = _safe_set(getattr(job, 'skill_tags', None))
    if not c_hard:
        c_hard = _safe_set(getattr(candidate, 'skill_tags', None))
    hard_hit = list(j_hard & c_hard)
    hard_score = min(len(hard_hit) * 5, 20)
    breakdown['hard_skill_match'] = hard_score
    matched_tags.extend(hard_hit)
    if hard_hit:
        reasons.append(f"硬技能命中 {len(hard_hit)} 项：{'、'.join(hard_hit[:4])}")

    # 7. soft_skill_match (10)
    j_soft = _safe_set(getattr(job, 'soft_skill_requirements', None))
    c_soft = _safe_set(getattr(candidate, 'soft_skill_tags', None))
    soft_hit = list(j_soft & c_soft)
    soft_score = min(len(soft_hit) * 5, 10)
    breakdown['soft_skill_match'] = soft_score
    matched_tags.extend(soft_hit)
    if soft_hit:
        reasons.append(f"软技能命中 {len(soft_hit)} 项：{'、'.join(soft_hit[:3])}")

    # 8. management_match (5)
    mgmt_score = 0
    j_mgmt = getattr(job, 'is_management_role', None)
    c_mgmt = getattr(candidate, 'is_management_role', None)
    if j_mgmt is not None and c_mgmt is not None:
        if j_mgmt == c_mgmt:
            mgmt_score = 5
            if j_mgmt:
                reasons.append("管理岗位匹配")
    breakdown['management_match'] = mgmt_score

    # 9. freshness (5)
    fresh_score = 0
    if hasattr(candidate, 'freshness_days'):
        fresh_days = candidate.freshness_days()
        if fresh_days <= 7:
            fresh_score = 5
            reasons.append(f"近 {fresh_days} 天内更新档案，活跃度高")
        elif fresh_days <= 14:
            fresh_score = 3
        elif fresh_days <= 30:
            fresh_score = 1
    breakdown['freshness'] = fresh_score

    # 10. responsibilities_overlap (5)
    resp_score = 0
    job_desc = (getattr(job, 'description', '') or '') + ' ' + (getattr(job, 'requirements', '') or '')
    cand_resp = getattr(candidate, 'current_responsibilities', '') or ''
    if job_desc.strip() and cand_resp.strip():
        resp_score = _text_overlap_score(job_desc, cand_resp, max_score=5)
        if resp_score > 0:
            reasons.append(f"工作职责相关度：{resp_score}/5")
    breakdown['responsibilities_overlap'] = resp_score

    total = min(sum(breakdown.values()), 100)
    return {
        'score': total,
        'breakdown': breakdown,
        'reasons': reasons,
        'matched_tags': matched_tags,
    }


def compute_candidate_fit(job, candidate) -> dict:
    """
    计算岗位对候选人的吸引度（候选人视角）。

    权重分配（总分 100）：
    - salary_match: 25
    - salary_months_match: 5
    - bonus_match: 10
    - location_preference: 20
    - function_preference: 15
    - management_preference: 10
    - job_description_quality: 5
    - relationship_signal: 10
    """
    breakdown = {}
    reasons = []

    # 1. salary_match (25)
    sal_score = 0
    j_min = getattr(job, 'salary_min', None)
    j_max = getattr(job, 'salary_max', None)
    c_min = getattr(candidate, 'expected_salary_min', None)
    c_max = getattr(candidate, 'expected_salary_max', None)

    if j_min and j_max and c_min and c_max:
        # 岗位薪资完全覆盖候选人期望
        if j_min >= c_min and j_max >= c_max:
            sal_score = 25
            reasons.append(f"薪资区间满足期望：{j_min}-{j_max}K")
        # 部分覆盖
        elif j_max >= c_min:
            overlap = min(j_max, c_max) - max(j_min, c_min)
            range_c = c_max - c_min if c_max > c_min else 1
            ratio = max(0, overlap / range_c)
            sal_score = int(ratio * 25)
            if sal_score > 0:
                reasons.append(f"薪资部分匹配：{j_min}-{j_max}K")
    elif j_min or j_max:
        # 只有岗位薪资，给基础分
        sal_score = 10
    breakdown['salary_match'] = sal_score

    # 2. salary_months_match (5)
    months_score = 0
    j_months = getattr(job, 'salary_months', None)
    c_months = getattr(candidate, 'current_salary_months', None)
    if j_months:
        if j_months >= 13:
            months_score = 5
            reasons.append(f"薪资月数：{j_months} 薪")
        elif j_months == 12:
            months_score = 3
    elif c_months and c_months >= 13:
        months_score = 2
    breakdown['salary_months_match'] = months_score

    # 3. bonus_match (10)
    bonus_score = 0
    j_bonus_pct = getattr(job, 'average_bonus_percent', None)
    j_year_end = getattr(job, 'has_year_end_bonus', None)
    j_year_months = getattr(job, 'year_end_bonus_months', None)

    if j_bonus_pct and j_bonus_pct > 0:
        bonus_score += min(int(j_bonus_pct / 10), 5)
    if j_year_end:
        bonus_score += 3
    if j_year_months and j_year_months > 0:
        bonus_score += 2
    bonus_score = min(bonus_score, 10)
    if bonus_score > 0:
        reasons.append(f"奖金福利：{bonus_score}/10")
    breakdown['bonus_match'] = bonus_score

    # 4. location_preference (20)
    loc_pref_score = 0
    c_exp_city = getattr(candidate, 'expected_city', None)
    c_loc_code = getattr(candidate, 'location_code', None)
    c_ba_code = getattr(candidate, 'business_area_code', None)
    j_city = getattr(job, 'city', None)
    j_loc_code = getattr(job, 'location_code', None)
    j_ba_code = getattr(job, 'business_area_code', None)

    if c_ba_code and j_ba_code and c_ba_code == j_ba_code:
        loc_pref_score = 20
        reasons.append(f"业务区域符合期望：{getattr(candidate, 'business_area_name', c_ba_code)}")
    elif c_loc_code and j_loc_code and c_loc_code == j_loc_code:
        loc_pref_score = 20
        reasons.append(f"地点符合期望：{getattr(candidate, 'location_name', c_loc_code)}")
    elif c_exp_city and j_city and c_exp_city == j_city:
        loc_pref_score = 15
        reasons.append(f"城市符合期望：{j_city}")
    elif j_city:
        loc_pref_score = 5
    breakdown['location_preference'] = loc_pref_score

    # 5. function_preference (15)
    func_pref_score = 0
    c_func = getattr(candidate, 'function_code', None)
    j_func = getattr(job, 'function_code', None)
    if c_func and j_func and c_func == j_func:
        func_pref_score = 15
        reasons.append(f"职能符合期望：{getattr(candidate, 'function_name', c_func)}")
    elif getattr(candidate, 'business_type', None) and getattr(job, 'business_type', None):
        if candidate.business_type == job.business_type:
            func_pref_score = 10
            reasons.append(f"业务板块符合期望：{job.business_type}")
    breakdown['function_preference'] = func_pref_score

    # 6. management_preference (10)
    mgmt_pref_score = 0
    c_mgmt = getattr(candidate, 'is_management_role', None)
    j_mgmt = getattr(job, 'is_management_role', None)
    if c_mgmt is not None and j_mgmt is not None:
        if c_mgmt == j_mgmt:
            mgmt_pref_score = 10
            if c_mgmt:
                reasons.append("管理岗位符合期望")
    breakdown['management_preference'] = mgmt_pref_score

    # 7. job_description_quality (5)
    desc_score = 0
    j_desc = getattr(job, 'description', '') or ''
    j_req = getattr(job, 'requirements', '') or ''
    total_len = len(j_desc) + len(j_req)
    if total_len > 200:
        desc_score = 5
    elif total_len > 100:
        desc_score = 3
    elif total_len > 50:
        desc_score = 1
    breakdown['job_description_quality'] = desc_score

    # 8. relationship_signal (10)
    # 本阶段无 application/invitation 上下文，默认 0
    rel_score = 0
    breakdown['relationship_signal'] = rel_score

    total = min(sum(breakdown.values()), 100)
    return {
        'score': total,
        'breakdown': breakdown,
        'reasons': reasons,
    }


def compute_final_match(job, candidate) -> dict:
    """
    计算双边匹配最终得分。

    返回：
    {
      "score": int,  // final score = employer_fit * 0.65 + candidate_fit * 0.35
      "employer_fit_score": int,
      "candidate_fit_score": int,
      "matched_tags": list[str],
      "score_breakdown": dict,
      "reason_list": list[str]
    }
    """
    emp_fit = compute_employer_fit(job, candidate)
    cand_fit = compute_candidate_fit(job, candidate)

    final_score = round(emp_fit['score'] * 0.65 + cand_fit['score'] * 0.35)
    final_score = max(0, min(final_score, 100))

    # 合并 matched_tags 并去重
    all_tags = emp_fit['matched_tags']
    matched_tags = list(set(all_tags))

    # 合并 reasons
    reason_list = emp_fit['reasons'] + cand_fit['reasons']

    # 结构化 breakdown
    score_breakdown = {
        'employer_fit': emp_fit['breakdown'],
        'candidate_fit': cand_fit['breakdown'],
    }

    return {
        'score': final_score,
        'employer_fit_score': emp_fit['score'],
        'candidate_fit_score': cand_fit['score'],
        'matched_tags': matched_tags,
        'score_breakdown': score_breakdown,
        'reason_list': reason_list,
    }


def compute_match(job, candidate) -> dict:
    """
    向后兼容的匹配函数。

    内部调用 compute_final_match，返回结构与 CAND-7A 一致。
    旧代码可继续使用此函数。
    """
    return compute_final_match(job, candidate)


# ============ CAND-7A Legacy 算法（保留用于对照测试）============

def compute_legacy_match(job, candidate) -> dict:
    """
    CAND-7A 原始单向匹配算法（保留用于测试对照）。

    评分维度（总分 100）：
      skill_tags  命中  40
      route_tags  命中  15
      business_type 匹配 12
      job_type    匹配   8
      city        匹配  10
      freshness   鲜度  10
      experience  年限   5
    """
    breakdown = {}
    reasons = []
    matched_tags = []

    j_skill = set(job.skill_tags or [])
    j_route = set(job.route_tags or [])
    c_skill = set(candidate.skill_tags or [])
    c_route = set(candidate.route_tags or [])

    # 1. skill_tags（满分 40，每命中 1 个 +8）
    skill_hit = list(j_skill & c_skill)
    skill_score = min(len(skill_hit) * 8, 40)
    breakdown["skill_tags"] = skill_score
    matched_tags.extend(skill_hit)
    if skill_hit:
        reasons.append(f"技能标签命中 {len(skill_hit)} 项：{'、'.join(skill_hit[:4])}")

    # 2. route_tags（满分 15，每命中 1 个 +8）
    route_hit = list(j_route & c_route)
    route_score = min(len(route_hit) * 8, 15)
    breakdown["route_tags"] = route_score
    matched_tags.extend(route_hit)
    if route_hit:
        reasons.append(f"航线匹配：{'、'.join(route_hit)}")

    # 3. business_type（满分 12）
    bt_score = 0
    if job.business_type and candidate.business_type:
        if job.business_type == candidate.business_type:
            bt_score = 12
            reasons.append(f"业务方向一致：{job.business_type}")
    breakdown["business_type"] = bt_score

    # 4. job_type（满分 8）
    jt_score = 0
    if job.job_type and candidate.job_type:
        if job.job_type == candidate.job_type:
            jt_score = 8
            reasons.append(f"岗位类型匹配：{job.job_type}")
    breakdown["job_type"] = jt_score

    # 5. city（满分 10）
    city_score = 0
    if job.city:
        if candidate.current_city == job.city:
            city_score = 10
            reasons.append(f"当前城市匹配：{job.city}")
        elif candidate.expected_city == job.city:
            city_score = 7
            reasons.append(f"期望城市匹配：{job.city}")
    breakdown["city"] = city_score

    # 6. 档案鲜度（满分 10）
    fresh_score = 0
    fresh_days = candidate.freshness_days()
    if fresh_days <= 7:
        fresh_score = 10
        reasons.append(f"近 {fresh_days} 天内更新档案，活跃度高")
    elif fresh_days <= 14:
        fresh_score = 5
        reasons.append(f"近 {fresh_days} 天内更新档案")
    elif fresh_days <= 30:
        fresh_score = 2
    breakdown["freshness"] = fresh_score

    # 7. 经验年限（满分 5）
    exp_score = 0
    exp_min = extract_exp_min(job.experience_required)
    if exp_min == 0:
        exp_score = 5
    elif candidate.experience_years is not None and candidate.experience_years >= exp_min:
        exp_score = 5
        reasons.append(f"{candidate.experience_years} 年经验满足要求（≥{exp_min}年）")
    breakdown["experience"] = exp_score

    total = min(sum(breakdown.values()), 100)

    return {
        "score": total,
        "matched_tags": list(set(matched_tags)),
        "score_breakdown": breakdown,
        "reason_list": reasons,
    }
