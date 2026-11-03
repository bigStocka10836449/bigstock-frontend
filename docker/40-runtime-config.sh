#!/bin/sh
set -eu
: "${APP_BASE_URL:?required}"
: "${WEB_API_BASE_URL:?required}"
: "${FIREBASE_API_KEY:?required}"
: "${FIREBASE_AUTH_DOMAIN:?required}"
: "${FIREBASE_PROJECT_ID:?required}"
: "${FIREBASE_STORAGE_BUCKET:?required}"
: "${FIREBASE_MESSAGING_SENDER_ID:?required}"
: "${FIREBASE_APP_ID:?required}"
: "${FIREBASE_VAPID_KEY:?required}"
: "${TURNSTILE_SITE_KEY:?required}"

jq -n \
  --arg base "$APP_BASE_URL" \
  --arg web "$WEB_API_BASE_URL" \
  --arg api "$FIREBASE_API_KEY" \
  --arg auth "$FIREBASE_AUTH_DOMAIN" \
  --arg project "$FIREBASE_PROJECT_ID" \
  --arg bucket "$FIREBASE_STORAGE_BUCKET" \
  --arg sender "$FIREBASE_MESSAGING_SENDER_ID" \
  --arg app "$FIREBASE_APP_ID" \
  --arg vapid "$FIREBASE_VAPID_KEY" \
  --arg turnstile "$TURNSTILE_SITE_KEY" \
  '{APP_BASE_URL:$base, WEB_API_BASE_URL:$web, FIREBASE_API_KEY:$api,
    FIREBASE_AUTH_DOMAIN:$auth, FIREBASE_PROJECT_ID:$project,
    FIREBASE_STORAGE_BUCKET:$bucket, FIREBASE_MESSAGING_SENDER_ID:$sender,
    FIREBASE_APP_ID:$app, FIREBASE_VAPID_KEY:$vapid,
    TURNSTILE_SITE_KEY:$turnstile}' \
    > /usr/share/nginx/html/runtime-config.json
# Use JSON serialization to prevent JS string injection from env values.
{ printf 'window.__APP_CONFIG__ = '; cat /usr/share/nginx/html/runtime-config.json; printf ';\n'; } \
  > /usr/share/nginx/html/config.js
