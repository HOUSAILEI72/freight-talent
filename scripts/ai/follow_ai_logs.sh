#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

LOG_FILE="${1:-}"

if [ -z "$LOG_FILE" ]; then
  if [ -d logs/ai ] && find logs/ai -type f -name '*-deepseek-result.md' -print -quit | grep -q .; then
    LOG_FILE="$(find logs/ai -type f -name '*-deepseek-result.md' -print0 | xargs -0 ls -t | head -1)"
  else
    echo "No DeepSeek result logs found yet."
    exit 1
  fi
fi

if [ ! -f "$LOG_FILE" ]; then
  echo "Log file does not exist: $LOG_FILE"
  exit 1
fi

echo "Following AI log: $LOG_FILE"
echo "Press Ctrl-C to stop following."
echo ""
tail -n "${AI_LOG_TAIL_LINES:-80}" -f "$LOG_FILE"
