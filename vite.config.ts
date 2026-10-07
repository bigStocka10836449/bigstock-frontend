import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'node:path';
import { build as viteBuild, defineConfig, loadEnv, type Plugin } from 'vite';
import { build as esbuild } from 'esbuild';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';



/**
 * Firebase Messaging Service Worker Plugin
 *
 * 用途：
 *
 * 開發環境：
 *
 * src/firebase/firebase-messaging-sw.ts
 *              ↓
 *           esbuild
 *              ↓
 * /firebase-messaging-sw.js
 *
 *
 * 正式環境：
 *
 * src/firebase/firebase-messaging-sw.ts
 *              ↓
 *        Vite / Rollup
 *              ↓
 * dist/firebase-messaging-sw.js
 *
 *
 * 這樣可以讓 Service Worker 繼續：
 *
 * 1. 使用 TypeScript
 * 2. import Firebase SDK
 * 3. 使用 import.meta.env
 *
 * 同時不需要在 public 目錄維護另一份 JS。
 */
function firebaseMessagingServiceWorkerPlugin(
  mode: string,
  env: Record<string, string>,
): Plugin {

  // Firebase Messaging Service Worker 原始檔案
  const serviceWorkerEntry = resolve(
    process.cwd(),
    'src/firebase/firebase-messaging-sw.ts',
  );


  /**
   * 將 Vite 環境變數轉成 esbuild 可以直接替換的格式。
   *
   * 例如：
   *
   * import.meta.env.VITE_FIREBASE_API_KEY
   *
   * 會在 bundle 時直接變成實際的字串值。
   */
  const defineEnv: Record<string, string> = {};

  for (
    const [key, value]
    of Object.entries(env)
  ) {

    if (
      key.startsWith('VITE_')
    ) {

      defineEnv[
        `import.meta.env.${key}`
      ] = JSON.stringify(value);
    }
  }


  return {

    name:
      'firebase-messaging-service-worker',


    /**
     * 開發環境處理。
     *
     * Firebase 預設會要求：
     *
     * /firebase-messaging-sw.js
     *
     * 這裡直接攔截該 request，
     * 使用 esbuild 將 TypeScript Service Worker
     * bundle 成一個完整 JavaScript 檔案。
     *
     * 注意：
     *
     * 這裡不再呼叫第二次 Vite build，
     * 避免干擾目前正在執行的 Vite Dev Server / HMR。
     */
    configureServer(server) {

      server.middlewares.use(
        '/firebase-messaging-sw.js',

        async (
          _req,
          res,
          next,
        ) => {

          try {

            const result =
              await esbuild({

                // Service Worker 原始檔
                entryPoints: [
                  serviceWorkerEntry,
                ],

                // 不輸出實體檔案，
                // 直接取得編譯結果並回傳給瀏覽器
                write: false,

                // 將 Firebase SDK 等 dependency
                // 全部 bundle 到同一個 Service Worker
                bundle: true,

                // Service Worker 執行於瀏覽器環境
                platform: 'browser',

                // 輸出一般 JavaScript，
                // 避免 Service Worker 再依賴 Vite module
                format: 'iife',

                // 現代瀏覽器即可
                target: 'es2020',

                // 將 import.meta.env.VITE_*
                // 替換成目前 development mode 的實際值
                define: defineEnv,

                // 產生 source map，
                // 方便開發環境除錯
                sourcemap: 'inline',
              });


            const outputFile =
              result.outputFiles?.[0];


            if (!outputFile) {

              throw new Error(
                'Firebase Messaging Service Worker build produced no output.',
              );
            }


            // Service Worker 正常回傳
            res.statusCode = 200;


            /**
             * 非常重要：
             *
             * 必須回傳 JavaScript MIME Type，
             * 不能再讓 Vite fallback 成 text/html。
             */
            res.setHeader(
              'Content-Type',
              'application/javascript; charset=utf-8',
            );


            /**
             * 允許 Service Worker 控制網站根目錄。
             */
            res.setHeader(
              'Service-Worker-Allowed',
              '/',
            );


            /**
             * 開發環境不要 cache Service Worker，
             * 避免修改程式後瀏覽器仍使用舊版本。
             */
            res.setHeader(
              'Cache-Control',
              'no-store',
            );


            // 回傳 bundle 完成的 Service Worker
            res.end(
              outputFile.contents,
            );

          } catch (error) {

            console.error(
              '[FCM] Service Worker build failed:',
              error,
            );


            next(error);
          }
        },
      );
    },


    /**
     * 正式環境 Build。
     *
     * 保留原本的設計：
     *
     * src/firebase/firebase-messaging-sw.ts
     *
     * ↓
     *
     * dist/firebase-messaging-sw.js
     */
    async closeBundle() {

      await viteBuild({

        // 不重新讀取目前的 vite.config.ts，
        // 避免 Plugin 遞迴執行自己
        configFile: false,

        mode,

        publicDir: false,


        build: {

          // 不清空 dist，
          // 因為 Vue 主程式已經 build 完成
          emptyOutDir: false,


          lib: {

            // Firebase Messaging Service Worker
            entry:
              serviceWorkerEntry,

            // 正式環境輸出 ES JavaScript
            formats: [
              'es',
            ],

            // Firebase 預設尋找的檔名
            fileName:
              () =>
                'firebase-messaging-sw.js',
          },


          // 輸出到正式 Vue build 的 dist
          outDir:
            resolve(
              process.cwd(),
              'dist',
            ),


          rollupOptions: {

            output: {

              // 將 dependency 全部打包在同一個檔案，
              // 避免 Service Worker 還需要額外載入 chunk
              inlineDynamicImports:
                true,
            },
          },
        },
      });
    },
  };
}


// https://vite.dev/config/
export default defineConfig(({ mode }) => {

  // 使用 loadEnv 加載對應模式的環境變量
  const env =
    loadEnv(
      mode,
      process.cwd(),
      '',
    );


  return {

    plugins: [

      vue(),

      vueDevTools(),

      firebaseMessagingServiceWorkerPlugin(
        mode,
        env,
      ),
    ],


    resolve: {

      alias: {

        '@':
          fileURLToPath(
            new URL(
              './src',
              import.meta.url,
            ),
          ),
      },
    },


    server: {

      port: 13001, // 這裡定義開發伺服器的端口號

      strictPort: true, // 如果該端口被佔用，則直接報錯，而不是自動選擇其他端口


      proxy: {

        '^/api/': {

          target:
            env.VITE_APP_BASE_URL, // 從 loadEnv 加載的環境變量

          changeOrigin: true, // 修改請求的來源，讓後端認為請求來自目標地址


          rewrite: (path) => {

            console.log(
              'VITE_APP_BASE_URL:',
              env.VITE_APP_BASE_URL,
            ); // 調試環境變量

            console.log(
              'Before rewrite:',
              path,
            );


            const rewrittenPath =
              path.replace(
                /^\/api/,
                '',
              );


            console.log(
              'After rewrite:',
              rewrittenPath,
            );


            return rewrittenPath;
          },
        },
      },
    },
  };
});
