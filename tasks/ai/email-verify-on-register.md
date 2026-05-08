# 任务：强制注册邮箱验证码（腾讯企业邮 SMTP）

## 背景

当前注册流程：前端已有"发送验证码"按钮和验证码输入框，`validate()` 也要求必须先获取
验证码且 code 为 6 位。但后端 `register()` 只在 `MAIL_ENABLED=true` 时才校验 code，
而 `send-code` 接口在 `MAIL_ENABLED=true` 时发送真实邮件，在 `false` 时 **只写 Redis
但不发邮件**。

当前问题：
1. `backend/.env` 已配置 `MAIL_ENABLED=true` 和完整腾讯企业邮 SMTP 凭据，但前端在
   `handleSendCode` 成功后才显示验证码输入框，若邮件实际发不出去，用户拿不到 code，
   注册失败报错体验差。
2. 前端验证码输入框只在 `codeSent=true` 后才渲染（第 273 行），但"发送验证码"按钮
   文案和 `codeSent` 状态并不区分"发送中失败"与"发送成功"——需确认 UI 流程正确。
3. 后端 `send_mail` 在 SMTP 发送失败时只 log error，不向前端返回错误，导致前端
   认为发送成功但用户收不到邮件。

修复目标：
- 核心问题：确保整条链路 **真实可跑**：用户填邮箱 → 点发送 → 收到真实邮件 → 填 code
  → 注册成功。
- 后端 `send_mail` SMTP 失败时应向调用方抛出异常，`send_code` 路由捕获后返回 503。
- 后端 `register` 在 `MAIL_ENABLED=true`（生产默认）时必须校验 code，不可绕过
  （现有逻辑已正确，确认无回归）。
- 前端 `handleSendCode` 已正确 try/catch，确认失败时 `setCodeSent` 不被调用（现有逻辑
  已正确，确认无回归）。
- 补全 SMTP 配置注释（`MAIL_HOST` 接收服务器为 imap.exmail.qq.com:993，发送服务器为
  smtp.exmail.qq.com:465，SSL）。

## 目标

1. **后端 `send_mail`**：SMTP 失败时 `raise`，让调用方感知失败。
2. **后端 `send_code` 路由**：捕获 `send_mail` 抛出的异常，返回 503 + 友好中文提示。
3. **`backend/.env` 注释**：补充 IMAP 接收服务器信息（注释行，不影响运行）。
4. **smoke test**：用 `test_client` 跑 `POST /api/auth/send-code`，验证：
   - 缺 email → 400
   - email 已注册 → 409
   - 正常邮箱（未注册）→ 成功（`MAIL_ENABLED=false` 环境下）或 503（SMTP 不通时）
5. `npx vite build` 无报错。

## 允许修改文件

- `backend/app/extensions.py`（`send_mail` 函数）
- `backend/app/routes/auth.py`（`send_code` 路由）
- `backend/.env`（只加注释行，不改已有 key=value）
- `backend/tests/` 中已有 smoke test 或新增测试文件（如 `tests/test_auth_smoke.py`）

## 禁止修改文件

- `src/pages/auth/Login.jsx`（前端 UI 逻辑已正确，不需改动）
- `src/api/auth.js`
- `backend/app/config.py`
- 任何 `src/components/terminal/` 下文件
- 任何迁移文件
- `.claude/**`

## 实现步骤

### Step 1：修改 `backend/app/extensions.py`

在 `send_mail` 函数末尾的 `except` 块里，把 `logging.error` 改为先 log 再 `raise`：

```python
    except Exception as e:
        logging.getLogger(__name__).error(f"Failed to send email to {to}: {e}")
        raise   # ← 新增：让调用方感知失败
```

### Step 2：修改 `backend/app/routes/auth.py` 中的 `send_code` 路由

在 `send_code` 里，`send_mail(...)` 调用处包一层 try/except：

```python
    if current_app.config.get('MAIL_ENABLED'):
        try:
            send_mail(email, "ACE-Talent 邮箱验证码",
                      f"<p>您的验证码是：<strong>{code}</strong></p><p>有效期 10 分钟，请勿泄露。</p>")
        except Exception:
            # 发送失败：删除已存入 Redis 的验证码，避免用户反复重试消耗限额
            r.delete(code_key)
            r.decr(cnt_key)   # 也回退计数（不惩罚因 SMTP 失败的请求）
            current_app.logger.error(f"send_code: SMTP failed for {email}")
            return _err("邮件发送失败，请稍后重试", 503)

    return jsonify({"success": True, "message": "验证码已发送"})
```

> 注意：当 `MAIL_ENABLED=false` 时，验证码写入 Redis 但不发邮件，直接返回成功（开发模式）。

### Step 3：补充 `backend/.env` 注释

在 `MAIL_HOST=...` 行上方添加注释：

```
# 腾讯企业邮 SMTP（发送）：smtp.exmail.qq.com:465 SSL
# 腾讯企业邮 IMAP（接收）：imap.exmail.qq.com:993 SSL
```

### Step 4：确认现有测试 + 补充 smoke test

检查 `backend/tests/` 是否已有 `test_auth_smoke.py`，若无则新建，包含以下 case：

1. `POST /api/auth/send-code` 缺 email → 400
2. `POST /api/auth/send-code` 无效角色 → 400  
3. `POST /api/auth/send-code` 正常邮箱（未注册，MAIL_ENABLED=false）→ 200 success:true
4. `POST /api/auth/register` 不带 code（MAIL_ENABLED=true 时）→ 400

测试必须使用 `app.config['MAIL_ENABLED'] = False` 来避免真实发邮件，同时需要 Redis
（本地 redis://127.0.0.1:6379/0 可用）。

## 验收标准

- [ ] `backend/app/extensions.py` 的 `send_mail` SMTP 失败时 `raise`
- [ ] `backend/app/routes/auth.py` 的 `send_code` 捕获异常并返回 503
- [ ] `backend/.env` 新增两行注释（SMTP / IMAP），不改任何 key=value
- [ ] `pytest backend/tests/ -v` 全绿（或新增测试全绿）
- [ ] `npx vite build` 无报错（前端未改动，应直接通过）
- [ ] `git diff` 只涉及上述三个文件 + 可选测试文件

## 必须运行命令

```bash
# 后端测试
cd /Users/edy/Desktop/货代招聘/backend
/Users/edy/Desktop/货代招聘/.venv/bin/pytest tests/ -v 2>&1 | tail -30

# 前端构建
cd /Users/edy/Desktop/货代招聘
npx vite build 2>&1 | tail -20
```

## 输出要求

完成后按以下格式输出：

```
### 完成情况
- 修改了哪些文件（列出路径）
- 完成了什么功能

### 还缺什么
- 列出本次未覆盖的边界或已知问题

### 下一步建议
- 具体的下一个小任务
```

## 停止条件

- 所有验收标准通过后停止。
- 若 pytest 或 vite build 失败，自行修复后重跑，直到全绿。
- 若遇到 PERMISSION_BLOCKED，立即停止并报告，不要自行修改权限配置。
