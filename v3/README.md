# AWord Lite (v3) — vỏ nhẹ chạy CLAUDE CODE THẬT thay Electron/Theia

Mục tiêu: thay phần lõi nặng (Electron ~250MB + Theia ~178MB) bằng vỏ **~8MB**, nhưng **giữ nguyên
Claude Code thật** (giao diện tương tác đầy đủ: hiện tool-use, sửa file, chạy skill) và **giao diện
giống AWord hiện tại**.

Nhánh thử nghiệm `aword-v3-lite`, thư mục `v3/` — **không đụng** bản Theia trên `main`.

## Cách làm: nhúng terminal thật

Không dựng lại giao diện Claude Code (bất khả thi) — mà chạy **chính `claude.exe` ở chế độ tương
tác** trong một **terminal thật** hiển thị trong cửa sổ AWord, y như VS Code/Theia chạy nó:

```
Cửa sổ AWord (Tauri, WebView2)  ── giao diện: thanh tiêu đề + explorer + terminal
   │  xterm.js  ⇅  (gõ phím → pty_write ; đầu ra PTY → sự kiện 'pty', base64)
   ▼
Backend Rust (Tauri)  ──  PTY / ConPTY
   │  stdin/stdout của một TTY thật
   ▼
claude.exe   (KHÔNG --print — chế độ TUI tương tác đầy đủ, đọc ~/.claude, skill, MCP, gateway)
```

- **xterm.js** (đóng kèm `frontend/vendor/`, không cần bundler) render terminal.
- **portable-pty** (ConPTY trên Windows) chạy claude tương tác, luồng đọc PTY → phát `pty` (base64) lên webview.
- Giao diện AWord: thanh tiêu đề tùy biến (logo cam + menu), activity bar, Explorer (bấm tệp → chèn `@tệp`).

## KHÔNG đóng kèm claude.exe

Khi mở, backend tự dò `claude.exe` (ưu tiên bản có sẵn: `~/.local/bin` → `%LOCALAPPDATA%\Programs\claude`
→ winget → PATH → bản đóng kèm AWord Theia). **Thiếu** → tự cài bằng trình cài **chính thức**
(`https://claude.ai/install.ps1`, bản latest), có lớp phủ báo tiến trình. **Không** tự chạy
`claude update` — Claude Code tự lo cập nhật nên mở nhanh, không "treo".

## Build

Cần (đã cài sẵn máy dev): Rust (rustup) + **VS Build Tools workload C++** (MSVC) + Tauri CLI.
```
cd v3/tauri
npx tauri build       (ra target\release\bundle\nsis\AWord_0.1.0_x64-setup.exe)
npx tauri dev         (chạy nhanh khi phát triển)
```
Lưu ý: `frontendDist` (`../../frontend`) **không được** chứa `node_modules` (tauri build sẽ từ chối).
Thư viện web đã đóng kèm sẵn ở `frontend/vendor/` — xem `frontend/vendor/SOURCE.md` để cập nhật.

### Kết quả đo
| | AWord (Theia) | **AWord Lite (Tauri)** |
|---|---|---|
| Vỏ ứng dụng (không tính claude.exe) | ~430 MB | **~8.7 MB** |
| Bộ cài (chưa đóng claude.exe) | 285 MB | **~1.9 MB** |
| RAM lúc mở | vài trăm MB | **~30 MB** |

→ Vỏ nhẹ ~8MB thay toàn bộ ~430MB Electron+Theia, **vẫn là Claude Code thật**. Phần nặng duy nhất còn
lại là chính `claude.exe` (~242MB, động cơ AI, không bỏ được) — giống cả hai bản.

## Ghi chú kỹ thuật (bài học khi làm)

- **WebView2 nạp/chạy `app.js` có thể 2 lần** trong cùng realm → `const` top-level báo "already declared"
  làm cả file chết (biểu hiện: cửa sổ trống, "chạy ko ra gì"). Khắc phục: bọc `app.js` trong IIFE +
  guard `window.__APPJS_RUNS === 1`.
- **WebView2 cache asset**: sau khi cập nhật, `app.js`/`index.html` cũ có thể bị dùng lại. Đặt
  `additionalBrowserArgs: "--disable-http-cache ..."` trong `tauri.conf.json` để luôn nạp bản mới.
- Đầu ra PTY gửi lên webview dạng **base64** (Vec<u8> → chuỗi) để tránh lỗi biên UTF-8 khi ghép mảnh;
  xterm ghi thẳng `Uint8Array`.

## Còn lại để thành sản phẩm hoàn chỉnh
- Xem docx/xlsx/pdf ngay trong app (khung riêng cạnh terminal).
- Nút bố cục/cập nhật/kết nối kho; tự cập nhật vỏ.
- Ký số (chung bản Theia) để hết cảnh báo antivirus/SmartScreen.
- (Tùy chọn) Tự tin cậy sẵn thư mục `~/Documents/AWord` để bỏ bước hỏi "trust this folder?" lần đầu.
