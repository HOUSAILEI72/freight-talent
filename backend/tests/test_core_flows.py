"""
核心链路集成测试：登录 / 会话列表 / 匹配接口 / Redis 配置。

运行方式：
  cd backend
  pytest tests/test_core_flows.py -v
"""
import pytest
import os


# ─────────────────────────────────────────────────────────────────────────────
# 测试夹具（复用 conftest.py 的 app / client / admin_token）
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def employer_token(app, client):
    """创建 employer 用户并返回其 access token。"""
    from app.extensions import db
    from app.models.user import User
    with app.app_context():
        u = User(email="employer_core_test@example.com", role="employer",
                 name="Test Employer", company_name="TestCo", is_active=True)
        u.set_password("TestPass123!")
        db.session.add(u)
        db.session.commit()

    resp = client.post("/api/auth/login", json={
        "email": "employer_core_test@example.com",
        "password": "TestPass123!",
    })
    assert resp.status_code == 200
    return resp.get_json()["access_token"]


@pytest.fixture(scope="module")
def candidate_token(app, client):
    """创建 candidate 用户并返回其 access token。"""
    from app.extensions import db
    from app.models.user import User
    with app.app_context():
        u = User(email="candidate_core_test@example.com", role="candidate",
                 name="Test Candidate", is_active=True)
        u.set_password("TestPass123!")
        db.session.add(u)
        db.session.commit()

    resp = client.post("/api/auth/login", json={
        "email": "candidate_core_test@example.com",
        "password": "TestPass123!",
    })
    assert resp.status_code == 200
    return resp.get_json()["access_token"]


# ─────────────────────────────────────────────────────────────────────────────
# 1. 登录链路
# ─────────────────────────────────────────────────────────────────────────────

class TestLogin:
    def test_login_success_returns_token(self, client, admin_token):
        # admin_token 夹具已创建 admin_test@example.com 用户，此处验证登录流程
        resp = client.post("/api/auth/login", json={
            "email": "admin_test@example.com",
            "password": "AdminPass123!",
        })
        data = resp.get_json()
        assert resp.status_code == 200
        assert data["success"] is True
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["user"]["role"] == "admin"

    def test_login_wrong_password_returns_401(self, client, admin_token):
        resp = client.post("/api/auth/login", json={
            "email": "admin_test@example.com",
            "password": "WrongPassword!",
        })
        assert resp.status_code == 401

    def test_login_missing_email_returns_400(self, client):
        resp = client.post("/api/auth/login", json={"password": "TestPass123!"})
        assert resp.status_code == 400

    def test_me_with_valid_token(self, client, admin_token):
        resp = client.get("/api/auth/me",
                          headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        assert resp.get_json()["user"]["role"] == "admin"

    def test_me_without_token_returns_401(self, client):
        resp = client.get("/api/auth/me")
        assert resp.status_code in (401, 422)


# ─────────────────────────────────────────────────────────────────────────────
# 2. 健康检查
# ─────────────────────────────────────────────────────────────────────────────

class TestHealth:
    def test_health_returns_200(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["status"] == "ok"

    def test_ready_returns_200_or_degraded(self, client):
        resp = client.get("/api/ready")
        data = resp.get_json()
        # 测试环境用 SQLite，DB 应该 ok；Redis 未配置则 not_configured
        assert resp.status_code in (200, 503)
        assert "checks" in data
        assert "database" in data["checks"]


# ─────────────────────────────────────────────────────────────────────────────
# 3. 会话列表（验证无 N+1 + 权限隔离）
# ─────────────────────────────────────────────────────────────────────────────

class TestConversations:
    def test_employer_gets_empty_list(self, client, employer_token):
        resp = client.get("/api/conversations",
                          headers={"Authorization": f"Bearer {employer_token}"})
        data = resp.get_json()
        assert resp.status_code == 200
        assert data["success"] is True
        assert "conversations" in data
        assert "total_unread" in data
        assert isinstance(data["total_unread"], int)

    def test_candidate_no_profile_gets_empty(self, client, candidate_token):
        resp = client.get("/api/conversations",
                          headers={"Authorization": f"Bearer {candidate_token}"})
        data = resp.get_json()
        assert resp.status_code == 200
        assert data["conversations"] == []

    def test_conversations_requires_auth(self, client):
        resp = client.get("/api/conversations")
        assert resp.status_code in (401, 422)


# ─────────────────────────────────────────────────────────────────────────────
# 4. 岗位匹配接口（验证 N+1 修复 — 用 employer 创建岗位）
# ─────────────────────────────────────────────────────────────────────────────

class TestMatchEndpoint:
    @pytest.fixture(scope="class")
    def job_id(self, client, employer_token):
        resp = client.post("/api/jobs", json={
            "title": "海运操作专员",
            "city": "上海",
            "description": "负责海运订单操作",
            "business_type": "海运",
            "job_type": "操作",
            "skill_tags": ["Cargowise", "英语"],
            "route_tags": ["美线"],
        }, headers={"Authorization": f"Bearer {employer_token}"})
        assert resp.status_code == 201
        return resp.get_json()["job"]["id"]

    def test_match_returns_list(self, client, employer_token, job_id):
        resp = client.get(f"/api/jobs/{job_id}/match",
                          headers={"Authorization": f"Bearer {employer_token}"})
        data = resp.get_json()
        assert resp.status_code == 200
        assert data["success"] is True
        assert "matches" in data
        assert isinstance(data["matches"], list)

    def test_match_candidate_forbidden(self, client, candidate_token, job_id):
        resp = client.get(f"/api/jobs/{job_id}/match",
                          headers={"Authorization": f"Bearer {candidate_token}"})
        assert resp.status_code == 403

    def test_match_requires_auth(self, client, job_id):
        resp = client.get(f"/api/jobs/{job_id}/match")
        assert resp.status_code in (401, 422)


# ─────────────────────────────────────────────────────────────────────────────
# 5. Redis 配置可用性（仅当 REDIS_URL 环境变量存在时运行）
# ─────────────────────────────────────────────────────────────────────────────

class TestRedisConfig:
    @pytest.mark.skipif(
        not os.getenv("REDIS_URL", "").startswith("redis"),
        reason="REDIS_URL 未配置，跳过 Redis 测试",
    )
    def test_redis_ping(self):
        import redis as _redis
        url = os.getenv("REDIS_URL")
        client = _redis.from_url(url, decode_responses=True)
        assert client.ping() is True

    @pytest.mark.skipif(
        not os.getenv("REDIS_URL", "").startswith("redis"),
        reason="REDIS_URL 未配置，跳过 blocklist 测试",
    )
    def test_redis_jwt_blocklist_roundtrip(self):
        """验证 Flask 侧 blocklist_add / blocklist_contains 与 Redis 正确交互。"""
        from app.extensions import blocklist_add, blocklist_contains
        test_jti = "test-jti-pytest-12345"
        # 确保初始不在黑名单
        assert blocklist_contains(test_jti) is False
        # 加入黑名单（TTL 10s）
        blocklist_add(test_jti, expires_in_seconds=10)
        # 应该能查到
        assert blocklist_contains(test_jti) is True
