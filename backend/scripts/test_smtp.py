"""
SMTP 连通性测试脚本

直接发送测试邮件验证 SMTP 配置是否正确。
"""
import sys
from app import create_app
from app.services.email_service import send_invitation_email

def test_smtp():
    app = create_app()
    with app.app_context():
        print("=== SMTP 配置检查 ===")
        print(f"MAIL_ENABLED: {app.config.get('MAIL_ENABLED')}")
        print(f"MAIL_HOST: {app.config.get('MAIL_HOST')}")
        print(f"MAIL_PORT: {app.config.get('MAIL_PORT')}")
        print(f"MAIL_USERNAME: {app.config.get('MAIL_USERNAME')}")
        print(f"MAIL_PASSWORD: {'***SET***' if app.config.get('MAIL_PASSWORD') else '***EMPTY***'}")
        print()

        # 获取测试收件人邮箱
        if len(sys.argv) > 1:
            test_email = sys.argv[1]
        else:
            test_email = input("请输入测试收件人邮箱: ").strip()

        if not test_email or '@' not in test_email:
            print("❌ 无效的邮箱地址")
            return

        print(f"\n正在发送测试邮件到: {test_email}")
        print("=" * 50)

        # 构造测试岗位数据
        test_jobs = [
            {
                'title': '海运操作专员（测试岗位）',
                'location_name': '上海市浦东新区',
                'city': '上海',
                'function_name': '海运操作',
                'salary_label': '8-12K',
            },
            {
                'title': '货代销售经理（测试岗位）',
                'location_name': '深圳市南山区',
                'city': '深圳',
                'function_name': '销售',
                'salary_label': '15-25K',
            },
        ]

        try:
            send_invitation_email(
                candidate_email=test_email,
                company_name="ACE-Talent 测试企业",
                jobs=test_jobs,
                site_url=app.config.get('PUBLIC_SITE_URL', 'https://globalogin.com')
            )
            print("\n✅ 邮件发送成功！")
            print(f"请检查 {test_email} 的收件箱（可能在垃圾邮件中）")
        except Exception as e:
            print(f"\n❌ 邮件发送失败: {type(e).__name__}")
            print(f"错误详情: {str(e)}")
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    test_smtp()
