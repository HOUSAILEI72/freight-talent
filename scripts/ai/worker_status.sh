#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "== DeepSeek daemon =="
if scripts/ai/worker_daemon.sh status >/dev/null 2>&1; then
  scripts/ai/worker_daemon.sh status
else
  echo "DeepSeek daemon not running."
  echo "Start daemon: scripts/ai/worker_daemon.sh start"
fi

echo ""
echo "== AI task queues =="
for dir in tasks/ai/queue tasks/ai/running tasks/ai/done tasks/ai/failed; do
  mkdir -p "$dir"
  count="$(find "$dir" -maxdepth 1 -type f -name '*.md' | wc -l | tr -d ' ')"
  echo "$dir: $count"
  find "$dir" -maxdepth 1 -type f -name '*.md' -print | sort | tail -5 | sed 's/^/  - /'
done

echo ""
echo "== DeepSeek worker processes =="
PROCESS_PATTERN="run_deepseek_task.sh|claude.*deepseek-v4-pro|stream_json_to_text.cjs logs/ai/"
if ps -axo pid,ppid,etime,command | grep -E "$PROCESS_PATTERN" | grep -v grep >/dev/null 2>&1; then
  ps -axo pid,ppid,etime,command | grep -E "$PROCESS_PATTERN" | grep -v grep
else
  echo "No DeepSeek worker is currently running."
fi

echo ""
echo "== Latest AI run files =="
if [ -d logs/ai ] && find logs/ai -type f -name '*-deepseek-result.md' -print -quit | grep -q .; then
  find logs/ai -type f -name '*-deepseek-result.md' -print0 \
    | xargs -0 ls -t \
    | head -5
  LATEST_LOG="$(find logs/ai -type f -name '*-deepseek-result.md' -print0 | xargs -0 ls -t | head -1)"
  LATEST_PREFIX="${LATEST_LOG%-deepseek-result.md}"
  echo ""
  echo "Follow latest log:"
  echo "scripts/ai/follow_ai_logs.sh \"$LATEST_LOG\""
  echo ""
  echo "Latest run related files:"
  find logs/ai -maxdepth 1 -type f -name "$(basename "$LATEST_PREFIX")*" -print | sort
else
  echo "No DeepSeek result logs found yet."
fi

echo ""
echo "== Latest AI status files =="
if [ -d logs/ai ] && find logs/ai -type f -name '*-status-after.txt' -print -quit | grep -q .; then
  find logs/ai -type f -name '*-status-after.txt' -print0 \
    | xargs -0 ls -t \
    | head -5
else
  echo "No status-after files found yet."
fi
