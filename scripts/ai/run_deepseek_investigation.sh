#!/usr/bin/env bash
# DeepSeek 代码调查脚本（两阶段规划 - 第二阶段）
# 用法: scripts/ai/run_deepseek_investigation.sh tasks/requirements/REQ-xxx.md tasks/context/REQ-xxx-investigation-questions.md
#
# 重要约束：
#   - DeepSeek 只读调查，不修改任何业务代码
#   - DeepSeek 根据官方 Claude 的 investigation questions 去项目代码里调查
#   - 生成 code-summary 供官方 Claude 后续生成最终 plan
#   - 不允许修改 src/** backend/app/** backend/migrations/** .env
#   - 不允许读取密钥文件
#   - 不允许写 logs/ai/** tasks/status/**（日志由 wrapper 写）

set -euo pipefail

REQ_FILE="${1:-}"
QUESTIONS_FILE="${2:-}"

if [ -z "$REQ_FILE" ] || [ ! -f "$REQ_FILE" ]; then
  echo "用法: scripts/ai/run_deepseek_investigation.sh tasks/requirements/REQ-xxx.md tasks/context/REQ-xxx-investigation-questions.md"
  echo ""
  echo "说明："
  echo "  这是两阶段规划的第二阶段（代码调查）。"
  echo "  DeepSeek 根据官方 Claude 的调查问题，去项目代码里做只读调查，生成 code-summary。"
  echo "  不修改任何业务代码。"
  echo ""
  echo "  前置步骤: scripts/ai/ask_official_claude_questions.sh $REQ_FILE"
  echo "  后续步骤: scripts/ai/ask_official_claude_plan.sh $REQ_FILE tasks/context/REQ-xxx-code-summary.md"
  exit 1
fi

if [ -z "$QUESTIONS_FILE" ] || [ ! -f "$QUESTIONS_FILE" ]; then
  echo "investigation questions 文件不存在: ${QUESTIONS_FILE:-（未提供）}"
  echo "请先运行: scripts/ai/ask_official_claude_questions.sh $REQ_FILE"
  exit 1
fi

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
EXPECTED_PROJECT_ROOT="/Users/edy/Desktop/货代招聘"

if [ "$PROJECT_ROOT" != "$EXPECTED_PROJECT_ROOT" ]; then
  echo "ERROR: refusing to run DeepSeek investigation outside expected project root."
  echo "expected: $EXPECTED_PROJECT_ROOT"
  echo "actual:   $PROJECT_ROOT"
  exit 1
fi

cd "$PROJECT_ROOT"

source scripts/ai/deepseek_env.sh

if ! command -v claude >/dev/null 2>&1; then
  echo "ERROR: claude CLI not found in PATH. Please install Claude Code CLI first."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node not found in PATH. stream_json_to_text.cjs requires Node.js."
  exit 1
fi

REQ_NAME="$(basename "$REQ_FILE" .md)"
RUN_ID="$(date '+%Y%m%d-%H%M%S')"
CODE_SUMMARY_FILE="tasks/context/${REQ_NAME}-code-summary.md"
LOG_FILE="logs/ai/${RUN_ID}-${REQ_NAME}-investigation.md"
STREAM_RAW="logs/ai/${RUN_ID}-${REQ_NAME}-investigation-stream.raw.jsonl"

mkdir -p tasks/context logs/ai

now() {
  date '+%Y-%m-%d %H:%M:%S'
}

announce() {
  echo ""
  echo "[$(now)] $*" | tee -a "$LOG_FILE"
}

echo "== DeepSeek 代码调查 =="
echo "project: $PROJECT_ROOT"
echo "需求文件: $REQ_FILE"
echo "调查问题: $QUESTIONS_FILE"
echo "run id: $RUN_ID"
echo "code-summary: $CODE_SUMMARY_FILE"
echo "log: $LOG_FILE"
echo "raw stream: $STREAM_RAW"
echo "model: ${ANTHROPIC_MODEL:-deepseek-v4-pro}"
echo ""

# Save git status before investigation (to detect if agent accidentally modified code)
GIT_STATUS_BEFORE="logs/ai/${RUN_ID}-${REQ_NAME}-investigation-git-status-before.txt"
git status --short > "$GIT_STATUS_BEFORE" 2>/dev/null || true
announce "已保存调查前 git status: $GIT_STATUS_BEFORE"

{
  echo "# DeepSeek 代码调查日志: $REQ_NAME"
  echo ""
  echo "需求文件: $REQ_FILE"
  echo "调查问题: $QUESTIONS_FILE"
  echo "执行时间: $(date '+%Y-%m-%d %H:%M:%S')"
  echo ""
  echo "## 透明运行信息"
  echo ""
  echo "- project: $PROJECT_ROOT"
  echo "- run id: $RUN_ID"
  echo "- model: ${ANTHROPIC_MODEL:-deepseek-v4-pro}"
  echo "- base url: ${ANTHROPIC_BASE_URL:-unset}"
  echo "- raw stream: $STREAM_RAW"
  if [ -n "${ANTHROPIC_AUTH_TOKEN:-}" ]; then
    echo "- auth token: configured (redacted)"
  else
    echo "- auth token: missing"
  fi
  echo ""
  echo "## 调查问题预览"
  echo ""
  sed -n '1,120p' "$QUESTIONS_FILE"
  if [ "$(wc -l < "$QUESTIONS_FILE")" -gt 120 ]; then
    echo ""
    echo "... 调查问题超过 120 行，日志中仅预览前 120 行。"
  fi
  echo ""
} > "$LOG_FILE"

announce "即将启动 DeepSeek 代码调查子进程（只读模式）"
announce "命令参数：claude -p --output-format stream-json --verbose --include-partial-messages --setting-sources user --settings scripts/ai/deepseek_worker_settings.json --model deepseek-v4-pro --permission-mode dontAsk --max-turns ${MAX_TURNS:-60}"

# Build the combined investigation task.  We pipe it via stdin so the prompt
# inside -p is just a short instruction to read stdin.
announce "构建调查任务（需求 + 官方 Claude 问题 + 调查指令）..."

# Start the code-summary file with a header (the agent's response will follow)
{
  echo "# 代码调查摘要：$REQ_NAME"
  echo ""
  echo "需求文件: $REQ_FILE"
  echo "调查问题: $QUESTIONS_FILE"
  echo "Run ID: $RUN_ID"
  echo "调查时间: $(date '+%Y-%m-%d %H:%M:%S')"
  echo ""
} > "$CODE_SUMMARY_FILE"

set +e
{
  echo "# 代码调查任务"
  echo ""
  echo "## 原始需求"
  echo ""
  cat "$REQ_FILE"
  echo ""
  echo "## 官方 Claude 调查问题清单"
  echo ""
  cat "$QUESTIONS_FILE"
  echo ""
  echo "## 调查执行指令"
  echo ""
  cat <<'TASKEOF'
你是 DeepSeek 代码调查员。你的任务是做**只读代码调查**，不是实现功能。

## 你的角色

你只能阅读、搜索、查询代码。你不能修改任何文件。你不能做架构决策。

## 硬性限制

以下行为绝对禁止，违反任何一条必须立即停止并报告 PERMISSION_BLOCKED：
- 不允许修改 src/**
- 不允许修改 backend/app/**
- 不允许修改 backend/migrations/**
- 不允许修改 .env
- 不允许修改 .claude/**
- 不允许修改 scripts/ai/**
- 不允许读取 scripts/ai/deepseek_env.sh
- 不允许读取 scripts/ai/official_claude_env.sh
- 不允许读取 .env / .env.*
- 不允许读取 *.sql
- 不允许读取 *.pem
- 不允许读取 *.key
- 不允许写 tasks/status/**
- 不允许写 logs/ai/**
- 不允许 git add / git commit / git push
- 不允许运行 npm install / pip install
- 不允许修改任何业务代码

## 允许的操作

- Read: 读取项目文件（但不能读取上述禁止文件）
- Grep: 搜索代码
- Glob: 查找文件
- Bash: 只读查询命令（git log, git diff, git status, ls, find, grep, wc, cat, head, tail 等）

## 你的任务

逐个回答官方 Claude 调查问题清单中的每一个问题。对每个问题：
1. 读取相关代码文件
2. 搜索相关符号
3. 给出准确、具体的回答（包含文件路径和行号）

## code-summary 输出格式

你的最终回复必须是完整的 code-summary，包含以下所有章节：

### 1. 实际读取过的文件列表
列出调查过程中实际读取的每一个文件的完整路径。

### 2. 对官方 Claude 每一个调查问题的回答
逐个问题回答。每个回答包含：
- 问题原文
- 调查过程（读了哪些文件）
- 调查结论

### 3. 实际页面路径
列出与需求相关的前端页面组件及其实际路径。

### 4. 实际前端 API 文件
列出与需求相关的前端 API 调用文件及其实际路径。

### 5. 实际后端路由文件
列出与需求相关的后端路由文件及其实际路径。

### 6. 实际 model / 字段 / 表关系
列出相关的数据库 model、关键字段、表之间的关系。

### 7. 是否已有相关接口
明确说明是否已有相关 API 接口，如有列出接口路径和文件位置。

### 8. 是否已有相关字段
明确说明数据库表中是否已有相关字段，如有列出字段名和所属表。

### 9. 是否需要数据库迁移
如果需要新增或修改表结构，说明具体需要什么迁移。如果不需要，明确写"不需要数据库迁移"。

### 10. 是否涉及高风险模块
检查是否涉及以下高风险模块：认证、权限、支付、订阅、消息系统、候选人匹配。
如果涉及，详细说明涉及哪些模块、为什么涉及。

### 11. 建议修改范围
基于调查结果，列出建议修改的具体文件路径。如果发现不需要改任何文件，说明原因。

### 12. 禁止修改范围
列出绝对不能修改的文件或目录，说明原因。

### 13. 执行前必须停止的情况
列出在开始实现之前必须停止并报告的情况。

### 14. 是否建议调用官方 Claude 生成最终 plan
明确回答"是"或"否"，并说明原因。

## 重要提醒

- 你只能调查代码，不能修改代码。
- 如果发现必须先修改代码才能继续调查，立即停止并说明原因。
- 如果遇到任何权限不足、requires approval、permission denied、tool denied 的情况，立即停止，不要重试，不要绕过。输出 PERMISSION_BLOCKED 并列出被阻止的命令或文件。
- 不要在回复中写 status 文件内容。
- 保持输出结构清晰，中文为主，代码路径用英文。
TASKEOF
} | claude -p \
  --output-format stream-json \
  --verbose \
  --include-partial-messages \
  --setting-sources user \
  --settings scripts/ai/deepseek_worker_settings.json \
  --model deepseek-v4-pro \
  --permission-mode dontAsk \
  --max-turns "${MAX_TURNS:-60}" \
  --append-system-prompt "你是 DeepSeek 代码调查员。只读调查，不修改任何代码。不要做架构决策。不要扩大范围。不要写 tasks/status/** 或 logs/ai/**。遇到任何权限不足必须立即停止，不要重试，不要绕过。不要读取密钥文件。" \
  "请读取 stdin 中的代码调查任务并执行。只读调查，不修改任何代码。" \
  2> >(tee -a "$LOG_FILE" >&2) \
  | node scripts/ai/stream_json_to_text.cjs "$STREAM_RAW" "$LOG_FILE" \
  | tee -a "$CODE_SUMMARY_FILE" &
PIPELINE_PID=$!

announce "DeepSeek 调查 pipeline PID: $PIPELINE_PID"
announce "你可以另开终端查看：scripts/ai/worker_status.sh 或 scripts/ai/follow_ai_logs.sh"

HEARTBEAT_SECONDS="${AI_WORKER_HEARTBEAT_SECONDS:-10}"
while kill -0 "$PIPELINE_PID" >/dev/null 2>&1; do
  sleep "$HEARTBEAT_SECONDS"
  if kill -0 "$PIPELINE_PID" >/dev/null 2>&1; then
    announce "DeepSeek 调查仍在运行 (pipeline pid=$PIPELINE_PID, elapsed=${SECONDS}s)"
  fi
done

wait "$PIPELINE_PID"
PIPELINE_EXIT_CODE=$?
set -e

announce "DeepSeek 调查 pipeline 退出，exit code: $PIPELINE_EXIT_CODE"

# Check if any files were accidentally modified during investigation
GIT_STATUS_AFTER="logs/ai/${RUN_ID}-${REQ_NAME}-investigation-git-status-after.txt"
git status --short > "$GIT_STATUS_AFTER" 2>/dev/null || true

if cmp -s "$GIT_STATUS_BEFORE" "$GIT_STATUS_AFTER" 2>/dev/null; then
  announce "调查前后 git status 一致（未修改任何文件）"
else
  announce "WARNING: 调查前后 git status 不一致！DeepSeek 可能意外修改了文件。请检查 diff。"
  git diff --stat > "logs/ai/${RUN_ID}-${REQ_NAME}-investigation-unexpected-diff.stat" 2>/dev/null || true
  git diff > "logs/ai/${RUN_ID}-${REQ_NAME}-investigation-unexpected-diff.patch" 2>/dev/null || true
  echo ""
  echo "WARNING: git status 不一致。请查看："
  echo "  diff stat: logs/ai/${RUN_ID}-${REQ_NAME}-investigation-unexpected-diff.stat"
  echo "  diff patch: logs/ai/${RUN_ID}-${REQ_NAME}-investigation-unexpected-diff.patch"
fi

{
  echo ""
  echo "## 调查完成"
  echo ""
  echo "- pipeline exit code: $PIPELINE_EXIT_CODE"
  echo "- code-summary: $CODE_SUMMARY_FILE"
  echo "- 调查前 git status: $GIT_STATUS_BEFORE"
  echo "- 调查后 git status: $GIT_STATUS_AFTER"
  echo "- raw stream: $STREAM_RAW"
} | tee -a "$LOG_FILE"

echo ""
echo "DeepSeek 代码调查完成"
echo "  code-summary: $CODE_SUMMARY_FILE"
echo "  日志: $LOG_FILE"
echo "  raw stream: $STREAM_RAW"
echo "  pipeline exit code: $PIPELINE_EXIT_CODE"
echo ""

if [ "$PIPELINE_EXIT_CODE" -ne 0 ]; then
  echo "WARNING: 调查 pipeline 异常退出（exit code: $PIPELINE_EXIT_CODE）"
  echo "请检查日志和 code-summary 是否完整。"
fi

echo "下一步: scripts/ai/ask_official_claude_plan.sh $REQ_FILE $CODE_SUMMARY_FILE"
