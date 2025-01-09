import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 使用 loadEnv 加載對應模式的環境變量
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [vue(), vueDevTools()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 13001, // 這裡定義開發伺服器的端口號
      strictPort: true, // 如果該端口被佔用，則直接報錯，而不是自動選擇其他端口
      proxy: {
        '^/api/': {
          target: env.VITE_APP_BASE_URL, // 從 loadEnv 加載的環境變量
          changeOrigin: true, // 修改請求的來源，讓後端認為請求來自目標地址
          rewrite: (path) => {
            console.log('VITE_APP_BASE_URL:', env.VITE_APP_BASE_URL); // 調試環境變量
            console.log('Before rewrite:', path);
            const rewrittenPath = path.replace(/^\/api/, '');
            console.log('After rewrite:', rewrittenPath);
            return rewrittenPath;
          },
        },
      },
    },
  };
});
