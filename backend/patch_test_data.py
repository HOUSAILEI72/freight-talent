"""
Patch existing test data for candidate pool page testing.
Does NOT insert new candidates or jobs — only updates existing rows
and adds relationship records (favorites, invitations, applications)
for employer@test.com (id=56).

Run: python patch_test_data.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('FLASK_ENV', 'development')
from dotenv import load_dotenv; load_dotenv('.env')

from datetime import datetime, timezone, timedelta
from app import create_app
from app.extensions import db
from app.models.candidate import Candidate
from app.models.user import User
from app.models.invitation import Invitation
from app.models.job_application import JobApplication
from app.models.employer_candidate_favorite import EmployerCandidateFavorite

app = create_app()

def days_ago(n):
    return datetime.now(timezone.utc) - timedelta(days=n)

def main():
    with app.app_context():
        emp = User.query.filter_by(email='employer@test.com').first()
        if not emp:
            print('[ERROR] employer@test.com not found'); return
        emp_id = emp.id
        print(f'[OK] Employer id={emp_id}')

        # ── 1. Set gender + availability_status + last_active_at ───────────
        #   candidate01~10 → id 24~33 (confirmed from DB output)
        PATCH = [
            # id,  gender,   availability,  days_ago_active
            (24, 'male',   'open',    0),   # 张明远 — 今日更新
            (25, 'female', 'open',    1),   # 李思雨 — 昨日
            (26, 'male',   'passive', 3),   # 王建国 — passive
            (27, 'male',   'open',    7),   # 陈晓峰
            (28, 'female', 'passive', 1),   # 刘芳华 — passive
            (29, 'male',   'open',    14),  # 赵志强
            (30, 'female', 'open',    0),   # 周美琪 — 今日更新
            (31, 'male',   'open',    5),   # 吴明辉
            (32, 'female', 'closed',  30),  # 孙丽萍 — 暂不考虑机会
            (33, 'male',   'open',    60),  # 黄伟杰
        ]
        for cid, gender, avail, dago in PATCH:
            c = Candidate.query.get(cid)
            if not c:
                print(f'[SKIP] Candidate id={cid} not found'); continue
            c.gender             = gender
            c.availability_status = avail
            c.last_active_at     = days_ago(dago)
            print(f'[UPDATE] id={cid} {c.full_name}: gender={gender} avail={avail} freshness~{dago}d')
        db.session.flush()

        # ── 2. Favorites for employer 56 ───────────────────────────────────
        # 张明远(24)、刘芳华(28)、周美琪(30) — 三种混合：open+applied, passive, open+invited
        FAV_CANDS = [24, 28, 30]
        for cid in FAV_CANDS:
            exists = EmployerCandidateFavorite.query.filter_by(
                employer_id=emp_id, candidate_id=cid).first()
            if exists:
                print(f'[SKIP] Favorite emp={emp_id} cand={cid} already exists')
                continue
            db.session.add(EmployerCandidateFavorite(employer_id=emp_id, candidate_id=cid))
            print(f'[ADD] Favorite emp={emp_id} → cand={cid}')

        # ── 3. Invitations from employer 56 ───────────────────────────────
        # job_id 28=海运出口操作经理, 29=空运销售经理, 36=供应链数据分析师
        # 李思雨(25)→job29 pending, 王建国(26)→job30 accepted, 黄伟杰(33)→job36 pending
        INV = [
            (25, 29, 'pending'),
            (26, 30, 'accepted'),
            (33, 36, 'pending'),
        ]
        for cid, jid, status in INV:
            exists = Invitation.query.filter_by(
                employer_id=emp_id, candidate_id=cid, job_id=jid).first()
            if exists:
                print(f'[SKIP] Invitation emp={emp_id} cand={cid} job={jid} already exists')
                continue
            db.session.add(Invitation(
                employer_id=emp_id, candidate_id=cid, job_id=jid,
                status=status,
                message='诚邀您来了解我们公司的职位机会。',
            ))
            print(f'[ADD] Invitation emp={emp_id} cand={cid} job={jid} status={status}')

        # ── 4. Job applications for employer 56's jobs ────────────────────
        # 候选人主动投递，涵盖所有 application_status 值
        # job 28=海运出口操作经理, 29=空运销售经理, 34=合同物流项目经理, 35=陆运调度主管
        APPS = [
            # cand_id, job_id, status,       message
            (24, 28, 'submitted',   '多年海运经验，希望加入贵司管理团队。'),
            (25, 29, 'submitted',   '在华南区有丰富空运销售经验，请考虑我的申请。'),
            (30, 28, 'viewed',      '有海运客服及操作双背景，期望转入管理岗位。'),
            (31, 34, 'shortlisted', '合同物流项目管理 9 年，PMP 认证，与 JD 高度匹配。'),
            (32, 28, 'rejected',    '期望深圳海运出口方向，可考虑上海机会。'),
            (27, 35, 'viewed',      '珠三角陆运调度 6 年，熟悉 TMS 系统。'),
        ]
        for cid, jid, status, msg in APPS:
            exists = JobApplication.query.filter_by(
                candidate_id=cid, job_id=jid).first()
            if exists:
                print(f'[SKIP] Application cand={cid} job={jid} already exists (status={exists.status})')
                continue
            db.session.add(JobApplication(
                job_id=jid, candidate_id=cid, employer_id=emp_id,
                status=status, message=msg,
            ))
            print(f'[ADD] Application cand={cid} job={jid} status={status}')

        db.session.commit()
        print('\n=== PATCH COMPLETE ===')
        print('Candidate pool test coverage:')
        print('  All pool    : 23 candidates, mixed gender/avail/freshness')
        print('  Applied pool: 6 applications (submitted×2, viewed×2, shortlisted×1, rejected×1)')
        print('  Favorited   : 3 favorites (张明远, 刘芳华, 周美琪)')
        print('  Invited     : 3 invitations (李思雨 pending, 王建国 accepted, 黄伟杰 pending)')
        print('  Availability: open×7, passive×2, closed×1')
        print('  Freshness   : 今日更新×2, 昨日×2, 3-7d×2, 14-60d×4')

if __name__ == '__main__':
    main()
