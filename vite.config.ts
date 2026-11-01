import { fileURLToPath, URL } from 'node:url'
import { resolve } from 'node:path'

import { build as viteBuild, defineConfig, loadEnv, type Plugin, type UserConfig } from 'vite'

import { build as esbuild } from 'esbuild'

import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

import { chartObfuscationPlugin } from './build/chartObfuscationPlugin'

// ============================================================
// BigStock Production Terser Configuration
// ============================================================

// 直接使用 Vite 的 TerserOptions 型別，避免與
// node_modules/terser 的獨立型別定義發生衝突。
type ViteTerserOptions = NonNullable<NonNullable<UserConfig['build']>['terserOptions']>

const bigstockTerserOptions: ViteTerserOptions = {
  compress: {
    // 只移除列出的 Console 方法
    // console.warn / console.error 保留
    drop_console: [
      'log',
      'info',
      'debug',
      'trace',
      'table',
      'dir',
      'dirxml',
      'group',
      'groupCollapsed',
      'groupEnd',
      'time',
      'timeEnd',
      'timeLog',
      'count',
      'countReset',
      'assert',
      'clear',
      'profile',
      'profileEnd',
      'timeStamp',
    ],

    drop_debugger: true,
    dead_code: true,
    passes: 2,
  },

  mangle: true,

  format: {
    comments: false,
  },
}

// ============================================================
// Firebase Messaging Service Worker Plugin
// ============================================================

function firebaseMessagingServiceWorkerPlugin(mode: string, env: Record<string, string>): Plugin {
  let isBuild = false

  const serviceWorkerEntry = resolve(process.cwd(), 'src/firebase/firebase-messaging-sw.ts')

  // 將 VITE_* 環境變數提供給開發環境的 esbuild
  const defineEnv: Record<string, string> = {}

  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith('VITE_')) {
      defineEnv[`import.meta.env.${key}`] = JSON.stringify(value)
    }
  }

  return {
    name: 'firebase-messaging-service-worker',

    // 判斷目前是否正在執行 Vite Build
    configResolved(config) {
      isBuild = config.command === 'build'
    },

    // ========================================================
    // Development Service Worker
    // ========================================================

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

              // 僅開發環境使用 Inline Source Map
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

    // ========================================================
    // Production Service Worker
    // ========================================================

    async closeBundle() {
      // 僅在 Build 時執行第二次 Vite Build
      if (!isBuild) {
        return
      }

      await viteBuild({
        // 不重新讀取外層 vite.config.ts
        configFile: false,

        mode,
        publicDir: false,

        // 保留原本的 SockJS / Firebase 相容設定
        define: {
          global: 'globalThis',
        },

        build: {
          // 不清除主程式產生的 dist
          emptyOutDir: false,

          outDir: resolve(process.cwd(), 'dist'),

          target: 'es2020',

          // 正式環境關閉 Source Map
          sourcemap: false,

          // Service Worker 也使用 Terser
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

// ============================================================
// BigStock Vite Configuration
// ============================================================

export default defineConfig(({ mode, command }) => {
  const productionBuild = command === 'build' && mode === 'production'

  // Production 預設啟用 K 線額外混淆
  const enableChartObfuscation = productionBuild && process.env.BIGSTOCK_CHART_OBFUSCATE !== 'false'

  const env = loadEnv(mode, process.cwd(), '')

  // Development Backend URL
  // Production 由 Docker Nginx Proxy 處理
  const apiTarget = env.VITE_APP_BASE_URL

  const wsTarget = env.VITE_WS_BASE_URL || env.VITE_APP_BASE_URL

  return {
    // ========================================================
    // Plugins
    // ========================================================

    plugins: [
      vue(),

      // 正式打包不載入 Vue DevTools Plugin
      ...(productionBuild ? [] : [vueDevTools()]),

      // Firebase Messaging Service Worker
      firebaseMessagingServiceWorkerPlugin(mode, env),

      // K 線圖額外混淆
      chartObfuscationPlugin({
        enabled: enableChartObfuscation,

        targetPaths: ['/src/utils/marketIndicators.ts', '/src/utils/marketHistoryParser.ts'],

        threshold: 0.15,
      }),
    ],

    // ========================================================
    // Browser Compatibility
    // ========================================================

    // 避免 SockJS：
    // ReferenceError: global is not defined
    define: {
      global: 'globalThis',
    },

    // ========================================================
    // Alias
    // ========================================================

    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },

    // ========================================================
    // Development Server
    // ========================================================

    server: {
      host: '0.0.0.0',

      port: 13001,

      strictPort: true,

      proxy: {
        // REST API
        // /api/auth/tempToken -> /auth/tempToken
        // /api/device/register -> /device/register
        '/api': {
          target: apiTarget,

          changeOrigin: true,

          rewrite: (path: string) => path.replace(/^\/api(?=\/|$)/, ''),
        },

        // SockJS / STOMP
        '/ws': {
          target: wsTarget,

          changeOrigin: true,

          ws: true,
        },
      },
    },

    // ========================================================
    // Production Build
    // ========================================================

    build: {
      target: 'es2020',

      outDir: 'dist',

      emptyOutDir: true,

      // 正式環境不輸出 Source Map
      sourcemap: false,

      // Production 使用 Terser
      minify: productionBuild ? 'terser' : false,

      // 使用 Vite 型別的 Terser 設定
      terserOptions: bigstockTerserOptions,
    },
  }
})
