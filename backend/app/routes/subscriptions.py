"""subscriptions.py — employer subscription API.

Endpoints:
  GET  /api/subscriptions/me            — current employer's subscription
  GET  /api/subscriptions/plans         — available plans (static, MVP)
  POST /api/subscriptions/dev-activate  — dev/demo: create/replace active subscription
"""

from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.models.user import User
from app.models.subscription import Subscription

subscriptions_bp = Blueprint("subscriptions", __name__, url_prefix="/api/subscriptions")

VALID_PLAN_IDS = {"china_function", "china_all_functions"}
VALID_BILLING_CYCLES = {"monthly", "annual"}
VALID_FUNCTIONS = ["Sea", "Air", "Road", "Railway", "Contract Logistics", "ECOMS"]

ANNUAL_DISCOUNT = 0.85

# New China + Function subscription plans.
PLANS = [
    {
        "id": "china_function",
        "name": "China + Selected Function",
        "monthly_price": 700,
        "annual_price": int(700 * 12 * ANNUAL_DISCOUNT),  # 7140
        "annual_discount": ANNUAL_DISCOUNT,
        "description": "覆盖中国区域单个职能方向",
        "features": [
            "中国全区域 (China, East/North/South/West/Central China, HK, TW, Macau)",
            "选择 1 个职能方向 (Sea/Air/Road/Railway/Contract Logistics/ECOMS)",
            "完整候选人档案查看",
            "发起邀约 & 沟通",
            "岗位发布 & AI 匹配",
        ],
        "allowed_functions": VALID_FUNCTIONS,
        "area_scope": "China",
    },
    {
        "id": "china_all_functions",
        "name": "China + All Functions",
        "monthly_price": 850,
        "annual_price": int(850 * 12 * ANNUAL_DISCOUNT),  # 8670
        "annual_discount": ANNUAL_DISCOUNT,
        "description": "覆盖中国区域全部职能方向",
        "features": [
            "中国全区域 (China, East/North/South/West/Central China, HK, TW, Macau)",
            "全职能方向 (ALL)",
            "完整候选人档案查看",
            "发起邀约 & 沟通",
            "岗位发布 & AI 匹配",
            "高级筛选过滤",
        ],
        "allowed_functions": ["ALL"],
        "area_scope": "China",
        "highlighted": True,
    },
]


def _err(msg, code=400, error_code=None):
    body = {"success": False, "message": msg}
    if error_code:
        body["error_code"] = error_code
        body["pricing_url"] = "/employer/pricing"
    return jsonify(body), code


def _current_user():
    uid = int(get_jwt_identity())
    return db.session.get(User, uid)


@subscriptions_bp.get("/me")
@jwt_required()
def get_my_subscription():
    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)
    if user.role not in ("employer", "admin"):
        return _err("仅企业账号可查看订阅", 403)

    sub = (
        Subscription.query
        .filter_by(employer_id=user.id)
        .order_by(Subscription.created_at.desc())
        .first()
    )
    return jsonify({
        "success": True,
        "subscription": sub.to_dict() if sub else None,
        "has_active": sub.is_active() if sub else False,
    })


@subscriptions_bp.get("/plans")
def get_plans():
    return jsonify({"success": True, "plans": PLANS})


@subscriptions_bp.post("/dev-activate")
@jwt_required()
def dev_activate():
    """Create or replace an active subscription (dev/demo only — disabled in production).

    Body:
      plan_id          — "china_function" | "china_all_functions" (required)
      billing_cycle    — "monthly" | "annual" (default "monthly")
      function_codes   — list of strings:
                          - china_function: exactly 1 from VALID_FUNCTIONS
                          - china_all_functions: ["ALL"] (forced)
      days             — subscription duration in days (default: 365 for annual, 30 for monthly)

    In production (FLASK_ENV=production), this endpoint returns 403.
    """
    import os
    if os.getenv("FLASK_ENV") == "production":
        return _err("此接口在生产环境不可用", 403, error_code="disabled_in_production")
    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)
    if user.role not in ("employer", "admin"):
        return _err("仅企业或管理员账号可激活订阅", 403)

    data = request.get_json(silent=True) or {}
    plan_id = data.get("plan_id", "")
    billing_cycle = data.get("billing_cycle", "monthly")
    func_codes = data.get("function_codes", None)
    days = int(data.get("days", 0))

    # Validate plan_id
    if plan_id not in VALID_PLAN_IDS:
        return _err(f"无效的 plan_id: {plan_id}，可选: {', '.join(sorted(VALID_PLAN_IDS))}")

    # Validate billing_cycle
    if billing_cycle not in VALID_BILLING_CYCLES:
        return _err(f"无效的 billing_cycle: {billing_cycle}，可选: monthly, annual")

    # Validate function_codes
    if plan_id == "china_function":
        if not isinstance(func_codes, list) or len(func_codes) != 1:
            return _err("china_function 套餐必须选择且只能选择 1 个 function")
        if func_codes[0] not in VALID_FUNCTIONS:
            return _err(f"无效的 function: {func_codes[0]}，可选: {', '.join(VALID_FUNCTIONS)}")
    else:  # china_all_functions
        func_codes = ["ALL"]

    # Area scope is always China
    area_codes = ["GREAT_CHINA"]

    # Default duration based on billing_cycle
    if days <= 0:
        days = 365 if billing_cycle == "annual" else 30

    now = datetime.now(timezone.utc)

    # Expire any existing active subscriptions for this employer
    Subscription.query.filter_by(
        employer_id=user.id, status="active"
    ).update({"status": "cancelled", "updated_at": now})

    sub = Subscription(
        employer_id=user.id,
        status="active",
        plan_type=billing_cycle,
        tier=plan_id,
        function_codes=func_codes,
        business_area_codes=area_codes,
        starts_at=now,
        ends_at=now + timedelta(days=days),
        created_at=now,
        updated_at=now,
    )
    db.session.add(sub)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "订阅已激活（演示模式）",
        "subscription": sub.to_dict(),
        "pricing": {
            "plan_id": plan_id,
            "billing_cycle": billing_cycle,
            "monthly_price": next((p["monthly_price"] for p in PLANS if p["id"] == plan_id), 0),
            "annual_price": next((p["annual_price"] for p in PLANS if p["id"] == plan_id), 0),
        },
    }), 201
