#!/bin/sh
set -eu

OUTPUT_DIR="/usr/share/nginx/html"

# ==========================================
# Validate required environment variables
# ==========================================

: "${FIREBASE_API_KEY:?FIREBASE_API_KEY required}"
: "${FIREBASE_AUTH_DOMAIN:?FIREBASE_AUTH_DOMAIN required}"
: "${FIREBASE_PROJECT_ID:?FIREBASE_PROJECT_ID required}"
: "${FIREBASE_STORAGE_BUCKET:?FIREBASE_STORAGE_BUCKET required}"
: "${FIREBASE_MESSAGING_SENDER_ID:?FIREBASE_MESSAGING_SENDER_ID required}"
: "${FIREBASE_APP_ID:?FIREBASE_APP_ID required}"
: "${FIREBASE_VAPID_KEY:?FIREBASE_VAPID_KEY required}"

: "${TURNSTILE_SITE_KEY:?TURNSTILE_SITE_KEY required}"

# ==========================================
# Generate Runtime Config JSON
# ==========================================

jq -n \
  --arg apiKey "$FIREBASE_API_KEY" \
  --arg authDomain "$FIREBASE_AUTH_DOMAIN" \
  --arg projectId "$FIREBASE_PROJECT_ID" \
  --arg storageBucket "$FIREBASE_STORAGE_BUCKET" \
  --arg messagingSenderId "$FIREBASE_MESSAGING_SENDER_ID" \
  --arg appId "$FIREBASE_APP_ID" \
  --arg vapidKey "$FIREBASE_VAPID_KEY" \
  --arg turnstileSiteKey "$TURNSTILE_SITE_KEY" \
  '{
    FIREBASE_API_KEY: $apiKey,
    FIREBASE_AUTH_DOMAIN: $authDomain,
    FIREBASE_PROJECT_ID: $projectId,
    FIREBASE_STORAGE_BUCKET: $storageBucket,
    FIREBASE_MESSAGING_SENDER_ID: $messagingSenderId,
    FIREBASE_APP_ID: $appId,
    FIREBASE_VAPID_KEY: $vapidKey,
    TURNSTILE_SITE_KEY: $turnstileSiteKey
  }' > "$OUTPUT_DIR/runtime-config.json"

# ==========================================
# Generate Vue Runtime Config
# ==========================================

{
  printf 'window.__APP_CONFIG__ = '
  cat "$OUTPUT_DIR/runtime-config.json"
  printf ';\n'
} > "$OUTPUT_DIR/config.js"

echo "[BigStock] Runtime configuration generated successfully."