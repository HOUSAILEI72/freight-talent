#!/usr/bin/env bash
set -euo pipefail

TASK_FILE="${1:-}"

if [ -z "$TASK_FILE" ] || [ ! -f "$TASK_FILE" ]; then
  echo "用法: scripts/ai/run_deepseek_task.sh tasks/ai/xxx.md 或 tasks/plans/xxx.md"
  exit 1
fi

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
EXPECTED_PROJECT_ROOT="/Users/edy/Desktop/货代招聘"

if [ "$PROJECT_ROOT" != "$EXPECTED_PROJECT_ROOT" ]; then
  echo "ERROR: refusing to run DeepSeek worker outside expected project root."
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

TASK_NAME="$(basename "$TASK_FILE" .md)"
RUN_ID="$(date '+%Y%m%d-%H%M%S')"
LOG_FILE="logs/ai/${RUN_ID}-${TASK_NAME}-deepseek-result.md"
STATUS_BEFORE="logs/ai/${RUN_ID}-${TASK_NAME}-status-before.txt"
STATUS_AFTER="logs/ai/${RUN_ID}-${TASK_NAME}-status-after.txt"
STATUS_FILE="tasks/status/${TASK_NAME}-status.md"
DIFF_BEFORE_STAT="logs/ai/${RUN_ID}-${TASK_NAME}-diff-before.stat"
DIFF_BEFORE_PATCH="logs/ai/${RUN_ID}-${TASK_NAME}-diff-before.patch"
DIFF_AFTER_STAT="logs/ai/${RUN_ID}-${TASK_NAME}-diff-after.stat"
DIFF_AFTER_PATCH="logs/ai/${RUN_ID}-${TASK_NAME}-diff-after.patch"
DIFF_FILE="logs/ai/${RUN_ID}-${TASK_NAME}-diff.patch"
STREAM_RAW="logs/ai/${RUN_ID}-${TASK_NAME}-stream.raw.jsonl"
AI_FINALIZED=0
TASK_DELTA="unknown"
DELTA_NOTE="尚未完成 before/after diff 增量判断。"
DELTA_LINES=0
FINAL_STATE="running"
FINAL_NOTE="任务仍在运行或尚未完成。"

mkdir -p logs/ai tasks/status

find logs/ai -maxdepth 1 -type p -name '*.fifo' -delete 2>/dev/null || true

now() {
  date '+%Y-%m-%d %H:%M:%S'
}

announce() {
  echo ""
  echo "[$(now)] $*" | tee -a "$LOG_FILE"
}

write_status_file() {
  local final_state="${1:-${FINAL_STATE:-unknown}}"
  local delta_state="${2:-${TASK_DELTA:-unknown}}"
  local delta_lines="${3:-${DELTA_LINES:-0}}"
  local final_note="${4:-${FINAL_NOTE:-状态文件生成时缺少后续建议。}}"
  local completed_at="${5:-$(date '+%Y-%m-%d %H:%M:%S')}"

  {
    echo "# 任务状态：$TASK_NAME"
    echo ""
    echo "- 状态：$final_state"
    echo "- 任务文件：$TASK_FILE"
    echo "- Run ID：$RUN_ID"
    echo "- 完成时间：$completed_at"
    echo "- 执行日志：$LOG_FILE"
    echo "- Raw stream：$STREAM_RAW"
    echo "- Status before：$STATUS_BEFORE"
    echo "- Status after：$STATUS_AFTER"
    echo "- Diff before（执行前基线）：$DIFF_BEFORE_PATCH"
    echo "- Diff after（执行后全量）：$DIFF_AFTER_PATCH"
    echo "- Diff patch（兼容引用）：$DIFF_FILE"
    echo "- Diff stat：$DIFF_AFTER_STAT"
    echo "- 增量判断：${delta_state:-unknown}（增量行数 ${delta_lines:-0}）"
    echo ""
    echo "## 后续建议"
    echo ""
    echo "- ${final_note:-状态文件生成时缺少后续建议。}"
    echo ""
    echo "## 官方 Claude 审查命令"
    echo ""
    echo "\`\`\`bash"
    echo "scripts/ai/ask_official_claude_review.sh $TASK_FILE $DIFF_FILE $STATUS_FILE"
    echo "\`\`\`"
  } > "$STATUS_FILE"
}

compute_delta() {
  if diff -q "$DIFF_BEFORE_PATCH" "$DIFF_AFTER_PATCH" >/dev/null 2>&1; then
    TASK_DELTA="zero"
    DELTA_NOTE="本次任务零增量修改（before diff 与 after diff 完全一致，任务未产生新变更）。"
    DELTA_LINES=0
  else
    TASK_DELTA="changed"
    DELTA_NOTE="本次任务产生增量修改，需要人工查看 diff。"
    DELTA_LINES="$(diff "$DIFF_BEFORE_PATCH" "$DIFF_AFTER_PATCH" 2>/dev/null | grep -c '^[<>]' || true)"
    DELTA_LINES="${DELTA_LINES:-0}"
  fi

  FINAL_STATE="done"
  FINAL_NOTE="$DELTA_NOTE 若涉及高风险模块，调用官方 Claude 审查。"

  if [ "$TASK_DELTA" = "changed" ] && [ "$DELTA_LINES" -gt 500 ]; then
    FINAL_STATE="needs-review"
    FINAL_NOTE="$DELTA_NOTE 增量超过 500 行（$DELTA_LINES 行），必须调用官方 Claude 审查后再决定是否合并。"
  fi
}

finalize_on_exit() {
  local rc=$?
  if [ "${AI_FINALIZED:-0}" = "1" ]; then
    return "$rc"
  fi

  mkdir -p logs/ai tasks/status
  git status --short > "$STATUS_AFTER" 2>/dev/null || true
  git diff --stat > "$DIFF_AFTER_STAT" 2>/dev/null || true
  git diff > "$DIFF_AFTER_PATCH" 2>/dev/null || true
  cp "$DIFF_AFTER_PATCH" "$DIFF_FILE" 2>/dev/null || true
  compute_delta

  if [ "$rc" -ne 0 ]; then
    FINAL_STATE="failed"
    FINAL_NOTE="worker 异常退出（exit code: $rc）。$DELTA_NOTE 需要官方 Claude 查看日志和 diff 后决定是否返工。"
  fi

  write_status_file "$FINAL_STATE" "$TASK_DELTA" "$DELTA_LINES" "$FINAL_NOTE" "$(date '+%Y-%m-%d %H:%M:%S')" 2>/dev/null || true

  {
    echo ""
    echo "## 异常退出收尾"
    echo ""
    echo "worker script exited before normal finalization."
    echo "exit code: $rc"
    echo "after status: $STATUS_AFTER"
    echo "after diff: $DIFF_AFTER_PATCH"
    echo "status: $STATUS_FILE"
    echo "delta: ${TASK_DELTA:-unknown} (${DELTA_LINES:-0} lines)"
  } >> "$LOG_FILE" 2>/dev/null || true

  AI_FINALIZED=1
  return "$rc"
}

trap finalize_on_exit EXIT

echo "== DeepSeek worker transparent run =="
echo "project: $PROJECT_ROOT"
echo "task: $TASK_FILE"
echo "run id: $RUN_ID"
echo "log: $LOG_FILE"
echo "raw stream: $STREAM_RAW"
echo "model: ${ANTHROPIC_MODEL:-deepseek-v4-pro}"
echo "base url: ${ANTHROPIC_BASE_URL:-unset}"
if [ -n "${ANTHROPIC_AUTH_TOKEN:-}" ]; then
  echo "auth token: configured (redacted)"
else
  echo "auth token: missing"
fi
echo ""

git status --short > "$STATUS_BEFORE"
git diff --stat > "$DIFF_BEFORE_STAT"
git diff > "$DIFF_BEFORE_PATCH"

{
  echo "# 任务状态：$TASK_NAME"
  echo ""
  echo "- 状态：running"
  echo "- 任务文件：$TASK_FILE"
  echo "- Run ID：$RUN_ID"
  echo "- 开始时间：$(date '+%Y-%m-%d %H:%M:%S')"
  echo "- 执行日志：$LOG_FILE"
  echo "- Raw stream：$STREAM_RAW"
} > "$STATUS_FILE"

{
  echo "# DeepSeek 执行结果: $TASK_NAME"
  echo ""
  echo "任务文件: $TASK_FILE"
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
  echo "## 任务单预览"
  echo ""
  TASK_PREVIEW_LINES="${AI_TASK_PREVIEW_LINES:-240}"
  sed -n "1,${TASK_PREVIEW_LINES}p" "$TASK_FILE"
  if [ "$(wc -l < "$TASK_FILE")" -gt "$TASK_PREVIEW_LINES" ]; then
    echo ""
    echo "... 任务单超过 ${TASK_PREVIEW_LINES} 行，日志中仅预览前 ${TASK_PREVIEW_LINES} 行。"
  fi
  echo ""
  if [ -s "$STATUS_BEFORE" ]; then
    echo "## 执行前工作区状态"
    echo ""
    echo "注意：执行前工作区已有未提交改动，审查时必须对比 before/after 状态，避免把旧改动误判为 worker 产生。"
    echo ""
    sed 's/^/- /' "$STATUS_BEFORE"
    echo ""
  fi
} > "$LOG_FILE"

announce "已保存执行前 git status: $STATUS_BEFORE"
announce "已保存执行前 git diff: $DIFF_BEFORE_PATCH"
announce "即将启动 DeepSeek Claude Code 子进程。命令参数：claude -p --output-format stream-json --verbose --include-partial-messages --setting-sources user --settings scripts/ai/deepseek_worker_settings.json --model deepseek-v4-pro --permission-mode dontAsk --max-turns ${MAX_TURNS:-80}"
announce "模型事件会实时转成人类可读输出；完整原始 JSONL 会保存到：$STREAM_RAW"

set +e
claude -p \
  --output-format stream-json \
  --verbose \
  --include-partial-messages \
  --setting-sources user \
  --settings scripts/ai/deepseek_worker_settings.json \
  --model deepseek-v4-pro \
  --permission-mode dontAsk \
  --max-turns "${MAX_TURNS:-80}" \
  --append-system-prompt "你是低成本执行 worker。严格按任务单执行；不要做架构决策；不要扩大范围。不要写 tasks/status/** 或 logs/ai/**，这些运行状态文件由外层 run_deepseek_task.sh 自动生成；即使任务单要求写 status 文件，也只在最终回复中报告内容，不要实际写入该文件。遇到任何权限不足、requires approval、permission denied、tool denied、无法读取/编辑/运行的情况，必须立即停止，不要重试，不要换一种命令绕过，不要调用 fewer-permission-prompts，不要读取或编辑 .claude/**，不要修改任何权限配置。请输出 PERMISSION_BLOCKED，并列出：被阻止的命令或文件、为什么需要它、建议交给官方 Claude 主控添加的最小权限。测试失败时只记录失败摘要，不要扩大排查，除非任务单明确要求继续修测试。" \
  "请读取 stdin 中的任务单并执行。" \
  < "$TASK_FILE" \
  2> >(tee -a "$LOG_FILE" >&2) \
  | node scripts/ai/stream_json_to_text.cjs "$STREAM_RAW" "$LOG_FILE" &
PIPELINE_PID=$!
announce "DeepSeek worker pipeline PID: $PIPELINE_PID"
announce "你可以另开终端查看：scripts/ai/worker_status.sh 或 scripts/ai/follow_ai_logs.sh"

HEARTBEAT_SECONDS="${AI_WORKER_HEARTBEAT_SECONDS:-10}"
while kill -0 "$PIPELINE_PID" >/dev/null 2>&1; do
  sleep "$HEARTBEAT_SECONDS"
  if kill -0 "$PIPELINE_PID" >/dev/null 2>&1; then
    announce "DeepSeek worker still running (pipeline pid=$PIPELINE_PID, elapsed=${SECONDS}s)"
  fi
done

wait "$PIPELINE_PID"
PIPELINE_EXIT_CODE=$?
set -e

announce "DeepSeek worker pipeline exited with code $PIPELINE_EXIT_CODE"

git status --short > "$STATUS_AFTER"
git diff --stat > "$DIFF_AFTER_STAT"
git diff > "$DIFF_AFTER_PATCH"
cp "$DIFF_AFTER_PATCH" "$DIFF_FILE"
announce "已保存执行后 git status: $STATUS_AFTER"
announce "已保存执行后 git diff: $DIFF_AFTER_PATCH"

compute_delta
if [ "$PIPELINE_EXIT_CODE" -ne 0 ]; then
  FINAL_STATE="failed"
  FINAL_NOTE="worker 异常退出（exit code: $PIPELINE_EXIT_CODE）。$DELTA_NOTE 需要官方 Claude 查看日志和 diff 后决定是否返工。"
fi

write_status_file "$FINAL_STATE" "$TASK_DELTA" "$DELTA_LINES" "$FINAL_NOTE" "$(date '+%Y-%m-%d %H:%M:%S')"

{
  echo ""
  echo "## 执行后状态对比"
  echo ""
  if cmp -s "$STATUS_BEFORE" "$STATUS_AFTER"; then
    echo "工作区 status 与执行前一致。"
  else
    echo "工作区 status 与执行前不同，请重点审查新增变化。"
  fi
  echo ""
  echo "before status: $STATUS_BEFORE"
  echo "after status: $STATUS_AFTER"
  echo "before diff: $DIFF_BEFORE_PATCH"
  echo "after diff: $DIFF_AFTER_PATCH"
  echo "raw stream: $STREAM_RAW"
  echo "status: $STATUS_FILE"
  echo "worker pipeline exit code: $PIPELINE_EXIT_CODE"
  echo "delta: ${TASK_DELTA:-unknown} (${DELTA_LINES:-0} lines)"
} | tee -a "$LOG_FILE"

echo ""
echo "DeepSeek 执行完成"
echo "  状态: $FINAL_STATE"
echo "  日志: $LOG_FILE"
echo "  增量: ${TASK_DELTA:-unknown}（${DELTA_LINES:-0} 行）"
echo "  Diff before: $DIFF_BEFORE_PATCH"
echo "  Diff after:  $DIFF_AFTER_PATCH"
echo "  Status: $STATUS_FILE"

if [ "${ASK_OFFICIAL_REVIEW:-0}" = "1" ]; then
  echo ""
  echo "ASK_OFFICIAL_REVIEW=1，自动调用官方 Claude 审查..."
  scripts/ai/ask_official_claude_review.sh "$TASK_FILE" "$DIFF_FILE" "$STATUS_FILE"
fi

find logs/ai -maxdepth 1 -type p -name '*.fifo' -delete 2>/dev/null || true

AI_FINALIZED=1
exit "$PIPELINE_EXIT_CODE"
