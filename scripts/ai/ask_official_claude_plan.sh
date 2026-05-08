#!/usr/bin/env bash
# 官方 Claude 低 token 规划脚本
# 用法: scripts/ai/ask_official_claude_plan.sh tasks/requirements/xxx.md [tasks/context/xxx-code-summary.md]
#
# 重要约束：
#   - 官方 Claude 禁止使用任何工具（Read/Grep/Glob/Bash/Edit/Write 等）
#   - 官方 Claude 只能看脚本传入的文本（需求 + AI_CONTEXT.md + PROJECT_DECISIONS.md + 可选代码摘要）
#   - 如需代码上下文，先由 DeepSeek 生成 tasks/context/xxx-code-summary.md，再作为第 2 个参数传入
#   - 目标 token 控制在 3k-8k

set -euo pipefail

REQ_FILE="${1:-}"
CONTEXT_FILE="${2:-}"

if [ -z "$REQ_FILE" ] || [ ! -f "$REQ_FILE" ]; then
  echo "用法: scripts/ai/ask_official_claude_plan.sh tasks/requirements/xxx.md [tasks/context/xxx-code-summary.md]"
  exit 1
fi

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

source scripts/ai/official_claude_env.sh

REQ_NAME="$(basename "$REQ_FILE" .md)"
RUN_ID="$(date '+%Y%m%d-%H%M%S')"
PLAN_FILE="tasks/plans/${REQ_NAME}-plan.md"
LOG_FILE="logs/ai/${RUN_ID}-${REQ_NAME}-official-plan.md"

mkdir -p tasks/plans logs/ai

AI_CONTEXT_TEXT="$(cat AI_CONTEXT.md 2>/dev/null || echo 'AI_CONTEXT.md 不存在，请在计划中要求 DeepSeek 补齐。')"
DECISIONS_TEXT="$(cat PROJECT_DECISIONS.md 2>/dev/null || echo 'PROJECT_DECISIONS.md 不存在。')"
REQ_TEXT="$(cat "$REQ_FILE")"

if [ -n "$CONTEXT_FILE" ] && [ -f "$CONTEXT_FILE" ]; then
  CODE_CONTEXT_TEXT="$(cat "$CONTEXT_FILE")"
else
  CODE_CONTEXT_TEXT="未提供代码摘要。官方 Claude 不允许自行读取代码；如需要代码上下文，请要求 DeepSeek 先生成 tasks/context/${REQ_NAME}-code-summary.md，然后再次调用本脚本并传入该文件。"
fi

PROMPT="$(cat <<EOF
你是官方 Claude 高价值架构顾问。你不能读取项目代码，不能调用任何工具，不能修改文件。你只能基于下面提供的有限文本做架构规划。

# 用户需求

$REQ_TEXT

# 项目长期上下文 AI_CONTEXT.md

$AI_CONTEXT_TEXT

# 项目架构决策 PROJECT_DECISIONS.md

$DECISIONS_TEXT

# DeepSeek 提供的代码摘要（可选）

$CODE_CONTEXT_TEXT

请输出一份给 DeepSeek 执行的开发计划，必须包含：

1. **需求理解** — 用自己的语言复述理解
2. **风险等级** — 低 / 中 / 高，并说明原因
3. **可能涉及模块** — 列出文件路径（如能从上下文推断）
4. **DeepSeek 需要自行调查的文件范围** — DeepSeek 执行前应读哪些文件
5. **允许修改范围** — 明确哪些文件可以改
6. **禁止修改范围** — 明确哪些文件不能碰
7. **实现步骤** — 分步骤，每步一个小目标
8. **验收标准** — 可量化的验收条件
9. **必须运行的测试或构建命令** — 具体命令
10. **停止条件** — 遇到什么情况 DeepSeek 必须停止
11. **是否需要官方 Claude 最终审查** — 是 / 否，并说明原因
12. **建议的 status 文件名称** — 格式：tasks/status/${REQ_NAME}-status.md

注意：
- 不要写代码。
- 不要要求官方 Claude 自己读取项目。
- 如果上下文不足，要求 DeepSeek 先调查并生成 tasks/context/${REQ_NAME}-code-summary.md，而不是你自己读代码。
- 保持输出简洁，目标 token 控制在合理范围。
EOF
)"

{
  echo "# 官方 Claude 规划结果"
  echo ""
  echo "需求文件: $REQ_FILE"
  echo "代码摘要: ${CONTEXT_FILE:-未提供}"
  echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
  echo ""
} > "$LOG_FILE"

claude -p \
  --setting-sources user,project \
  --model "${CLAUDE_PLAN_MODEL:-claude-sonnet-4-6}" \
  --effort "${CLAUDE_PLAN_EFFORT:-medium}" \
  --allowedTools "" \
  --disallowedTools "Read,Grep,Glob,Bash,Edit,Write,WebFetch,WebSearch,NotebookEdit" \
  --append-system-prompt "你是官方 Claude 架构顾问。禁止使用任何工具，禁止读取项目代码，禁止修改文件。只基于用户传入的文本做规划。保持简洁，控制 token 消耗。" \
  "$PROMPT" | tee -a "$LOG_FILE" | tee "$PLAN_FILE"

echo ""
echo "官方 Claude plan 已生成: $PLAN_FILE"
echo "日志: $LOG_FILE"
