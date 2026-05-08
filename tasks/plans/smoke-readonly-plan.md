# Smoke Plan：DeepSeek 只读冒烟测试

## 需求理解

验证 DeepSeek 主控入口和任务执行脚本是否可用。仅做只读操作，不修改业务代码。

## 风险等级

**低** — 只读操作，无业务代码修改。

## 可能涉及模块

- `AI_CONTEXT.md`
- `PROJECT_DECISIONS.md`
- `package.json`
- `backend/requirements.txt`

## DeepSeek 需要自行调查的文件范围

1. `AI_CONTEXT.md`
2. `PROJECT_DECISIONS.md`
3. `package.json`
4. `backend/requirements.txt`（如果存在）

## 允许操作

- 读取上述文件
- 输出技术栈摘要到日志
- 新增 `tasks/status/smoke-readonly-plan-status.md`

## 禁止操作

- 禁止修改任何业务文件（src/、backend/app/、backend/migrations/ 等）
- 禁止调用官方 Claude
- 禁止读取密钥文件（deepseek_env.sh、official_claude_env.sh、.env、.env.*）
- 禁止执行测试或构建命令

## 执行步骤

1. 读取 `AI_CONTEXT.md`，确认项目上下文已加载。
2. 读取 `PROJECT_DECISIONS.md`，确认架构决策已加载。
3. 读取 `package.json`，提取前端框架和主要依赖版本。
4. 读取 `backend/requirements.txt`，提取后端依赖版本（如文件存在）。
5. 输出技术栈摘要报告。
6. 不做任何代码修改，确认 git diff 为空（或仅含 status 文件）。

## 验收标准

- `git diff -- src/ backend/app/ backend/migrations/` 输出为空。
- 输出包含前端框架版本（React、Vite、Tailwind 版本号）。
- 输出包含后端框架版本（Flask 或 fastapi 版本号）。

## 停止条件

- 如发现需要读取密钥文件，立即停止。
- 如发现任何业务文件被修改，立即停止并回滚。

## 是否需要官方 Claude 最终审查

**否** — 低风险只读操作。

## 建议的 status 文件名称

`tasks/status/smoke-readonly-plan-status.md`
