# bstock-frontend

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```


## Nginx 部署

1. 執行 `npm run build` 產生 `dist/` 目錄。
2. 將 `dist/` 內的檔案部署到 Nginx 伺服器的靜態檔案路徑。
3. 範例設定檔位於 [`nginx.conf.example`](./nginx.conf.example)，內容如下：

```nginx
server {
    listen 80;
    server_name example.com;

    root /var/www/bstock;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```