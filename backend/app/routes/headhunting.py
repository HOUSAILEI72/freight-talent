import re
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User
from app.models.headhunting_request import HeadhuntingRequest

headhunting_bp = Blueprint("headhunting", __name__, url_prefix="/api/headhunting")

VALID_SERVICE_TYPES = {"personal", "team", "entrusted"}
_EMAIL_RE = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
_PHONE_RE = re.compile(r'^[\d+\-\s()]+$')


def _err(msg, code=400):
    return jsonify({"success": False, "message": msg}), code


def _current_user():
    user_id = int(get_jwt_identity())
    return db.session.get(User, user_id)


@headhunting_bp.get("/requests")
@jwt_required()
def list_requests():
    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)
    if user.role not in ("employer", "admin"):
        return _err("仅企业账号可查看猎头服务需求", 403)

    service_type = request.args.get("service_type", "").strip() or None
    q = HeadhuntingRequest.query.filter_by(employer_id=user.id)
    if service_type:
        q = q.filter_by(service_type=service_type)
    items = q.order_by(HeadhuntingRequest.created_at.desc()).all()

    def _row(r):
        job_payload = r.job_payload or {}
        return {
            "id":           r.id,
            "service_type": r.service_type,
            "status":       r.status,
            "job_payload":  job_payload,
            "terms_payload":  r.terms_payload,
            "add_ons_payload": r.add_ons_payload,
            "fee_snapshot": r.fee_snapshot,
            "contact_name":  r.contact_name,
            "contact_phone": r.contact_phone,
            "contact_email": r.contact_email,
            "contact_wechat": r.contact_wechat,
            "created_at":   r.created_at.isoformat() if r.created_at else None,
        }

    return jsonify({"success": True, "requests": [_row(r) for r in items]}), 200


@headhunting_bp.post("/requests")
@jwt_required()
def create_request():
    user = _current_user()
    if not user or not user.is_active:
        return _err("用户不存在", 404)
    if user.role not in ("employer", "admin"):
        return _err("仅企业账号可提交猎头服务需求", 403)

    data = request.get_json(silent=True) or {}

    # ── service_type ─────────────────────────────────────────────────────────
    service_type = (data.get("service_type") or "personal").strip()
    if service_type not in VALID_SERVICE_TYPES:
        return _err(f"service_type 只能是 {sorted(VALID_SERVICE_TYPES)} 之一")

    # ── contact ───────────────────────────────────────────────────────────────
    contact = data.get("contact") or {}
    contact_name  = (contact.get("name")   or "").strip()
    contact_phone = (contact.get("phone")  or "").strip()
    contact_email = (contact.get("email")  or "").strip()
    contact_wechat= (contact.get("wechat") or "").strip() or None

    if not contact_name:
        return _err("联系人姓名不能为空")
    if not contact_phone:
        return _err("联系人手机不能为空")
    if not contact_email:
        return _err("联系人邮箱不能为空")
    if not _EMAIL_RE.match(contact_email):
        return _err("邮箱格式不正确")
    digits = re.sub(r"[^\d]", "", contact_phone)
    if not _PHONE_RE.match(contact_phone) or not (7 <= len(digits) <= 30):
        return _err("手机号格式不正确")

    # ── payload validation (branches by service_type) ─────────────────────────
    terms = data.get("terms") or {}

    if service_type == "personal":
        job = data.get("job") or {}
        if not str(job.get("title") or "").strip():
            return _err("岗位名称不能为空")
        if not str(job.get("function_code") or "").strip():
            return _err("岗位板块不能为空")
        if not str(job.get("location_code") or "").strip():
            return _err("岗位城市不能为空")
        salary_min = job.get("salary_min")
        salary_max = job.get("salary_max")
        if not salary_min or not salary_max:
            return _err("薪资区间不能为空")
        try:
            if float(salary_min) <= 0 or float(salary_max) <= 0:
                return _err("薪资必须大于 0")
            if float(salary_min) > float(salary_max):
                return _err("最低月薪不能大于最高月薪")
        except (TypeError, ValueError):
            return _err("薪资格式不正确")

        payload_for_storage = job

    elif service_type == "team":
        team_req = data.get("team_requirement") or {}

        if not str(team_req.get("summary") or "").strip():
            return _err("需求简述不能为空")
        preferred_cities = team_req.get("preferred_cities") or []
        if not isinstance(preferred_cities, list) or len(preferred_cities) == 0:
            return _err("所在城市偏向至少选择 1 个城市")
        business_focus = team_req.get("business_focus") or []
        if not isinstance(business_focus, list) or len(business_focus) == 0:
            return _err("业务侧重至少填写 1 项")
        if not str(team_req.get("expected_onboard_time") or "").strip():
            return _err("希望到岗时间不能为空")

        fee_snapshot = data.get("fee_snapshot") or {}
        valid_base_totals   = {180000, 210000}
        valid_monthly_fees  = {15000, 17500}
        try:
            base_total  = int(fee_snapshot.get("baseTotal",  0))
            monthly_fee = int(fee_snapshot.get("monthlyFee", 0))
            months      = int(fee_snapshot.get("months",     0))
        except (TypeError, ValueError):
            return _err("fee_snapshot 数值格式不正确")
        if base_total  not in valid_base_totals:
            return _err("baseTotal 必须为 180000 或 210000")
        if monthly_fee not in valid_monthly_fees:
            return _err("monthlyFee 必须为 15000 或 17500")
        if months != 12:
            return _err("支付周期 months 必须为 12")

        payload_for_storage = team_req

    else:
        payload_for_storage = data.get("job") or {}

    # ── persist ────────────────────────────────────────────────────────────────
    now = datetime.now(timezone.utc)
    req = HeadhuntingRequest(
        employer_id    = user.id,
        service_type   = service_type,
        status         = "submitted",
        job_payload    = payload_for_storage,
        terms_payload  = terms,
        add_ons_payload= data.get("add_ons"),
        fee_snapshot   = data.get("fee_snapshot"),
        contact_name   = contact_name,
        contact_phone  = contact_phone,
        contact_email  = contact_email,
        contact_wechat = contact_wechat,
        created_at     = now,
        updated_at     = now,
    )
    db.session.add(req)
    db.session.commit()

    from app.utils.notifications import create_and_push_notification
    create_and_push_notification(
        user_id=user.id,
        type='headhunting_request',
        title='猎头服务需求已提交',
        body=f'服务类型: {service_type}',
        data={'request_id': req.id},
    )

    return jsonify({"success": True, "request": req.to_dict()}), 201
