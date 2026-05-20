#!/usr/bin/env bash
# use_model.sh — select AI model provider for current terminal session
# Usage: source scripts/ai/use_model.sh <official|deepseek|openox|pikachu>

set -e

# ── Guard: must be sourced ─────────────────────────────────────────────
if [[ -n "${BASH_VERSION:-}" ]]; then
  SCRIPT_PATH="${BASH_SOURCE[0]}"
  IS_SOURCED=true
  [[ "$SCRIPT_PATH" == "$0" ]] && IS_SOURCED=false
elif [[ -n "${ZSH_VERSION:-}" ]]; then
  SCRIPT_PATH="${(%):-%x}"
  IS_SOURCED=false
  [[ ":${ZSH_EVAL_CONTEXT:-}:" == *":file:"* ]] && IS_SOURCED=true
else
  SCRIPT_PATH="$0"
  IS_SOURCED=true
fi

if [[ "$IS_SOURCED" != true ]]; then
  echo "ERROR: this script must be sourced, not executed directly."
  echo ""
  echo "  source scripts/ai/use_model.sh deepseek"
  echo ""
  exit 1
fi

# ── Parse provider ─────────────────────────────────────────────────────
PROVIDER="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"

if [[ -z "$PROVIDER" ]]; then
  echo "ERROR: provider argument required."
  echo "Usage: source scripts/ai/use_model.sh <official|deepseek|openox|pikachu>"
  return 1
fi

case "$PROVIDER" in
  official|claude)
    unset ANTHROPIC_BASE_URL
    unset ANTHROPIC_AUTH_TOKEN
    unset ANTHROPIC_MODEL
    unset ANTHROPIC_DEFAULT_OPUS_MODEL
    unset ANTHROPIC_DEFAULT_SONNET_MODEL
    unset ANTHROPIC_DEFAULT_HAIKU_MODEL
    unset CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC

    if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
      AUTH_STATUS="ANTHROPIC_API_KEY configured (redacted)"
    else
      AUTH_STATUS="Claude Code login / subscription"
    fi

    echo ""
    echo "== AI model selected =="
    echo "provider:   official"
    echo "base url:   Anthropic default"
    echo "model:      Claude Code default"
    echo "auth:       $AUTH_STATUS"
    echo ""
    return 0
    ;;
  deepseek) LOCAL_FILE="$SCRIPT_DIR/env.deepseek.local.sh" ;;
  openox)   LOCAL_FILE="$SCRIPT_DIR/env.openox.local.sh" ;;
  pikachu)  LOCAL_FILE="$SCRIPT_DIR/env.pikachu.local.sh" ;;
  *)
    echo "ERROR: unknown provider '$PROVIDER'"
    echo "Valid providers: official, deepseek, openox, pikachu"
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
