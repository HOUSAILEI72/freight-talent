#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "== DeepSeek Worker Processes =="
PROCESS_PATTERN="run_deepseek_task.sh|deepseek-v4-pro"
if ps -axo pid,ppid,etime,command 2>/dev/null | grep -E "$PROCESS_PATTERN" | grep -v grep >/dev/null 2>&1; then
  ps -axo pid,ppid,etime,command 2>/dev/null | grep -E "$PROCESS_PATTERN" | grep -v grep
else
  echo "当前无 active worker，这是直接执行型工作流下的正常状态"
fi

echo ""
echo "== Recent DeepSeek Results (logs/ai/*-deepseek-result.md) =="
if [ -d logs/ai ] && find logs/ai -maxdepth 1 -type f -name '*-deepseek-result.md' -print -quit 2>/dev/null | grep -q .; then
  find logs/ai -maxdepth 1 -type f -name '*-deepseek-result.md' -print0 \
    | xargs -0 ls -t 2>/dev/null \
    | head -5 \
    | while IFS= read -r f; do
        echo "  $(basename "$f")"
      done
else
  echo "  (none)"
fi

echo ""
echo "== Recent Status After (logs/ai/*-status-after.txt) =="
if [ -d logs/ai ] && find logs/ai -maxdepth 1 -type f -name '*-status-after.txt' -print -quit 2>/dev/null | grep -q .; then
  find logs/ai -maxdepth 1 -type f -name '*-status-after.txt' -print0 \
    | xargs -0 ls -t 2>/dev/null \
    | head -5 \
    | while IFS= read -r f; do
        echo "  $(basename "$f")"
      done
else
  echo "  (none)"
fi

echo ""
echo "== Recent Task Status (tasks/status/*-status.md) =="
if [ -d tasks/status ] && find tasks/status -maxdepth 1 -type f -name '*-status.md' -print -quit 2>/dev/null | grep -q .; then
  find tasks/status -maxdepth 1 -type f -name '*-status.md' -print0 \
    | xargs -0 ls -t 2>/dev/null \
    | head -5 \
    | while IFS= read -r f; do
        echo "  $(basename "$f")"
      done
else
  echo "  (none)"
fi
