# AI Agent Pipeline — 新架构说明

> 本文件描述当前生效的 AI 协作开发架构。

---

## 架构目标

**DeepSeek-v4-pro 默认执行，官方 Claude 按需规划/审查。**

- DeepSeek：日常主控，大量读代码、改代码、跑测试、修复报错、生成日志
- 官方 Claude：高价值架构顾问，只在规划或审查时通过脚本调用，禁止扫描全项目

---

## 日常入口

```bash
cd /Users/edy/Desktop/货代招聘
scripts/ai/cc_deepseek_master.sh
```

启动 DeepSeek 交互会话，API endpoint 指向 DeepSeek-v4-pro，不消耗官方 Claude token。

---

## 标准工作流

### 1. 创建需求文件

手动创建：`tasks/requirements/REQ-XXX.md`

格式：说明目标、要求、验收标准。

---

### 2. 规划阶段（可选，调用官方 Claude）

```bash
# 仅传需求文件（官方 Claude 只看文本，不读代码）
scripts/ai/ask_official_claude_plan.sh tasks/requirements/REQ-XXX.md

# 如需代码上下文，先让 DeepSeek 生成摘要，再传入
scripts/ai/ask_official_claude_plan.sh tasks/requirements/REQ-XXX.md tasks/context/REQ-XXX-code-summary.md
```

输出到：`tasks/plans/REQ-XXX-plan.md`

**官方 Claude 在 plan 阶段：禁止使用任何工具，只能看传入文本。**

---

### 3. DeepSeek 执行

```bash
# 单次执行
scripts/ai/run_deepseek_task.sh tasks/plans/REQ-XXX-plan.md

# 多轮自动修复（最多 3 轮，遇 needs-review 自动停止）
scripts/ai/run_until_done.sh tasks/plans/REQ-XXX-plan.md

# 执行完毕后自动调用官方 Claude 审查
ASK_OFFICIAL_REVIEW=1 scripts/ai/run_deepseek_task.sh tasks/plans/REQ-XXX-plan.md
```

输出到：
- `logs/ai/RUNID-*-deepseek-result.md` — 执行日志
- `logs/ai/RUNID-*-diff.patch` — git diff
- `tasks/status/REQ-XXX-plan-status.md` — 任务状态（done / needs-review）

---

### 4. 官方 Claude 审查（可选）

```bash
scripts/ai/ask_official_claude_review.sh \
  tasks/plans/REQ-XXX-plan.md \
  logs/ai/RUNID-diff.patch \
  tasks/status/REQ-XXX-plan-status.md
```

输出到：`logs/ai/RUNID-official-claude-review.md`

**官方 Claude 在 review 阶段：禁止使用任何工具，只能看传入文本。**

---

### 5. 两阶段官方 Claude 规划（复杂/高风险需求推荐）

对于复杂或高风险需求，使用两阶段规划流程。官方 Claude 先提调查问题 → DeepSeek 只读调查代码 → 官方 Claude 基于代码事实生成最终 plan。

```bash
# 第一步：写需求文件
# 手动创建 tasks/requirements/REQ-XXX.md

# 第二步：官方 Claude 生成调查问题（不读代码，不生成 plan）
scripts/ai/ask_official_claude_questions.sh tasks/requirements/REQ-XXX.md
# 输出: tasks/context/REQ-XXX-investigation-questions.md
#       logs/ai/RUNID-REQ-XXX-official-questions.md

# 第三步：DeepSeek 只读调查代码（不修改业务代码）
scripts/ai/run_deepseek_investigation.sh \
  tasks/requirements/REQ-XXX.md \
  tasks/context/REQ-XXX-investigation-questions.md
# 输出: tasks/context/REQ-XXX-code-summary.md
#       logs/ai/RUNID-REQ-XXX-investigation.md
#       logs/ai/RUNID-REQ-XXX-investigation-stream.raw.jsonl

# 第四步：官方 Claude 基于 code-summary 生成最终 plan
scripts/ai/ask_official_claude_plan.sh \
  tasks/requirements/REQ-XXX.md \
  tasks/context/REQ-XXX-code-summary.md
# 输出: tasks/plans/REQ-XXX-plan.md
#       logs/ai/RUNID-REQ-XXX-official-plan.md

# 第五步：DeepSeek 执行 plan
scripts/ai/run_deepseek_task.sh tasks/plans/REQ-XXX-plan.md

# 第六步（可选）：多轮自动修复
scripts/ai/run_until_done.sh tasks/plans/REQ-XXX-plan.md

# 第七步（可选）：官方 Claude 审查
scripts/ai/ask_official_claude_review.sh \
  tasks/plans/REQ-XXX-plan.md \
  logs/ai/RUNID-REQ-XXX-diff.patch \
  tasks/status/REQ-XXX-plan-status.md
```

**需要两阶段规划的场景：**
- 认证、权限相关
- 订阅、支付相关
- 数据库迁移（新增/修改表结构）
- 消息系统核心逻辑
- 候选人匹配算法
- 大型重构（涉及 5 个以上文件）
- 用户自己不确定实现路径的需求

**不需要两阶段规划的场景（直接跳到第四步）：**
- 文案修改
- 小 UI 调整（单文件、纯样式）
- 简单 bug 修复（单文件、逻辑明确）
- 单文件低风险修改
- 文档更新

**两阶段规划的核心原理：**
- 官方 Claude 不直接读项目代码，也不凭空生成最终 plan
- 官方 Claude 先告诉 DeepSeek：它为了做高质量架构判断，需要知道哪些代码事实
- DeepSeek 去项目代码里做只读调查，生成 code-summary
- 官方 Claude 基于需求 + AI_CONTEXT.md + PROJECT_DECISIONS.md + code-summary 生成最终 plan
- 所有阶段官方 Claude 均无工具权限

---

## 持久上下文文件

| 文件 | 用途 |
|---|---|
| `AI_CONTEXT.md` | 项目技术摘要，DeepSeek 每次任务前必读 |
| `PROJECT_DECISIONS.md` | 架构决策日志，所有重要决策追加到此 |
| `AGENTS.md` | 项目规则和阶段规划（不要修改） |
| `tasks/requirements/` | 需求文件（人工创建） |
| `tasks/plans/` | 计划文件（官方 Claude 或人工生成） |
| `tasks/status/` | 状态文件（DeepSeek 自动生成） |
| `tasks/context/` | 代码摘要（DeepSeek 生成，供官方 Claude 使用） |
| `logs/ai/` | 执行日志、diff、review |

---

## 官方 Claude Token 控制原则

1. **plan 阶段禁止工具** — `--allowedTools ""` + `--disallowedTools "Read,Grep,Glob,Bash,Edit,Write,..."`
2. **review 阶段禁止工具** — 同上
3. **只传文本，不读项目** — 需求、AI_CONTEXT.md、PROJECT_DECISIONS.md、diff patch、status
4. **代码上下文由 DeepSeek 先生成摘要** — 放到 `tasks/context/`，再作为参数传给官方 Claude
5. **目标 token 控制在 3k-8k** — 不传大文件，不传全项目 diff

---

## 停止条件

DeepSeek 遇到以下情况必须停止并报告：

1. 认证、权限、支付、订阅、数据库迁移、消息系统核心逻辑不确定
2. diff 超过 500 行（`run_deepseek_task.sh` 自动检测并标记 `needs-review`）
3. 连续修复 3 次失败（`run_until_done.sh` 自动停止）
4. 测试环境缺失
5. 需要读取密钥
6. 需要执行破坏性命令
7. 需求不清楚

---

## 密钥管理

| 文件 | 用途 |
|---|---|
| `scripts/ai/deepseek_env.sh` | DeepSeek API token（本地，不入库） |
| `scripts/ai/official_claude_env.sh` | 官方 Claude gateway token（本地，不入库） |
| `scripts/ai/deepseek_env.example.sh` | DeepSeek 模板（可入库） |
| `scripts/ai/official_claude_env.example.sh` | 官方 Claude 模板（可入库） |

两个 env 文件已加入 `.gitignore`，chmod 600。

---

## 停用的旧文件（参考用，不作为入口）

| 文件 | 原用途 | 现状 |
|---|---|---|
| `scripts/ai/cc_arch.sh` | 旧官方 Claude 主控入口 | DISABLED stub |
| `scripts/ai/worker_daemon.sh` | 旧守护进程队列 | DISABLED stub |
| `scripts/ai/enqueue_task.sh` | 旧任务入队 | DISABLED stub |
| `.claude/commands/plan-delegate.md.disabled` | 旧 /plan-delegate 命令 | .disabled |
| `.claude/commands/review-deepseek.md.disabled` | 旧 /review-deepseek 命令 | .disabled |
| `.claude/agents/architect.md.disabled` | 旧官方 Claude architect agent | .disabled |

---

## Smoke 测试

```bash
scripts/ai/run_deepseek_task.sh tasks/plans/smoke-readonly-plan.md
git diff -- src/ backend/app/ backend/migrations/
```

预期：git diff 为空（无业务代码变更）。
