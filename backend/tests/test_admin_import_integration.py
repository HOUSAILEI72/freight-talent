"""
test_admin_import_integration.py — 路由层集成测试

验证 POST /api/admin/import/preview 的完整链路：
  - 批次写入 DB
  - 正常模板时 pending 字段被注册
  - duplicate_header 时字段注册被跳过
  - 任意列名时字段正常注册（不再做模板校验）
  - 坏文件返回 422（不写 DB）
  - 非 admin 返回 403
"""
import io
import pytest
from tests.helpers import make_xlsx


# ---------------------------------------------------------------------------
# 辅助：发送 multipart 预检请求
# ---------------------------------------------------------------------------

def _post_preview(client, token, file_bytes, filename="test.xlsx",
                  import_type="job", content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"):
    data = {
        "import_type": import_type,
        "file": (io.BytesIO(file_bytes), filename, content_type),
    }
    return client.post(
        "/api/admin/import/preview",
        data=data,
        content_type="multipart/form-data",
        headers={"Authorization": f"Bearer {token}"},
    )


# ---------------------------------------------------------------------------
# 1. 正常模板 → ImportBatch 写入，pending 字段被注册
# ---------------------------------------------------------------------------

def test_normal_template_registers_pending_fields(app, client, admin_token):
    """正常 job 模板：批次写入，列头中新字段以 pending 状态进入 field_registry"""
    from app.extensions import db
    from app.models.import_models import ImportBatch, FieldRegistry

    xlsx = make_xlsx(
        ["title", "city", "job_type", "my_novel_field"],
        [["物流专员", "上海", "全职", "extra_value"]],
    )
    resp = _post_preview(client, admin_token, xlsx)
    assert resp.status_code == 200, resp.get_json()

    body = resp.get_json()
    assert body["success"] is True
    assert body["fields_registration_skipped"] is False

    with app.app_context():
        assert db.session.query(ImportBatch).count() == 1
        # my_novel_field 应被注册为 pending
        fr = FieldRegistry.query.filter_by(
            entity_type="job", field_key="my_novel_field"
        ).first()
        assert fr is not None
        assert fr.status == "pending"


# ---------------------------------------------------------------------------
# 2. duplicate_header → ImportBatch 写入，字段注册跳过
# ---------------------------------------------------------------------------

def test_duplicate_header_skips_field_registration(app, client, admin_token):
    """重复列名：批次和标注文件仍写入；FieldRegistry 不新增任何行"""
    from app.extensions import db
    from app.models.import_models import ImportBatch, FieldRegistry

    xlsx = make_xlsx(
        ["title", "city", "job_type", "title"],   # title 重复
        [["物流专员", "上海", "全职", "副标题"]],
    )
    resp = _post_preview(client, admin_token, xlsx)
    assert resp.status_code == 200, resp.get_json()

    body = resp.get_json()
    assert body["fields_registration_skipped"] is True

    with app.app_context():
        # 批次仍记录
        assert db.session.query(ImportBatch).count() == 1
        # 不应注册任何字段
        assert db.session.query(FieldRegistry).count() == 0

    # errors 中含 duplicate_header
    err_types = [e["issue_type"] for e in body["errors"]]
    assert "duplicate_header" in err_types


# ---------------------------------------------------------------------------
# 3. 任意列名 → ImportBatch 写入，字段注册正常进行
# ---------------------------------------------------------------------------

def test_arbitrary_columns_registers_fields(app, client, admin_token):
    """任意列名的 Excel：批次写入，FieldRegistry 新增对应字段"""
    from app.extensions import db
    from app.models.import_models import ImportBatch, FieldRegistry

    xlsx = make_xlsx(
        ["random_col_a", "random_col_b"],
        [["foo", "bar"]],
    )
    resp = _post_preview(client, admin_token, xlsx)
    assert resp.status_code == 200, resp.get_json()

    body = resp.get_json()
    assert body["fields_registration_skipped"] is False

    with app.app_context():
        assert db.session.query(ImportBatch).count() == 1
        assert db.session.query(FieldRegistry).count() == 2

    warn_types = [w["issue_type"] for w in body["warnings"]]
    assert "template_mismatch" not in warn_types


# ---------------------------------------------------------------------------
# 4. 坏文件 → 422，不写 DB
# ---------------------------------------------------------------------------

def test_corrupt_file_returns_422_no_db_write(app, client, admin_token):
    """非法字节流 → 422，ImportBatch 不写入"""
    from app.extensions import db
    from app.models.import_models import ImportBatch

    resp = _post_preview(client, admin_token, b"garbage bytes not xlsx")
    assert resp.status_code == 422

    body = resp.get_json()
    assert body["success"] is False
    assert body["issue_type"] == "file_parse_error"

    with app.app_context():
        assert db.session.query(ImportBatch).count() == 0


# ---------------------------------------------------------------------------
# 5. .xls 被拒 → 400
# ---------------------------------------------------------------------------

def test_xls_extension_rejected(client, admin_token):
    """.xls 扩展名在 ALLOWED_EXTENSIONS 外 → 400"""
    resp = _post_preview(
        client, admin_token,
        b"dummy",
        filename="import.xls",
    )
    assert resp.status_code == 400
    body = resp.get_json()
    assert "xlsx" in body["message"]


# ---------------------------------------------------------------------------
# 6. 非 admin 被拒 → 403
# ---------------------------------------------------------------------------

def test_non_admin_forbidden(app, client):
    """employer 角色不能访问 preview 接口"""
    from app.extensions import db
    from app.models.user import User
    from flask_jwt_extended import create_access_token

    with app.app_context():
        emp = User(email="employer_test@example.com", role="employer",
                   name="Emp", is_active=True)
        emp.set_password("Pass123!")
        db.session.add(emp)
        db.session.commit()
        emp_id = emp.id
        token = create_access_token(identity=str(emp_id))

    xlsx = make_xlsx(["title", "city"], [["物流专员", "上海"]])
    resp = _post_preview(client, token, xlsx)
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 7. pending 字段在再次预检时仍出现在 new_fields（不被视为 known）
# ---------------------------------------------------------------------------

def test_pending_field_reappears_in_new_fields_on_repeat(app, client, admin_token):
    """同一新字段第二次上传时仍出现在 new_fields（pending 不算 active）"""
    xlsx = make_xlsx(
        ["title", "city", "job_type", "brand_new_field"],
        [["物流专员", "上海", "全职", "v1"]],
    )
    # 第一次预检 — brand_new_field 被注册为 pending
    resp1 = _post_preview(client, admin_token, xlsx)
    assert resp1.status_code == 200
    assert resp1.get_json()["fields_registration_skipped"] is False

    # 第二次预检（同样的文件内容，但 conftest _clean_import_tables 会重置；
    # 手动保留 field_registry 以模拟"真实第二次上传"情形）
    from app.extensions import db
    from app.models.import_models import ImportBatch, ImportBatchRow

    with app.app_context():
        # 只清批次，不清 field_registry（模拟第二次独立上传）
        db.session.query(ImportBatchRow).delete()
        db.session.query(ImportBatch).delete()
        db.session.commit()

    resp2 = _post_preview(client, admin_token, xlsx)
    assert resp2.status_code == 200
    body2 = resp2.get_json()

    new_fks = {nf["field_key"] for nf in body2.get("new_fields", [])}
    assert "brand_new_field" in new_fks, (
        "pending 字段应在第二次预检中仍出现在 new_fields"
    )


# ---------------------------------------------------------------------------
# 8. GET /batches — 分页列表
# ---------------------------------------------------------------------------

def test_list_batches_returns_empty_initially(client, admin_token):
    resp = client.get(
        "/api/admin/import/batches",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["success"] is True
    assert isinstance(body["batches"], list)


# ---------------------------------------------------------------------------
# 9. GET /batches/<id>/download — 下载标注文件
# ---------------------------------------------------------------------------

def test_download_annotated_returns_xlsx(app, client, admin_token):
    """正常上传后，下载接口返回有效的 xlsx binary"""
    xlsx = make_xlsx(
        ["title", "city", "job_type"],
        [["物流专员", "上海", "全职"]],
    )
    resp = _post_preview(client, admin_token, xlsx)
    batch_id = resp.get_json()["batch_id"]

    dl = client.get(
        f"/api/admin/import/batches/{batch_id}/download",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert dl.status_code == 200
    assert dl.content_type.startswith("application/vnd.openxmlformats")
    # xlsx 文件以 PK 签名开头（zip 格式）
    assert dl.data[:2] == b"PK"
