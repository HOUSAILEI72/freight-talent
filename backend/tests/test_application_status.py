"""CAND-4B: Test application status transitions."""
import pytest
from app.models.user import User
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.job_application import JobApplication


@pytest.fixture
def candidate_user(db_session):
    u = User(
        email="cand_status@test.com",
        name="测试候选人",
        role="candidate",
        is_active=True,
    )
    u.set_password("pass123")
    db_session.add(u)
    db_session.commit()
    return u


@pytest.fixture
def candidate_profile(db_session, candidate_user):
    c = Candidate(
        user_id=candidate_user.id,
        full_name="测试候选人",
        current_title="操作员",
        current_city="上海",
        profile_status="complete",
    )
    db_session.add(c)
    db_session.commit()
    return c


@pytest.fixture
def employer_user(db_session):
    u = User(
        email="emp_status@test.com",
        name="测试企业用户",
        role="employer",
        company_name="测试企业",
        is_active=True,
    )
    u.set_password("pass123")
    db_session.add(u)
    db_session.commit()
    return u


@pytest.fixture
def employer_user_2(db_session):
    u = User(
        email="emp_status_2@test.com",
        name="另一家企业用户",
        role="employer",
        company_name="另一家企业",
        is_active=True,
    )
    u.set_password("pass123")
    db_session.add(u)
    db_session.commit()
    return u


@pytest.fixture
def admin_user(db_session):
    u = User(
        email="admin_status@test.com",
        name="测试管理员",
        role="admin",
        is_active=True,
    )
    u.set_password("pass123")
    db_session.add(u)
    db_session.commit()
    return u


@pytest.fixture
def job(db_session, employer_user):
    j = Job(
        title="测试岗位",
        company_id=employer_user.id,
        city="上海",
        description="测试岗位描述",
        status="published",
    )
    db_session.add(j)
    db_session.commit()
    return j


@pytest.fixture
def application(db_session, job, candidate_profile, employer_user):
    app = JobApplication(
        job_id=job.id,
        candidate_id=candidate_profile.id,
        employer_id=employer_user.id,
        status="submitted",
    )
    db_session.add(app)
    db_session.commit()
    return app


def test_candidate_withdraw_own_application(client, candidate_user, application):
    """Candidate can withdraw their own submitted application."""
    token = client.post("/api/auth/login", json={
        "email": "cand_status@test.com",
        "password": "pass123",
    }).json["access_token"]

    resp = client.patch(
        f"/api/applications/{application.id}/status",
        json={"status": "withdrawn"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json["success"] is True
    assert resp.json["application"]["status"] == "withdrawn"


def test_candidate_cannot_withdraw_others_application(client, candidate_user, employer_user_2, job, db_session):
    """Candidate cannot withdraw another candidate's application."""
    # Create another candidate
    other_user = User(
        email="other@test.com",
        name="其他候选人",
        role="candidate",
        is_active=True,
    )
    other_user.set_password("pass123")
    db_session.add(other_user)
    db_session.commit()

    other_profile = Candidate(
        user_id=other_user.id,
        full_name="其他候选人",
        current_title="操作员",
        current_city="上海",
        profile_status="complete",
    )
    db_session.add(other_profile)
    db_session.commit()

    other_app = JobApplication(
        job_id=job.id,
        candidate_id=other_profile.id,
        employer_id=employer_user_2.id,
        status="submitted",
    )
    db_session.add(other_app)
    db_session.commit()

    token = client.post("/api/auth/login", json={
        "email": "cand_status@test.com",
        "password": "pass123",
    }).json["access_token"]

    resp = client.patch(
        f"/api/applications/{other_app.id}/status",
        json={"status": "withdrawn"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


def test_candidate_cannot_change_to_viewed(client, candidate_user, application):
    """Candidate cannot change status to viewed/shortlisted/rejected."""
    token = client.post("/api/auth/login", json={
        "email": "cand_status@test.com",
        "password": "pass123",
    }).json["access_token"]

    resp = client.patch(
        f"/api/applications/{application.id}/status",
        json={"status": "viewed"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


def test_employer_mark_viewed(client, employer_user, application):
    """Employer can mark their application as viewed."""
    token = client.post("/api/auth/login", json={
        "email": "emp_status@test.com",
        "password": "pass123",
    }).json["access_token"]

    resp = client.patch(
        f"/api/applications/{application.id}/status",
        json={"status": "viewed"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json["application"]["status"] == "viewed"


def test_employer_mark_shortlisted(client, employer_user, application):
    """Employer can mark their application as shortlisted."""
    token = client.post("/api/auth/login", json={
        "email": "emp_status@test.com",
        "password": "pass123",
    }).json["access_token"]

    resp = client.patch(
        f"/api/applications/{application.id}/status",
        json={"status": "shortlisted"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json["application"]["status"] == "shortlisted"


def test_employer_mark_rejected(client, employer_user, application):
    """Employer can mark their application as rejected."""
    token = client.post("/api/auth/login", json={
        "email": "emp_status@test.com",
        "password": "pass123",
    }).json["access_token"]

    resp = client.patch(
        f"/api/applications/{application.id}/status",
        json={"status": "rejected"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json["application"]["status"] == "rejected"


def test_employer_cannot_update_other_employer_application(client, employer_user_2, application):
    """Employer cannot update another employer's application."""
    token = client.post("/api/auth/login", json={
        "email": "emp_status_2@test.com",
        "password": "pass123",
    }).json["access_token"]

    resp = client.patch(
        f"/api/applications/{application.id}/status",
        json={"status": "viewed"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


def test_employer_cannot_mark_withdrawn(client, employer_user, application):
    """Employer cannot mark application as withdrawn."""
    token = client.post("/api/auth/login", json={
        "email": "emp_status@test.com",
        "password": "pass123",
    }).json["access_token"]

    resp = client.patch(
        f"/api/applications/{application.id}/status",
        json={"status": "withdrawn"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


def test_candidate_cannot_withdraw_rejected(client, candidate_user, application, db_session):
    """Candidate cannot withdraw after rejection."""
    application.status = "rejected"
    db_session.commit()

    token = client.post("/api/auth/login", json={
        "email": "cand_status@test.com",
        "password": "pass123",
    }).json["access_token"]

    resp = client.patch(
        f"/api/applications/{application.id}/status",
        json={"status": "withdrawn"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 409


def test_get_received_applications_with_status_filter(client, employer_user, application, candidate_profile, db_session):
    """GET /applications/received?status=submitted filters correctly."""
    # Create another job for the second application
    job2 = Job(
        title="另一个测试岗位",
        company_id=employer_user.id,
        city="北京",
        description="另一个测试岗位描述",
        status="published",
    )
    db_session.add(job2)
    db_session.flush()

    # Create another application with different status
    app2 = JobApplication(
        job_id=job2.id,
        candidate_id=candidate_profile.id,
        employer_id=employer_user.id,
        status="viewed",
    )
    db_session.add(app2)
    db_session.commit()

    token = client.post("/api/auth/login", json={
        "email": "emp_status@test.com",
        "password": "pass123",
    }).json["access_token"]

    resp = client.get(
        "/api/applications/received?status=submitted",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    apps = resp.json["applications"]
    assert len(apps) == 1
    assert apps[0]["status"] == "submitted"


def test_withdrawn_idempotent(client, candidate_user, application, db_session):
    """Withdrawing an already-withdrawn application returns current state."""
    application.status = "withdrawn"
    db_session.commit()

    token = client.post("/api/auth/login", json={
        "email": "cand_status@test.com",
        "password": "pass123",
    }).json["access_token"]

    resp = client.patch(
        f"/api/applications/{application.id}/status",
        json={"status": "withdrawn"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json["application"]["status"] == "withdrawn"


def test_admin_can_change_any_status(client, admin_user, application, db_session):
    """Admin can override terminal states."""
    application.status = "rejected"
    db_session.commit()

    token = client.post("/api/auth/login", json={
        "email": "admin_status@test.com",
        "password": "pass123",
    }).json["access_token"]

    resp = client.patch(
        f"/api/applications/{application.id}/status",
        json={"status": "withdrawn"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json["application"]["status"] == "withdrawn"
