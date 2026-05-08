# 任务：修复 Login.jsx 验证码自动填充（返工）

## 背景

上次任务已正确修改后端 `backend/app/routes/auth.py`：
- `/register` 强制校验验证码
- `/send-code` 开发模式下返回 `code` 字段

但前端 `src/pages/auth/Login.jsx` 修改不完整：
- `handleSendCode` 函数（第 69-85 行）没有接收返回值 `res`
- 无法获取开发模式返回的验证码并自动填充到 `code` state
- 验证码输入框下方（第 273-286 行）缺少开发模式提示

## 目标

只修改前端 `src/pages/auth/Login.jsx` 的两处：
1. `handleSendCode` 接收 `res` 并自动填充验证码
2. 验证码输入框下方显示开发模式提示

## 允许修改文件

- `src/pages/auth/Login.jsx`

## 禁止修改文件

- `backend/**`（后端已正确）
- 其他前端文件

## 实现步骤

### 1. 修改 handleSendCode 函数（第 69-85 行）

当前第 76-79 行：
```javascript
try {
  await authApi.sendCode({ email: form.email.trim().toLowerCase(), role: tab })
  setCodeSent(true)
  setCountdown(60)
```

修改为：
```javascript
try {
  const res = await authApi.sendCode({ email: form.email.trim().toLowerCase(), role: tab })
  setCodeSent(true)
  setCountdown(60)
  // Development mode: auto-fill code if returned
  if (res.data?.code) {
    setCode(res.data.code)
  }
```

### 2. 在验证码输入框下方添加提示（第 273-286 行）

当前代码在 input 标签后直接关闭 div。在 input 和 </div> 之间添加：
```jsx
{code.length === 6 && (
  <p className="text-xs text-emerald-600 mt-1">
    ✓ 验证码已填写
  </p>
)}
```

完整修改后的验证码区域（第 273-291 行）：
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
      onChange={(e) => setCode(e.target.value.replace(/\D/g, '\).slice(0, 6))}
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

1. handleSendCode 接收 res 并在 res.data?.code 存在时调用 setCode
2. 验证码输入框下方显示绿色提示（当 code.length === 6 时）
3. 不破坏登录和注册的其他功能

## 必须运行命令

```bash
git diff src/pages/auth/Login.jsx
```

## 输出要求

1. 列出修改的具体行号
2. 粘贴 git diff 输出
3. 确认两处修改都已完成

## 停止条件

- 遇到 PERMISSION_BLOCKED 立即停止并报告
- 文件不存在或无法读取时报告并停止
