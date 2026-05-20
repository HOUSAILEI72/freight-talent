#!/usr/bin/env bash
# git_trace_start.sh — snapshot git status/diff before AI makes changes
# Usage: scripts/ai/git_trace_start.sh <task-name>

set -e

TASK_NAME="${1:-}"
if [[ -z "$TASK_NAME" ]]; then
  echo "ERROR: task-name argument required."
  echo "Usage: scripts/ai/git_trace_start.sh <task-name>"
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TRACE_DIR="$REPO_ROOT/logs/git-trace"
TRACE_CURRENT="$REPO_ROOT/.ai_trace_current"

mkdir -p "$TRACE_DIR"

RUN_ID="$(date +%Y%m%d-%H%M%S)"
BEFORE_STATUS="$TRACE_DIR/${RUN_ID}-${TASK_NAME}-status-before.txt"
BEFORE_DIFF="$TRACE_DIR/${RUN_ID}-${TASK_NAME}-diff-before.patch"
BEFORE_STAT="$TRACE_DIR/${RUN_ID}-${TASK_NAME}-diff-before.stat"

cd "$REPO_ROOT"

# Save before snapshots
git status > "$BEFORE_STATUS" 2>&1 || true
git diff > "$BEFORE_DIFF" 2>&1 || true
git diff --stat > "$BEFORE_STAT" 2>&1 || true

# Save current trace info
cat > "$TRACE_CURRENT" <<EOF
RUN_ID=$RUN_ID
TASK_NAME=$TASK_NAME
BEFORE_STATUS=$BEFORE_STATUS
BEFORE_DIFF=$BEFORE_DIFF
BEFORE_STAT=$BEFORE_STAT
EOF

echo ""
echo "== git trace started =="
echo "RUN_ID:        $RUN_ID"
echo "task:          $TASK_NAME"
echo "before status: $BEFORE_STATUS"
echo "before diff:   $BEFORE_DIFF"
echo "before stat:   $BEFORE_STAT"
echo ""
echo "Trace info saved to: $TRACE_CURRENT"
echo "Now run: source scripts/ai/use_model.sh <provider> && claude"
echo ""
