#!/usr/bin/env bash
# git_trace_latest.sh — show recent git trace records
# Usage: scripts/ai/git_trace_latest.sh

set -e

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TRACE_DIR="$REPO_ROOT/logs/git-trace"

if [[ ! -d "$TRACE_DIR" ]]; then
  echo "No trace records found (logs/git-trace/ does not exist)."
  exit 0
fi

echo "== recent git trace records =="
echo ""

# Show last 10 stat files
STAT_FILES=$(ls -t "$TRACE_DIR"/*-diff-after.stat 2>/dev/null || true)

if [[ -z "$STAT_FILES" ]]; then
  echo "No after-diff stat files found."
  echo ""
  echo "Patch files in logs/git-trace/:"
  ls -la "$TRACE_DIR/" 2>/dev/null | head -20
  exit 0
fi

echo "Recent 10 trace runs:"
echo "$STAT_FILES" | head -10 | while read f; do
  basename "$f"
done

echo ""

# Show latest after stat
LATEST_STAT=$(echo "$STAT_FILES" | head -1)
if [[ -n "$LATEST_STAT" && -f "$LATEST_STAT" ]]; then
  echo "-- latest: $(basename "$LATEST_STAT") --"
  cat "$LATEST_STAT"
  echo ""
fi

echo ""
echo "To view a patch file:"
echo "  cat $TRACE_DIR/<run-id>-<task>-diff-before.patch"
echo "  cat $TRACE_DIR/<run-id>-<task>-diff-after.patch"
echo ""
echo "To compare before/after:"
echo "  diff $TRACE_DIR/<run-id>-<task>-diff-before.patch $TRACE_DIR/<run-id>-<task>-diff-after.patch"
echo ""
