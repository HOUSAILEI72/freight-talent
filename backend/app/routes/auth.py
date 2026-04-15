from datetime import datetime, timezone
import click
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
    get_jwt,
    decode_token,
)
from app.extensions import db, limiter, blocklist_add, blocklist_contains
from app.models.user import User

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

# admin 不允许公开注册，只能通过 CLI seed 创建
VALID_ROLES = {"employer", "candidate"}


def _err(msg, code=400):
    return jsonify({"success": False, "message": msg}), code


@auth_bp.post("/register")
@limiter.limit("10 per hour; 3 per minute")
def register():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    name = (data.get("name") or "").strip()
    role = (data.get("role") or "candidate").strip()
    company_name = (data.get("company_name") or "").strip() or None

    # Basic validation
    if not email or "@" not in email:
        return _err("请输入有效的邮箱地址")
    if len(password) < 6:
        return _err("密码至少 6 位")
    if not name:
        return _err("请输入姓名")
    if role not in VALID_ROLES:
        return _err("无效角色")
    if role == "employer" and not company_name:
        return _err("企业用户请填写公司名称")

    if User.query.filter_by(email=email).first():
        return _err("该邮箱已注册", 409)

    user = User(email=email, role=role, name=name, company_name=company_name)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    refresh = create_refresh_token(identity=str(user.id))
    return jsonify({"success": True, "token": token, "refresh_token": refresh, "user": user.to_dict()}), 201


@auth_bp.post("/login")
@limiter.limit("20 per hour; 5 per minute")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return _err("请填写邮箱和密码")

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return _err("邮箱或密码错误", 401)
    if not user.is_active:
        return _err("账号已被停用", 403)

    user.last_login = datetime.now(timezone.utc)
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    refresh = create_refresh_token(identity=str(user.id))
    return jsonify({"success": True, "token": token, "refresh_token": refresh, "user": user.to_dict()})


@auth_bp.get("/me")
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user or not user.is_active:
        return _err("用户不存在", 404)
    return jsonify({"success": True, "user": user.to_dict()})


@auth_bp.post("/logout")
@jwt_required(optional=True)
def logout():
    """
    撤销当前 access token，并同时撤销请求体中携带的 refresh token。
    前端应在 body 中传 { "refresh_token": "<token>" } 以实现完整登出。
    """
    # 1. 撤销 access token
    try:
        payload = get_jwt()
        jti = payload.get("jti")
        if jti:
            exp = payload.get("exp", 0)
            now = int(datetime.now(timezone.utc).timestamp())
            ttl = max(exp - now + 60, 60)   # 至少保留 60 秒冗余
            blocklist_add(jti, expires_in_seconds=ttl)
    except Exception:
        pass

    # 2. 撤销前端传入的 refresh token（如果有）
    data = request.get_json(silent=True) or {}
    refresh_token_str = data.get("refresh_token", "")
    if refresh_token_str:
        try:
            decoded = decode_token(refresh_token_str)
            r_jti = decoded.get("jti")
            r_exp = decoded.get("exp", 0)
            if r_jti:
                now = int(datetime.now(timezone.utc).timestamp())
                ttl = max(r_exp - now + 60, 60)
                blocklist_add(r_jti, expires_in_seconds=ttl)
        except Exception:
            pass   # refresh token 已过期或格式非法，忽略

    return jsonify({"success": True, "message": "已退出登录"})


@auth_bp.post("/refresh")
@jwt_required(refresh=True)
def refresh():
    """用 refresh token 换一个新的 access token（短时效），并轮转 refresh token。"""
    identity = get_jwt_identity()
    # 撤销旧 refresh token（token rotation 防重放）
    payload = get_jwt()
    jti = payload.get("jti")
    if jti:
        exp = payload.get("exp", 0)
        now = int(datetime.now(timezone.utc).timestamp())
        ttl = max(exp - now + 60, 60)
        blocklist_add(jti, expires_in_seconds=ttl)
    new_access = create_access_token(identity=identity)
    new_refresh = create_refresh_token(identity=identity)
    return jsonify({"success": True, "token": new_access, "refresh_token": new_refresh})


# ── CLI：seed 管理员账号 ───────────────────────────────────────────────────────

@auth_bp.cli.command("create-admin")
@click.option("--email", prompt=True, help="管理员邮箱")
@click.option("--password", prompt=True, hide_input=True, confirmation_prompt=True,
              help="管理员密码（至少 12 位）")
@click.option("--name", default="超级管理员", help="显示名称")
def create_admin(email, password, name):
    """创建或重置管理员账号（仅 CLI 可用，不开放注册）。"""
    if len(password) < 12:
        click.echo("❌ 管理员密码至少 12 位", err=True)
        return
    existing = User.query.filter_by(email=email.strip().lower()).first()
    if existing:
        if existing.role != "admin":
            click.echo(f"❌ {email} 已是 {existing.role} 账号，无法转换", err=True)
            return
        existing.set_password(password)
        existing.is_active = True
        db.session.commit()
        click.echo(f"✅ 已重置管理员 {email} 的密码")
    else:
        admin = User(
            email=email.strip().lower(),
            role="admin",
            name=name,
        )
        admin.set_password(password)
        db.session.add(admin)
        db.session.commit()
        click.echo(f"✅ 管理员账号已创建：{email}（id={admin.id}）")