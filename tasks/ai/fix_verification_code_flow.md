# 修复验证码注册流程

## 背景
用户报告验证码注册流程有问题。根据 git status，以下文件已被修改：
- backend/app/routes/auth.py
- src/api/auth.js
- src/pages/auth/Login.jsx

需要调查当前验证码注册流程的问题并修复。

## 目标
调查并修复验证码注册流程，确保前后端逻辑一致、API 正确对接、用户体验流畅。

## 实现步骤
1. 读取 logs/ai/ 目录下最新的相关执行日志（*-deepseek-result.md），了解之前是否有相关任务
2. 读取 tasks/ai/ 目录下相关任务单，了解之前的需求
3. 读取当前验证码注册流程相关代码：
   - backend/app/routes/auth.py（后端验证码发送和验证逻辑）
   - backend/app/extensions.py（Redis 配置）
   - src/api/auth.js（前端 API 调用）
   - src/pages/auth/Login.jsx（前端注册表单和验证码输入）
4. 对比 git diff，找出已修改的部分
5. 分析问题：
   - 验证码发送接口是否正确实现
   - 验证码验证逻辑是否正确
   - 前后端 API 契约是否一致
   - 错误处理是否完善
   - Redis 存储和过期时间是否正确
6. 修复发现的问题
7. 运行相关测试验证修复效果：
   - backend/tests/test_auth_send_code_smoke.py（如果存在）
   - 或手动测试验证码发送和注册流程

## 允许修改文件
- backend/app/routes/auth.py
- backend/app/extensions.py
- src/api/auth.js
- src/pages/auth/Login.jsx
- backend/tests/test_auth*.py

## 禁止修改文件
- .claude/**
- scripts/ai/**
- AGENTS.md
- 其他不相关的业务文件

## 验收标准
1. 验证码发送接口正确实现（POST /api/auth/send-code）
2. 验证码验证逻辑正确（注册时验证验证码）
3. 前后端 API 契约一致
4. Redis 存储和过期时间正确（验证码 5 分钟过期）
5. 错误处理完善（验证码错误、过期、未发送等情况）
6. 相关测试通过
7. 无超范围修改

## 必须运行命令
- git diff
- git status
- pytest backend/tests/test_auth*.py -v（如果测试文件存在）

## 输出要求
1. 列出发现的问题（具体描述）
2. 列出修改的文件和关键改动
3. 列出测试结果
4. 如果有未解决的问题，明确说明

## 停止条件
遇到 PERMISSION_BLOCKED 立即停止并报告，不要尝试修改权限配置。
