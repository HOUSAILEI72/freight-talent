"""
Seed historical test data spanning multiple months/years.
10 candidates + 10 jobs with created_at spread across 2025-2026.
Tests checkpoint-based trend summary across month boundaries.

Usage: python seed_historical_data.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from app.extensions import db
from app.models.user import User
from app.models.candidate import Candidate
from app.models.job import Job
from datetime import datetime, timezone, timedelta

app = create_app()

# ── Historical dates for spreading data ────────────────────────────────────
# Each tuple: (profile_confirmed_at, created_at) as naive UTC strings
DATES = [
    # 2025 Q4 — cross-year data
    ("2025-10-15T10:00:00", "2025-10-15T10:00:00"),
    ("2025-11-08T10:00:00", "2025-11-08T10:00:00"),
    ("2025-12-22T10:00:00", "2025-12-22T10:00:00"),
    # 2026 Q1 — cross checkpoint boundaries
    ("2026-01-12T10:00:00", "2026-01-12T10:00:00"),
    ("2026-02-18T10:00:00", "2026-02-18T10:00:00"),
    ("2026-03-25T10:00:00", "2026-03-25T10:00:00"),
    # 2026 April — previous checkpoint (Apr 20)
    ("2026-04-05T10:00:00", "2026-04-05T10:00:00"),
    ("2026-04-15T10:00:00", "2026-04-15T10:00:00"),
    # 2026 May — current month
    ("2026-05-03T10:00:00", "2026-05-03T10:00:00"),
    ("2026-05-08T10:00:00", "2026-05-08T10:00:00"),
]

CANDIDATE_DATA = [
    {"full_name": "历史候选人A", "function_code": "Sea",    "business_area_code": "EAST_CHINA",
     "current_title": "海运经理", "current_city": "上海", "experience_years": 10},
    {"full_name": "历史候选人B", "function_code": "Air",    "business_area_code": "SOUTH_CHINA",
     "current_title": "空运操作", "current_city": "深圳", "experience_years": 6},
    {"full_name": "历史候选人C", "function_code": "Land",   "business_area_code": "EAST_CHINA",
     "current_title": "陆运调度", "current_city": "上海", "experience_years": 8},
    {"full_name": "历史候选人D", "function_code": "Sea",    "business_area_code": "NORTH_CHINA",
     "current_title": "海运销售", "current_city": "青岛", "experience_years": 4},
    {"full_name": "历史候选人E", "function_code": "Custom", "business_area_code": "EAST_CHINA",
     "current_title": "报关员",   "current_city": "上海", "experience_years": 12},
    {"full_name": "历史候选人F", "function_code": "Railway","business_area_code": "CENTRAL_CHINA",
     "current_title": "铁路货运", "current_city": "郑州", "experience_years": 7},
    {"full_name": "历史候选人G", "function_code": "Sea",    "business_area_code": "SOUTH_CHINA",
     "current_title": "海运客服", "current_city": "广州", "experience_years": 3},
    {"full_name": "历史候选人H", "function_code": "Air",    "business_area_code": "EAST_CHINA",
     "current_title": "空运销售", "current_city": "上海", "experience_years": 5},
    {"full_name": "历史候选人I", "function_code": "ECOMS",  "business_area_code": "EAST_CHINA",
     "current_title": "跨境电商", "current_city": "杭州", "experience_years": 2},
    {"full_name": "历史候选人J", "function_code": "Contract Logistics", "business_area_code": "HONG_KONG",
     "current_title": "合同物流", "current_city": "香港", "experience_years": 9},
]

JOB_DATA = [
    {"title": "历史海运经理岗",        "city": "上海", "function_code": "Sea",    "business_area_code": "EAST_CHINA"},
    {"title": "历史空运操作岗",        "city": "深圳", "function_code": "Air",    "business_area_code": "SOUTH_CHINA"},
    {"title": "历史陆运调度岗",        "city": "上海", "function_code": "Land",   "business_area_code": "EAST_CHINA"},
    {"title": "历史海运销售岗",        "city": "青岛", "function_code": "Sea",    "business_area_code": "NORTH_CHINA"},
    {"title": "历史报关主管岗",        "city": "上海", "function_code": "Custom", "business_area_code": "EAST_CHINA"},
    {"title": "历史铁路货运岗",        "city": "郑州", "function_code": "Railway","business_area_code": "CENTRAL_CHINA"},
    {"title": "历史海运客服岗",        "city": "广州", "function_code": "Sea",    "business_area_code": "SOUTH_CHINA"},
    {"title": "历史空运销售岗",        "city": "上海", "function_code": "Air",    "business_area_code": "EAST_CHINA"},
    {"title": "历史跨境电商运营岗",    "city": "杭州", "function_code": "ECOMS",  "business_area_code": "EAST_CHINA"},
    {"title": "历史合同物流经理岗",    "city": "香港", "function_code": "Contract Logistics", "business_area_code": "HONG_KONG"},
]


def seed():
    with app.app_context():
        # ── Get or create employer ──────────────────────────────────────
        emp = User.query.filter_by(email="employer@test.com").first()
        if not emp:
            emp = User(email="employer@test.com", role="employer",
                       name="ACE Logistics", company_name="ACE Logistics 测试公司",
                       is_active=True)
            emp.set_password("test123456")
            db.session.add(emp)
            db.session.commit()

        # ── Create historical candidates ────────────────────────────────
        created_c = 0
        for i, (cd, (pc_str, created_str)) in enumerate(zip(CANDIDATE_DATA, DATES), start=1):
            email = f"hist_c{i:02d}@test.com"
            existing = User.query.filter_by(email=email).first()
            if existing:
                print(f"[SKIP] {email} exists")
                continue

            user = User(email=email, role="candidate", name=cd["full_name"], is_active=True)
            user.set_password("test123456")
            user.created_at = datetime.fromisoformat(created_str).replace(tzinfo=timezone.utc)
            db.session.add(user)
            db.session.flush()

            pc_dt = datetime.fromisoformat(pc_str).replace(tzinfo=timezone.utc)
            profile = Candidate(
                user_id=user.id,
                full_name=cd["full_name"],
                current_title=cd["current_title"],
                current_city=cd["current_city"],
                expected_city=cd["current_city"],
                experience_years=cd["experience_years"],
                function_code=cd["function_code"],
                function_name=cd["function_code"],
                business_area_code=cd["business_area_code"],
                business_area_name=cd["business_area_code"].replace("_", " ").title(),
                location_code=f"CN-{i:02d}",
                location_name=cd["current_city"],
                location_path=f"China/{cd['current_city']}",
                location_type="mainland_china",
                education="本科",
                english_level="CET-4",
                birth_year=1990 + i,
                birth_month=(i % 12) + 1,
                gender="male" if i % 2 == 1 else "female",
                availability_status="open",
                email=email,
                phone=f"1390000{i:04d}",
                contact_visible=True,
                profile_status="complete",
                profile_confirmed_at=pc_dt,
                last_active_at=pc_dt,
                created_at=datetime.fromisoformat(created_str).replace(tzinfo=timezone.utc),
            )
            db.session.add(profile)
            created_c += 1
            print(f"[OK] Candidate #{i}: {cd['full_name']} pc={pc_str[:10]} ({email})")

        db.session.commit()
        print(f"\n[OK] {created_c} historical candidates created")

        # ── Create historical jobs ──────────────────────────────────────
        created_j = 0
        for i, (jd, (_, created_str)) in enumerate(zip(JOB_DATA, DATES), start=1):
            job = Job(
                company_id=emp.id,
                title=jd["title"],
                city=jd["city"],
                business_type=jd["function_code"],
                job_type="全职",
                function_code=jd["function_code"],
                function_name=jd["function_code"],
                business_area_code=jd["business_area_code"],
                description=f"{jd['title']}的详细岗位描述。负责相关工作，确保业务正常运行。",
                experience_required="3-5年",
                degree_required="大专",
                headcount=1,
                urgency_level=2,
                salary_min=10000 + i * 2000,
                salary_max=20000 + i * 2000,
                salary_months=13,
                status="published",
                created_at=datetime.fromisoformat(created_str).replace(tzinfo=timezone.utc),
            )
            db.session.add(job)
            created_j += 1
            print(f"[OK] Job #{i}: {jd['title']} created={created_str[:10]}")

        db.session.commit()
        print(f"\n[OK] {created_j} historical jobs created")

        print("\n=== SEED COMPLETE ===")
        print("Login: employer@test.com / test123456")
        for i in range(1, 11):
            print(f"  hist_c{i:02d}@test.com / test123456")


if __name__ == "__main__":
    seed()
