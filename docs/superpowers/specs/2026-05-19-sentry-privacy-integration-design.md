# Sentry Privacy-Safe Integration Design

**Date:** 2026-05-19  
**Branch:** release/ace-talent-mvp  
**Status:** Approved → Implementation

---

## Goal

Integrate Sentry as production monitoring across Flask, FastAPI, and React frontend. Must not leak PII (phone, email, resume content, tokens, identity documents) to Sentry's servers.

---

## Files Modified

| File | Change summary |
|---|---|
| `backend/app/__init__.py` | Add `send_default_pii`, `max_request_body_size`, `environment`, `traces_sample_rate=0.05`, `before_send` |
| `backend/fastapi_app/main.py` | Same as Flask |
| `src/main.jsx` | Add `environment="production"`, `tracesSampleRate=0.05`, `beforeSend` filter |
| `vite.config.js` | Conditional `sourcemap` + `filesToDeleteAfterUpload` |
| `Dockerfile` | Add `ARG VITE_SENTRY_DSN`, `ARG SENTRY_AUTH_TOKEN`, expose to build |
| `docker-compose.yml` | Add `build.args` for frontend: `VITE_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` |
| `.env.example` | Add 5 Sentry placeholders with comments |
| `.github/workflows/ci.yml` | Pass `VITE_SENTRY_DSN=""` to Docker build step so build doesn't fail if var absent |

---

## Backend — Flask (`backend/app/__init__.py`)

### Sensitive field list

```
Authorization, Cookie, Set-Cookie,
password, token, access_token, refresh_token,
phone, email, resume, file, attachment, id_card,
身份证, 手机号, 邮箱
```

### `before_send` implementation

```python
_SENSITIVE = {
    "authorization", "cookie", "set-cookie",
    "password", "token", "access_token", "refresh_token",
    "phone", "email", "resume", "file", "attachment", "id_card",
    "身份证", "手机号", "邮箱",
}

def _strip_sensitive(d):
    """Return copy of dict with sensitive keys replaced by [FILTERED]."""
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
        req["data"] = None  # belt-and-suspenders: max_request_body_size=never already blocks this
    if "extra" in event:
        event["extra"] = _strip_sensitive(event["extra"])
    return event
```

### `sentry_sdk.init` call

```python
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

---

## Backend — FastAPI (`backend/fastapi_app/main.py`)

Same `_SENSITIVE`, `_strip_sensitive`, `_before_send` pattern (copy, not import — different process).

```python
sentry_sdk.init(
    dsn=_sentry_dsn,
    integrations=[StarletteIntegration(), FastApiIntegration()],
    send_default_pii=False,
    max_request_body_size="never",
    environment="production",
    traces_sample_rate=0.05,
    before_send=_before_send,
)
```

---

## Frontend — React (`src/main.jsx`)

```js
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: 'production',
    tracesSampleRate: 0.05,
    beforeSend(event) {
      const SENSITIVE = new Set([
        'authorization', 'cookie', 'set-cookie',
        'password', 'token', 'access_token', 'refresh_token',
        'phone', 'email', 'resume', 'attachment',
      ])
      const strip = (obj) => {
        if (!obj || typeof obj !== 'object') return obj
        return Object.fromEntries(
          Object.entries(obj).map(([k, v]) =>
            SENSITIVE.has(k.toLowerCase()) ? [k, '[FILTERED]'] : [k, v]
          )
        )
      }
      if (event.request?.headers) event.request.headers = strip(event.request.headers)
      if (event.request?.data) event.request.data = null
      return event
    },
  })
}
```

No Session Replay initialized.

---

## Vite (`vite.config.js`)

```js
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
    sourcemap: hasAuthToken,  // only build maps when they'll be uploaded + deleted
  },
  server: { /* proxy unchanged */ },
})
```

---

## Dockerfile (frontend)

Add two `ARG` + `ENV` pairs in the builder stage:

```dockerfile
ARG VITE_SENTRY_DSN
ARG SENTRY_AUTH_TOKEN
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN
```

These are only present in the `builder` stage; the `nginx:alpine` runtime stage does NOT inherit them.

---

## docker-compose.yml

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

Backend and FastAPI already have `SENTRY_DSN: ${SENTRY_DSN:-}`.

---

## .env.example additions

```bash
# ── Sentry 监控 ────────────────────────────────────────────────────────────────
# SENTRY_DSN        后端 Flask / FastAPI 使用。留空则不启用。
SENTRY_DSN=

# VITE_SENTRY_DSN   前端 React 使用（构建期写入 bundle，不是运行时读取）。留空则不启用。
VITE_SENTRY_DSN=

# SENTRY_AUTH_TOKEN / ORG / PROJECT 仅在构建前端镜像时上传 sourcemap 时需要。
# 不上传 sourcemap 可留空。不会进入最终 nginx 运行时镜像。
SENTRY_AUTH_TOKEN=
SENTRY_ORG=
SENTRY_PROJECT=
```

---

## CI (`.github/workflows/ci.yml`)

The frontend lint/build job runs `npm run build` without Sentry vars — fine, Sentry plugin is skipped when `SENTRY_AUTH_TOKEN` is absent.

The Docker build step (`docker build -t freight-talent-frontend .`) passes no build args. Vite will see empty `VITE_SENTRY_DSN` and skip Sentry init. No change needed.

---

## Security Verification Checklist

| Concern | Mitigation |
|---|---|
| Resume/file content in Sentry | `max_request_body_size="never"` + `before_send` sets `data=None` |
| Phone/email in error events | `before_send` strips these keys from headers + extra |
| JWT tokens in headers | `before_send` strips `Authorization`, `token`, `access_token`, `refresh_token` |
| Source code exposed via `.map` | `sourcemap` only built when `SENTRY_AUTH_TOKEN` set; `filesToDeleteAfterUpload` removes maps after upload |
| `SENTRY_AUTH_TOKEN` in nginx image | ARG/ENV only in builder stage; nginx stage doesn't inherit |
| `VITE_SENTRY_DSN` in nginx image | Same — baked into JS bundle at build time, not an env var in nginx |
| Session Replay (video/input capture) | Not initialized |
| Default PII collection | `send_default_pii=False` on both backends |
