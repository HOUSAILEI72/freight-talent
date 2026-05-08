# 任务：修复注册流程邮箱验证码强制校验

## 背景

当前注册流程存在安全漏洞：
- `backend/app/routes/auth.py` 的 `/register` 端点在 `MAIL_ENABLED=false` 时跳过验证码校验（第 50 行）
- 前端强制要求用户获取验证码，但后端可能不校验
- 这不符合工程化登录的安全要求

用户提供的邮件服务器配置：
- SMTP: `smtp.exmail.qq.com:465` (SSL)
- IMAP: `imap.exmail.qq.com:993` (SSL)

## 目标

1. **强制验证码校验**：无论 `MAIL_ENABLED` 是否开启，注册时都必须校验验证码
2. **开发环境兜底**：`MAIL_ENABLED=false` 时，`send-code` 仍生成验证码存 Redis，但不发邮件；开发模式下在响应中返回验证码（方便本地测试）
3. **前端适配**：开发模式下如果后端返回了验证码，在 UI 上显示

## 允许修改文件

- `backend/app/routes/auth.py`
- `src/pages/auth/Login.jsx`

## 禁止修改文件

- `backend/app/config.py`（邮件配置已正确）
- `backend/app/extensions.py`（`send_mail` 函数已正确）
- `.env` 文件
- 其他业务文件

## 实现步骤

### 1. 修改 `backend/app/routes/auth.py`

#### 1.1 修改 `/register` 端点（第 26-73 行）

**当前逻辑**（第 49-61 行）：
```python
# Email verification code check (skipped when MAIL_ENABLED=false)
if current_app.config.get('MAIL_ENABLED'):
    if not code:
        return _err("请输入邮箱验证码")
    r = _get_redis()
    if not r:
        return _err("验证服务暂不可用，请稍后再试", 503)
    stored_code = r.get(f"email_code:{email}")
    if stored_code is None:
        return _err("验证码错误或已过期")
    if stored_code != code:
        return _err("验证码错误或已过期")
    r.delete(f"email_code:{email}")
```

**修改为**（移除 `if MAIL_ENABLED` 条件，始终校验）：
```python
# Email verification code check (always required)
if not code:
    return _err("请输入邮箱验证码")
r = _get_redis()
if not r:
    return _err("验证服务暂不可用，请稍后再试", 503)
stored_code = r.get(f"email_code:{email}")
if stored_code is None:
    return _err("验证码错误或已过期")
if stored_code != code:
    return _err("验证码错误或已过期")
r.delete(f"email_code:{email}")
```

#### 1.2 修改 `/send-code` 端点（第 76-118 行）

**当前逻辑**（第 106-116 行）：
```python
if current_app.config.get('MAIL_ENABLED'):
    try:
        send_mail(email, "ACE-Talent 邮箱验证码",
                  f"<p>您的验证码是：<strong>{code}</strong></p><p>有效期 10 分钟，请勿泄露。</p>")
    except Exception:
        # SMTP 发送失败：回滚 Redis 计数和验证码，避免用户因服务故障被惩罚
        r.delete(code_key)
        r.decr(cnt_key)
        current_app.logger.error(f"send_code: SMTP failed for {email}")
        return _err("邮件发送失败，请稍后重试", 503)

return jsonify({"success": True, "message": "验证码已发送"})
```

**修改为**（始终生成验证码；`MAIL_ENABLED=false` 时跳过 SMTP；开发模式下返回验证码）：
```python
# Send email if MAIL_ENABLED=true
if current_app.config.get('MAIL_ENABLED'):
    try:
        send_mail(email, "ACE-Talent 邮箱验证码",
                  f"<p>您的验证码是：<strong>{code}</strong></p><p>有效期 10 分钟，请勿泄露。</p>")
    except Exception:
        # SMTP 发送失败：回滚 Redis 计数和验证码，避免用户因服务故障被惩罚
        r.delete(code_key)
        r.decr(cnt_key)
        current_app.logger.error(f"send_code: SMTP failed for {email}")
        return _err("邮件发送失败，请稍后重试", 503)

# Development mode: return code in response for testing
response = {"success": True, "message": "验证码已发送"}
if current_app.debug and not current_app.config.get('MAIL_ENABLED'):
    response["code"] = code  # Only in dev mode when email is disabled
    response["message"] = "验证码已生成（开发模式）"

return jsonify(response)
```

### 2. 修改 `src/pages/auth/Login.jsx`

#### 2.1 在 `handleSendCode` 函数中处理开发模式返回的验证码（第 69-85 行）

**当前逻辑**：
```javascript
async function handleSendCode() {
  if (!form.email || !form.email.includes('@')) {
    setError('请先输入有效的邮箱地址')
    return
  }
  setError('')
  setSendingCode(true)
  try {
    await authApi.sendCode({ email: form.email.trim().toLowerCase(), role: tab })
    setCodeSent(true)
    setCountdown(60)
  } catch (err) {
    setError(err.response?.data?.message ?? '发送验证码失败，请稍后重试')
  } finally {
    setSendingCode(false)
  }
}
```

**修改为**（开发模式下自动填充验证码）：
```javascript
async function handleSendCode() {
  if (!form.email || !form.email.includes('@')) {
    setError('请先输入有效的邮箱地址')
    return
  }
  setError('')
  setSendingCode(true)
  try {
    const res = await authApi.sendCode({ email: form.email.trim().toLowerCase(), role: tab })
    setCodeSent(true)
    setCountdown(60)
    // Development mode: auto-fill code if returned
    if (res.data?.code) {
      setCode(res.data.code)
    }
  } catch (err) {
    setError(err.response?.data?.message ?? '发送验证码失败，请稍后重试')
  } finally {
    setSendingCode(false)
  }
}
```

#### 2.2 在验证码输入框下方显示开发模式提示（第 273-286 行）

**在验证码输入框后添加**：
```jsx
{mode === 'register' && codeSent && code && (
  <p className="text-xs text-slate-500 mt-1">
    {code.length === 6 ? '✓ 验证码已自动填充（开发模式）' : ''}
  </p>
)}
```

完整修改后的验证码输入区域：
```jsx
{mode === 'register' && codeSent && (
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1.5">验证码</label>
    <input
      type="text"
      inputMode="numeric"
      maxLength={6}
      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 tracking-[0.3em] text-center text-lg"
      placeholder="000000"
      value={code}
      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
    />
    {code.length === 6 && (
      <p className="text-xs text-emerald-600 mt-1">
        ✓ 验证码已填写
      </p>
    )}
  </div>
)}
```

## 验收标准

1. **后端强制校验**：
   - 无论 `MAIL_ENABLED` 是 `true` 还是 `false`，`/register` 都必须校验验证码
   - `MAIL_ENABLED=false` 时，`/send-code` 仍生成验证码存 Redis，但不发邮件
   - 开发模式（`DEBUG=True`）且 `MAIL_ENABLED=false` 时，`/send-code` 响应中包含 `code` 字段

2. **前端开发体验**：
   - 开发模式下，如果后端返回了 `code`，自动填充到输入框
   - 验证码填写完成后显示绿色提示

3. **安全性**：
   - 生产环境（`DEBUG=False`）不在响应中返回验证码
   - 验证码仍有 10 分钟过期时间和频率限制

## 必须运行命令

```bash
# 1. 检查 Redis 是否运行
docker ps | grep redis || docker run -d -p 6379:6379 redis:7-alpine

# 2. 启动后端（在 backend/ 目录下）
cd backend
source ../.venv/bin/activate || ../.venv/Scripts/activate
python run.py &
BACKEND_PID=$!

# 3. 等待后端启动
sleep 3

# 4. 测试 send-code 接口（开发模式应返回 code）
curl -X POST http://127.0.0.1:5000/api/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","role":"candidate"}' \
  | python -m json.tool

# 5. 测试 register 接口（必须校验验证码）
# 先获取验证码
CODE_RESPONSE=$(curl -s -X POST http://127.0.0.1:5000/api/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{"email":"test2@example.com","role":"candidate"}')
echo "Send code response: $CODE_RESPONSE"

# 提取验证码（开发模式）
CODE=$(echo $CODE_RESPONSE | python -c "import sys, json; print(json.load(sys.stdin).get('code', ''))")
echo "Extracted code: $CODE"

# 使用验证码注册
if [ -n "$CODE" ]; then
  curl -X POST http://127.0.0.1:5000/api/auth/register \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"test2@example.com\",\"password\":\"test123456\",\"name\":\"测试用户\",\"role\":\"candidate\",\"code\":\"$CODE\"}" \
    | python -m json.tool
fi

# 6. 测试无验证码注册（应失败）
curl -X POST http://127.0.0.1:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test3@example.com","password":"test123456","name":"测试用户","role":"candidate"}' \
  | python -m json.tool

# 7. 停止后端
kill $BACKEND_PID 2>/dev/null || true
```

## 输出要求

1. 列出修改的文件和具体改动行数
2. 粘贴测试命令的完整输出
3. 确认以下行为：
   - `send-code` 开发模式返回 `code` 字段
   - `register` 无验证码时返回 `"请输入邮箱验证码"`
   - `register` 使用正确验证码时成功注册

## 停止条件

- 如果遇到 `PERMISSION_BLOCKED`，立即停止并报告
- 如果 Redis 未运行且无法启动，报告并停止
- 如果测试失败，报告具体错误信息
