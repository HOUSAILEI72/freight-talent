"""
test_auth_send_code_smoke.py
验证 POST /api/auth/send-code 的基本行为（不发真实邮件）。
"""
import pytest


@pytest.fixture()
def no_mail_app(app):
    """临时关闭 MAIL_ENABLED，确保不真正发送邮件。"""
    app.config['MAIL_ENABLED'] = False
    yield app
    app.config['MAIL_ENABLED'] = True


def test_send_code_missing_email(client):
    """缺少 email → 400"""
    resp = client.post('/api/auth/send-code', json={'role': 'candidate'})
    assert resp.status_code == 400
    data = resp.get_json()
    assert data['success'] is False


def test_send_code_invalid_email(client):
    """无效邮箱格式 → 400"""
    resp = client.post('/api/auth/send-code', json={'email': 'notanemail', 'role': 'candidate'})
    assert resp.status_code == 400


def test_send_code_invalid_role(client):
    """无效角色 → 400"""
    resp = client.post('/api/auth/send-code', json={'email': 'test@example.com', 'role': 'hacker'})
    assert resp.status_code == 400


def test_send_code_already_registered(app, client):
    """已注册邮箱 → 409"""
    from app.extensions import db
    from app.models.user import User
    with app.app_context():
        existing = User(email='existing@example.com', role='candidate', name='已注册用户')
        existing.set_password('password123')
        db.session.add(existing)
        db.session.commit()

    resp = client.post('/api/auth/send-code', json={'email': 'existing@example.com', 'role': 'candidate'})
    assert resp.status_code == 409
    data = resp.get_json()
    assert data['success'] is False


def test_send_code_success_mail_disabled(no_mail_app, client):
    """MAIL_ENABLED=false 时，正常未注册邮箱 → 200，不发真实邮件"""
    resp = client.post('/api/auth/send-code',
                       json={'email': 'newuser_smoke@example.com', 'role': 'candidate'})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['success'] is True
    assert '已发送' in data.get('message', '')


def test_register_without_code_mail_enabled(app, client):
    """MAIL_ENABLED=true 时，注册不带 code → 400"""
    app.config['MAIL_ENABLED'] = True
    resp = client.post('/api/auth/register', json={
        'email': 'nocode@example.com',
        'password': 'password123',
        'name': '测试用户',
        'role': 'candidate',
        # 故意不传 code
    })
    assert resp.status_code == 400
    data = resp.get_json()
    assert data['success'] is False
    assert '验证码' in data.get('message', '')
    # 恢复
    app.config['MAIL_ENABLED'] = False
