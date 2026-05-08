# 任务：调查并修复验证码注册流程

## 背景

用户报告"验证码注册流程"有问题。当前有多个相关修改未提交：
- `backend/app/routes/auth.py`
- `src/pages/auth/Login.jsx`
- `src/api/auth.js`
- `backend/app/extensions.py`

最近执行过的相关任务：
- `fix_login_code_autofill`（2026-05-08 13:34）
- `fix_email_verification`（2026-05-08 13:04）
- `email-verify-on-register`（2026-05-08 12:40）

## 目标

调查并修复验证码注册流程的所有问题，确保完整链路可用：
1. 发送验证码（`POST /api/auth/send-code`）
2. 注册时验证验证码（`POST /api/auth/register`）
3. 前端自动填充验证码（开发模式）
4. 错误处理和用户提示

## 实现步骤

### 1. 调查阶段

1. 读取最近的执行日志：
   - `logs/ai/20260508-133445-20260508-133441-fix_login_code_autofill-deepseek-result.md`
   - `logs/ai/20260508-130441-fix_email_verification-deepseek-result.md`
   - `logs/ai/20260508-123910-email-verify-on-register-deepseek-result.md`

2. 读取对应的任务单（如果存在）：
   - `tasks/ai/running/` 或 `tasks/ai/archive/` 下的相关任务单

3. 查看当前代码状态：
   - `git diff backend/app/routes/auth.py`
   - `git diff src/pages/auth/Login.jsx`
   - `git diff src/api/auth.js`
   - `git diff backend/app/extensions.py`

4. 理解完整流程：
   - 后端 `/send-code` 接口实现（是否返回验证码？）
   - 后端 `/register` 接口验证逻辑（是否强制校验验证码？）
   - 前端发送验证码逻辑（是否接收返回值？）
   - 前端注册逻辑（是否传递验证码？）
   - Redis 验证码存储和验证

5. 找出问题：
   - 上次任务是否完整实现了所有要求？
   - 是否有遗漏的修改？
   - 是否有逻辑错误？
   - 是否有测试失败？

### 2. 修复阶段

根据调查结果修复所有问题，可能包括但不限于：
- 补充遗漏的代码修改
- 修正逻辑错误
- 完善错误处理
- 添加开发模式提示

### 3. 测试阶段

1. 运行 smoke test：
   ```bash
   cd /Users/edy/Desktop/货代招聘/backend
   /Users/edy/Desktop/货代招聘/.venv/Scripts/python.exe -m pytest tests/test_auth_send_code_smoke.py -v
   ```

2. 检查测试结果，如果失败则继续修复

3. 运行 `git diff` 确认所有修改

## 允许修改文件

- `backend/app/routes/auth.py`
- `backend/app/extensions.py`
- `src/pages/auth/Login.jsx`
- `src/api/auth.js`
- `backend/tests/test_auth_*.py`（如需添加测试）
- 其他直接相关的验证码注册流程文件

## 禁止修改文件

- `.claude/**`
- `scripts/ai/**`
- `AGENTS.md`
- 不相关的业务文件

## 验收标准

1. 所有任务单要求都已实现（对比历史任务单）
2. 验证码注册流程完整可用：
   - 发送验证码成功
   - 开发模式下自动填充验证码
   - 注册时正确验证验证码
   - 错误情况有清晰提示
3. Smoke test 通过
4. 无超范围修改
5. 代码逻辑清晰，无明显 bug

## 必须运行命令

```bash
# 查看当前修改
git diff

# 运行测试
cd /Users/edy/Desktop/货代招聘/backend
/Users/edy/Desktop/货代招聘/.venv/Scripts/python.exe -m pytest tests/test_auth_send_code_smoke.py -v
```

## 输出要求

1. 列出调查发现的问题（对比任务单和实际代码）
2. 列出修改的文件和关键改动
3. 测试结果（通过/失败，失败则说明原因）
4. 确认验收标准是否全部满足

## 停止条件

- 遇到 PERMISSION_BLOCKED 立即停止并报告
- 遇到无法解决的技术问题立即停止并报告
- 完成所有验收标准后停止
