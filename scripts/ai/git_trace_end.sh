#!/usr/bin/env bash
# git_trace_end.sh — snapshot git status/diff after AI made changes
# Usage: scripts/ai/git_trace_end.sh

set -e

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TRACE_DIR="$REPO_ROOT/logs/git-trace"
TRACE_CURRENT="$REPO_ROOT/.ai_trace_current"

if [[ ! -f "$TRACE_CURRENT" ]]; then
  echo "ERROR: no active trace found ($TRACE_CURRENT not found)."
  echo "Run scripts/ai/git_trace_start.sh <task-name> first."
  exit 1
fi

# Read current trace info
source "$TRACE_CURRENT"

AFTER_STATUS="$TRACE_DIR/${RUN_ID}-${TASK_NAME}-status-after.txt"
AFTER_DIFF="$TRACE_DIR/${RUN_ID}-${TASK_NAME}-diff-after.patch"
AFTER_STAT="$TRACE_DIR/${RUN_ID}-${TASK_NAME}-diff-after.stat"

cd "$REPO_ROOT"

# Save after snapshots
git status > "$AFTER_STATUS" 2>&1 || true
git diff > "$AFTER_DIFF" 2>&1 || true
git diff --stat > "$AFTER_STAT" 2>&1 || true

echo ""
echo "== git trace ended =="
echo "RUN_ID:       $RUN_ID"
echo "task:         $TASK_NAME"
echo "before diff:  $BEFORE_DIFF"
echo "after diff:   $AFTER_DIFF"
echo ""

# Compare before/after
if diff "$BEFORE_DIFF" "$AFTER_DIFF" > /dev/null 2>&1 && \
   diff "$BEFORE_STATUS" "$AFTER_STATUS" > /dev/null 2>&1; then
  echo "result: no change (before and after are identical)"
else
  echo "result: changed (diffs differ)"
  echo ""
  echo "-- after stat --"
  cat "$AFTER_STAT"
fi

# Clean up trace file
rm -f "$TRACE_CURRENT"

echo ""
echo "Review the patch files:"
echo "  diff $BEFORE_DIFF $AFTER_DIFF"
echo ""
