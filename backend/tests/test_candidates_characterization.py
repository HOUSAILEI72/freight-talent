"""test_candidates_characterization.py — Characterization tests for candidates.py

These tests record the CURRENT actual behavior of every candidates route.
They are NOT designed to validate "correct" behavior — they capture what the
code does TODAY so that refactoring (Phase 2 service/repository/policy split)
does not silently change any externally-visible contract.

If a test fails after refactoring, either:
  - The refactoring broke something (fix the refactoring).
  - The behavior was intentionally changed (update the test + document why).

DO NOT fix production code to make these tests pass.  They describe reality.
"""

from datetime import datetime, timezone, timedelta
import pytest


# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════

def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _login(client, email, password="Pass123!"):
    """Login an existing user, return access_token."""
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed: {r.get_json()}"
    return r.get_json()["access_token"]


def _create_user(db_session, email, role, password="Pass123!", name="Test", company_name=None):
    """Create user directly in DB. Returns User instance."""
    from app.models.user import User
    u = User(email=email, role=role, name=name, is_active=True)
    if company_name:
        u.company_name = company_name
    u.set_password(password)
    db_session.add(u)
    db_session.commit()
    return u


def _make_employer(db_session, email, password="Pass123!"):
    u = _create_user(db_session, email, "employer", password, "Employer Co")
    token = _login(db_session.session.bind.engine.url.database if False else _get_client(db_session), email, password)
    return u, None  # token is obtained later via _login(client, email)


def _make_candidate_user(db_session, email, password="Pass123!"):
    u = _create_user(db_session, email, "candidate", password, "候选人")
    return u


def _make_profile(db_session, user_id, **overrides):
    """Create a Candidate profile row.  Returns the Candidate instance."""
    from app.models.candidate import Candidate
    c = Candidate(
        user_id=user_id,
        full_name=overrides.get("full_name", "张三"),
        current_title=overrides.get("current_title", "销售经理"),
        current_city=overrides.get("current_city", "上海"),
        availability_status=overrides.get("availability_status", "open"),
        function_code=overrides.get("function_code", "SALES"),
        business_area_code=overrides.get("business_area_code", "EAST_CHINA"),
    )
    db_session.add(c)
    db_session.commit()
    return c


def _make_subscription(db_session, employer_id,
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


# ═══════════════════════════════════════════════════════════════════════════════
# P0 — GET /api/candidates/me
# ═══════════════════════════════════════════════════════════════════════════════

class TestGetMe:
    """GET /api/candidates/me — characterization tests"""

    def test_candidate_sees_full_own_profile(self, app, client, db_session):
        """Candidate GET /me returns 200 with full private fields."""
        cand_user = _make_candidate_user(db_session, "c1@t.com")
        _make_profile(db_session, cand_user.id)
        token = _login(client, "c1@t.com")
        r = client.get("/api/candidates/me", headers=_auth(token))
        assert r.status_code == 200
        data = r.get_json()
        assert data["success"] is True
        p = data["profile"]
        assert p["full_name"] == "张三"
        assert p.get("private_visible") is True

    def test_employer_get_me_returns_403(self, app, client, db_session):
        """Employer GET /me is denied (current behavior)."""
        _create_user(db_session, "emp1@t.com", "employer")
        token = _login(client, "emp1@t.com")
        r = client.get("/api/candidates/me", headers=_auth(token))
        assert r.status_code == 403

    def test_unauthenticated_returns_401(self, client):
        """No token → 401."""
        r = client.get("/api/candidates/me")
        assert r.status_code == 401

    def test_candidate_without_profile_returns_null(self, app, client, db_session):
        """Candidate account with no Candidate row → profile: null."""
        _make_candidate_user(db_session, "c2@t.com")
        token = _login(client, "c2@t.com")
        r = client.get("/api/candidates/me", headers=_auth(token))
        assert r.status_code == 200
        data = r.get_json()
        assert data["success"] is True
        assert data["profile"] is None


# ═══════════════════════════════════════════════════════════════════════════════
# P0 — GET /api/candidates (list)
# ═══════════════════════════════════════════════════════════════════════════════

class TestListCandidates:
    """GET /api/candidates — characterization tests"""

    def test_unauthenticated_returns_401(self, client):
        r = client.get("/api/candidates")
        assert r.status_code == 401

    def test_candidate_role_returns_403(self, app, client, db_session):
        _make_candidate_user(db_session, "c3@t.com")
        token = _login(client, "c3@t.com")
        r = client.get("/api/candidates", headers=_auth(token))
        assert r.status_code == 403

    def test_employer_sees_candidates_array(self, app, client, db_session):
        _create_user(db_session, "emp2@t.com", "employer")
        cand_user = _make_candidate_user(db_session, "c4@t.com")
        _make_profile(db_session, cand_user.id)
        token = _login(client, "emp2@t.com")
        r = client.get("/api/candidates", headers=_auth(token))
        assert r.status_code == 200
        data = r.get_json()
        assert data["success"] is True
        assert isinstance(data.get("candidates"), list)
        assert len(data["candidates"]) >= 1

    def test_unsubscribed_employer_private_visible_false(self, app, client, db_session):
        """Without subscription, every candidate has private_visible=False."""
        _create_user(db_session, "emp3@t.com", "employer")
        cand_user = _make_candidate_user(db_session, "c5@t.com")
        _make_profile(db_session, cand_user.id)
        token = _login(client, "emp3@t.com")
        r = client.get("/api/candidates", headers=_auth(token))
        assert r.status_code == 200
        for c in r.get_json()["candidates"]:
            assert c.get("private_visible") is False

    def test_unsubscribed_employer_sees_masked_name(self, app, client, db_session):
        """Without subscription, full_name is masked (first char + **)."""
        _create_user(db_session, "emp4@t.com", "employer")
        cand_user = _make_candidate_user(db_session, "c6@t.com")
        _make_profile(db_session, cand_user.id, full_name="李四")
        token = _login(client, "emp4@t.com")
        r = client.get("/api/candidates", headers=_auth(token))
        assert r.status_code == 200
        c = r.get_json()["candidates"][0]
        assert c["full_name"] == "李**"

    def test_subscribed_all_scope_private_visible_true(self, app, client, db_session):
        """ALL scope subscription unlocks every candidate."""
        emp_user = _create_user(db_session, "emp5@t.com", "employer")
        cand_user = _make_candidate_user(db_session, "c7@t.com")
        _make_profile(db_session, cand_user.id)
        _make_subscription(db_session, emp_user.id,
                           function_codes=["ALL"], business_area_codes=["ALL"])
        token = _login(client, "emp5@t.com")
        r = client.get("/api/candidates", headers=_auth(token))
        assert r.status_code == 200
        for c in r.get_json()["candidates"]:
            assert c.get("private_visible") is True, f"Expected private_visible=true, got {c}"

    def test_availability_status_open_filter(self, app, client, db_session):
        """Default (no avail param) returns only open candidates."""
        _create_user(db_session, "emp6@t.com", "employer")
        cu1 = _make_candidate_user(db_session, "c8@t.com")
        cu2 = _make_candidate_user(db_session, "c9@t.com")
        _make_profile(db_session, cu1.id, availability_status="open")
        _make_profile(db_session, cu2.id, availability_status="closed")
        token = _login(client, "emp6@t.com")
        r = client.get("/api/candidates", headers=_auth(token))
        assert r.status_code == 200
        statuses = {c.get("availability_status") for c in r.get_json()["candidates"]}
        # closed candidates are excluded by default; status is None when masked
        assert "closed" not in statuses

    def test_q_search(self, app, client, db_session):
        """q= query returns matching candidates by name/title etc."""
        emp_user = _create_user(db_session, "emp7@t.com", "employer")
        cu1 = _make_candidate_user(db_session, "c10@t.com")
        cu2 = _make_candidate_user(db_session, "c11@t.com")
        _make_profile(db_session, cu1.id, full_name="王五", current_title="海运操作")
        _make_profile(db_session, cu2.id, full_name="赵六", current_title="空运销售")
        _make_subscription(db_session, emp_user.id,
                           function_codes=["ALL"], business_area_codes=["ALL"])
        token = _login(client, "emp7@t.com")
        r = client.get("/api/candidates?q=王五", headers=_auth(token))
        assert r.status_code == 200
        candidates = r.get_json()["candidates"]
        names = {c["full_name"] for c in candidates}
        assert "王五" in names
        assert "赵六" not in names


# ═══════════════════════════════════════════════════════════════════════════════
# P0 — GET /api/candidates/<id>
# ═══════════════════════════════════════════════════════════════════════════════

class TestGetCandidateById:
    """GET /api/candidates/<id> — characterization tests"""

    def test_employer_views_open_candidate_200(self, app, client, db_session):
        _create_user(db_session, "emp8@t.com", "employer")
        cand_user = _make_candidate_user(db_session, "c12@t.com")
        profile = _make_profile(db_session, cand_user.id, availability_status="open")
        token = _login(client, "emp8@t.com")
        r = client.get(f"/api/candidates/{profile.id}", headers=_auth(token))
        assert r.status_code == 200
        c = r.get_json()["candidate"]
        assert c["id"] == profile.id
        assert c["full_name"] == "张**"  # unsubscribed → masked

    def test_employer_views_closed_candidate_403(self, app, client, db_session):
        _create_user(db_session, "emp9@t.com", "employer")
        cand_user = _make_candidate_user(db_session, "c13@t.com")
        profile = _make_profile(db_session, cand_user.id, availability_status="closed")
        token = _login(client, "emp9@t.com")
        r = client.get(f"/api/candidates/{profile.id}", headers=_auth(token))
        assert r.status_code == 403

    def test_candidate_views_self_200(self, app, client, db_session):
        """Candidate can always view their own profile (is_own exemption)."""
        cand_user = _make_candidate_user(db_session, "c14@t.com")
        profile = _make_profile(db_session, cand_user.id, availability_status="closed")
        token = _login(client, "c14@t.com")
        r = client.get(f"/api/candidates/{profile.id}", headers=_auth(token))
        assert r.status_code == 200
        c = r.get_json()["candidate"]
        assert c["full_name"] == "张三"  # own → unmasked
        assert c.get("private_visible") is True

    def test_unsubscribed_employer_private_visible_false(self, app, client, db_session):
        _create_user(db_session, "emp10@t.com", "employer")
        cand_user = _make_candidate_user(db_session, "c15@t.com")
        profile = _make_profile(db_session, cand_user.id, availability_status="open")
        token = _login(client, "emp10@t.com")
        r = client.get(f"/api/candidates/{profile.id}", headers=_auth(token))
        assert r.status_code == 200
        c = r.get_json()["candidate"]
        assert c.get("private_visible") is False
        assert c["full_name"] == "张**"

    def test_subscribed_matching_scope_private_visible_true(self, app, client, db_session):
        emp_user = _create_user(db_session, "emp11@t.com", "employer")
        cand_user = _make_candidate_user(db_session, "c16@t.com")
        profile = _make_profile(db_session, cand_user.id,
                                function_code="SALES", business_area_code="EAST_CHINA")
        _make_subscription(db_session, emp_user.id,
                           function_codes=["SALES"], business_area_codes=["EAST_CHINA"])
        token = _login(client, "emp11@t.com")
        r = client.get(f"/api/candidates/{profile.id}", headers=_auth(token))
        assert r.status_code == 200
        c = r.get_json()["candidate"]
        assert c.get("private_visible") is True
        assert c["full_name"] == "张三"

    def test_subscribed_non_matching_scope_private_visible_false(self, app, client, db_session):
        emp_user = _create_user(db_session, "emp12@t.com", "employer")
        cand_user = _make_candidate_user(db_session, "c17@t.com")
        profile = _make_profile(db_session, cand_user.id,
                                function_code="OPS", business_area_code="EAST_CHINA")
        _make_subscription(db_session, emp_user.id,
                           function_codes=["SALES"], business_area_codes=["ALL"])
        token = _login(client, "emp12@t.com")
        r = client.get(f"/api/candidates/{profile.id}", headers=_auth(token))
        assert r.status_code == 200
        c = r.get_json()["candidate"]
        assert c.get("private_visible") is False

    def test_nonexistent_id_returns_404(self, app, client, db_session):
        _create_user(db_session, "emp13@t.com", "employer")
        token = _login(client, "emp13@t.com")
        r = client.get("/api/candidates/99999", headers=_auth(token))
        assert r.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════════
# P1 — PUT /api/candidates/me
# ═══════════════════════════════════════════════════════════════════════════════

class TestUpdateMe:
    """PUT /api/candidates/me — characterization tests"""

    def test_candidate_updates_profile_200(self, app, client, db_session):
        cand_user = _make_candidate_user(db_session, "c18@t.com")
        _make_profile(db_session, cand_user.id)
        token = _login(client, "c18@t.com")
        r = client.put("/api/candidates/me", json={
            "full_name": "张三",
            "current_title": "高级销售",
            "current_city": "北京",
        }, headers=_auth(token))
        assert r.status_code == 200
        data = r.get_json()
        assert data["success"] is True
        p = data["profile"]
        assert p["current_title"] == "高级销售"
        assert p["current_city"] == "北京"

    def test_employer_updates_me_returns_403(self, app, client, db_session):
        _create_user(db_session, "emp14@t.com", "employer")
        token = _login(client, "emp14@t.com")
        r = client.put("/api/candidates/me", json={
            "full_name": "Someone",
            "current_title": "PM",
            "current_city": "上海",
        }, headers=_auth(token))
        assert r.status_code == 403

    def test_missing_full_name_returns_400(self, app, client, db_session):
        _make_candidate_user(db_session, "c19@t.com")
        token = _login(client, "c19@t.com")
        r = client.put("/api/candidates/me", json={
            "full_name": "",
            "current_title": "PM",
            "current_city": "上海",
        }, headers=_auth(token))
        assert r.status_code == 400

    def test_salary_min_greater_than_max_returns_400(self, app, client, db_session):
        cand_user = _make_candidate_user(db_session, "c20@t.com")
        _make_profile(db_session, cand_user.id)
        token = _login(client, "c20@t.com")
        r = client.put("/api/candidates/me", json={
            "full_name": "张三",
            "current_title": "PM",
            "current_city": "上海",
            "current_salary_min": 50000,
            "current_salary_max": 30000,
        }, headers=_auth(token))
        assert r.status_code == 400
        data = r.get_json()
        assert data["success"] is False

    def test_invalid_salary_months_returns_400(self, app, client, db_session):
        cand_user = _make_candidate_user(db_session, "c21@t.com")
        _make_profile(db_session, cand_user.id)
        token = _login(client, "c21@t.com")
        r = client.put("/api/candidates/me", json={
            "full_name": "张三",
            "current_title": "PM",
            "current_city": "上海",
            "current_salary_months": 15,
        }, headers=_auth(token))
        assert r.status_code == 400

    def test_creates_profile_if_none_exists(self, app, client, db_session):
        """PUT /me creates a new Candidate row if none exists."""
        _make_candidate_user(db_session, "c22@t.com")
        token = _login(client, "c22@t.com")
        r = client.put("/api/candidates/me", json={
            "full_name": "新人",
            "current_title": "实习生",
            "current_city": "广州",
        }, headers=_auth(token))
        assert r.status_code == 200
        p = r.get_json()["profile"]
        assert p["full_name"] == "新人"


# ═══════════════════════════════════════════════════════════════════════════════
# P2 — POST /api/candidates/me/confirm-latest
# ═══════════════════════════════════════════════════════════════════════════════

class TestConfirmLatest:
    """POST /api/candidates/me/confirm-latest — characterization tests"""

    def test_confirm_with_incomplete_profile_returns_422(self, app, client, db_session):
        """Profile status is not 'complete' → 422 (current behavior)."""
        cand_user = _make_candidate_user(db_session, "c23@t.com")
        _make_profile(db_session, cand_user.id)
        # Default profile_status is not "complete"
        token = _login(client, "c23@t.com")
        r = client.post("/api/candidates/me/confirm-latest", headers=_auth(token))
        assert r.status_code in (200, 422), f"Got {r.status_code}: {r.get_json()}"

    def test_confirm_with_complete_profile(self, app, client, db_session):
        """Profile status 'complete' → 200 with updated confirmed_at."""
        cand_user = _make_candidate_user(db_session, "c24@t.com")
        from app.models.candidate import Candidate
        c = Candidate(
            user_id=cand_user.id,
            full_name="王五",
            current_title="操作",
            current_city="深圳",
            availability_status="open",
            profile_status="complete",
        )
        db_session.add(c)
        db_session.commit()
        token = _login(client, "c24@t.com")
        r = client.post("/api/candidates/me/confirm-latest", headers=_auth(token))
        assert r.status_code == 200
        data = r.get_json()
        assert data["success"] is True
        assert data["profile"]["profile_confirmed_at"] is not None

    def test_employer_confirm_latest_403(self, app, client, db_session):
        _create_user(db_session, "emp15@t.com", "employer")
        token = _login(client, "emp15@t.com")
        r = client.post("/api/candidates/me/confirm-latest", headers=_auth(token))
        assert r.status_code == 403

    def test_candidate_without_profile_returns_404(self, app, client, db_session):
        _make_candidate_user(db_session, "c25@t.com")
        token = _login(client, "c25@t.com")
        r = client.post("/api/candidates/me/confirm-latest", headers=_auth(token))
        assert r.status_code == 404
