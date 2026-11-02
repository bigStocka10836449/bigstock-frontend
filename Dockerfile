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

# Vue Build
COPY --from=builder /app/dist/ /usr/share/nginx/html/

# Nginx Template
COPY nginx/default.conf.template \
     /etc/nginx/templates/default.conf.template

# Runtime Config
COPY docker/40-runtime-config.sh \
     /docker-entrypoint.d/40-runtime-config.sh

RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh

EXPOSE 80