#!/usr/bin/env bash
# 官方 Claude 调查问题生成脚本（两阶段规划 - 第一阶段）
# 用法: scripts/ai/ask_official_claude_questions.sh tasks/requirements/REQ-xxx.md
#
# 重要约束：
#   - 官方 Claude 禁止使用任何工具（Read/Grep/Glob/Bash/Edit/Write 等）
#   - 官方 Claude 只能看脚本传入的文本（需求 + AI_CONTEXT.md + PROJECT_DECISIONS.md）
#   - 官方 Claude 不能读取项目代码
#   - 官方 Claude 只生成"调查问题清单"，不生成最终实现计划
#   - 官方 Claude 不能输出最终实现方案
#   - 输出到 tasks/context/ 和 logs/ai/

set -euo pipefail

REQ_FILE="${1:-}"

if [ -z "$REQ_FILE" ] || [ ! -f "$REQ_FILE" ]; then
  echo "用法: scripts/ai/ask_official_claude_questions.sh tasks/requirements/REQ-xxx.md"
  echo ""
  echo "说明："
  echo "  这是两阶段规划的第一阶段。"
  echo "  官方 Claude 只生成调查问题清单，不生成最终实现计划。"
  echo "  后续流程："
  echo "    1. DeepSeek 根据问题调查代码 → tasks/context/REQ-xxx-code-summary.md"
  echo "    2. 官方 Claude 基于 code-summary 生成最终 plan → tasks/plans/REQ-xxx-plan.md"
  exit 1
fi

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

source scripts/ai/official_claude_env.sh

REQ_NAME="$(basename "$REQ_FILE" .md)"
RUN_ID="$(date '+%Y%m%d-%H%M%S')"
QUESTIONS_FILE="tasks/context/${REQ_NAME}-investigation-questions.md"
LOG_FILE="logs/ai/${RUN_ID}-${REQ_NAME}-official-questions.md"

mkdir -p tasks/context logs/ai

# 安全读取所有输入文件内容（不经过 shell 解释）
REQ_TEXT="$(cat "$REQ_FILE")"
AI_CONTEXT_TEXT="$(cat AI_CONTEXT.md 2>/dev/null || echo 'AI_CONTEXT.md 不存在。')"
DECISIONS_TEXT="$(cat PROJECT_DECISIONS.md 2>/dev/null || echo 'PROJECT_DECISIONS.md 不存在。')"

# 用 temp 文件安全构造 prompt，避免 Bash 解释 prompt 文本中的任何内容
# 关键：所有静态 prompt 文本用 cat <<'PROMPTEOF'（单引号定界符，禁止变量展开）
#       变量内容用 printf '%s\n' 安全写入，不做 shell 解释
PROMPT_FILE="$(mktemp)"
trap 'rm -f "$PROMPT_FILE"' EXIT

# Section 1: 静态 prompt 头部（禁止变量展开）
cat > "$PROMPT_FILE" <<'PROMPTEOF'
你是官方 Claude 高价值架构顾问。你不能读取项目代码，不能调用任何工具，不能修改文件。
你只能基于下面提供的有限文本，生成一份"代码调查问题清单"给 DeepSeek 去执行。

你的角色在这一阶段是"提问者"，不是"规划者"。
你只提出问题、列出调查范围、定义停止条件。
你不能输出最终实现方案或实现步骤。

# 用户需求

PROMPTEOF

# Section 2: 需求文件内容（安全追加）
printf '\n%s\n' "$REQ_TEXT" >> "$PROMPT_FILE"

# Section 3: 静态中间段 + AI_CONTEXT
cat >> "$PROMPT_FILE" <<'PROMPTEOF'

# 项目长期上下文 AI_CONTEXT.md

PROMPTEOF
printf '%s\n' "$AI_CONTEXT_TEXT" >> "$PROMPT_FILE"

# Section 4: 静态中间段 + DECISIONS
cat >> "$PROMPT_FILE" <<'PROMPTEOF'

# 项目架构决策 PROJECT_DECISIONS.md

PROMPTEOF
printf '%s\n' "$DECISIONS_TEXT" >> "$PROMPT_FILE"

# Section 5: 输出要求（全部静态，单引号定界符安全）
cat >> "$PROMPT_FILE" <<'PROMPTEOF'

请输出一份给 DeepSeek 执行的代码调查问题清单，必须包含以下章节：

## 1. 需求理解

用自己的语言复述对需求的理解，明确要做什么、为什么做。

## 2. 需要 DeepSeek 查清楚的问题

列出具体、可执行的问题。每个问题必须：
- 能通过阅读代码、grep、glob 等方式回答
- 有明确的调查目标（例如：确认 xx 组件是否已存在、列出所有调用 yy API 的前端文件）
- 问题之间不要重叠

## 3. 建议 DeepSeek 调查的文件或目录

给出具体的文件路径或 glob 模式（例如：src/pages/employer/*.jsx、backend/app/routes/*.py）。
不要写"相关文件"，要写具体路径或至少具体的目录范围。

## 4. 禁止调查范围

明确哪些文件或目录不能调查（例如：scripts/ai/*env*.sh、.env、*.sql、*.pem、*.key）。

## 5. 禁止修改范围

明确哪些代码绝对不能修改（通常包括：src/**、backend/app/**、backend/migrations/** 等）。

## 6. 必须停止的情况

列出 DeepSeek 在执行调查过程中遇到什么情况必须立即停止并报告。

## 7. code-summary 必须包含的字段

定义 DeepSeek 生成的 code-summary 必须包含哪些信息。至少包括：
- 实际读取过的文件列表
- 对每一个调查问题的回答
- 实际页面路径
- 实际前端 API 文件
- 实际后端路由文件
- 实际 model / 字段 / 表关系
- 是否已有相关接口
- 是否已有相关字段
- 是否需要数据库迁移
- 是否涉及认证、权限、支付、订阅、消息系统、候选人匹配等高风险模块
- 建议修改范围
- 禁止修改范围
- 执行前必须停止的情况
- 是否建议调用官方 Claude 生成最终 plan

## 8. 是否需要后续官方 Claude 基于 code-summary 生成最终 plan

明确回答"是"或"否"，并说明原因。如果是高风险需求或复杂需求，应该回答"是"。

---

重要提醒：
- 你不能输出最终实现方案或实现步骤。
- 你只能提问题、列调查范围、定义停止条件。
- 你不能要求自己读取项目代码。
- 你不能调用工具。
- 保持输出简洁，目标 token 控制在合理范围。
- 输出语言以中文为主，代码路径用英文。
PROMPTEOF

# 将 prompt 文件内容安全读入变量（cat 不会解释内容）
PROMPT="$(cat "$PROMPT_FILE")"
rm -f "$PROMPT_FILE"
trap - EXIT

# 写入日志头部
{
  echo "# 官方 Claude 调查问题清单"
  echo ""
  echo "需求文件: $REQ_FILE"
  echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
  echo ""
} > "$LOG_FILE"

# 调用官方 Claude（无工具权限）
claude -p \
  --setting-sources user,project \
  --model "${CLAUDE_PLAN_MODEL:-claude-sonnet-4-6}" \
  --effort "${CLAUDE_PLAN_EFFORT:-medium}" \
  --allowedTools "" \
  --disallowedTools "Read,Grep,Glob,Bash,Edit,Write,WebFetch,WebSearch,NotebookEdit" \
  --append-system-prompt "你是官方 Claude 架构顾问。禁止使用任何工具，禁止读取项目代码，禁止修改文件。你只能基于用户传入的文本生成调查问题清单。你不能输出最终实现方案。保持简洁，控制 token 消耗。" \
  "$PROMPT" | tee -a "$LOG_FILE" | tee "$QUESTIONS_FILE"

echo ""
echo "官方 Claude 调查问题清单已生成: $QUESTIONS_FILE"
echo "日志: $LOG_FILE"
echo ""
echo "下一步: scripts/ai/run_deepseek_investigation.sh $REQ_FILE $QUESTIONS_FILE"
