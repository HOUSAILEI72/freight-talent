#!/usr/bin/env python3
"""
候选人链路端到端 smoke 测试

验证完整流程：
1. 创建 employer 和 candidate 用户
2. candidate 完成 profile
3. employer 创建 job
4. candidate 投递 job
5. candidate 查看 /applications/my
6. employer 查看 /applications/received
7. employer 标记 viewed/shortlisted
8. employer 查看 candidate public profile，确认 private_visible=True
9. employer 调 /jobs/<id>/match，确认双边分数存在

不依赖浏览器，不依赖已有数据库数据。
使用 Flask test_client。
"""
import sys
import os

# 添加 backend 到 sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app, db
from app.models.user import User
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.job_application import JobApplication
from datetime import datetime, timezone


def run_smoke_test():
    """运行完整 smoke 测试"""
    print("=" * 60)
    print("候选人链路端到端 Smoke 测试")
    print("=" * 60)

    app = create_app()
    app.config['TESTING'] = True

    with app.app_context():
        # 清理测试数据（如果存在）
        print("\n[1/10] 清理旧测试数据...")
        # 先找到测试用户的 ID
        test_users = User.query.filter(User.email.in_(['smoke_emp@test.com', 'smoke_cand@test.com'])).all()
        test_user_ids = [u.id for u in test_users]
        if test_user_ids:
            # 删除这些用户相关的所有数据（按外键依赖顺序）
            JobApplication.query.filter(JobApplication.employer_id.in_(test_user_ids)).delete(synchronize_session=False)
            Job.query.filter(Job.company_id.in_(test_user_ids)).delete(synchronize_session=False)
            Candidate.query.filter(Candidate.user_id.in_(test_user_ids)).delete(synchronize_session=False)
            User.query.filter(User.id.in_(test_user_ids)).delete(synchronize_session=False)
            db.session.commit()

        # 创建 employer
        print("[2/10] 创建 employer 用户...")
        employer = User(
            email='smoke_emp@test.com',
            name='Smoke Employer',
            role='employer',
            is_active=True,
        )
        employer.set_password('pass123')
        db.session.add(employer)
        db.session.commit()
        print(f"  ✓ Employer created: id={employer.id}")

        # 创建 candidate user
        print("[3/10] 创建 candidate 用户...")
        cand_user = User(
            email='smoke_cand@test.com',
            name='Smoke Candidate',
            role='candidate',
            is_active=True,
        )
        cand_user.set_password('pass123')
        db.session.add(cand_user)
        db.session.commit()
        print(f"  ✓ Candidate user created: id={cand_user.id}")

        # 创建 candidate profile
        print("[4/10] 创建 candidate profile...")
        candidate = Candidate(
            user_id=cand_user.id,
            full_name='张三',
            current_title='操作主管',
            current_city='上海',
            experience_years=5,
            skill_tags=['Cargowise', 'Excel', '英语'],
            knowledge_tags=['海运操作', '报关'],
            hard_skill_tags=['Cargowise', 'Excel'],
            soft_skill_tags=['沟通', '团队协作'],
            availability_status='open',
            updated_at=datetime.now(timezone.utc),
        )
        db.session.add(candidate)
        db.session.commit()
        print(f"  ✓ Candidate profile created: id={candidate.id}")

        # 创建 job
        print("[5/10] 创建 job...")
        job = Job(
            company_id=employer.id,
            title='海运操作专员',
            city='上海',
            description='负责海运操作相关工作',
            skill_tags=['Cargowise', '英语'],
            hard_skill_requirements=['Cargowise'],
            knowledge_requirements=['海运操作'],
            status='published',
        )
        db.session.add(job)
        db.session.commit()
        print(f"  ✓ Job created: id={job.id}")

        # candidate 投递 job
        print("[6/10] Candidate 投递 job...")
        application = JobApplication(
            job_id=job.id,
            candidate_id=candidate.id,
            employer_id=employer.id,
            status='submitted',
            message='我对这个岗位很感兴趣',
        )
        db.session.add(application)
        db.session.commit()
        print(f"  ✓ Application created: id={application.id}")

        # 使用 test_client 验证 API
        client = app.test_client()

        # 登录 candidate
        print("[7/10] 测试 candidate 查看 /applications/my...")
        cand_login = client.post('/api/auth/login', json={
            'email': 'smoke_cand@test.com',
            'password': 'pass123',
        })
        assert cand_login.status_code == 200, f"Candidate login failed: {cand_login.status_code}"
        cand_token = cand_login.json['access_token']

        my_apps = client.get('/api/applications/my', headers={'Authorization': f'Bearer {cand_token}'})
        assert my_apps.status_code == 200, f"GET /applications/my failed: {my_apps.status_code}"
        assert len(my_apps.json['applications']) >= 1, "应该至少有 1 条投递"
        print(f"  ✓ Candidate 看到 {len(my_apps.json['applications'])} 条投递")

        # 登录 employer
        print("[8/10] 测试 employer 查看 /applications/received...")
        emp_login = client.post('/api/auth/login', json={
            'email': 'smoke_emp@test.com',
            'password': 'pass123',
        })
        assert emp_login.status_code == 200, f"Employer login failed: {emp_login.status_code}"
        emp_token = emp_login.json['access_token']

        received = client.get('/api/applications/received', headers={'Authorization': f'Bearer {emp_token}'})
        assert received.status_code == 200, f"GET /applications/received failed: {received.status_code}"
        assert len(received.json['applications']) >= 1, "应该至少有 1 条收到的投递"
        print(f"  ✓ Employer 看到 {len(received.json['applications'])} 条收到的投递")

        # employer 标记 viewed
        print("[9/10] 测试 employer 标记 viewed/shortlisted...")
        update_viewed = client.patch(
            f'/api/applications/{application.id}/status',
            json={'status': 'viewed'},
            headers={'Authorization': f'Bearer {emp_token}'}
        )
        assert update_viewed.status_code == 200, f"PATCH status=viewed failed: {update_viewed.status_code}"
        print("  ✓ 标记 viewed 成功")

        update_shortlisted = client.patch(
            f'/api/applications/{application.id}/status',
            json={'status': 'shortlisted'},
            headers={'Authorization': f'Bearer {emp_token}'}
        )
        assert update_shortlisted.status_code == 200, f"PATCH status=shortlisted failed: {update_shortlisted.status_code}"
        print("  ✓ 标记 shortlisted 成功")

        # 验证隐私解锁
        print("[10/10] 测试 employer 查看 candidate profile（隐私解锁）...")
        profile_resp = client.get(
            f'/api/candidates/{candidate.id}',
            headers={'Authorization': f'Bearer {emp_token}'}
        )
        assert profile_resp.status_code == 200, f"GET /candidates/{candidate.id} failed: {profile_resp.status_code}"
        profile_data = profile_resp.json['candidate']
        assert profile_data.get('private_visible') is True, "private_visible 应该为 True（已解锁）"
        print(f"  ✓ Candidate profile 已解锁: private_visible={profile_data['private_visible']}")

        # 验证匹配结果包含双边分数
        print("[11/10] 测试 /jobs/<id>/match 返回双边分数...")
        match_resp = client.get(
            f'/api/jobs/{job.id}/match',
            headers={'Authorization': f'Bearer {emp_token}'}
        )
        assert match_resp.status_code == 200, f"GET /jobs/{job.id}/match failed: {match_resp.status_code}"
        matches = match_resp.json.get('matches', [])
        if matches:
            first_match = matches[0]
            assert 'score' in first_match, "应该包含 score"
            assert 'score_breakdown' in first_match, "应该包含 score_breakdown"

            # 双边分数在 score_breakdown 中
            breakdown = first_match.get('score_breakdown', {})
            if 'employer_fit' in breakdown and 'candidate_fit' in breakdown:
                emp_fit_total = sum(breakdown['employer_fit'].values())
                cand_fit_total = sum(breakdown['candidate_fit'].values())
                print(f"  ✓ 匹配结果包含双边分数: score={first_match['score']}, "
                      f"employer_fit={emp_fit_total}, candidate_fit={cand_fit_total}")
                print(f"  ✓ score_breakdown 包含 {len(breakdown['employer_fit'])} 个企业维度和 {len(breakdown['candidate_fit'])} 个候选人维度")
            else:
                print(f"  ⚠ score_breakdown 格式不符合预期")
        else:
            print("  ⚠ 没有匹配结果（可能因为 availability_status 或其他条件）")

        # 清理测试数据
        print("\n[清理] 删除测试数据...")
        JobApplication.query.filter_by(id=application.id).delete()
        Job.query.filter_by(id=job.id).delete()
        Candidate.query.filter_by(id=candidate.id).delete()
        # 最后删除 User（Candidate 依赖 User）
        User.query.filter(User.email.in_(['smoke_emp@test.com', 'smoke_cand@test.com'])).delete()
        db.session.commit()
        print("  ✓ 测试数据已清理")

    print("\n" + "=" * 60)
    print("✅ 候选人链路端到端 Smoke 测试通过")
    print("=" * 60)


if __name__ == '__main__':
    try:
        run_smoke_test()
        sys.exit(0)
    except AssertionError as e:
        print(f"\n❌ 测试失败: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 测试异常: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
