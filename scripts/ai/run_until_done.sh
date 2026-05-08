#!/usr/bin/env bash
# 多轮自动修复脚本
# 用法: scripts/ai/run_until_done.sh tasks/plans/xxx.md
#
# 环境变量：
#   MAX_ROUNDS=3             最大轮数（默认 3）
#   ASK_OFFICIAL_REVIEW=1   完成后触发官方 Claude 审查（默认不触发）

set -euo pipefail

TASK_FILE="${1:-}"

if [ -z "$TASK_FILE" ] || [ ! -f "$TASK_FILE" ]; then
  echo "用法: scripts/ai/run_until_done.sh tasks/plans/xxx.md"
  exit 1
fi

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

TASK_NAME="$(basename "$TASK_FILE" .md)"
LOOP_STATUS_FILE="tasks/status/${TASK_NAME}-loop-status.md"

mkdir -p tasks/status

MAX_ROUNDS="${MAX_ROUNDS:-3}"
ROUND=1

{
  echo "# 多轮执行状态：$TASK_NAME"
  echo ""
  echo "- 任务文件：$TASK_FILE"
  echo "- 最大轮数：$MAX_ROUNDS"
  echo "- 开始时间：$(date '+%Y-%m-%d %H:%M:%S')"
  echo ""
} > "$LOOP_STATUS_FILE"

echo "开始多轮执行: $TASK_NAME（最大 $MAX_ROUNDS 轮）"

while [ "$ROUND" -le "$MAX_ROUNDS" ]; do
  echo ""
  echo "=== Round $ROUND / $MAX_ROUNDS ==="

  {
    echo "## Round $ROUND"
    echo ""
    echo "- 开始：$(date '+%Y-%m-%d %H:%M:%S')"
  } >> "$LOOP_STATUS_FILE"

  # 执行任务（不自动触发 review，loop 自己决定）
  ASK_OFFICIAL_REVIEW=0 scripts/ai/run_deepseek_task.sh "$TASK_FILE" || true

  STATUS_FILE="tasks/status/${TASK_NAME}-status.md"

  if [ -f "$STATUS_FILE" ]; then
    if grep -q "状态：done" "$STATUS_FILE"; then
      {
        echo "- 结果：done"
        echo "- 完成时间：$(date '+%Y-%m-%d %H:%M:%S')"
      } >> "$LOOP_STATUS_FILE"
      echo ""
      echo "任务已完成（Round $ROUND）。"
      echo "Loop status: $LOOP_STATUS_FILE"

      if [ "${ASK_OFFICIAL_REVIEW:-0}" = "1" ]; then
        # 优先找最新的 *-TASK_NAME-diff.patch，没有再找 *-TASK_NAME-diff-after.patch
        LATEST_DIFF=$(find logs/ai -maxdepth 1 -type f -name "*-${TASK_NAME}-diff.patch" -print0 2>/dev/null | xargs -0 ls -t 2>/dev/null | head -1)
        if [ -z "$LATEST_DIFF" ]; then
          LATEST_DIFF=$(find logs/ai -maxdepth 1 -type f -name "*-${TASK_NAME}-diff-after.patch" -print0 2>/dev/null | xargs -0 ls -t 2>/dev/null | head -1)
        fi

        if [ -n "$LATEST_DIFF" ] && [ -f "$LATEST_DIFF" ]; then
          echo "ASK_OFFICIAL_REVIEW=1，调用官方 Claude 审查..."
          echo "  diff: $LATEST_DIFF"
          scripts/ai/ask_official_claude_review.sh "$TASK_FILE" "$LATEST_DIFF" "$STATUS_FILE"
        else
          echo "ASK_OFFICIAL_REVIEW=1，但未找到 diff 文件（搜索模式: *-${TASK_NAME}-diff.patch / *-${TASK_NAME}-diff-after.patch），跳过审查。"
        fi
      fi
      exit 0
    fi

    if grep -q "状态：needs-review" "$STATUS_FILE"; then
      {
        echo "- 结果：needs-review，停止自动循环"
        echo "- 停止时间：$(date '+%Y-%m-%d %H:%M:%S')"
      } >> "$LOOP_STATUS_FILE"
      echo ""
      echo "任务 diff 超过 500 行，需要审查，停止自动循环。"
      # 尝试找到 diff 文件路径以便提示
      HINT_DIFF=$(find logs/ai -maxdepth 1 -type f -name "*-${TASK_NAME}-diff.patch" -print0 2>/dev/null | xargs -0 ls -t 2>/dev/null | head -1)
      if [ -z "$HINT_DIFF" ]; then
        HINT_DIFF=$(find logs/ai -maxdepth 1 -type f -name "*-${TASK_NAME}-diff-after.patch" -print0 2>/dev/null | xargs -0 ls -t 2>/dev/null | head -1)
      fi
      if [ -n "$HINT_DIFF" ]; then
        echo "请调用: scripts/ai/ask_official_claude_review.sh $TASK_FILE $HINT_DIFF $STATUS_FILE"
      else
        echo "未找到 diff 文件（搜索模式: *-${TASK_NAME}-diff.patch / *-${TASK_NAME}-diff-after.patch），请确认 diff 文件路径后手动调用 ask_official_claude_review.sh。"
      fi
      exit 2
    fi
  fi

  {
    echo "- 结果：未完成，准备下一轮"
    echo ""
  } >> "$LOOP_STATUS_FILE"

  ROUND=$((ROUND + 1))
done

{
  echo ""
  echo "## 最终结果"
  echo ""
  echo "- 状态：failed"
  echo "- 原因：连续 $MAX_ROUNDS 轮未完成"
  echo "- 结束时间：$(date '+%Y-%m-%d %H:%M:%S')"
} >> "$LOOP_STATUS_FILE"

echo ""
echo "连续 $MAX_ROUNDS 轮未完成，已停止。"
echo "Loop status: $LOOP_STATUS_FILE"
exit 1
