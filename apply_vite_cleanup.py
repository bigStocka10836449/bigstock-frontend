#!/usr/bin/env python3
"""在前端專案根目錄執行：python apply_vite_cleanup.py；自動備份 vite.config.ts。"""
from pathlib import Path
import re

p=Path('vite.config.ts')
if not p.exists():
    raise SystemExit('請在 bstock-frontend 專案根目錄執行')
s=p.read_text(encoding='utf-8')
backup=p.with_suffix('.ts.fcm-backup')
if 'function firebaseMessagingServiceWorkerPlugin' not in s:
    print('未找到 FCM Plugin；可能已清理。')
    raise SystemExit(0)

# The plugin is bounded by the two existing named comment sections.
pattern = r'/\*\*\s*\n \* ============================================================\s*\n \* Firebase Messaging Service Worker Plugin[\s\S]*?(?=/\*\*\s*\n \* Development Runtime Configuration\.)'
# Match the exact block in current BigStock repo, through marker just before Development Runtime Configuration.
start=s.find('/**\n * ============================================================\n * Firebase Messaging Service Worker Plugin')
end=s.find('/**\n * Development Runtime Configuration.', start)
if start<0 or end<0 or end<=start:
    raise SystemExit('vite.config.ts 內容已與原版不同：請參考 VITE_REMOVAL.md 手動整合。')
backup.write_text(s,encoding='utf-8')
s=s[:start]+s[end:]
s=s.replace("import { resolve } from 'node:path'\n",'')
s=s.replace("import { build as viteBuild, defineConfig, loadEnv, type Plugin, type UserConfig } from 'vite'", "import { defineConfig, loadEnv, type Plugin, type UserConfig } from 'vite'")
s=s.replace("import { build as esbuild } from 'esbuild'\n",'')
s=s.replace('      firebaseMessagingServiceWorkerPlugin(mode),\n','')
s=s.replace('      // 僅主程式使用匿名化檔名；FCM Service Worker 維持固定 URL。','      // 主程式使用匿名化檔名。')
if 'firebaseMessagingServiceWorkerPlugin' in s:
    raise SystemExit('還有 FCM plugin 引用，已保留原檔')
p.write_text(s,encoding='utf-8')
print('已清理 Vite FCM Plugin。原設定備份：',backup)
