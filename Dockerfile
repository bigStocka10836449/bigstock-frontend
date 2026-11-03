# ==========================================
# Stage 1: Vue Build
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ==========================================
# Stage 2: Nginx
# ==========================================
FROM nginx:alpine

RUN apk add --no-cache jq

COPY --from=builder /app/dist/ /usr/share/nginx/html/

# Nginx 靜態資源設定
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Runtime Config
COPY docker/40-runtime-config.sh \
     /docker-entrypoint.d/40-runtime-config.sh

RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh

EXPOSE 80