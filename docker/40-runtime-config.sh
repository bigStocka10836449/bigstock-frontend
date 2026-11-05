#!/bin/sh
set -eu

OUTPUT_DIR="/usr/share/nginx/html"

# ==========================================
# Validate required environment variables
# ==========================================


: "${TURNSTILE_SITE_KEY:?TURNSTILE_SITE_KEY required}"

# ==========================================
# Generate Runtime Config JSON
# ==========================================

jq -n \
  --arg turnstileSiteKey "$TURNSTILE_SITE_KEY" \
  '{
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