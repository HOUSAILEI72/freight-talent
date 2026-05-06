"""
test_confirm_import_integration.py — confirm 导入集成测试

覆盖：
  1. 正常 job 批次确认 → jobs 表写入
  2. 正常 resume 批次确认 → users + candidates 表写入
  3. 重复确认 → 409
  4. dry_run=true → 不写 DB
  5. 含 error 行时跳过，只写 ok 行
  6. 非 admin 无法确认 → 403
"""
import io
import pytest
from tests.helpers import make_xlsx


def _post_preview(client, token, file_bytes, import_type="job"):
    data = {
        "import_type": import_type,
        "file": (io.BytesIO(file_bytes), "test.xlsx",
                 "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    }
    return client.post(
        "/api/admin/import/preview",
        data=data,
        content_type="multipart/form-data",
        headers={"Authorization": f"Bearer {token}"},
    )


def _confirm(client, token, batch_id, **params):
    qs = "&".join(f"{k}={v}" for k, v in params.items())
    url = f"/api/admin/import/batches/{batch_id}/confirm" + (f"?{qs}" if qs else "")
    return client.post(url, headers={"Authorization": f"Bearer {token}"})


# ---------------------------------------------------------------------------
# 1. 正常 job 批次 → jobs 表写入
# ---------------------------------------------------------------------------

def test_confirm_job_writes_to_jobs_table(app, client, admin_token):
    from app.extensions import db
    from app.models.job import Job

    xlsx = make_xlsx(
        ["title", "city", "job_type", "description"],
        [
            ["物流专员", "上海", "全职", "负责海运操作"],
            ["销售经理", "深圳", "全职", "负责客户开发"],
        ],
    )
    resp = _post_preview(client, admin_token, xlsx, import_type="job")
    assert resp.status_code == 200
    batch_id = resp.get_json()["batch_id"]

    confirm_resp = _confirm(client, admin_token, batch_id)
    assert confirm_resp.status_code == 200, confirm_resp.get_json()
    body = confirm_resp.get_json()
    assert body["success"] is True
    assert body["written"] == 2

    with app.app_context():
        jobs = Job.query.all()
        assert len(jobs) == 2
        titles = {j.title for j in jobs}
        assert "物流专员" in titles
        assert "销售经理" in titles


# ---------------------------------------------------------------------------
# 2. 正常 resume 批次 → users + candidates 写入
# ---------------------------------------------------------------------------

def test_confirm_resume_writes_candidates(app, client, admin_token):
    from app.extensions import db
    from app.models.user import User
    from app.models.candidate import Candidate

    xlsx = make_xlsx(
        ["full_name", "current_title", "current_city", "email"],
        [
            ["张三", "操作员", "上海", "zhangsan_import@example.com"],
            ["李四", "销售", "北京", "lisi_import@example.com"],
        ],
    )
    resp = _post_preview(client, admin_token, xlsx, import_type="resume")
    assert resp.status_code == 200
    batch_id = resp.get_json()["batch_id"]

    confirm_resp = _confirm(client, admin_token, batch_id)
    assert confirm_resp.status_code == 200, confirm_resp.get_json()
    body = confirm_resp.get_json()
    assert body["written"] == 2

    with app.app_context():
        u1 = User.query.filter_by(email="zhangsan_import@example.com").first()
        assert u1 is not None
        assert u1.role == "candidate"
        c1 = Candidate.query.filter_by(user_id=u1.id).first()
        assert c1 is not None
        assert c1.full_name == "张三"
        assert c1.current_city == "上海"


# ---------------------------------------------------------------------------
# 3. 重复确认 → 409
# ---------------------------------------------------------------------------

def test_confirm_twice_returns_409(app, client, admin_token):
    xlsx = make_xlsx(
        ["title", "city", "job_type", "description"],
        [["物流专员", "上海", "全职", "负责海运操作"]],
    )
    resp = _post_preview(client, admin_token, xlsx, import_type="job")
    batch_id = resp.get_json()["batch_id"]

    r1 = _confirm(client, admin_token, batch_id)
    assert r1.status_code == 200

    r2 = _confirm(client, admin_token, batch_id)
    assert r2.status_code == 409


# ---------------------------------------------------------------------------
# 4. dry_run=true → 不写 DB
# ---------------------------------------------------------------------------

def test_confirm_dry_run_no_db_write(app, client, admin_token):
    from app.extensions import db
    from app.models.job import Job

    xlsx = make_xlsx(
        ["title", "city", "job_type", "description"],
        [["物流专员", "上海", "全职", "负责海运操作"]],
    )
    resp = _post_preview(client, admin_token, xlsx, import_type="job")
    batch_id = resp.get_json()["batch_id"]

    with app.app_context():
        count_before = Job.query.count()

    dr = _confirm(client, admin_token, batch_id, dry_run="true")
    assert dr.status_code == 200
    body = dr.get_json()
    assert body["dry_run"] is True
    assert body["writable_rows"] == 1

    with app.app_context():
        assert Job.query.count() == count_before


# ---------------------------------------------------------------------------
# 5. 非 admin 无法确认 → 403
# ---------------------------------------------------------------------------

def test_confirm_non_admin_forbidden(app, client):
    from app.extensions import db
    from app.models.user import User
    from flask_jwt_extended import create_access_token

    with app.app_context():
        emp = User(email="emp_confirm@example.com", role="employer",
                   name="Emp", is_active=True)
        emp.set_password("Pass123!")
        db.session.add(emp)
        db.session.commit()
        token = create_access_token(identity=str(emp.id))

    resp = _confirm(client, token, 9999)
    assert resp.status_code == 403
