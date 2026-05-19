# Sentry Privacy-Safe Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the existing partial Sentry integration with `send_default_pii=False`, `max_request_body_size="never"`, `before_send` scrubbing for PII, conditional sourcemaps, and correct Docker build-arg wiring for `VITE_SENTRY_DSN`.

**Architecture:** Both Flask and FastAPI backends gain identical `_SENSITIVE`/`_before_send` guards at module level before `sentry_sdk.init`. The React frontend gains a `beforeSend` callback. Vite sourcemaps are built only when `SENTRY_AUTH_TOKEN` is present, then deleted from `dist/` by the Sentry plugin after upload. `VITE_SENTRY_DSN` flows from `.env` → docker-compose build arg → Dockerfile `ARG`/`ENV` → `npm run build` → baked into JS bundle; it is never present in the final nginx runtime image.

**Tech Stack:** sentry-sdk (Python, already in requirements), @sentry/react + @sentry/vite-plugin (already in package.json), Docker multi-stage build.

---

## Files Modified

| File | Change |
|---|---|
| `backend/app/__init__.py` | Replace Sentry block with full privacy-safe init |
| `backend/fastapi_app/main.py` | Replace Sentry block with full privacy-safe init |
| `src/main.jsx` | Add `beforeSend`, fix `environment`, lower sample rate |
| `vite.config.js` | Conditional sourcemap + `filesToDeleteAfterUpload` |
| `Dockerfile` | Add `ARG VITE_SENTRY_DSN`, `ARG SENTRY_AUTH_TOKEN`, `ARG SENTRY_ORG`, `ARG SENTRY_PROJECT` + matching `ENV` |
| `docker-compose.yml` | Add `build.args` block to `frontend` service |
| `.env.example` | Add 5 Sentry placeholders with bilingual comments |
| `.github/workflows/ci.yml` | Pass empty build args in Docker build step |
| `backend/tests/test_sentry_privacy.py` | New: unit tests for `_before_send` scrubbing logic |

---

## Task 1 — Flask: privacy-safe Sentry init + unit test

**Files:**
- Modify: `backend/app/__init__.py` (lines 8-17, the Sentry block)
- Create: `backend/tests/test_sentry_privacy.py`

- [ ] **Step 1.1: Write the failing test for `_before_send`**

Create `backend/tests/test_sentry_privacy.py`:

```python
"""
Unit tests for the Sentry before_send scrubber in backend/app/__init__.py.
No DB or Flask app needed — pure function test.

Must pop SENTRY_DSN before importing app so the Sentry init block is skipped.
"""
import os
os.environ.pop("SENTRY_DSN", None)  # must happen before `from app import ...`

from app import _before_send  # noqa: E402


def test_strips_authorization_header():
    event = {"request": {"headers": {"Authorization": "Bearer secret", "Content-Type": "application/json"}}}
    result = _before_send(event, {})
    assert result["request"]["headers"]["Authorization"] == "[FILTERED]"
    assert result["request"]["headers"]["Content-Type"] == "application/json"


def test_strips_cookie_header():
    event = {"request": {"headers": {"Cookie": "session=abc123", "Accept": "*/*"}}}
    result = _before_send(event, {})
    assert result["request"]["headers"]["Cookie"] == "[FILTERED]"
    assert result["request"]["headers"]["Accept"] == "*/*"


def test_strips_set_cookie_header():
    event = {"request": {"headers": {"Set-Cookie": "token=xyz; HttpOnly"}}}
    result = _before_send(event, {})
    assert result["request"]["headers"]["Set-Cookie"] == "[FILTERED]"


def test_strips_pii_keys_case_insensitive():
    event = {
        "request": {"headers": {}},
        "extra": {
            "Phone": "13800138000",
            "EMAIL": "user@example.com",
            "resume": "base64content...",
            "other": "safe",
        },
    }
    result = _before_send(event, {})
    assert result["extra"]["Phone"] == "[FILTERED]"
    assert result["extra"]["EMAIL"] == "[FILTERED]"
    assert result["extra"]["resume"] == "[FILTERED]"
    assert result["extra"]["other"] == "safe"


def test_clears_request_data():
    event = {"request": {"headers": {}, "data": {"password": "secret123", "username": "user"}}}
    result = _before_send(event, {})
    assert result["request"]["data"] is None


def test_always_returns_event_not_none():
    event = {"request": {"headers": {"X-Custom": "value"}}, "extra": {}}
    result = _before_send(event, {})
    assert result is not None


def test_handles_missing_request_keys_gracefully():
    event = {}  # no "request", no "extra"
    result = _before_send(event, {})
    assert result is not None


def test_strips_chinese_pii_keys_in_extra():
    event = {
        "request": {"headers": {}},
        "extra": {"手机号": "13800138000", "邮箱": "u@e.com", "身份证": "11010519491231002X"},
    }
    result = _before_send(event, {})
    assert result["extra"]["手机号"] == "[FILTERED]"
    assert result["extra"]["邮箱"] == "[FILTERED]"
    assert result["extra"]["身份证"] == "[FILTERED]"
```

- [ ] **Step 1.2: Run test to confirm it fails (import works, function not yet compliant)**

```bash
cd backend
python -m pytest tests/test_sentry_privacy.py -x -q 2>&1 | tail -20
```

Expected: Tests fail because `_before_send` does not exist yet in `app/__init__.py`.

- [ ] **Step 1.3: Replace the Sentry block in `backend/app/__init__.py`**

Replace lines 8-17 (the current Sentry block):

```python
import os
from flask import Flask, jsonify, send_from_directory
from app.config import get_config
from app.extensions import db, jwt, bcrypt, cors, migrate, limiter, socketio, blocklist_contains
from logging_config import setup_logging
from app.request_logging import init_request_logging

_SENSITIVE = {
    "authorization", "cookie", "set-cookie",
    "password", "token", "access_token", "refresh_token",
    "phone", "email", "resume", "file", "attachment", "id_card",
    "身份证", "手机号", "邮箱",
}


def _strip_sensitive(d):
    if not isinstance(d, dict):
        return d
    return {
        k: "[FILTERED]" if k.lower() in _SENSITIVE else v
        for k, v in d.items()
    }


def _before_send(event, hint):
    req = event.get("request", {})
    if "headers" in req:
        req["headers"] = _strip_sensitive(req["headers"])
    if "data" in req:
        req["data"] = None
    if "extra" in event:
        event["extra"] = _strip_sensitive(event["extra"])
    return event


_sentry_dsn = os.getenv("SENTRY_DSN")
if _sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.flask import FlaskIntegration
    sentry_sdk.init(
        dsn=_sentry_dsn,
        integrations=[FlaskIntegration()],
        send_default_pii=False,
        max_request_body_size="never",
        environment="production",
        traces_sample_rate=0.05,
        before_send=_before_send,
    )
```

The rest of the file (`def create_app(...)` onward) stays unchanged.

- [ ] **Step 1.4: Run tests to confirm they pass**

```bash
cd backend
python -m pytest tests/test_sentry_privacy.py -x -q 2>&1 | tail -10
```

Expected: `8 passed` (or similar count matching the tests above).

- [ ] **Step 1.5: Run full test suite to check for regressions**

```bash
cd backend
python -m pytest tests/ -x -q 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 1.6: Commit**

```bash
git add backend/app/__init__.py backend/tests/test_sentry_privacy.py
git commit -m "feat(sentry): privacy-safe Flask init — before_send, no PII, no body"
```

---

## Task 2 — FastAPI: privacy-safe Sentry init

**Files:**
- Modify: `backend/fastapi_app/main.py` (lines 36-46, the Sentry block)

No new test file needed — the `_before_send` logic is identical; it's covered by Task 1's tests. The integration is verified in Task 7 (docker compose build).

- [ ] **Step 2.1: Replace the Sentry block in `backend/fastapi_app/main.py`**

Replace lines 36-46 (current Sentry block):

```python
import os as _os

_SENSITIVE_FA = {
    "authorization", "cookie", "set-cookie",
    "password", "token", "access_token", "refresh_token",
    "phone", "email", "resume", "file", "attachment", "id_card",
    "身份证", "手机号", "邮箱",
}


def _strip_sensitive_fa(d):
    if not isinstance(d, dict):
        return d
    return {
        k: "[FILTERED]" if k.lower() in _SENSITIVE_FA else v
        for k, v in d.items()
    }


def _before_send_fa(event, hint):
    req = event.get("request", {})
    if "headers" in req:
        req["headers"] = _strip_sensitive_fa(req["headers"])
    if "data" in req:
        req["data"] = None
    if "extra" in event:
        event["extra"] = _strip_sensitive_fa(event["extra"])
    return event


_sentry_dsn = _os.getenv("SENTRY_DSN")
if _sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.starlette import StarletteIntegration
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    sentry_sdk.init(
        dsn=_sentry_dsn,
        integrations=[StarletteIntegration(), FastApiIntegration()],
        send_default_pii=False,
        max_request_body_size="never",
        environment="production",
        traces_sample_rate=0.05,
        before_send=_before_send_fa,
    )
```

(The `_FA` suffix avoids any name collision if both modules ever share a process in future.)

- [ ] **Step 2.2: Verify FastAPI starts without errors (Sentry skipped when DSN absent)**

```bash
cd backend
python -c "from fastapi_app.main import app; print('FastAPI import OK')"
```

Expected: `FastAPI import OK` with no tracebacks.

- [ ] **Step 2.3: Commit**

```bash
git add backend/fastapi_app/main.py
git commit -m "feat(sentry): privacy-safe FastAPI init — before_send, no PII, no body"
```

---

## Task 3 — Frontend React: `beforeSend` + privacy settings

**Files:**
- Modify: `src/main.jsx`

- [ ] **Step 3.1: Replace the Sentry init block in `src/main.jsx`**

Replace the current `if (import.meta.env.VITE_SENTRY_DSN) { ... }` block (lines 17-23):

```js
const _SENTRY_SENSITIVE = new Set([
  'authorization', 'cookie', 'set-cookie',
  'password', 'token', 'access_token', 'refresh_token',
  'phone', 'email', 'resume', 'attachment',
])

function _stripSensitive(obj) {
  if (!obj || typeof obj !== 'object') return obj
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) =>
      _SENTRY_SENSITIVE.has(k.toLowerCase()) ? [k, '[FILTERED]'] : [k, v]
    )
  )
}

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: 'production',
    tracesSampleRate: 0.05,
    beforeSend(event) {
      if (event.request?.headers) {
        event.request.headers = _stripSensitive(event.request.headers)
      }
      if (event.request?.data) {
        event.request.data = null
      }
      return event
    },
  })
}
```

Keep all other lines (imports, providers, `createRoot`) unchanged.

- [ ] **Step 3.2: Verify build compiles without errors**

```bash
npm run build 2>&1 | tail -5
```

Expected: build succeeds, `dist/` created, no TypeScript/ESLint errors.

- [ ] **Step 3.3: Commit**

```bash
git add src/main.jsx
git commit -m "feat(sentry): frontend beforeSend PII filter, environment=production, rate=0.05"
```

---

## Task 4 — Vite: conditional sourcemaps + delete after upload

**Files:**
- Modify: `vite.config.js`

- [ ] **Step 4.1: Update `vite.config.js`**

Replace the entire file content:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'

const hasAuthToken = !!process.env.SENTRY_AUTH_TOKEN

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    hasAuthToken && sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        filesToDeleteAfterUpload: ['./dist/**/*.map'],
      },
    }),
  ].filter(Boolean),
  build: {
    // Only build sourcemaps when they will be uploaded + deleted by Sentry plugin.
    // Without SENTRY_AUTH_TOKEN, .map files would be served publicly by nginx.
    sourcemap: hasAuthToken,
  },
  server: {
    proxy: {
      '/api/v2': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
```

- [ ] **Step 4.2: Verify build without auth token produces no `.map` files**

```bash
npm run build 2>&1 | tail -3
find dist -name "*.map" | wc -l
```

Expected: build succeeds, `find` returns `0`.

- [ ] **Step 4.3: Commit**

```bash
git add vite.config.js
git commit -m "feat(sentry): conditional sourcemaps — only built+uploaded when SENTRY_AUTH_TOKEN set"
```

---

## Task 5 — Dockerfile: wire `VITE_SENTRY_DSN` and auth token into builder stage

**Files:**
- Modify: `Dockerfile`

- [ ] **Step 5.1: Add ARG/ENV declarations to the builder stage**

In `Dockerfile`, after the existing `ARG ALPINE_MIRROR` and `ARG NPM_REGISTRY` lines (lines 4-5), add:

```dockerfile
ARG VITE_SENTRY_DSN
ARG SENTRY_AUTH_TOKEN
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN
ENV SENTRY_ORG=$SENTRY_ORG
ENV SENTRY_PROJECT=$SENTRY_PROJECT
```

These four `ARG`/`ENV` pairs belong **before** `RUN npm run build` and in the `builder` stage only. The `FROM nginx:alpine` stage that follows does **not** inherit these ENV values — they stay in the builder layer.

Final builder stage should look like:

```dockerfile
FROM node:22-alpine AS builder

ARG ALPINE_MIRROR=http://mirrors.aliyun.com/alpine
ARG NPM_REGISTRY=https://registry.npmmirror.com
ARG VITE_SENTRY_DSN
ARG SENTRY_AUTH_TOKEN
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN
ENV SENTRY_ORG=$SENTRY_ORG
ENV SENTRY_PROJECT=$SENTRY_PROJECT

WORKDIR /app
COPY package*.json ./
RUN sed -i "s|https://dl-cdn.alpinelinux.org/alpine|${ALPINE_MIRROR}|g" /etc/apk/repositories \
    && npm config set registry "$NPM_REGISTRY" \
    && npm ci --frozen-lockfile

COPY . .
RUN npm run build
```

The nginx stage (FROM nginx:alpine onward) stays unchanged.

- [ ] **Step 5.2: Verify Dockerfile syntax**

```bash
docker build --no-cache --target builder \
  --build-arg VITE_SENTRY_DSN="" \
  --build-arg SENTRY_AUTH_TOKEN="" \
  -t freight-talent-frontend-builder-test . 2>&1 | tail -5
```

Expected: builder stage completes successfully.

- [ ] **Step 5.3: Commit**

```bash
git add Dockerfile
git commit -m "feat(sentry): add VITE_SENTRY_DSN / SENTRY_AUTH_TOKEN build args to Dockerfile builder stage"
```

---

## Task 6 — docker-compose.yml: pass build args to frontend service

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 6.1: Add `build.args` to the `frontend` service**

In `docker-compose.yml`, replace the `frontend` service's `build` block:

```yaml
  frontend:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        VITE_SENTRY_DSN: ${VITE_SENTRY_DSN:-}
        SENTRY_AUTH_TOKEN: ${SENTRY_AUTH_TOKEN:-}
        SENTRY_ORG: ${SENTRY_ORG:-}
        SENTRY_PROJECT: ${SENTRY_PROJECT:-}
```

(The `restart`, `depends_on`, `ports`, `volumes`, `networks`, `mem_limit`, `cpus`, `healthcheck` keys stay unchanged.)

- [ ] **Step 6.2: Verify compose config is valid**

```bash
docker compose config 2>&1 | grep -A 10 "frontend:"
```

Expected: `frontend` service shows `build.args` with the four Sentry variables.

- [ ] **Step 6.3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(sentry): pass VITE_SENTRY_DSN and sourcemap vars as build args to frontend service"
```

---

## Task 7 — .env.example: add Sentry placeholders

**Files:**
- Modify: `.env.example`

- [ ] **Step 7.1: Append Sentry section to `.env.example`**

Open `.env.example` and append the following block at the end (after all existing entries):

```bash
# ── Sentry 监控（可选）────────────────────────────────────────────────────────
# SENTRY_DSN        后端 Flask / FastAPI 使用。SENTRY_DSN 为空时不启用。
SENTRY_DSN=

# VITE_SENTRY_DSN   前端 React 使用（构建期写入 bundle，不是运行时读取）。为空时不启用。
VITE_SENTRY_DSN=

# 以下三个变量仅用于构建阶段上传 sourcemap 到 Sentry。
# 不上传 sourcemap 可留空；不会进入最终 nginx 运行时镜像。
SENTRY_AUTH_TOKEN=
SENTRY_ORG=
SENTRY_PROJECT=
```

- [ ] **Step 7.2: Verify the file looks correct**

```bash
tail -12 .env.example
```

Expected: shows the 5 Sentry entries with their comments.

- [ ] **Step 7.3: Commit**

```bash
git add .env.example
git commit -m "docs: add Sentry env placeholders to .env.example"
```

---

## Task 8 — CI: pass empty build args in Docker build step

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 8.1: Update the frontend Docker build command**

In `.github/workflows/ci.yml`, under `docker-build` job, replace:

```yaml
      - name: Build frontend image
        run: docker build -t freight-talent-frontend .
```

with:

```yaml
      - name: Build frontend image
        run: |
          docker build \
            --build-arg VITE_SENTRY_DSN="" \
            --build-arg SENTRY_AUTH_TOKEN="" \
            --build-arg SENTRY_ORG="" \
            --build-arg SENTRY_PROJECT="" \
            -t freight-talent-frontend .
```

This ensures CI never fails due to missing build args (they default to empty — Sentry init is skipped in the built bundle, no sourcemaps generated).

- [ ] **Step 8.2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: pass empty Sentry build args to frontend Docker build"
```

---

## Task 9 — End-to-end verification

- [ ] **Step 9.1: Validate compose config**

```bash
docker compose config 2>&1 | grep -E "(SENTRY|VITE_SENTRY)" | sort
```

Expected output (with empty values since `.env` doesn't have real tokens):
```
      SENTRY_AUTH_TOKEN: ''
      SENTRY_DSN: ''
      SENTRY_ORG: ''
      SENTRY_PROJECT: ''
      VITE_SENTRY_DSN: ''
```
Both backend and fastapi services show `SENTRY_DSN: ''`.  
Frontend service shows `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `VITE_SENTRY_DSN` under `build.args`.

- [ ] **Step 9.2: Build all images**

```bash
docker compose build 2>&1 | tail -20
```

Expected: all three images (`backend`, `fastapi`, `frontend`) build successfully. No Sentry errors (DSN is empty so init is skipped).

- [ ] **Step 9.3: Verify SENTRY_AUTH_TOKEN is absent from nginx runtime image**

```bash
# Get the built image name (project dir name + "-frontend")
FRONTEND_IMAGE=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep frontend | grep -v builder | head -1)
echo "Image: $FRONTEND_IMAGE"
docker run --rm "$FRONTEND_IMAGE" printenv 2>&1 | grep -i sentry || echo "PASS: no Sentry vars in runtime image"
```

Expected: `PASS: no Sentry vars in runtime image` (the `printenv` grep finds nothing because ARG/ENV only exist in the builder stage).

- [ ] **Step 9.4: Verify no `.map` files in built frontend image**

```bash
docker run --rm $(docker images --format "{{.Repository}}:{{.Tag}}" | grep frontend | head -1) \
  find /usr/share/nginx/html -name "*.map" | wc -l
```

Expected: `0`

- [ ] **Step 9.5: Run backend tests one final time**

```bash
cd backend && python -m pytest tests/ -x -q 2>&1 | tail -5
```

Expected: all pass.

- [ ] **Step 9.6: Final commit (if any uncommitted changes)**

```bash
git status
# If clean: nothing to do. If not:
git add -p
git commit -m "chore: final cleanup for Sentry privacy integration"
```

---

## Security Verification Summary

| Concern | Mechanism | Status after this plan |
|---|---|---|
| Resume/file content uploaded to Sentry | `max_request_body_size="never"` + `before_send` sets `data=None` | Blocked |
| phone/email in error events | `before_send` strips from headers + extra | Blocked |
| JWT tokens in Authorization header | `before_send` strips `authorization`, `token`, `access_token`, `refresh_token` | Blocked |
| Chinese PII field names (手机号/邮箱/身份证) | In `_SENSITIVE` set, stripped from `extra` | Blocked |
| Source code via `.map` files | `sourcemap: hasAuthToken` — no maps without upload token | Blocked |
| `SENTRY_AUTH_TOKEN` in nginx runtime image | ARG/ENV only in `builder` stage; nginx stage doesn't inherit | Blocked |
| `VITE_SENTRY_DSN` as runtime env var | Baked into JS at build time; not an env var in nginx container | N/A (by design) |
| Session Replay (video/keystroke capture) | Not initialized | Not present |
| Default PII (IP, user-agent, username) | `send_default_pii=False` on both backends | Blocked |
