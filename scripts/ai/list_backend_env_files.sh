#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "backend .env files (names only, content is not read):"

found=0
for file in backend/.env backend/.env.*; do
  if [ -e "$file" ]; then
    found=1
    ls -ld "$file"
  fi
done

if [ "$found" -eq 0 ]; then
  echo "No backend .env files found."
fi
