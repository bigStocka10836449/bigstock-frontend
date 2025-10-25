#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

nginx -p "$ROOT_DIR" -c "$ROOT_DIR/nginx.conf"