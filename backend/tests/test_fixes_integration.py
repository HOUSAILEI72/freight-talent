"""
test_fixes_integration.py — 验证本次修复的各个缺陷

覆盖：
  1. auth 契约：login / register / refresh 均返回 access_token
  2. tags 类型校验：route_tags / skill_tags 传非数组 → 400
  3. tags 元素类型：传入含非字符串元素 → 400
  4. 候选人自查：候选人可通过 GET /api/candidates/<id> 查自己
  5. 候选人不可查他人（closed 外的隐私场景）
"""
import pytest
from app.extensions import db
from app.models.user import User
from app.models.candidate import Candidate
from flask_jwt_extended import create_access_token


# ---------------------------------------------------------------------------
# 辅助
# ---------------------------------------------------------------------------

def _make_user(app, email, role, name="TestUser"):
    with app.app_context():
        u = User(email=email, role=role, name=name, is_active=True)
        u.set_password("Pass1234!")
        db.session.add(u)
        db.session.commit()
        uid = u.id
        token = create_access_token(identity=str(uid))
    return uid, token


# ---------------------------------------------------------------------------
# 1. Auth 契约 — 所有端点统一返回 access_token
# ---------------------------------------------------------------------------

def test_login_returns_access_token_key(client):
    resp = client.post("/api/auth/login", json={
        "email": "admin_test@example.com",
        "password": "AdminPass123!",
    })
    assert resp.status_code == 200
    body = resp.get_json()
    assert "access_token" in body, f"login 返回缺少 access_token，实际：{list(body)}"
    assert "token" not in body, "login 不应返回旧字段 'token'"


def test_register_returns_access_token_key(app, client):
    resp = client.post("/api/auth/register", json={
        "email": "newreg_test@example.com",
        "password": "Pass1234!",
        "name": "新用户",
        "role": "candidate",
    })
    assert resp.status_code == 201
    body = resp.get_json()
    assert "access_token" in body


def test_refresh_returns_access_token_key(app, client, admin_token):
    login_resp = client.post("/api/auth/login", json={
        "email": "admin_test@example.com",
        "password": "AdminPass123!",
    })
    refresh_token = login_resp.get_json()["refresh_token"]

    resp = client.post(
        "/api/auth/refresh",
        headers={"Authorization": f"Bearer {refresh_token}"},
    )
    assert resp.status_code == 200
    body = resp.get_json()
    assert "access_token" in body


# ---------------------------------------------------------------------------
# 2 & 3. Tags 类型校验 — jobs
# ---------------------------------------------------------------------------

def test_create_job_route_tags_not_list_returns_400(app, client, admin_token):
    resp = client.post(
        "/api/jobs",
        json={
            "title": "测试岗位",
            "city": "上海",
            "description": "描述",
            "route_tags": "美线",        # 字符串而非数组
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 400
    assert "route_tags" in resp.get_json().get("message", "")


def test_create_job_skill_tags_non_string_element_returns_400(app, client, admin_token):
    resp = client.post(
        "/api/jobs",
        json={
            "title": "测试岗位",
            "city": "上海",
            "description": "描述",
            "skill_tags": ["Cargowise", 123],   # 含数字元素
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 400
    assert "skill_tags" in resp.get_json().get("message", "")


# ---------------------------------------------------------------------------
# 2 & 3. Tags 类型校验 — candidates
# ---------------------------------------------------------------------------

def test_update_candidate_route_tags_not_list_returns_400(app, client):
    uid, token = _make_user(app, "cand_tags@example.com", "candidate", "候选人A")
    resp = client.put(
        "/api/candidates/me",
        json={
            "full_name": "候选人A",
            "current_title": "操作员",
            "current_city": "上海",
            "route_tags": "美线",   # 字符串而非数组
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400
    assert "route_tags" in resp.get_json().get("message", "")


def test_update_candidate_skill_tags_non_string_element_returns_400(app, client):
    uid, token = _make_user(app, "cand_tags2@example.com", "candidate", "候选人B")
    resp = client.put(
        "/api/candidates/me",
        json={
            "full_name": "候选人B",
            "current_title": "操作员",
            "current_city": "上海",
            "skill_tags": [True, "英语"],   # 含布尔元素
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400
    assert "skill_tags" in resp.get_json().get("message", "")


# ---------------------------------------------------------------------------
# 4. 候选人自查 — GET /api/candidates/<id>
# ---------------------------------------------------------------------------

def test_candidate_can_view_own_profile(app, client):
    uid, token = _make_user(app, "self_view@example.com", "candidate", "自查用户")

    # 先建档案
    client.put(
        "/api/candidates/me",
        json={
            "full_name": "自查用户",
            "current_title": "操作员",
            "current_city": "上海",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    with app.app_context():
        profile = Candidate.query.filter_by(user_id=uid).first()
        cid = profile.id

    resp = client.get(
        f"/api/candidates/{cid}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.get_json()["candidate"]["id"] == cid


# ---------------------------------------------------------------------------
# 5. 候选人不可查他人
# ---------------------------------------------------------------------------

def test_candidate_cannot_view_other_candidate(app, client):
    _, token_a = _make_user(app, "cand_other_a@example.com", "candidate", "用户A")
    uid_b, _ = _make_user(app, "cand_other_b@example.com", "candidate", "用户B")

    # 为用户B建档案
    _, token_b = uid_b, _
    with app.app_context():
        u_b = User.query.filter_by(email="cand_other_b@example.com").first()
        prof_b = Candidate(user_id=u_b.id, full_name="用户B",
                           current_title="X", current_city="北京",
                           availability_status="open")
        db.session.add(prof_b)
        db.session.commit()
        cid_b = prof_b.id

    resp = client.get(
        f"/api/candidates/{cid_b}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert resp.status_code == 403
