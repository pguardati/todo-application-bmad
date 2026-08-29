FROM node:24-bookworm-slim AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
RUN npm run build


FROM nginxinc/nginx-unprivileged:1.30-alpine AS runtime

USER root
RUN apk add --no-cache curl
USER nginx

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=10 \
    CMD curl -fsS http://localhost:8080/ || exit 1
