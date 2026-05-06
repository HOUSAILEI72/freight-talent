"""
邮件服务

使用 Python 标准库 smtplib 发送邮件。
不在日志中打印 SMTP 密码。
"""
import smtplib
import logging
from email.message import EmailMessage
from email.utils import formatdate, make_msgid, parseaddr
from flask import current_app

logger = logging.getLogger(__name__)


def send_invitation_email(candidate_email, company_name, jobs, site_url):
    """
    发送企业邀约邮件给候选人

    Args:
        candidate_email: 候选人邮箱
        company_name: 企业名称
        jobs: 岗位列表 [{ title, location_name, city, function_name, salary_label }, ...]
        site_url: 网站 URL（如 https://globalogin.com）

    Raises:
        Exception: SMTP 发送失败时抛出异常
    """
    if not current_app.config.get('MAIL_ENABLED'):
        logger.info(f"MAIL_ENABLED=false, skip sending invitation email to {candidate_email}")
        return

    mail_host = current_app.config.get('MAIL_HOST')
    mail_port = current_app.config.get('MAIL_PORT')
    mail_use_ssl = current_app.config.get('MAIL_USE_SSL')
    mail_username = current_app.config.get('MAIL_USERNAME')
    mail_password = current_app.config.get('MAIL_PASSWORD')
    mail_sender = current_app.config.get('MAIL_DEFAULT_SENDER')

    if not mail_username or not mail_password:
        logger.warning("MAIL_USERNAME or MAIL_PASSWORD not configured, skip sending email")
        return

    # 构建邮件主题
    subject = f"{company_name} 通过 ACE-Talent 向你发出岗位邀约"

    # 构建纯文本内容
    text_body = f"""你好，

{company_name} 通过 ACE-Talent 向你发出岗位邀约。

该企业当前发布的岗位：

"""
    for job in jobs:
        location = job.get('location_name') or job.get('city') or '不限'
        function = job.get('function_name') or '不限'
        salary = job.get('salary_label') or '面议'
        text_body += f"• {job['title']} - {location} - {function} - {salary}\n"

    text_body += f"""
请先登录并完善个人档案，完成后即可查看邀约、投递进度和后续沟通。

立即查看：{site_url}/candidate/tags?source=invite_email

---
ACE-Talent 货代招聘平台
{site_url}
"""

    # 构建 HTML 内容
    html_body = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }}
        .content {{ background: #f9fafb; padding: 30px 20px; }}
        .job-list {{ background: white; border-radius: 8px; padding: 20px; margin: 20px 0; }}
        .job-item {{ padding: 12px 0; border-bottom: 1px solid #e5e7eb; }}
        .job-item:last-child {{ border-bottom: none; }}
        .job-title {{ font-weight: 600; color: #1f2937; }}
        .job-meta {{ color: #6b7280; font-size: 14px; margin-top: 4px; }}
        .cta {{ text-align: center; margin: 30px 0; }}
        .cta-button {{ display: inline-block; background: #667eea; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; }}
        .footer {{ text-align: center; color: #9ca3af; font-size: 12px; padding: 20px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0; font-size: 24px;">🎯 你收到了新的岗位邀约</h1>
        </div>
        <div class="content">
            <p>你好，</p>
            <p><strong>{company_name}</strong> 通过 ACE-Talent 向你发出岗位邀约。</p>

            <div class="job-list">
                <h3 style="margin-top: 0; color: #1f2937;">该企业当前发布的岗位：</h3>
"""

    for job in jobs:
        location = job.get('location_name') or job.get('city') or '不限'
        function = job.get('function_name') or '不限'
        salary = job.get('salary_label') or '面议'
        html_body += f"""
                <div class="job-item">
                    <div class="job-title">{job['title']}</div>
                    <div class="job-meta">{location} · {function} · {salary}</div>
                </div>
"""

    html_body += f"""
            </div>

            <p>请先登录并完善个人档案，完成后即可查看邀约、投递进度和后续沟通。</p>

            <div class="cta">
                <a href="{site_url}/candidate/tags?source=invite_email" class="cta-button">立即查看邀约</a>
            </div>
        </div>
        <div class="footer">
            <p>ACE-Talent 货代招聘平台</p>
            <p><a href="{site_url}" style="color: #667eea; text-decoration: none;">{site_url}</a></p>
        </div>
    </div>
</body>
</html>
"""

    # 构建邮件
    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = mail_sender
    msg['To'] = candidate_email
    msg['Date'] = formatdate(localtime=False, usegmt=True)

    sender_email = parseaddr(mail_sender)[1] or mail_username
    sender_domain = sender_email.rsplit('@', 1)[1] if '@' in sender_email else 'globalogin.com'
    msg['Message-ID'] = make_msgid(idstring='ace-talent', domain=sender_domain)

    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype='html')

    # 发送邮件
    try:
        if mail_use_ssl:
            with smtplib.SMTP_SSL(mail_host, mail_port, timeout=10) as server:
                server.login(mail_username, mail_password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(mail_host, mail_port, timeout=10) as server:
                server.starttls()
                server.login(mail_username, mail_password)
                server.send_message(msg)

        logger.info(f"Invitation email sent to {candidate_email} from {company_name}")
    except Exception as e:
        logger.error(f"Failed to send invitation email to {candidate_email}: {type(e).__name__}")
        raise
