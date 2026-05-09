#!/usr/bin/env bash
# use_model.sh — select AI model provider for current terminal session
# Usage: source scripts/ai/use_model.sh <deepseek|openox|pikachu>

set -e

# ── Guard: must be sourced ─────────────────────────────────────────────
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "ERROR: this script must be sourced, not executed directly."
  echo ""
  echo "  source scripts/ai/use_model.sh deepseek"
  echo ""
  exit 1
fi

# ── Parse provider ─────────────────────────────────────────────────────
PROVIDER="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -z "$PROVIDER" ]]; then
  echo "ERROR: provider argument required."
  echo "Usage: source scripts/ai/use_model.sh <deepseek|openox|pikachu>"
  return 1
fi

case "$PROVIDER" in
  deepseek) LOCAL_FILE="$SCRIPT_DIR/env.deepseek.local.sh" ;;
  openox)   LOCAL_FILE="$SCRIPT_DIR/env.openox.local.sh" ;;
  pikachu)  LOCAL_FILE="$SCRIPT_DIR/env.pikachu.local.sh" ;;
  *)
    echo "ERROR: unknown provider '$PROVIDER'"
    echo "Valid providers: deepseek, openox, pikachu"
    return 1
    ;;
esac

# ── Check local env file exists ────────────────────────────────────────
if [[ ! -f "$LOCAL_FILE" ]]; then
  EXAMPLE_FILE="$SCRIPT_DIR/env.${PROVIDER}.example.sh"
  echo "ERROR: local env file not found:"
  echo "  $LOCAL_FILE"
  echo ""
  if [[ -f "$EXAMPLE_FILE" ]]; then
    echo "Copy the example and fill in your key:"
    echo ""
    echo "  cp $EXAMPLE_FILE $LOCAL_FILE"
    echo ""
  fi
  return 1
fi

# ── Source local env ───────────────────────────────────────────────────
source "$LOCAL_FILE"

# ── Print summary (never print token) ──────────────────────────────────
TOKEN_STATUS="configured (redacted)"
if [[ -z "$ANTHROPIC_AUTH_TOKEN" ]]; then
  TOKEN_STATUS="NOT SET (warning)"
fi

echo ""
echo "== AI model selected =="
echo "provider:   $PROVIDER"
echo "base url:   ${ANTHROPIC_BASE_URL:-NOT SET}"
echo "model:      ${ANTHROPIC_MODEL:-NOT SET}"
echo "auth token: $TOKEN_STATUS"
echo ""
