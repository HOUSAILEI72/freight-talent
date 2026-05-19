# ── 前端生产镜像（Nginx + React SPA）──────────────────────────────────────────
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

# ── 静态服务 ──────────────────────────────────────────────────────────────────
FROM nginx:alpine

# SPA 路由：所有未知路径回退到 index.html
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
