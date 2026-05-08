#!/usr/bin/env bash
set -euo pipefail

TASK_FILE="${1:-}"

if [ -z "$TASK_FILE" ]; then
  echo "用法: scripts/ai/write_task.sh tasks/ai/name.md"
  exit 1
fi

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

case "$TASK_FILE" in
  tasks/ai/*.md)
    ;;
  /Users/edy/Desktop/货代招聘/tasks/ai/*.md)
    TASK_FILE="${TASK_FILE#/Users/edy/Desktop/货代招聘/}"
    ;;
  *)
    echo "ERROR: task file must be under tasks/ai/*.md"
    exit 1
    ;;
esac

mkdir -p tasks/ai
cat > "$TASK_FILE"
echo "Task written: $TASK_FILE"
