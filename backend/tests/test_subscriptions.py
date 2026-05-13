"""test_subscriptions.py — 订阅门禁测试

覆盖：
  1. 未订阅 employer 查看候选人列表 private_visible=false
  2. active function subscription 覆盖候选人时 private_visible=true
  3. active area subscription 覆盖候选人时 private_visible=true
  4. combo subscription 必须 function 和 area 同时命中
  5. accepted invitation 不再解锁隐私
  6. 未订阅 dashboard 非 ALL/GLOBAL 返回 402
  7. 未订阅发邀约返回 402
  8. China + Sea 解锁 EAST_CHINA 候选人（China scope expansion）
  9. China + Sea 不解锁 Air + EAST_CHINA 候选人
  10. China + ALL 解锁 Air/Sea/Road 等 China 区域候选人
  11. 年付 annual_price = monthly * 12 * 0.85
  12. 非法 function / 多个 function 选择返回 400
  13. 非 China 区域 OVERSEAS 不被 China 套餐覆盖
  14. 新套餐 plan API 返回正确价格结构
"""
from datetime import datetime, timezone, timedelta
import pytest


# ─── helpers ────────────────────────────────────────────────────────────────

def _register_login(client, email, password, role, name="Test", company_name=None):
    payload = {"email": email, "password": password, "role": role, "name": name}
    if company_name:
        payload["company_name"] = company_name
    r = client.post("/api/auth/register", json=payload)
    assert r.status_code in (200, 201), f"register failed: {r.get_json()}"
    r2 = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r2.status_code == 200, f"login failed: {r2.get_json()}"
    return r2.get_json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _make_candidate(app, db_session, user_id, function_code="SALES", business_area_code="EAST_CHINA"):
    from app.models.candidate import Candidate
    c = Candidate(
        user_id=user_id,
        full_name="张三",
        current_title="销售经理",
        current_city="上海",
        availability_status="open",
        function_code=function_code,
        business_area_code=business_area_code,
        email="zhangsan@example.com",
        phone="13800000001",
    )
    db_session.add(c)
    db_session.commit()
    return c


def _make_subscription(app, db_session, employer_id,
                        function_codes=None, business_area_codes=None,
                        status="active", days=365):
    from app.models.subscription import Subscription
    now = datetime.now(timezone.utc)
    sub = Subscription(
        employer_id=employer_id,
        status=status,
        plan_type="standard",
        tier="pro",
        function_codes=function_codes if function_codes is not None else ["ALL"],
        business_area_codes=business_area_codes if business_area_codes is not None else ["ALL"],
        starts_at=now,
        ends_at=now + timedelta(days=days),
        created_at=now,
        updated_at=now,
    )
    db_session.add(sub)
    db_session.commit()
    return sub


def _make_employer_user(app, db_session, email, password="Pass123!", name="Employer Co"):
    from app.models.user import User
    from app.extensions import db
    u = User(email=email, role="employer", name=name, is_active=True)
    u.set_password(password)
    db_session.add(u)
    db_session.commit()
    return u


def _make_candidate_user(app, db_session, email, password="Pass123!"):
    from app.models.user import User
    u = User(email=email, role="candidate", name="候选人", is_active=True)
    u.set_password(password)
    db_session.add(u)
    db_session.commit()
    return u


# ─── tests ──────────────────────────────────────────────────────────────────

class TestCandidateListPrivacy:
    """Test 1: 未订阅 employer 查看候选人列表 private_visible=false"""

    def test_no_subscription_private_false(self, app, client, db_session):
        emp_user = _make_employer_user(app, db_session, "emp_t1@ex.com")
        cand_user = _make_candidate_user(app, db_session, "cand_t1@ex.com")
        _make_candidate(app, db_session, cand_user.id,
                        function_code="SALES", business_area_code="EAST_CHINA")

        token = client.post("/api/auth/login", json={"email": "emp_t1@ex.com", "password": "Pass123!"}).get_json()["access_token"]
        r = client.get("/api/candidates", headers=_auth(token))
        assert r.status_code == 200
        data = r.get_json()
        candidates = data.get("candidates", [])
        # All candidates must have private_visible=false for unsubscribed employer
        for c in candidates:
            assert c.get("private_visible") is False, f"Expected private_visible=false, got {c}"

    def test_with_subscription_all_scope_private_true(self, app, client, db_session):
        emp_user = _make_employer_user(app, db_session, "emp_t1b@ex.com")
        cand_user = _make_candidate_user(app, db_session, "cand_t1b@ex.com")
        _make_candidate(app, db_session, cand_user.id,
                        function_code="SALES", business_area_code="EAST_CHINA")
        _make_subscription(app, db_session, emp_user.id,
                           function_codes=["ALL"], business_area_codes=["ALL"])

        token = client.post("/api/auth/login", json={"email": "emp_t1b@ex.com", "password": "Pass123!"}).get_json()["access_token"]
        r = client.get("/api/candidates", headers=_auth(token))
        assert r.status_code == 200
        candidates = r.get_json().get("candidates", [])
        assert len(candidates) > 0, "Should have at least one candidate"
        for c in candidates:
            assert c.get("private_visible") is True, f"Expected private_visible=true, got {c}"


class TestFunctionSubscriptionCoverage:
    """Test 2: active function subscription 覆盖候选人时 private_visible=true"""

    def test_function_match(self, app, client, db_session):
        emp_user = _make_employer_user(app, db_session, "emp_t2@ex.com")
        cand_user = _make_candidate_user(app, db_session, "cand_t2@ex.com")
        _make_candidate(app, db_session, cand_user.id,
                        function_code="SALES", business_area_code="EAST_CHINA")
        _make_subscription(app, db_session, emp_user.id,
                           function_codes=["SALES"], business_area_codes=["ALL"])

        token = client.post("/api/auth/login", json={"email": "emp_t2@ex.com", "password": "Pass123!"}).get_json()["access_token"]
        r = client.get(f"/api/candidates/{cand_user.id}", headers=_auth(token))
        assert r.status_code == 200
        c = r.get_json()["candidate"]
        assert c.get("private_visible") is True

    def test_function_no_match(self, app, client, db_session):
        emp_user = _make_employer_user(app, db_session, "emp_t2b@ex.com")
        cand_user = _make_candidate_user(app, db_session, "cand_t2b@ex.com")
        _make_candidate(app, db_session, cand_user.id,
                        function_code="OPS", business_area_code="EAST_CHINA")
        _make_subscription(app, db_session, emp_user.id,
                           function_codes=["SALES"], business_area_codes=["ALL"])

        token = client.post("/api/auth/login", json={"email": "emp_t2b@ex.com", "password": "Pass123!"}).get_json()["access_token"]
        r = client.get(f"/api/candidates/{cand_user.id}", headers=_auth(token))
        assert r.status_code == 200
        c = r.get_json()["candidate"]
        assert c.get("private_visible") is False


class TestAreaSubscriptionCoverage:
    """Test 3: active area subscription 覆盖候选人时 private_visible=true"""

    def test_area_match(self, app, client, db_session):
        emp_user = _make_employer_user(app, db_session, "emp_t3@ex.com")
        cand_user = _make_candidate_user(app, db_session, "cand_t3@ex.com")
        _make_candidate(app, db_session, cand_user.id,
                        function_code="SALES", business_area_code="EAST_CHINA")
        _make_subscription(app, db_session, emp_user.id,
                           function_codes=["ALL"], business_area_codes=["EAST_CHINA"])

        token = client.post("/api/auth/login", json={"email": "emp_t3@ex.com", "password": "Pass123!"}).get_json()["access_token"]
        r = client.get(f"/api/candidates/{cand_user.id}", headers=_auth(token))
        assert r.status_code == 200
        c = r.get_json()["candidate"]
        assert c.get("private_visible") is True

    def test_area_no_match(self, app, client, db_session):
        emp_user = _make_employer_user(app, db_session, "emp_t3b@ex.com")
        cand_user = _make_candidate_user(app, db_session, "cand_t3b@ex.com")
        _make_candidate(app, db_session, cand_user.id,
                        function_code="SALES", business_area_code="SOUTH_CHINA")
        _make_subscription(app, db_session, emp_user.id,
                           function_codes=["ALL"], business_area_codes=["EAST_CHINA"])

        token = client.post("/api/auth/login", json={"email": "emp_t3b@ex.com", "password": "Pass123!"}).get_json()["access_token"]
        r = client.get(f"/api/candidates/{cand_user.id}", headers=_auth(token))
        assert r.status_code == 200
        c = r.get_json()["candidate"]
        assert c.get("private_visible") is False


class TestComboSubscriptionCoverage:
    """Test 4: combo subscription 必须 function 和 area 同时命中"""

    def test_both_match(self, app, client, db_session):
        emp_user = _make_employer_user(app, db_session, "emp_t4@ex.com")
        cand_user = _make_candidate_user(app, db_session, "cand_t4@ex.com")
        _make_candidate(app, db_session, cand_user.id,
                        function_code="SALES", business_area_code="EAST_CHINA")
        _make_subscription(app, db_session, emp_user.id,
                           function_codes=["SALES"], business_area_codes=["EAST_CHINA"])

        token = client.post("/api/auth/login", json={"email": "emp_t4@ex.com", "password": "Pass123!"}).get_json()["access_token"]
        r = client.get(f"/api/candidates/{cand_user.id}", headers=_auth(token))
        assert r.status_code == 200
        assert r.get_json()["candidate"].get("private_visible") is True

    def test_only_function_match(self, app, client, db_session):
        emp_user = _make_employer_user(app, db_session, "emp_t4b@ex.com")
        cand_user = _make_candidate_user(app, db_session, "cand_t4b@ex.com")
        _make_candidate(app, db_session, cand_user.id,
                        function_code="SALES", business_area_code="SOUTH_CHINA")
        _make_subscription(app, db_session, emp_user.id,
                           function_codes=["SALES"], business_area_codes=["EAST_CHINA"])

        token = client.post("/api/auth/login", json={"email": "emp_t4b@ex.com", "password": "Pass123!"}).get_json()["access_token"]
        r = client.get(f"/api/candidates/{cand_user.id}", headers=_auth(token))
        assert r.status_code == 200
        assert r.get_json()["candidate"].get("private_visible") is False

    def test_only_area_match(self, app, client, db_session):
        emp_user = _make_employer_user(app, db_session, "emp_t4c@ex.com")
        cand_user = _make_candidate_user(app, db_session, "cand_t4c@ex.com")
        _make_candidate(app, db_session, cand_user.id,
                        function_code="OPS", business_area_code="EAST_CHINA")
        _make_subscription(app, db_session, emp_user.id,
                           function_codes=["SALES"], business_area_codes=["EAST_CHINA"])

        token = client.post("/api/auth/login", json={"email": "emp_t4c@ex.com", "password": "Pass123!"}).get_json()["access_token"]
        r = client.get(f"/api/candidates/{cand_user.id}", headers=_auth(token))
        assert r.status_code == 200
        assert r.get_json()["candidate"].get("private_visible") is False


class TestInvitationNoLongerUnlocks:
    """Test 5: accepted invitation 不再解锁隐私"""

    def test_accepted_invitation_no_unlock(self, app, client, db_session):
        from app.models.job import Job
        from app.models.invitation import Invitation

        emp_user = _make_employer_user(app, db_session, "emp_t5@ex.com")
        cand_user = _make_candidate_user(app, db_session, "cand_t5@ex.com")
        cand = _make_candidate(app, db_session, cand_user.id,
                               function_code="SALES", business_area_code="EAST_CHINA")

        # Create an accepted invitation directly in DB (bypassing API validation)
        job = Job(
            company_id=emp_user.id,
            title="Test Job",
            city="上海",
            job_type="销售",
            business_type="海运",
            description="Test job description",
            status="published",
        )
        db_session.add(job)
        db_session.commit()

        inv = Invitation(
            job_id=job.id,
            candidate_id=cand.id,
            employer_id=emp_user.id,
            status="accepted",
        )
        db_session.add(inv)
        db_session.commit()

        # No subscription → private must be False even with accepted invitation
        token = client.post("/api/auth/login", json={"email": "emp_t5@ex.com", "password": "Pass123!"}).get_json()["access_token"]
        r = client.get(f"/api/candidates/{cand_user.id}", headers=_auth(token))
        assert r.status_code == 200
        assert r.get_json()["candidate"].get("private_visible") is False


class TestDashboardSubscriptionGate:
    """Test 6: 未订阅 dashboard 非 ALL/GLOBAL 返回 402"""

    def test_no_sub_all_ok(self, app, client, db_session):
        emp_user = _make_employer_user(app, db_session, "emp_t6@ex.com")
        token = client.post("/api/auth/login", json={"email": "emp_t6@ex.com", "password": "Pass123!"}).get_json()["access_token"]
        # ALL / ALL → should not be blocked
        r = client.get("/api/employer/dashboard-chart?function=ALL&region=ALL", headers=_auth(token))
        assert r.status_code == 200

    def test_no_sub_non_all_function_402(self, app, client, db_session):
        emp_user = _make_employer_user(app, db_session, "emp_t6b@ex.com")
        token = client.post("/api/auth/login", json={"email": "emp_t6b@ex.com", "password": "Pass123!"}).get_json()["access_token"]
        r = client.get("/api/employer/dashboard-chart?function=SALES&region=ALL", headers=_auth(token))
        assert r.status_code == 402
        data = r.get_json()
        assert data.get("error_code") == "subscription_required"
        assert "pricing_url" in data

    def test_no_sub_non_all_region_402(self, app, client, db_session):
        emp_user = _make_employer_user(app, db_session, "emp_t6c@ex.com")
        token = client.post("/api/auth/login", json={"email": "emp_t6c@ex.com", "password": "Pass123!"}).get_json()["access_token"]
        r = client.get("/api/employer/dashboard-chart?function=ALL&region=EAST_CHINA", headers=_auth(token))
        assert r.status_code == 402

    def test_with_sub_non_all_ok(self, app, client, db_session):
        emp_user = _make_employer_user(app, db_session, "emp_t6d@ex.com")
        _make_subscription(app, db_session, emp_user.id,
                           function_codes=["ALL"], business_area_codes=["ALL"])
        token = client.post("/api/auth/login", json={"email": "emp_t6d@ex.com", "password": "Pass123!"}).get_json()["access_token"]
        r = client.get("/api/employer/dashboard-chart?function=SALES&region=EAST_CHINA", headers=_auth(token))
        assert r.status_code == 200


class TestInvitationSubscriptionGate:
    """Test 7: 未订阅发邀约返回 402"""

    def _setup_job_and_candidate(self, app, db_session, emp_user):
        from app.models.job import Job
        cand_user = _make_candidate_user(app, db_session, f"cand_inv_{emp_user.id}@ex.com")
        cand = _make_candidate(app, db_session, cand_user.id,
                               function_code="SALES", business_area_code="EAST_CHINA")
        job = Job(
            company_id=emp_user.id,
            title="Test Job",
            city="上海",
            job_type="销售",
            business_type="海运",
            description="Test job description",
            status="published",
        )
        db_session.add(job)
        db_session.commit()
        return job, cand

    def test_no_sub_invite_402(self, app, client, db_session):
        emp_user = _make_employer_user(app, db_session, "emp_t7@ex.com")
        job, cand = self._setup_job_and_candidate(app, db_session, emp_user)

        token = client.post("/api/auth/login", json={"email": "emp_t7@ex.com", "password": "Pass123!"}).get_json()["access_token"]
        r = client.post("/api/invitations", json={
            "job_id": job.id,
            "candidate_id": cand.id,
            "message": "您好",
        }, headers=_auth(token))
        assert r.status_code == 402
        data = r.get_json()
        assert data.get("error_code") == "subscription_required"

    def test_with_sub_invite_ok(self, app, client, db_session):
        emp_user = _make_employer_user(app, db_session, "emp_t7b@ex.com")
        job, cand = self._setup_job_and_candidate(app, db_session, emp_user)
        _make_subscription(app, db_session, emp_user.id,
                           function_codes=["ALL"], business_area_codes=["ALL"])

        token = client.post("/api/auth/login", json={"email": "emp_t7b@ex.com", "password": "Pass123!"}).get_json()["access_token"]
        r = client.post("/api/invitations", json={
            "job_id": job.id,
            "candidate_id": cand.id,
            "message": "您好",
        }, headers=_auth(token))
        assert r.status_code in (200, 201)

    def test_sub_scope_mismatch_402(self, app, client, db_session):
        """Subscription exists but doesn't cover candidate's area → 402."""
        emp_user = _make_employer_user(app, db_session, "emp_t7c@ex.com")
        job, cand = self._setup_job_and_candidate(app, db_session, emp_user)
        # Subscription only covers SOUTH_CHINA, but candidate is EAST_CHINA
        _make_subscription(app, db_session, emp_user.id,
                           function_codes=["SALES"], business_area_codes=["SOUTH_CHINA"])

        token = client.post("/api/auth/login", json={"email": "emp_t7c@ex.com", "password": "Pass123!"}).get_json()["access_token"]
        r = client.post("/api/invitations", json={
            "job_id": job.id,
            "candidate_id": cand.id,
            "message": "您好",
        }, headers=_auth(token))
        assert r.status_code == 402
        data = r.get_json()
        assert data.get("error_code") == "subscription_scope_mismatch"


class TestSubscriptionApi:
    """Test GET /api/subscriptions/me and POST /api/subscriptions/dev-activate"""

    def test_get_my_subscription_no_sub(self, app, client, db_session):
        emp_user = _make_employer_user(app, db_session, "emp_api1@ex.com")
        token = client.post("/api/auth/login", json={"email": "emp_api1@ex.com", "password": "Pass123!"}).get_json()["access_token"]
        r = client.get("/api/subscriptions/me", headers=_auth(token))
        assert r.status_code == 200
        data = r.get_json()
        assert data["has_active"] is False
        assert data["subscription"] is None

    def test_dev_activate_china_function(self, app, client, db_session):
        emp_user = _make_employer_user(app, db_session, "emp_api2@ex.com")
        token = client.post("/api/auth/login", json={"email": "emp_api2@ex.com", "password": "Pass123!"}).get_json()["access_token"]

        r = client.post("/api/subscriptions/dev-activate", json={
            "plan_id": "china_function",
            "billing_cycle": "monthly",
            "function_codes": ["Sea"],
        }, headers=_auth(token))
        assert r.status_code == 201
        sub = r.get_json()["subscription"]
        assert sub["status"] == "active"
        assert sub["tier"] == "china_function"
        assert sub["function_codes"] == ["Sea"]
        assert "GREAT_CHINA" in sub["business_area_codes"]

        # Verify GET reflects it
        r2 = client.get("/api/subscriptions/me", headers=_auth(token))
        assert r2.get_json()["has_active"] is True

    def test_dev_activate_china_all_functions(self, app, client, db_session):
        emp_user = _make_employer_user(app, db_session, "emp_api2b@ex.com")
        token = client.post("/api/auth/login", json={"email": "emp_api2b@ex.com", "password": "Pass123!"}).get_json()["access_token"]

        r = client.post("/api/subscriptions/dev-activate", json={
            "plan_id": "china_all_functions",
            "billing_cycle": "annual",
        }, headers=_auth(token))
        assert r.status_code == 201
        sub = r.get_json()["subscription"]
        assert sub["status"] == "active"
        assert sub["tier"] == "china_all_functions"
        assert sub["function_codes"] == ["ALL"]
        assert sub["plan_type"] == "annual"

    def test_dev_activate_invalid_plan(self, app, client, db_session):
        emp_user = _make_employer_user(app, db_session, "emp_api2c@ex.com")
        token = client.post("/api/auth/login", json={"email": "emp_api2c@ex.com", "password": "Pass123!"}).get_json()["access_token"]

        r = client.post("/api/subscriptions/dev-activate", json={
            "plan_id": "basic",
        }, headers=_auth(token))
        assert r.status_code == 400

    def test_dev_activate_china_function_no_function(self, app, client, db_session):
        emp_user = _make_employer_user(app, db_session, "emp_api2d@ex.com")
        token = client.post("/api/auth/login", json={"email": "emp_api2d@ex.com", "password": "Pass123!"}).get_json()["access_token"]

        # Missing function_codes
        r = client.post("/api/subscriptions/dev-activate", json={
            "plan_id": "china_function",
        }, headers=_auth(token))
        assert r.status_code == 400
        assert "必须选择" in r.get_json()["message"]

    def test_dev_activate_china_function_multiple_functions(self, app, client, db_session):
        emp_user = _make_employer_user(app, db_session, "emp_api2e@ex.com")
        token = client.post("/api/auth/login", json={"email": "emp_api2e@ex.com", "password": "Pass123!"}).get_json()["access_token"]

        r = client.post("/api/subscriptions/dev-activate", json={
            "plan_id": "china_function",
            "function_codes": ["Sea", "Air"],
        }, headers=_auth(token))
        assert r.status_code == 400
        assert "只能选择 1 个" in r.get_json()["message"]

    def test_dev_activate_china_function_invalid_function(self, app, client, db_session):
        emp_user = _make_employer_user(app, db_session, "emp_api2f@ex.com")
        token = client.post("/api/auth/login", json={"email": "emp_api2f@ex.com", "password": "Pass123!"}).get_json()["access_token"]

        r = client.post("/api/subscriptions/dev-activate", json={
            "plan_id": "china_function",
            "function_codes": ["INVALID"],
        }, headers=_auth(token))
        assert r.status_code == 400

    def test_dev_activate_invalid_billing_cycle(self, app, client, db_session):
        emp_user = _make_employer_user(app, db_session, "emp_api2g@ex.com")
        token = client.post("/api/auth/login", json={"email": "emp_api2g@ex.com", "password": "Pass123!"}).get_json()["access_token"]

        r = client.post("/api/subscriptions/dev-activate", json={
            "plan_id": "china_all_functions",
            "billing_cycle": "weekly",
        }, headers=_auth(token))
        assert r.status_code == 400

    def test_get_plans(self, app, client):
        r = client.get("/api/subscriptions/plans")
        assert r.status_code == 200
        data = r.get_json()
        assert data["success"] is True
        plans = data["plans"]
        assert len(plans) == 2
        plan_ids = [p["id"] for p in plans]
        assert "china_function" in plan_ids
        assert "china_all_functions" in plan_ids

        # Verify pricing for china_function
        cf = next(p for p in plans if p["id"] == "china_function")
        assert cf["monthly_price"] == 700
        assert cf["annual_price"] == 7140
        assert cf["annual_discount"] == 0.85
        assert cf["area_scope"] == "China"

        # Verify pricing for china_all_functions
        ca = next(p for p in plans if p["id"] == "china_all_functions")
        assert ca["monthly_price"] == 850
        assert ca["annual_price"] == 8670
        assert ca["annual_discount"] == 0.85


class TestChinaScopeExpansion:
    """Test that GREAT_CHINA subscription covers all China sub-areas."""

    def test_china_covers_east_china(self, app, client, db_session):
        """China + Sea sub should unlock Sea + EAST_CHINA candidate."""
        emp_user = _make_employer_user(app, db_session, "emp_china1@ex.com")
        cand_user = _make_candidate_user(app, db_session, "cand_china1@ex.com")
        cand = _make_candidate(app, db_session, cand_user.id,
                        function_code="Sea", business_area_code="EAST_CHINA")
        _make_subscription(app, db_session, emp_user.id,
                           function_codes=["Sea"], business_area_codes=["GREAT_CHINA"])

        token = client.post("/api/auth/login", json={
            "email": "emp_china1@ex.com", "password": "Pass123!"}).get_json()["access_token"]
        r = client.get(f"/api/candidates/{cand.id}", headers=_auth(token))
        assert r.status_code == 200
        assert r.get_json()["candidate"].get("private_visible") is True

    def test_china_covers_north_china(self, app, client, db_session):
        """China + Sea sub should unlock Sea + NORTH_CHINA candidate."""
        emp_user = _make_employer_user(app, db_session, "emp_china1b@ex.com")
        cand_user = _make_candidate_user(app, db_session, "cand_china1b@ex.com")
        cand = _make_candidate(app, db_session, cand_user.id,
                        function_code="Sea", business_area_code="NORTH_CHINA")
        _make_subscription(app, db_session, emp_user.id,
                           function_codes=["Sea"], business_area_codes=["GREAT_CHINA"])

        token = client.post("/api/auth/login", json={
            "email": "emp_china1b@ex.com", "password": "Pass123!"}).get_json()["access_token"]
        r = client.get(f"/api/candidates/{cand.id}", headers=_auth(token))
        assert r.get_json()["candidate"].get("private_visible") is True

    def test_china_covers_hong_kong(self, app, client, db_session):
        """China + Sea sub should unlock Sea + HONG_KONG candidate."""
        emp_user = _make_employer_user(app, db_session, "emp_china1c@ex.com")
        cand_user = _make_candidate_user(app, db_session, "cand_china1c@ex.com")
        cand = _make_candidate(app, db_session, cand_user.id,
                        function_code="Sea", business_area_code="HONG_KONG")
        _make_subscription(app, db_session, emp_user.id,
                           function_codes=["Sea"], business_area_codes=["GREAT_CHINA"])

        token = client.post("/api/auth/login", json={
            "email": "emp_china1c@ex.com", "password": "Pass123!"}).get_json()["access_token"]
        r = client.get(f"/api/candidates/{cand.id}", headers=_auth(token))
        assert r.get_json()["candidate"].get("private_visible") is True

    def test_china_sea_does_not_unlock_air(self, app, client, db_session):
        """China + Sea sub should NOT unlock Air + EAST_CHINA candidate."""
        emp_user = _make_employer_user(app, db_session, "emp_china2@ex.com")
        cand_user = _make_candidate_user(app, db_session, "cand_china2@ex.com")
        cand = _make_candidate(app, db_session, cand_user.id,
                        function_code="Air", business_area_code="EAST_CHINA")
        _make_subscription(app, db_session, emp_user.id,
                           function_codes=["Sea"], business_area_codes=["GREAT_CHINA"])

        token = client.post("/api/auth/login", json={
            "email": "emp_china2@ex.com", "password": "Pass123!"}).get_json()["access_token"]
        r = client.get(f"/api/candidates/{cand.id}", headers=_auth(token))
        assert r.get_json()["candidate"].get("private_visible") is False

    def test_china_all_unlocks_all_functions(self, app, client, db_session):
        """China + ALL sub should unlock Air + EAST_CHINA candidate."""
        emp_user = _make_employer_user(app, db_session, "emp_china3@ex.com")
        cand_user = _make_candidate_user(app, db_session, "cand_china3@ex.com")
        cand = _make_candidate(app, db_session, cand_user.id,
                        function_code="Air", business_area_code="EAST_CHINA")
        _make_subscription(app, db_session, emp_user.id,
                           function_codes=["ALL"], business_area_codes=["GREAT_CHINA"])

        token = client.post("/api/auth/login", json={
            "email": "emp_china3@ex.com", "password": "Pass123!"}).get_json()["access_token"]
        r = client.get(f"/api/candidates/{cand.id}", headers=_auth(token))
        assert r.get_json()["candidate"].get("private_visible") is True

    def test_china_all_unlocks_road(self, app, client, db_session):
        """China + ALL sub should unlock Road + SOUTH_CHINA candidate."""
        emp_user = _make_employer_user(app, db_session, "emp_china3b@ex.com")
        cand_user = _make_candidate_user(app, db_session, "cand_china3b@ex.com")
        cand = _make_candidate(app, db_session, cand_user.id,
                        function_code="Road", business_area_code="SOUTH_CHINA")
        _make_subscription(app, db_session, emp_user.id,
                           function_codes=["ALL"], business_area_codes=["GREAT_CHINA"])

        token = client.post("/api/auth/login", json={
            "email": "emp_china3b@ex.com", "password": "Pass123!"}).get_json()["access_token"]
        r = client.get(f"/api/candidates/{cand.id}", headers=_auth(token))
        assert r.get_json()["candidate"].get("private_visible") is True

    def test_china_does_not_cover_overseas(self, app, client, db_session):
        """China sub should NOT unlock OVERSEAS candidate."""
        emp_user = _make_employer_user(app, db_session, "emp_china4@ex.com")
        cand_user = _make_candidate_user(app, db_session, "cand_china4@ex.com")
        cand = _make_candidate(app, db_session, cand_user.id,
                        function_code="Sea", business_area_code="OVERSEAS")
        _make_subscription(app, db_session, emp_user.id,
                           function_codes=["ALL"], business_area_codes=["GREAT_CHINA"])

        token = client.post("/api/auth/login", json={
            "email": "emp_china4@ex.com", "password": "Pass123!"}).get_json()["access_token"]
        r = client.get(f"/api/candidates/{cand.id}", headers=_auth(token))
        assert r.get_json()["candidate"].get("private_visible") is False

    def test_east_china_alone_no_expansion(self, app, client, db_session):
        """Sub with only EAST_CHINA should NOT expand to cover NORTH_CHINA.
        China scope expansion only triggers for GREAT_CHINA or CHINA keys."""
        emp_user = _make_employer_user(app, db_session, "emp_china5@ex.com")
        cand_user = _make_candidate_user(app, db_session, "cand_china5@ex.com")
        cand = _make_candidate(app, db_session, cand_user.id,
                        function_code="Sea", business_area_code="NORTH_CHINA")
        _make_subscription(app, db_session, emp_user.id,
                           function_codes=["Sea"], business_area_codes=["EAST_CHINA"])

        token = client.post("/api/auth/login", json={
            "email": "emp_china5@ex.com", "password": "Pass123!"}).get_json()["access_token"]
        r = client.get(f"/api/candidates/{cand.id}", headers=_auth(token))
        # EAST_CHINA alone should NOT unlock NORTH_CHINA candidate
        assert r.get_json()["candidate"].get("private_visible") is False

    def test_annual_price_calculation(self, app, client):
        """Verify annual_price = monthly * 12 * 0.85."""
        r = client.get("/api/subscriptions/plans")
        plans = r.get_json()["plans"]
        for p in plans:
            expected = int(p["monthly_price"] * 12 * 0.85)
            assert p["annual_price"] == expected, \
                f"{p['id']}: expected {expected}, got {p['annual_price']}"
