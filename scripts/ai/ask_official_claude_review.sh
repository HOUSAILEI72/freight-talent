#!/usr/bin/env bash
# 官方 Claude 高价值审查脚本
# 用法: scripts/ai/ask_official_claude_review.sh tasks/plans/xxx.md logs/ai/xxx-diff.patch [tasks/status/xxx-status.md]
#
# 重要约束：
#   - 官方 Claude 禁止使用任何工具（Read/Grep/Glob/Bash/Edit/Write 等）
#   - 官方 Claude 不写代码，不读全项目
#   - 只能看脚本传入的文本（任务计划 + diff patch + 可选 status）
#   - 禁止 Edit、Write

set -euo pipefail

PLAN_FILE="${1:-}"
DIFF_FILE="${2:-}"
STATUS_FILE="${3:-}"

if [ -z "$PLAN_FILE" ] || [ ! -f "$PLAN_FILE" ]; then
  echo "用法: scripts/ai/ask_official_claude_review.sh tasks/plans/xxx.md logs/ai/xxx-diff.patch [tasks/status/xxx-status.md]"
  exit 1
fi

if [ -z "$DIFF_FILE" ] || [ ! -f "$DIFF_FILE" ]; then
  echo "diff 文件不存在: ${DIFF_FILE:-（未提供）}"
  exit 1
fi

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

source scripts/ai/official_claude_env.sh

RUN_ID="$(date '+%Y%m%d-%H%M%S')"
OUT_FILE="logs/ai/${RUN_ID}-official-claude-review.md"

mkdir -p logs/ai

PLAN_TEXT="$(cat "$PLAN_FILE")"
DIFF_TEXT="$(cat "$DIFF_FILE")"

if [ -n "${STATUS_FILE:-}" ] && [ -f "$STATUS_FILE" ]; then
  STATUS_TEXT="$(cat "$STATUS_FILE")"
else
  STATUS_TEXT="未提供 status 文件。"
fi

PROMPT="$(cat <<EOF
你是官方 Claude 高价值审查器。你不能修改代码，不能扫描项目，不能调用任何工具。你只基于任务计划、diff patch、status/test 信息做审查。

# 任务计划

$PLAN_TEXT

# Status / 测试结果

$STATUS_TEXT

# Git diff patch

$DIFF_TEXT

请输出：

1. **审查结论**：通过 / 不通过 / 需要人工确认
2. **是否满足任务目标**：是/否，说明原因
3. **是否存在超范围修改**：是/否，如有，列出具体文件和修改
4. **是否存在高风险问题**：是/否，重点检查认证、权限、支付、订阅、数据库迁移、消息系统
5. **是否需要返工**：是/否，如需返工给出最小返工建议
6. **是否建议合并/提交**：是/否，并说明条件
EOF
)"

{
  echo "# 官方 Claude 审查结果"
  echo ""
  echo "Plan 文件: $PLAN_FILE"
  echo "Diff 文件: $DIFF_FILE"
  echo "Status 文件: ${STATUS_FILE:-未提供}"
  echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
  echo ""
} > "$OUT_FILE"

claude -p \
  --setting-sources user,project \
  --model "${CLAUDE_REVIEW_MODEL:-claude-sonnet-4-6}" \
  --effort "${CLAUDE_REVIEW_EFFORT:-medium}" \
  --allowedTools "" \
  --disallowedTools "Read,Grep,Glob,Bash,Edit,Write,WebFetch,WebSearch,NotebookEdit" \
  --append-system-prompt "你是官方 Claude 审查器。禁止使用任何工具，禁止读取项目代码，禁止修改文件。只审查传入的 plan、diff patch、status 文本。保持简洁，控制 token 消耗。" \
  "$PROMPT" | tee -a "$OUT_FILE"

echo ""
echo "官方 Claude 审查完成: $OUT_FILE"
