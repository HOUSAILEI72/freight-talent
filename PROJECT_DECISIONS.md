# PROJECT_DECISIONS.md

本文件记录长期架构决策。以后官方 Claude 或 DeepSeek 做出重要技术决策，都要追加记录。

---

## 决策记录格式

```
### YYYY-MM-DD - 决策标题
- 背景：
- 决策：
- 原因：
- 影响范围：
- 是否需要官方 Claude 审查：
```

---

## 决策历史

### 2026-05-08 - AI 协作架构采用 DeepSeek 默认执行、官方 Claude 按需顾问模式

- **背景**：用户不是专业全栈开发工程师，需要官方 Claude 做高价值架构判断，但不希望官方 Claude 承担大量代码阅读和实现成本。
- **决策**：DeepSeek-v4-pro 作为默认主控和执行器；官方 Claude 仅通过 `scripts/ai/ask_official_claude_plan.sh` 和 `scripts/ai/ask_official_claude_review.sh` 按需调用。
- **原因**：降低官方 Claude token 消耗，同时保留高质量架构判断能力。官方 Claude 的 plan/review 阶段禁止使用工具，只能看脚本传入的文本（需求、AI_CONTEXT.md、PROJECT_DECISIONS.md、diff patch、status）。
- **影响范围**：
  - 新建：`AI_CONTEXT.md`、`PROJECT_DECISIONS.md`、`tasks/requirements/`、`tasks/plans/`、`tasks/status/`、`tasks/context/`
  - 新建脚本：`cc_deepseek_master.sh`、`ask_official_claude_plan.sh`、`ask_official_claude_review.sh`、`run_deepseek_task.sh`、`run_until_done.sh`
  - 停用：`cc_arch.sh`、`worker_daemon.sh`、`enqueue_task.sh`、`.claude/commands/plan-delegate.md`、`.claude/commands/review-deepseek.md`、`.claude/agents/architect.md`
- **是否需要官方 Claude 审查**：否。

---

### 2026-05-08 - 官方 Claude token 控制策略

- **背景**：官方 Claude 成本高，必须严格控制 token 消耗。
- **决策**：
  1. 官方 Claude 的 plan 阶段禁止所有工具（Read、Grep、Glob、Bash、Edit、Write、WebFetch、WebSearch、NotebookEdit），只能看脚本传入的文本。
  2. 官方 Claude 的 review 阶段同样禁止所有工具，只能看任务计划、diff patch、status 文件。
  3. 如果官方 Claude 需要代码上下文，必须由 DeepSeek 先生成 `tasks/context/xxx-code-summary.md`，再作为摘要传给官方 Claude。
  4. plan 阶段目标 token 控制在 3k-8k。
- **原因**：防止官方 Claude 自行扫描全项目，导致 token 爆炸。
- **影响范围**：`ask_official_claude_plan.sh`、`ask_official_claude_review.sh` 的 `--allowedTools ""` 和 `--disallowedTools` 参数。
- **是否需要官方 Claude 审查**：否。

---

### 2026-05-08 - 停止条件硬编码

- **背景**：之前只在 system prompt 里口头说停止条件，没有脚本层面的硬检查。
- **决策**：`run_deepseek_task.sh` 执行后自动检查 diff 行数，如果超过 500 行，status 文件标记为 `needs-review`。
- **原因**：大 diff 必须人工或官方 Claude 审查，避免 DeepSeek 自行合并高风险变更。
- **影响范围**：`run_deepseek_task.sh`、`tasks/status/*.md`。
- **是否需要官方 Claude 审查**：否。

---

### 2026-05-08 - 需求闭环文件链

- **背景**：之前任务只有 `tasks/ai/*.md`，没有形成需求→计划→执行→状态的闭环。
- **决策**：每个需求必须经过以下文件链：
  1. `tasks/requirements/REQ-XXX.md` — 用户需求
  2. `tasks/plans/REQ-XXX-plan.md` — 官方 Claude 或人工规划
  3. `logs/ai/RUN_ID-REQ-XXX-deepseek-result.md` — DeepSeek 执行日志
  4. `logs/ai/RUN_ID-REQ-XXX-diff.patch` — git diff
  5. `tasks/status/REQ-XXX-status.md` — 最终状态（done/failed/needs-review/blocked）
  6. 可选：`logs/ai/RUN_ID-official-review.md` — 官方 Claude 审查
- **原因**：持久化上下文，便于追溯和审计。
- **影响范围**：所有 AI 脚本、目录结构。
- **是否需要官方 Claude 审查**：否。

---

## 未来决策追加格式

当做出新的架构决策时，请在本文件末尾追加新条目，格式如上。
