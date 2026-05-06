"""
测试匹配算法服务 — CAND-7A Legacy + CAND-7B 双边匹配

保留 CAND-7A 原始测试，新增 CAND-7B 双边匹配测试。
"""
import pytest
from datetime import datetime, timezone, timedelta
from app.services.matching import (
    extract_exp_min,
    compute_legacy_match,
    compute_employer_fit,
    compute_candidate_fit,
    compute_final_match,
    compute_match,
)


class TestExtractExpMin:
    """测试经验年限提取函数"""

    def test_extract_from_standard_format(self):
        assert extract_exp_min("3年以上") == 3
        assert extract_exp_min("5年") == 5
        assert extract_exp_min("10年以上经验") == 10

    def test_extract_none_or_empty(self):
        assert extract_exp_min(None) == 0
        assert extract_exp_min("") == 0

    def test_extract_no_number(self):
        assert extract_exp_min("不限") == 0
        assert extract_exp_min("应届生") == 0


class MockJob:
    """Mock Job 对象用于测试"""
    def __init__(self, **kwargs):
        self.skill_tags = kwargs.get('skill_tags', [])
        self.route_tags = kwargs.get('route_tags', [])
        self.business_type = kwargs.get('business_type')
        self.job_type = kwargs.get('job_type')
        self.city = kwargs.get('city')
        self.experience_required = kwargs.get('experience_required')
        # CAND-7B 新字段
        self.function_code = kwargs.get('function_code')
        self.function_name = kwargs.get('function_name')
        self.location_code = kwargs.get('location_code')
        self.location_name = kwargs.get('location_name')
        self.business_area_code = kwargs.get('business_area_code')
        self.business_area_name = kwargs.get('business_area_name')
        self.degree_required = kwargs.get('degree_required')
        self.knowledge_requirements = kwargs.get('knowledge_requirements', [])
        self.hard_skill_requirements = kwargs.get('hard_skill_requirements', [])
        self.soft_skill_requirements = kwargs.get('soft_skill_requirements', [])
        self.is_management_role = kwargs.get('is_management_role')
        self.description = kwargs.get('description', '')
        self.requirements = kwargs.get('requirements', '')
        self.salary_min = kwargs.get('salary_min')
        self.salary_max = kwargs.get('salary_max')
        self.salary_months = kwargs.get('salary_months')
        self.average_bonus_percent = kwargs.get('average_bonus_percent')
        self.has_year_end_bonus = kwargs.get('has_year_end_bonus')
        self.year_end_bonus_months = kwargs.get('year_end_bonus_months')


class MockCandidate:
    """Mock Candidate 对象用于测试"""
    def __init__(self, **kwargs):
        self.skill_tags = kwargs.get('skill_tags', [])
        self.route_tags = kwargs.get('route_tags', [])
        self.business_type = kwargs.get('business_type')
        self.job_type = kwargs.get('job_type')
        self.current_city = kwargs.get('current_city')
        self.expected_city = kwargs.get('expected_city')
        self.experience_years = kwargs.get('experience_years')
        self.updated_at = kwargs.get('updated_at', datetime.now(timezone.utc))
        # CAND-7B 新字段
        self.function_code = kwargs.get('function_code')
        self.function_name = kwargs.get('function_name')
        self.location_code = kwargs.get('location_code')
        self.location_name = kwargs.get('location_name')
        self.business_area_code = kwargs.get('business_area_code')
        self.business_area_name = kwargs.get('business_area_name')
        self.education = kwargs.get('education')
        self.certificates = kwargs.get('certificates')
        self.knowledge_tags = kwargs.get('knowledge_tags', [])
        self.hard_skill_tags = kwargs.get('hard_skill_tags', [])
        self.soft_skill_tags = kwargs.get('soft_skill_tags', [])
        self.is_management_role = kwargs.get('is_management_role')
        self.current_responsibilities = kwargs.get('current_responsibilities', '')
        self.expected_salary_min = kwargs.get('expected_salary_min')
        self.expected_salary_max = kwargs.get('expected_salary_max')
        self.current_salary_months = kwargs.get('current_salary_months')

    def freshness_days(self):
        """计算档案更新距今天数"""
        if not self.updated_at:
            return 999
        delta = datetime.now(timezone.utc) - self.updated_at
        return delta.days


# ============ CAND-7A Legacy 测试（保留） ============

class TestLegacyMatch:
    """测试 CAND-7A 原始匹配算法"""

    def test_legacy_skill_tags_scoring(self):
        """测试技能标签得分：满分 40，每命中 1 个 +8"""
        job = MockJob(skill_tags=["Cargowise", "英语", "Excel"])
        candidate = MockCandidate(skill_tags=["Cargowise", "英语"])

        result = compute_legacy_match(job, candidate)

        assert result["score_breakdown"]["skill_tags"] == 16  # 2 * 8
        assert "Cargowise" in result["matched_tags"]

    def test_legacy_total_score_cap_100(self):
        """测试总分上限 100"""
        job = MockJob(
            skill_tags=["A", "B", "C", "D", "E", "F"],
            route_tags=["美线", "欧线"],
            business_type="海运",
            job_type="操作",
            city="上海",
            experience_required=None,
        )
        now = datetime.now(timezone.utc)
        candidate = MockCandidate(
            skill_tags=["A", "B", "C", "D", "E", "F"],
            route_tags=["美线", "欧线"],
            business_type="海运",
            job_type="操作",
            current_city="上海",
            experience_years=5,
            updated_at=now - timedelta(days=3),
        )

        result = compute_legacy_match(job, candidate)

        assert result["score"] == 100


# ============ CAND-7B 双边匹配测试 ============

class TestEmployerFit:
    """测试企业视角匹配度"""

    def test_function_match_full(self):
        """测试职能完全匹配：10 分"""
        job = MockJob(function_code="OPS", function_name="操作")
        candidate = MockCandidate(function_code="OPS", function_name="操作")

        result = compute_employer_fit(job, candidate)

        assert result['breakdown']['function_match'] == 10

    def test_function_match_fallback_business_type(self):
        """测试职能 fallback 到业务板块：6 分"""
        job = MockJob(business_type="海运")
        candidate = MockCandidate(business_type="海运")

        result = compute_employer_fit(job, candidate)

        assert result['breakdown']['function_match'] == 6

    def test_location_match_business_area(self):
        """测试业务区域匹配：10 分"""
        job = MockJob(business_area_code="CN-EAST", business_area_name="华东")
        candidate = MockCandidate(business_area_code="CN-EAST")

        result = compute_employer_fit(job, candidate)

        assert result['breakdown']['location_match'] == 10

    def test_location_match_current_city(self):
        """测试当前城市匹配：8 分"""
        job = MockJob(city="上海")
        candidate = MockCandidate(current_city="上海")

        result = compute_employer_fit(job, candidate)

        assert result['breakdown']['location_match'] == 8

    def test_experience_match_full(self):
        """测试经验满足要求：12 分"""
        job = MockJob(experience_required="3年以上")
        candidate = MockCandidate(experience_years=5)

        result = compute_employer_fit(job, candidate)

        assert result['breakdown']['experience_match'] == 12

    def test_experience_match_close(self):
        """测试经验接近要求：8 分"""
        job = MockJob(experience_required="5年以上")
        candidate = MockCandidate(experience_years=4)

        result = compute_employer_fit(job, candidate)

        assert result['breakdown']['experience_match'] == 8

    def test_hard_skill_match(self):
        """测试硬技能匹配：每命中 +5，上限 20"""
        job = MockJob(hard_skill_requirements=["Cargowise", "Excel", "SAP"])
        candidate = MockCandidate(hard_skill_tags=["Cargowise", "Excel"])

        result = compute_employer_fit(job, candidate)

        assert result['breakdown']['hard_skill_match'] == 10  # 2 * 5
        assert "Cargowise" in result['matched_tags']

    def test_management_match(self):
        """测试管理岗位匹配：5 分"""
        job = MockJob(is_management_role=True)
        candidate = MockCandidate(is_management_role=True)

        result = compute_employer_fit(job, candidate)

        assert result['breakdown']['management_match'] == 5

    def test_freshness_within_7_days(self):
        """测试档案鲜度 ≤7 天：5 分"""
        now = datetime.now(timezone.utc)
        candidate = MockCandidate(updated_at=now - timedelta(days=5))

        job = MockJob()
        result = compute_employer_fit(job, candidate)

        assert result['breakdown']['freshness'] == 5

    def test_employer_fit_no_crash_on_missing_fields(self):
        """测试缺少字段时不崩溃"""
        job = MockJob()
        candidate = MockCandidate()

        result = compute_employer_fit(job, candidate)

        assert result['score'] >= 0
        assert result['score'] <= 100


class TestCandidateFit:
    """测试候选人视角匹配度"""

    def test_salary_match_full_coverage(self):
        """测试薪资完全覆盖期望：25 分"""
        job = MockJob(salary_min=15, salary_max=25)
        candidate = MockCandidate(expected_salary_min=12, expected_salary_max=20)

        result = compute_candidate_fit(job, candidate)

        assert result['breakdown']['salary_match'] == 25

    def test_salary_match_partial_coverage(self):
        """测试薪资部分覆盖期望：部分分"""
        job = MockJob(salary_min=10, salary_max=18)
        candidate = MockCandidate(expected_salary_min=15, expected_salary_max=25)

        result = compute_candidate_fit(job, candidate)

        assert result['breakdown']['salary_match'] > 0
        assert result['breakdown']['salary_match'] < 25

    def test_salary_months_match(self):
        """测试薪资月数 ≥13：5 分"""
        job = MockJob(salary_months=14)
        candidate = MockCandidate()

        result = compute_candidate_fit(job, candidate)

        assert result['breakdown']['salary_months_match'] == 5

    def test_bonus_match(self):
        """测试奖金福利：上限 10 分"""
        job = MockJob(
            average_bonus_percent=30,
            has_year_end_bonus=True,
            year_end_bonus_months=2,
        )
        candidate = MockCandidate()

        result = compute_candidate_fit(job, candidate)

        # bonus_pct 30% -> 3分, year_end -> 3分, year_months -> 2分 = 8分
        assert result['breakdown']['bonus_match'] == 8

    def test_location_preference_match(self):
        """测试地点符合期望：20 分"""
        job = MockJob(city="上海", location_code="SH")
        candidate = MockCandidate(expected_city="上海", location_code="SH")

        result = compute_candidate_fit(job, candidate)

        assert result['breakdown']['location_preference'] == 20

    def test_function_preference_match(self):
        """测试职能符合期望：15 分"""
        job = MockJob(function_code="OPS")
        candidate = MockCandidate(function_code="OPS")

        result = compute_candidate_fit(job, candidate)

        assert result['breakdown']['function_preference'] == 15

    def test_management_preference_match(self):
        """测试管理岗位符合期望：10 分"""
        job = MockJob(is_management_role=True)
        candidate = MockCandidate(is_management_role=True)

        result = compute_candidate_fit(job, candidate)

        assert result['breakdown']['management_preference'] == 10

    def test_job_description_quality(self):
        """测试岗位描述质量：上限 5 分"""
        job = MockJob(description="详细的岗位描述" * 50, requirements="详细的任职要求" * 50)
        candidate = MockCandidate()

        result = compute_candidate_fit(job, candidate)

        assert result['breakdown']['job_description_quality'] == 5

    def test_candidate_fit_no_crash_on_missing_fields(self):
        """测试缺少字段时不崩溃"""
        job = MockJob()
        candidate = MockCandidate()

        result = compute_candidate_fit(job, candidate)

        assert result['score'] >= 0
        assert result['score'] <= 100


class TestFinalMatch:
    """测试双边匹配最终得分"""

    def test_final_score_calculation(self):
        """测试最终得分 = employer_fit * 0.65 + candidate_fit * 0.35"""
        job = MockJob(
            function_code="OPS",
            hard_skill_requirements=["Cargowise"],
            salary_min=15,
            salary_max=25,
        )
        candidate = MockCandidate(
            function_code="OPS",
            hard_skill_tags=["Cargowise"],
            expected_salary_min=12,
            expected_salary_max=20,
        )

        result = compute_final_match(job, candidate)

        # employer_fit 应该有 function(10) + hard_skill(5) = 15+
        # candidate_fit 应该有 salary(25) = 25+
        # final = employer * 0.65 + candidate * 0.35
        assert result['score'] > 0
        assert result['score'] <= 100
        assert 'employer_fit_score' in result
        assert 'candidate_fit_score' in result

    def test_final_score_cap_100(self):
        """测试最终得分上限 100"""
        job = MockJob(
            function_code="OPS",
            location_code="SH",
            business_area_code="CN-EAST",
            experience_required="3年",
            hard_skill_requirements=["A", "B", "C", "D"],
            knowledge_requirements=["K1", "K2", "K3"],
            soft_skill_requirements=["S1", "S2"],
            is_management_role=True,
            description="详细描述" * 100,
            salary_min=20,
            salary_max=30,
            salary_months=14,
            average_bonus_percent=50,
            has_year_end_bonus=True,
            year_end_bonus_months=3,
        )
        now = datetime.now(timezone.utc)
        candidate = MockCandidate(
            function_code="OPS",
            location_code="SH",
            business_area_code="CN-EAST",
            experience_years=5,
            hard_skill_tags=["A", "B", "C", "D"],
            knowledge_tags=["K1", "K2", "K3"],
            soft_skill_tags=["S1", "S2"],
            is_management_role=True,
            updated_at=now - timedelta(days=3),
            expected_salary_min=15,
            expected_salary_max=25,
            expected_city="上海",
        )

        result = compute_final_match(job, candidate)

        assert result['score'] <= 100

    def test_matched_tags_deduplication(self):
        """测试 matched_tags 去重"""
        job = MockJob(
            hard_skill_requirements=["Cargowise", "Excel"],
            knowledge_requirements=["Cargowise"],
        )
        candidate = MockCandidate(
            hard_skill_tags=["Cargowise", "Excel"],
            knowledge_tags=["Cargowise"],
        )

        result = compute_final_match(job, candidate)

        # Cargowise 出现在 hard_skill 和 knowledge，应该去重
        assert len([t for t in result['matched_tags'] if t == "Cargowise"]) == 1

    def test_reason_list_not_empty(self):
        """测试 reason_list 有内容"""
        job = MockJob(
            function_code="OPS",
            hard_skill_requirements=["Cargowise"],
        )
        candidate = MockCandidate(
            function_code="OPS",
            hard_skill_tags=["Cargowise"],
        )

        result = compute_final_match(job, candidate)

        assert len(result['reason_list']) > 0

    def test_score_breakdown_structure(self):
        """测试 score_breakdown 结构"""
        job = MockJob()
        candidate = MockCandidate()

        result = compute_final_match(job, candidate)

        assert 'employer_fit' in result['score_breakdown']
        assert 'candidate_fit' in result['score_breakdown']
        assert isinstance(result['score_breakdown']['employer_fit'], dict)
        assert isinstance(result['score_breakdown']['candidate_fit'], dict)


class TestBackwardCompatibility:
    """测试向后兼容性"""

    def test_compute_match_returns_required_fields(self):
        """测试 compute_match 返回必需字段"""
        job = MockJob(skill_tags=["Cargowise"])
        candidate = MockCandidate(skill_tags=["Cargowise"])

        result = compute_match(job, candidate)

        # 必须包含旧 API 需要的字段
        assert 'score' in result
        assert 'matched_tags' in result
        assert 'score_breakdown' in result
        assert 'reason_list' in result
        assert isinstance(result['score'], int)
        assert isinstance(result['matched_tags'], list)
        assert isinstance(result['score_breakdown'], dict)
        assert isinstance(result['reason_list'], list)

    def test_compute_match_delegates_to_final_match(self):
        """测试 compute_match 内部调用 compute_final_match"""
        job = MockJob(function_code="OPS")
        candidate = MockCandidate(function_code="OPS")

        result = compute_match(job, candidate)

        # 应该包含新字段
        assert 'employer_fit_score' in result
        assert 'candidate_fit_score' in result
