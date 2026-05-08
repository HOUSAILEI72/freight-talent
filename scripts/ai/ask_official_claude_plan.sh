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

HAS_CODE_SUMMARY="no"
if [ -n "$CONTEXT_FILE" ] && [ -f "$CONTEXT_FILE" ]; then
  CODE_CONTEXT_TEXT="$(cat "$CONTEXT_FILE")"
  HAS_CODE_SUMMARY="yes"
else
  CODE_CONTEXT_TEXT="未提供代码摘要。"
fi

if [ "$HAS_CODE_SUMMARY" = "yes" ]; then
  PLAN_MODE="最终实现计划（基于代码事实）"
  PLAN_INSTRUCTION="你拥有 DeepSeek 通过只读调查生成的 code-summary。这份 code-summary 包含项目的实际代码事实。你必须基于这些代码事实做出架构判断和实现规划。

如果 code-summary 中的信息与 AI_CONTEXT.md / PROJECT_DECISIONS.md 有冲突，以 code-summary 为准（code-summary 是最新的实际代码调查结果）。"

  CODE_SUMMARY_REQUIREMENT="## 2. 代码事实摘要 — 基于 code-summary 总结与本次需求相关的代码事实"
else
  PLAN_MODE="初步实现计划（未经代码事实校验）"
  PLAN_INSTRUCTION="你没有 code-summary。AI_CONTEXT.md 和 PROJECT_DECISIONS.md 可能已过时。因此：
- 你必须明确声明：本计划未经代码事实校验，仅供参考。
- 你必须要求 DeepSeek 在执行前自行阅读相关代码验证每一个假设。
- 如果上下文不足无法给出具体路径，不要编造路径，写明\"需要 DeepSeek 自行查找\"。"

  CODE_SUMMARY_REQUIREMENT="## 2. 代码事实摘要 — 无 code-summary，本节留空，注明\"未经代码事实校验，DeepSeek 执行前必须自行验证\""
fi

PROMPT="$(cat <<PLANEOF
你是官方 Claude 高价值架构顾问。你不能读取项目代码，不能调用任何工具，不能修改文件。你只能基于下面提供的有限文本做架构规划。

# 计划模式

$PLAN_MODE

$PLAN_INSTRUCTION

# 用户需求

$REQ_TEXT

# 项目长期上下文 AI_CONTEXT.md

$AI_CONTEXT_TEXT

# 项目架构决策 PROJECT_DECISIONS.md

$DECISIONS_TEXT

# DeepSeek 提供的代码摘要

$CODE_CONTEXT_TEXT

---

请输出一份给 DeepSeek 执行的开发计划，必须包含以下章节：

## 1. 需求理解
用自己的语言复述理解，明确要做什么、为什么做。

$CODE_SUMMARY_REQUIREMENT

## 3. 风险等级
低 / 中 / 高，并说明原因。如果涉及认证、权限、支付、订阅、数据库迁移、消息系统、候选人匹配，自动升高一级风险等级。

## 4. 允许修改范围
明确列出可以修改的具体文件路径或目录。如果没有 code-summary，写明\"需要 DeepSeek 自行确认\"。

## 5. 禁止修改范围
明确列出绝对不能修改的文件或目录。通常包括：scripts/ai/\*env\*.sh、.env\*、\*.sql、\*.pem、\*.key。

## 6. 实现步骤
分步骤，每步一个小目标。每一步必须可独立验证。

## 7. 验收标准
可量化的验收条件。每个条件必须能用命令行或浏览器操作验证。

## 8. 必须运行的测试命令
具体的测试命令（例如 pytest、npx vite build、test_client.py 等）。

## 9. 停止条件
列出 DeepSeek 在实现过程中遇到什么情况必须立即停止并报告。

## 10. 是否需要官方 Claude review
是 / 否，并说明原因。高风险需求或涉及高风险模块时原则上必须回答"是"。

## 11. 建议的 status 文件名
格式：tasks/status/${REQ_NAME}-status.md

---

重要提醒：
- 不要写代码。
- 不要要求官方 Claude 自己读取项目。
- 如果上下文不足，要求 DeepSeek 先通过两阶段规划（investigation questions + code-summary）获取代码事实，而不是你自己读代码。
- 保持输出简洁，目标 token 控制在合理范围。
- 输出语言以中文为主，代码路径用英文。
PLANEOF
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

if [ "$HAS_CODE_SUMMARY" = "no" ]; then
  echo ""
  echo "WARNING: 本计划未经代码事实校验（未传入 code-summary）。"
  echo "DeepSeek 执行前必须自行阅读相关代码验证每一个假设。"
  echo "建议先运行两阶段规划获取代码事实："
  echo "  1. scripts/ai/ask_official_claude_questions.sh $REQ_FILE"
  echo "  2. scripts/ai/run_deepseek_investigation.sh $REQ_FILE tasks/context/${REQ_NAME}-investigation-questions.md"
  echo "  3. 重新运行本脚本并传入 code-summary"
else
  echo "本计划基于 code-summary（代码事实校验通过）。"
fi
