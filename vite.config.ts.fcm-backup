import { fileURLToPath, URL } from 'node:url'
import { resolve } from 'node:path'

import { build as viteBuild, defineConfig, loadEnv, type Plugin, type UserConfig } from 'vite'

import { build as esbuild } from 'esbuild'

import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { chartObfuscationPlugin } from './build/chartObfuscationPlugin'


/** Production: retain only console.warn/error, remove ordinary comments. */
type ViteTerserOptions = NonNullable<NonNullable<UserConfig['build']>['terserOptions']>

const bigstockTerserOptions: ViteTerserOptions = {
  compress: {
    drop_console: [
      'log', 'info', 'debug', 'trace', 'table', 'dir', 'dirxml',
      'group', 'groupCollapsed', 'groupEnd', 'time', 'timeEnd',
      'timeLog', 'count', 'countReset', 'assert', 'clear',
      'profile', 'profileEnd', 'timeStamp',
    ],
    drop_debugger: true,
    dead_code: true,
    passes: 2,
  },
  mangle: true,
  format: { comments: false },
}

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
 * - runtime-config.json loaded at service worker startup
 * - 單獨的 Service Worker Bundle
 */
function firebaseMessagingServiceWorkerPlugin(mode: string): Plugin {
  let isBuild = false
  const serviceWorkerEntry = resolve(process.cwd(), 'src/firebase/firebase-messaging-sw.ts')

  return {
    name: 'firebase-messaging-service-worker',
    configResolved(config) {
      isBuild = config.command === 'build'
    },

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
      if (!isBuild) return
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

          target: 'es2020',
          sourcemap: false,
          minify: 'terser',
          terserOptions: bigstockTerserOptions,

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
 * Development Runtime Configuration.
 *
 * Read .env.local through Vite's loadEnv().
 *
 * Production continues using Docker runtime config.
 */
function developmentRuntimeConfigPlugin(
  env: Record<string, string>,
): Plugin {

  const config = {
    APP_BASE_URL: env.VITE_APP_BASE_URL || '',
    WEB_API_BASE_URL: '/api',

    FIREBASE_API_KEY:
      env.VITE_FIREBASE_API_KEY || '',

    FIREBASE_AUTH_DOMAIN:
      env.VITE_FIREBASE_AUTH_DOMAIN || '',

    FIREBASE_PROJECT_ID:
      env.VITE_FIREBASE_PROJECT_ID || '',

    FIREBASE_STORAGE_BUCKET:
      env.VITE_FIREBASE_STORAGE_BUCKET || '',

    FIREBASE_MESSAGING_SENDER_ID:
      env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',

    FIREBASE_APP_ID:
      env.VITE_FIREBASE_APP_ID || '',

    FIREBASE_VAPID_KEY:
      env.VITE_FIREBASE_VAPID_KEY || '',

    TURNSTILE_SITE_KEY:
      env.VITE_TURNSTILE_SITE_KEY || '',
  }

  const configJson = JSON.stringify(config)

  return {
    name: 'bigstock-development-runtime-config',

    configureServer(server) {

      server.middlewares.use((req, res, next) => {

        const pathname =
          (req.url || '').split('?')[0]

        if (pathname === '/config.js') {

          res.statusCode = 200

          res.setHeader(
            'Content-Type',
            'application/javascript; charset=utf-8',
          )

          res.setHeader(
            'Cache-Control',
            'no-store',
          )

          res.end(
            `window.__APP_CONFIG__ = ${configJson};`,
          )

          return
        }

        if (pathname === '/runtime-config.json') {

          res.statusCode = 200

          res.setHeader(
            'Content-Type',
            'application/json; charset=utf-8',
          )

          res.setHeader(
            'Cache-Control',
            'no-store',
          )

          res.end(configJson)

          return
        }

        next()
      })
    },
  }
}

/**
 * ============================================================
 * BigStock Vite Configuration
 * ============================================================
 */
export default defineConfig(({ mode, command }) => {
  const productionBuild = command === 'build' && mode === 'production'
  const enableChartObfuscation = productionBuild && process.env.BIGSTOCK_CHART_OBFUSCATE !== 'false'
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
    plugins: [
      vue(),

      ...(command === 'serve'
        ? [developmentRuntimeConfigPlugin(env)]
        : []),

      ...(productionBuild ? [] : [vueDevTools()]),

      firebaseMessagingServiceWorkerPlugin(mode),

      chartObfuscationPlugin({
        enabled: enableChartObfuscation,
        targetPaths: [
          '/src/utils/marketIndicators.ts',
          '/src/utils/marketHistoryParser.ts',
        ],
        threshold: 0.15,
      }),
    ],

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

      sourcemap: false,
      minify: productionBuild ? 'terser' : false,
      terserOptions: bigstockTerserOptions,

      // 僅主程式使用匿名化檔名；FCM Service Worker 維持固定 URL。
      rollupOptions: {
        output: {
          // 所有入口 JS、動態 Chunk、CSS、圖片皆使用 hash 命名。
          entryFileNames: 'assets/j-[hash].js',
          chunkFileNames: 'assets/j-[hash].js',
          assetFileNames: 'assets/r-[hash][extname]',

          manualChunks(id) {
            const normalized = id.replace(/\\/g, '/')
            const cleanId = normalized.split('?')[0]

            if (
              cleanId.endsWith('/src/utils/marketIndicators.ts') ||
              cleanId.endsWith('/src/utils/marketHistoryParser.ts')
            ) {
              return 'x' // Chunk 內部識別名稱，不會出現在輸出檔名
            }

            return undefined
          },
        },
      },
    },
  }
})
