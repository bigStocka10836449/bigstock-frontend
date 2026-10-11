import { fileURLToPath, URL } from 'node:url'
import { resolve } from 'node:path'

import { build as viteBuild, defineConfig, loadEnv, type Plugin } from 'vite'

import { build as esbuild } from 'esbuild'

import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

/**
 * ============================================================
 * Firebase Messaging Service Worker Plugin
 * ============================================================
 *
 * Development:
 *
 * src/firebase/firebase-messaging-sw.ts
 *         ↓ esbuild
 * /firebase-messaging-sw.js
 *
 * Production:
 *
 * src/firebase/firebase-messaging-sw.ts
 *         ↓ Vite Build
 * dist/firebase-messaging-sw.js
 *
 * 保留：
 * - TypeScript Service Worker
 * - Firebase SDK Imports
 * - import.meta.env
 * - 單獨的 Service Worker Bundle
 */
function firebaseMessagingServiceWorkerPlugin(mode: string, env: Record<string, string>): Plugin {
  const serviceWorkerEntry = resolve(process.cwd(), 'src/firebase/firebase-messaging-sw.ts')

  /**
   * 將 VITE_* 環境變數轉成 esbuild define。
   */
  const defineEnv: Record<string, string> = {}

  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith('VITE_')) {
      defineEnv[`import.meta.env.${key}`] = JSON.stringify(value)
    }
  }

  return {
    name: 'firebase-messaging-service-worker',

    /**
     * --------------------------------------------------------
     * Development
     * --------------------------------------------------------
     *
     * 動態處理：
     * /firebase-messaging-sw.js
     */
    configureServer(server) {
      server.middlewares.use(
        '/firebase-messaging-sw.js',

        async (_req, res, next) => {
          try {
            const result = await esbuild({
              entryPoints: [serviceWorkerEntry],

              write: false,

              bundle: true,

              platform: 'browser',

              format: 'iife',

              target: 'es2020',

              define: {
                ...defineEnv,
                global: 'globalThis',
              },

              sourcemap: 'inline',
            })

            const outputFile = result.outputFiles?.[0]

            if (!outputFile) {
              throw new Error('Firebase Service Worker build produced no output.')
            }

            res.statusCode = 200

            res.setHeader('Content-Type', 'application/javascript; charset=utf-8')

            res.setHeader('Service-Worker-Allowed', '/')

            res.setHeader('Cache-Control', 'no-store')

            res.end(outputFile.contents)
          } catch (error) {
            console.error('[FCM] Service Worker build failed:', error)

            next(error)
          }
        },
      )
    },

    /**
     * --------------------------------------------------------
     * Production
     * --------------------------------------------------------
     *
     * Vue 主程式 Build 完成後，
     * 再將 Firebase Messaging Service Worker
     * 打包至 dist 根目錄。
     */
    async closeBundle() {
      await viteBuild({
        configFile: false,

        mode,

        publicDir: false,

        /**
         * 此設定是獨立的第二次 Vite Build。
         *
         * 不會自動繼承外層 Vite define。
         */
        define: {
          global: 'globalThis',
        },

        build: {
          emptyOutDir: false,

          outDir: resolve(process.cwd(), 'dist'),

          lib: {
            entry: serviceWorkerEntry,

            formats: ['es'],

            fileName: () => 'firebase-messaging-sw.js',
          },

          rollupOptions: {
            output: {
              inlineDynamicImports: true,
            },
          },
        },
      })
    },
  }
}

/**
 * ============================================================
 * BigStock Vite Configuration
 * ============================================================
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  /**
   * Backend URL 僅供 Development Proxy 使用。
   *
   * Production 由 Docker Nginx Proxy 負責。
   */
  const apiTarget = env.VITE_APP_BASE_URL

  const wsTarget = env.VITE_WS_BASE_URL || env.VITE_APP_BASE_URL

  return {
    /**
     * --------------------------------------------------------
     * Vue / Firebase Plugins
     * --------------------------------------------------------
     */
    plugins: [vue(), vueDevTools(), firebaseMessagingServiceWorkerPlugin(mode, env)],

    /**
     * --------------------------------------------------------
     * Browser Compatibility
     * --------------------------------------------------------
     *
     * 避免 sockjs-client 在瀏覽器執行時：
     *
     * ReferenceError: global is not defined
     *
     * Development / Production 都生效。
     */
    define: {
      global: 'globalThis',
    },

    /**
     * --------------------------------------------------------
     * Alias
     * --------------------------------------------------------
     */
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },

    /**
     * --------------------------------------------------------
     * Development Server
     * --------------------------------------------------------
     *
     * 只在 npm run dev 時生效。
     *
     * Docker Production 不使用此設定。
     */
    server: {
      host: '0.0.0.0',

      port: 13001,

      strictPort: true,

      proxy: {
        /**
         * ----------------------------------------------------
         * REST API
         * ----------------------------------------------------
         *
         * Frontend:
         * /api/auth/tempToken
         * /api/device/register
         * /api/biz/market/USHistory
         *
         * Backend:
         * /auth/tempToken
         * /device/register
         * /biz/market/USHistory
         */
        '/api': {
          target: apiTarget,

          changeOrigin: true,

          rewrite: (path: string) => path.replace(/^\/api(?=\/|$)/, ''),
        },

        /**
         * ----------------------------------------------------
         * SockJS / STOMP
         * ----------------------------------------------------
         *
         * Frontend:
         * /ws?token=...
         * /ws/info
         * /ws/.../websocket
         * /ws/.../xhr_streaming
         *
         * Backend:
         * 相同 /ws 路徑
         *
         * ws: true 支援 WebSocket Upgrade。
         *
         * Vite Proxy 也會處理 SockJS HTTP Transport。
         */
        '/ws': {
          target: wsTarget,

          changeOrigin: true,

          ws: true,
        },
      },
    },

    /**
     * --------------------------------------------------------
     * Production Build
     * --------------------------------------------------------
     */
    build: {
      target: 'es2020',

      outDir: 'dist',

      emptyOutDir: true,
    },
  }
})
