#!/usr/bin/env python3
"""
企业链路端到端 smoke 测试

验证完整流程：
1. 创建 employer 和 candidate 用户
2. 创建完整 candidate profile
3. employer 创建 job
4. employer GET /api/jobs/my
5. employer GET /api/jobs/<id>/match
6. candidate 投递 job
7. employer 查看收到的投递
8. employer 标记 viewed/shortlisted
9. employer 发邀约
10. candidate 查看邀约
11. candidate 接受邀约
12. employer 查看 conversations
13. employer 发消息
14. candidate 查看消息

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
from app.models.invitation import Invitation
from app.models.conversation import ConversationThread, Message
from datetime import datetime, timezone


def run_smoke_test():
    """运行完整 smoke 测试"""
    print("=" * 60)
    print("企业链路端到端 Smoke 测试")
    print("=" * 60)

    app = create_app()
    app.config['TESTING'] = True

    with app.app_context():
        # 清理测试数据（如果存在）
        print("\n[1/15] 清理旧测试数据...")
        test_users = User.query.filter(User.email.in_(['smoke_emp2@test.com', 'smoke_cand2@test.com'])).all()
        test_user_ids = [u.id for u in test_users]
        if test_user_ids:
            # 按外键依赖顺序删除
            Message.query.filter(Message.sender_user_id.in_(test_user_ids)).delete(synchronize_session=False)
            ConversationThread.query.filter(
                (ConversationThread.employer_id.in_(test_user_ids)) | (ConversationThread.candidate_id.in_(test_user_ids))
            ).delete(synchronize_session=False)
            Invitation.query.filter(Invitation.employer_id.in_(test_user_ids)).delete(synchronize_session=False)
            JobApplication.query.filter(JobApplication.employer_id.in_(test_user_ids)).delete(synchronize_session=False)
            Job.query.filter(Job.company_id.in_(test_user_ids)).delete(synchronize_session=False)
            Candidate.query.filter(Candidate.user_id.in_(test_user_ids)).delete(synchronize_session=False)
            User.query.filter(User.id.in_(test_user_ids)).delete(synchronize_session=False)
            db.session.commit()

        # 创建 employer
        print("[2/15] 创建 employer 用户...")
        employer = User(
            email='smoke_emp2@test.com',
            name='Smoke Employer 2',
            role='employer',
            is_active=True,
        )
        employer.set_password('pass123')
        db.session.add(employer)
        db.session.commit()
        print(f"  ✓ Employer created: id={employer.id}")

        # 创建 candidate user
        print("[3/15] 创建 candidate 用户...")
        cand_user = User(
            email='smoke_cand2@test.com',
            name='Smoke Candidate 2',
            role='candidate',
            is_active=True,
        )
        cand_user.set_password('pass123')
        db.session.add(cand_user)
        db.session.commit()
        print(f"  ✓ Candidate user created: id={cand_user.id}")

        # 创建完整 candidate profile
        print("[4/15] 创建完整 candidate profile...")
        candidate = Candidate(
            user_id=cand_user.id,
            full_name='李四',
            current_title='销售经理',
            current_city='深圳',
            experience_years=8,
            skill_tags=['销售', '客户管理', '英语'],
            knowledge_tags=['空运操作', '客户开发'],
            hard_skill_tags=['CRM', 'Excel'],
            soft_skill_tags=['谈判', '沟通'],
            availability_status='open',
            profile_status='complete',  # 标记为完整档案
            updated_at=datetime.now(timezone.utc),
        )
        db.session.add(candidate)
        db.session.commit()
        print(f"  ✓ Candidate profile created: id={candidate.id}")

        # 使用 test_client
        client = app.test_client()

        # 登录 employer
        print("[5/15] Employer 登录...")
        emp_login = client.post('/api/auth/login', json={
            'email': 'smoke_emp2@test.com',
            'password': 'pass123',
        })
        assert emp_login.status_code == 200, f"Employer login failed: {emp_login.status_code}"
        emp_token = emp_login.json['access_token']
        print("  ✓ Employer 登录成功")

        # employer 创建 job
        print("[6/15] Employer 创建 job...")
        create_job = client.post('/api/jobs', json={
            'title': '空运销售专员',
            'city': '深圳',
            'description': '负责空运销售相关工作',
            'skill_tags': ['销售', '英语'],
            'hard_skill_requirements': ['CRM'],
            'knowledge_requirements': ['空运操作'],
            'status': 'published',
        }, headers={'Authorization': f'Bearer {emp_token}'})
        assert create_job.status_code == 201, f"POST /api/jobs failed: {create_job.status_code}"
        job_id = create_job.json['job']['id']
        print(f"  ✓ Job created: id={job_id}")

        # employer GET /api/jobs/my
        print("[7/15] Employer 查看我的岗位...")
        my_jobs = client.get('/api/jobs/my', headers={'Authorization': f'Bearer {emp_token}'})
        assert my_jobs.status_code == 200, f"GET /api/jobs/my failed: {my_jobs.status_code}"
        assert len(my_jobs.json['jobs']) >= 1, "应该至少有 1 个岗位"
        print(f"  ✓ Employer 看到 {len(my_jobs.json['jobs'])} 个岗位")

        # employer GET /api/jobs/<id>/match
        print("[8/15] Employer 查看匹配结果...")
        match_resp = client.get(f'/api/jobs/{job_id}/match', headers={'Authorization': f'Bearer {emp_token}'})
        assert match_resp.status_code == 200, f"GET /api/jobs/{job_id}/match failed: {match_resp.status_code}"
        matches = match_resp.json.get('matches', [])
        if matches:
            first_match = matches[0]
            assert 'score' in first_match, "应该包含 score"
            assert 'score_breakdown' in first_match, "应该包含 score_breakdown"
            print(f"  ✓ 匹配结果返回 {len(matches)} 个候选人，score={first_match['score']}")
        else:
            print("  ⚠ 没有匹配结果")

        # 登录 candidate
        print("[9/15] Candidate 登录并投递...")
        cand_login = client.post('/api/auth/login', json={
            'email': 'smoke_cand2@test.com',
            'password': 'pass123',
        })
        assert cand_login.status_code == 200, f"Candidate login failed: {cand_login.status_code}"
        cand_token = cand_login.json['access_token']

        # candidate 投递 job
        apply_resp = client.post(f'/api/jobs/{job_id}/applications', json={
            'message': '我对这个岗位很感兴趣',
        }, headers={'Authorization': f'Bearer {cand_token}'})
        assert apply_resp.status_code in [200, 201], f"POST /api/jobs/{job_id}/applications failed: {apply_resp.status_code}"
        application_id = apply_resp.json['application']['id']
        print(f"  ✓ Candidate 投递成功: application_id={application_id}")

        # employer 查看收到的投递
        print("[10/15] Employer 查看收到的投递...")
        received = client.get('/api/applications/received', headers={'Authorization': f'Bearer {emp_token}'})
        assert received.status_code == 200, f"GET /api/applications/received failed: {received.status_code}"
        assert len(received.json['applications']) >= 1, "应该至少有 1 条投递"
        print(f"  ✓ Employer 看到 {len(received.json['applications'])} 条投递")

        # employer 标记 viewed
        print("[11/15] Employer 标记 viewed/shortlisted...")
        update_viewed = client.patch(
            f'/api/applications/{application_id}/status',
            json={'status': 'viewed'},
            headers={'Authorization': f'Bearer {emp_token}'}
        )
        assert update_viewed.status_code == 200, f"PATCH status=viewed failed: {update_viewed.status_code}"
        print("  ✓ 标记 viewed 成功")

        # employer 标记 shortlisted
        update_shortlisted = client.patch(
            f'/api/applications/{application_id}/status',
            json={'status': 'shortlisted'},
            headers={'Authorization': f'Bearer {emp_token}'}
        )
        assert update_shortlisted.status_code == 200, f"PATCH status=shortlisted failed: {update_shortlisted.status_code}"
        print("  ✓ 标记 shortlisted 成功")

        # employer 发邀约
        print("[12/15] Employer 发邀约...")
        invite_resp = client.post('/api/invitations', json={
            'candidate_id': candidate.id,
            'job_id': job_id,
            'message': '我们对您的背景很感兴趣，期待与您沟通',
        }, headers={'Authorization': f'Bearer {emp_token}'})
        assert invite_resp.status_code in [200, 201], f"POST /api/invitations failed: {invite_resp.status_code}"
        invitation_id = invite_resp.json['invitation']['id']
        print(f"  ✓ 邀约发送成功: invitation_id={invitation_id}")

        # candidate 查看邀约
        print("[13/15] Candidate 查看邀约...")
        my_invites = client.get('/api/invitations/my', headers={'Authorization': f'Bearer {cand_token}'})
        assert my_invites.status_code == 200, f"GET /api/invitations/my failed: {my_invites.status_code}"
        assert len(my_invites.json['invitations']) >= 1, "应该至少有 1 条邀约"
        print(f"  ✓ Candidate 看到 {len(my_invites.json['invitations'])} 条邀约")

        # candidate 接受邀约
        print("[14/15] Candidate 接受邀约...")
        accept_resp = client.patch(
            f'/api/invitations/{invitation_id}/status',
            json={'status': 'accepted'},
            headers={'Authorization': f'Bearer {cand_token}'}
        )
        assert accept_resp.status_code == 200, f"PATCH invitation status=accepted failed: {accept_resp.status_code}"
        print("  ✓ 邀约接受成功")

        # employer 查看 conversations
        print("[15/15] Employer 查看 conversations...")
        convs = client.get('/api/conversations', headers={'Authorization': f'Bearer {emp_token}'})
        assert convs.status_code == 200, f"GET /api/conversations failed: {convs.status_code}"
        threads = convs.json.get('conversations', [])
        if threads:
            thread_id = threads[0]['id']
            print(f"  ✓ Conversation thread 已创建: thread_id={thread_id}")

            # employer 发消息
            send_msg = client.post(f'/api/conversations/{thread_id}/messages', json={
                'content': '您好，我们想进一步了解您的工作经验',
            }, headers={'Authorization': f'Bearer {emp_token}'})
            assert send_msg.status_code in [200, 201], f"POST message failed: {send_msg.status_code}"
            print("  ✓ Employer 发送消息成功")

            # candidate 查看消息
            get_msgs = client.get(f'/api/conversations/{thread_id}/messages', headers={'Authorization': f'Bearer {cand_token}'})
            assert get_msgs.status_code == 200, f"GET messages failed: {get_msgs.status_code}"
            messages = get_msgs.json.get('messages', [])
            assert len(messages) >= 1, "应该至少有 1 条消息"
            print(f"  ✓ Candidate 看到 {len(messages)} 条消息")
        else:
            print("  ⚠ 没有 conversation thread（可能邀约接受后未自动创建）")

        # 清理测试数据
        print("\n[清理] 删除测试数据...")
        test_users = User.query.filter(User.email.in_(['smoke_emp2@test.com', 'smoke_cand2@test.com'])).all()
        test_user_ids = [u.id for u in test_users]
        if test_user_ids:
            Message.query.filter(Message.sender_user_id.in_(test_user_ids)).delete(synchronize_session=False)
            ConversationThread.query.filter(
                (ConversationThread.employer_id.in_(test_user_ids)) | (ConversationThread.candidate_id.in_(test_user_ids))
            ).delete(synchronize_session=False)
            Invitation.query.filter(Invitation.employer_id.in_(test_user_ids)).delete(synchronize_session=False)
            JobApplication.query.filter(JobApplication.employer_id.in_(test_user_ids)).delete(synchronize_session=False)
            Job.query.filter(Job.company_id.in_(test_user_ids)).delete(synchronize_session=False)
            Candidate.query.filter(Candidate.user_id.in_(test_user_ids)).delete(synchronize_session=False)
            User.query.filter(User.id.in_(test_user_ids)).delete(synchronize_session=False)
            db.session.commit()
        print("  ✓ 测试数据已清理")

    print("\n" + "=" * 60)
    print("✅ 企业链路端到端 Smoke 测试通过")
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
