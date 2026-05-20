from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.models.company import Company

companies_bp = Blueprint("companies", __name__, url_prefix="/api/companies")


@companies_bp.get("")
@jwt_required()
def list_companies():
    """GET /api/companies?q=…  返回公司主数据列表，供候选人屏蔽公司选择器使用。"""
    q = request.args.get("q", "").strip()
    query = Company.query.order_by(Company.name)
    if q:
        query = query.filter(Company.name.ilike(f"%{q}%"))
    companies = query.limit(100).all()
    return jsonify({"success": True, "companies": [c.to_dict() for c in companies]})
