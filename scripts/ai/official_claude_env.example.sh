#!/usr/bin/env bash

# Copy this file to scripts/ai/official_claude_env.sh, fill the tokens,
# then run: chmod 600 scripts/ai/official_claude_env.sh

export ANTHROPIC_BASE_URL_OPENOX="https://openox.tech/"
export ANTHROPIC_AUTH_TOKEN_OPENOX=""

export ANTHROPIC_BASE_URL_PIKACHU="https://pikachu.claudecode.love"
export ANTHROPIC_AUTH_TOKEN_PIKACHU=""

CLAUDE_GATEWAY_PROVIDER="${CLAUDE_GATEWAY_PROVIDER:-pikachu}"

if [ "$CLAUDE_GATEWAY_PROVIDER" = "openox" ]; then
  export ANTHROPIC_BASE_URL="$ANTHROPIC_BASE_URL_OPENOX"
  export ANTHROPIC_AUTH_TOKEN="$ANTHROPIC_AUTH_TOKEN_OPENOX"
else
  export ANTHROPIC_BASE_URL="$ANTHROPIC_BASE_URL_PIKACHU"
  export ANTHROPIC_AUTH_TOKEN="$ANTHROPIC_AUTH_TOKEN_PIKACHU"
fi

unset ANTHROPIC_API_KEY
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC="1"
