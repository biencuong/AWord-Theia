# Thư viện web đóng kèm (vendored)

Các tệp trong thư mục này lấy từ npm, bản UMD dùng qua thẻ `<script>` (không cần bundler):

| Tệp | Gói npm | Phiên bản | Nguồn |
|---|---|---|---|
| `xterm.js` | `@xterm/xterm` | 6.0.0 | `node_modules/@xterm/xterm/lib/xterm.js` |
| `xterm.css` | `@xterm/xterm` | 6.0.0 | `node_modules/@xterm/xterm/css/xterm.css` |
| `addon-fit.js` | `@xterm/addon-fit` | 0.11.0 | `node_modules/@xterm/addon-fit/lib/addon-fit.js` |

Global phơi ra: `window.Terminal` (xterm) và `window.FitAddon.FitAddon` (addon-fit).

## Cập nhật khi cần

```
cd <thư mục tạm>
npm i @xterm/xterm @xterm/addon-fit
copy node_modules/@xterm/xterm/lib/xterm.js        -> v3/frontend/vendor/xterm.js
copy node_modules/@xterm/xterm/css/xterm.css       -> v3/frontend/vendor/xterm.css
copy node_modules/@xterm/addon-fit/lib/addon-fit.js-> v3/frontend/vendor/addon-fit.js
```

Không đặt `node_modules` trong `v3/frontend/` — `tauri build` từ chối vì `frontendDist` không được chứa `node_modules`.
