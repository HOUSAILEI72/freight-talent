"""
test_socket_integration.py — Socket.IO 集成测试

覆盖：
  1. access token 可连接（auth dict 路径）
  2. refresh token 被拒绝（auth dict 路径）
  3. 旧 query-string token 仍可连接（向后兼容）
  4. 空 token 被拒绝
  5. reauthenticate 事件：新 access token 生效 → reauthenticated
  6. reauthenticate 事件：传入 refresh token → error（连接保持）
  7. reauthenticate 事件：传入无效字符串 → error（连接保持）
  8. 断线重连：重连时携带新 token → 以新 token 身份连入

注意：
  - socketio.test_client(app, auth={...}) 模拟 Socket.IO v4 的 auth 回调路径；
    每次 connect() 调用都可传入新的 auth，对应前端每次重连读取最新 localStorage token。
  - query_string= 路径用于验证向后兼容性。
"""
import pytest
from flask_jwt_extended import create_access_token, create_refresh_token


# ---------------------------------------------------------------------------
# 辅助：在 app context 内创建测试用户并返回各种 token
# ---------------------------------------------------------------------------

def _make_tokens(app, email, role="candidate"):
    """创建用户（若不存在），返回 (user_id, access_token, refresh_token)。"""
    from app.extensions import db
    from app.models.user import User

    with app.app_context():
        u = User.query.filter_by(email=email).first()
        if not u:
            u = User(email=email, role=role, name=email.split("@")[0], is_active=True)
            u.set_password("Pass1234!")
            db.session.add(u)
            db.session.commit()
        uid = u.id
        at = create_access_token(identity=str(uid))
        rt = create_refresh_token(identity=str(uid))
    return uid, at, rt


# ---------------------------------------------------------------------------
# fixture：socketio 测试客户端工厂（每个测试独立实例）
# ---------------------------------------------------------------------------

@pytest.fixture()
def sio(app):
    """返回 Flask-SocketIO 的 socketio 扩展对象，用于创建 test_client。"""
    from app.extensions import socketio
    return socketio


# ---------------------------------------------------------------------------
# 1. access token 可连接（auth dict 路径）
# ---------------------------------------------------------------------------

def test_connect_with_access_token(app, sio):
    _, at, _ = _make_tokens(app, "sock_access@example.com")

    with app.app_context():
        tc = sio.test_client(app, auth={"token": at})
        assert tc.is_connected(), "access token 应能成功连接"

        evts = tc.get_received()
        names = [e["name"] for e in evts]
        assert "connected" in names, f"应收到 connected 事件，实际：{names}"

        connected_evt = next(e for e in evts if e["name"] == "connected")
        assert connected_evt["args"][0]["status"] == "ok"

        tc.disconnect()


# ---------------------------------------------------------------------------
# 2. refresh token 被拒绝
# ---------------------------------------------------------------------------

def test_connect_with_refresh_token_rejected(app, sio):
    _, _, rt = _make_tokens(app, "sock_refresh@example.com")

    with app.app_context():
        tc = sio.test_client(app, auth={"token": rt})
        assert not tc.is_connected(), "refresh token 不应能连接"


# ---------------------------------------------------------------------------
# 3. 旧 query-string token 仍可连接（向后兼容）
# ---------------------------------------------------------------------------

def test_connect_with_query_string_token(app, sio):
    _, at, _ = _make_tokens(app, "sock_query@example.com")

    with app.app_context():
        tc = sio.test_client(app, query_string=f"token={at}")
        assert tc.is_connected(), "query-string token 应能连接（向后兼容）"
        tc.disconnect()


# ---------------------------------------------------------------------------
# 4. 空 token 被拒绝
# ---------------------------------------------------------------------------

def test_connect_with_empty_token_rejected(app, sio):
    with app.app_context():
        tc = sio.test_client(app, auth={"token": ""})
        assert not tc.is_connected(), "空 token 不应能连接"


# ---------------------------------------------------------------------------
# 5. reauthenticate：新 access token → reauthenticated
# ---------------------------------------------------------------------------

def test_reauthenticate_with_new_access_token(app, sio):
    uid, at, _ = _make_tokens(app, "sock_reauth@example.com")

    with app.app_context():
        tc = sio.test_client(app, auth={"token": at})
        assert tc.is_connected()
        tc.get_received()   # 清空 connected 事件

        # 模拟 token 刷新：生成新 access token
        new_at = create_access_token(identity=str(uid))
        tc.emit("reauthenticate", {"token": new_at})

        evts = tc.get_received()
        names = [e["name"] for e in evts]
        assert "reauthenticated" in names, f"应收到 reauthenticated 事件，实际：{names}"

        reauth_evt = next(e for e in evts if e["name"] == "reauthenticated")
        assert reauth_evt["args"][0]["status"] == "ok"
        assert reauth_evt["args"][0]["user_id"] == uid

        tc.disconnect()


# ---------------------------------------------------------------------------
# 6. reauthenticate：传入 refresh token → error，连接保持
# ---------------------------------------------------------------------------

def test_reauthenticate_with_refresh_token_returns_error(app, sio):
    _, at, rt = _make_tokens(app, "sock_reauth_rt@example.com")

    with app.app_context():
        tc = sio.test_client(app, auth={"token": at})
        assert tc.is_connected()
        tc.get_received()

        tc.emit("reauthenticate", {"token": rt})

        evts = tc.get_received()
        names = [e["name"] for e in evts]
        assert "error" in names, f"传入 refresh token 应收到 error，实际：{names}"
        # 连接不应被断开
        assert tc.is_connected(), "reauthenticate 失败后连接应保持"

        tc.disconnect()


# ---------------------------------------------------------------------------
# 7. reauthenticate：传入无效字符串 → error，连接保持
# ---------------------------------------------------------------------------

def test_reauthenticate_with_invalid_token_returns_error(app, sio):
    _, at, _ = _make_tokens(app, "sock_reauth_bad@example.com")

    with app.app_context():
        tc = sio.test_client(app, auth={"token": at})
        assert tc.is_connected()
        tc.get_received()

        tc.emit("reauthenticate", {"token": "not-a-valid-jwt"})

        evts = tc.get_received()
        names = [e["name"] for e in evts]
        assert "error" in names, f"无效 token 应收到 error，实际：{names}"
        assert tc.is_connected(), "reauthenticate 失败后连接应保持"

        tc.disconnect()


# ---------------------------------------------------------------------------
# 8. 断线重连：重连时携带新 token → 以新 token 身份连入
#
# 模拟场景：
#   a) 用 token_v1 连接
#   b) 断开连接（模拟网络中断 / access token 过期导致重连）
#   c) 用 token_v2（刷新后的新 token）重新连接
#   d) 服务端应以 token_v2 认证并发出 connected 事件
#
# 对应前端行为：auth 回调在每次重连时读取 localStorage，
# token 刷新后 localStorage 已更新，重连即可带新 token。
# ---------------------------------------------------------------------------

def test_reconnect_uses_new_token(app, sio):
    uid, at_v1, _ = _make_tokens(app, "sock_reconnect@example.com")

    with app.app_context():
        # 初次连接
        tc = sio.test_client(app, auth={"token": at_v1})
        assert tc.is_connected(), "初次连接应成功"
        tc.get_received()

        # 模拟断线
        tc.disconnect()
        assert not tc.is_connected(), "断线后 is_connected 应为 False"

        # 生成新 token（模拟刷新后写入 localStorage）
        at_v2 = create_access_token(identity=str(uid))

        # 重连时传入新 token（对应前端 auth 回调读取更新后的 localStorage）
        tc.connect(auth={"token": at_v2})
        assert tc.is_connected(), "携带新 token 重连应成功"

        evts = tc.get_received()
        names = [e["name"] for e in evts]
        assert "connected" in names, f"重连后应收到 connected 事件，实际：{names}"

        connected_evt = next(e for e in evts if e["name"] == "connected")
        assert connected_evt["args"][0]["user_id"] == uid

        tc.disconnect()
