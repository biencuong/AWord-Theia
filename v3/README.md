# AWord Lite (v3) — vỏ nhẹ, khung chat kiểu extension, thay Electron/Theia

Mục tiêu: thay phần lõi nặng (Electron ~250MB + Theia ~178MB) bằng vỏ **~8MB**, giữ **thương hiệu
AWord**, **gateway riêng**, và cho giao diện **giống extension Claude trên VSCode** (khung chat +
thẻ tool-use + diff), thân thiện cho cán bộ văn phòng.

Nhánh thử nghiệm `aword-v3-lite`, thư mục `v3/` — **không đụng** bản Theia trên `main`.

## Vì sao không dùng thẳng extension gốc?

Extension Claude của VSCode **không chạy độc lập** — nó cần cả IDE VSCode (gọi API `vscode.*`).
Bản AWord Theia hiện tại CHÍNH LÀ "dùng extension gốc" → nặng ~430MB. App Claude Desktop chính thức
thì mang thương hiệu Anthropic và dựa trên đăng nhập tài khoản (chưa chắc hợp gateway riêng của cơ quan).
Phần webview của extension là mã đóng ("© Anthropic, all rights reserved") — không được bóc ra nhúng.

→ Chỉ **khung chat tự dựng** mới giữ được cả 3: **thương hiệu AWord + nhẹ + gateway riêng**. Ta dựng nó
cho ra dáng extension (chảy chữ từng token, thẻ tool, diff) — đây cũng là cách [opcode](https://github.com/winfunc/opcode)
(GUI Claude Code bằng Tauri) làm.

## Kiến trúc

```
Cửa sổ AWord (Tauri, WebView2) — thanh tiêu đề + menu + Explorer + khung CHAT
   │  chat_send(tin)         sự kiện 'chat' (text_start/text/tool_start/tool_input/tool_result/result)
   ▼
Backend Rust (Tauri)  ──  claude.exe headless stream-json (giữ 1 tiến trình sống, nhớ ngữ cảnh)
   claude --print --input-format stream-json --output-format stream-json --verbose
          --include-partial-messages   (chảy từng token)
          --permission-mode acceptEdits (tự duyệt SỬA TỆP — headless không có hộp thoại duyệt như terminal)
          [--continue]                  (khôi phục phiên trước)
```

Backend parse stream-json → phát sự kiện; frontend render:
- **Chữ chảy từng token** (content_block_delta / text_delta) → bong bóng trợ lý, markdown tối giản (an toàn).
- **Thẻ tool-use** theo đúng thứ tự (content_block_start) + điền tham số khi input đủ (content_block_stop):
  📄 Đọc, ✏️ Sửa, 📝 Tạo tệp, ▶️ Lệnh, 🔎 Tìm, ⚙️ Kỹ năng… có trạng thái chạy (spinner) → xong (✓/✕).
- **Diff khi sửa/tạo tệp** (Edit/Write/MultiEdit): đỏ = bỏ, xanh = thêm.
- Menu Tệp/Chỉnh sửa/Xem/Trợ giúp hoạt động; Explorer bấm tệp → chèn `@tệp`.
- **Lưu/khôi phục phiên**: mở app tự `--continue`; nút "＋ Mới" mở phiên tươi.

## KHÔNG đóng kèm claude.exe

Khi mở, backend tự dò `claude.exe` (ưu tiên bản có sẵn: `~/.local/bin` → `%LOCALAPPDATA%` → winget →
PATH → bản đóng kèm AWord Theia). **Thiếu** → tự cài bằng trình cài **chính thức**
(`https://claude.ai/install.ps1`). **Không** tự chạy `claude update` (Claude Code tự lo) → mở nhanh.

## Build

Cần (đã có máy dev): Rust (rustup) + **VS Build Tools C++** (MSVC) + Tauri CLI.
```
cd v3/tauri
npx tauri build      (ra target\release\bundle\nsis\AWord_0.1.0_x64-setup.exe)
npx tauri dev
```
`frontendDist` (`../../frontend`) **không được** chứa `node_modules` (tauri build từ chối).

### Kết quả đo
| | AWord (Theia) | **AWord Lite** |
|---|---|---|
| Vỏ ứng dụng | ~430 MB | **~8–9 MB** |
| Bộ cài (chưa đóng claude.exe) | 285 MB | **~2 MB** |
| RAM lúc mở | vài trăm MB | **~30 MB** |

Phần nặng duy nhất còn lại là `claude.exe` (~242MB, động cơ AI) — giống cả hai bản.

## Ghi chú kỹ thuật (bài học)
- **WebView2 chạy `app.js` 2 lần** trong cùng realm → `const` "already declared" → cả file chết
  (cửa sổ trống). Bọc IIFE + guard `window.__APPJS_RUNS === 1`.
- **WebView2 cache asset cũ** → `additionalBrowserArgs: "--disable-http-cache"` trong tauri.conf.json.
- Chẩn đoán webview không console: eval từ Rust `on_page_load` + lệnh tạm `flog` ghi ra %TEMP%.
- Headless **không có hộp thoại duyệt quyền** như terminal → phải `--permission-mode acceptEdits`
  thì Write/Edit mới chạy (nếu không sẽ bị "chưa được cấp quyền ghi").

## Còn có thể trau chuốt thêm
- Hộp thoại duyệt quyền tương tác (thay cho acceptEdits) cho thao tác nhạy cảm.
- Xem docx/xlsx/pdf ngay trong app; nút kết nối kho; tự cập nhật vỏ; ký số.
- Bản Rust vẫn giữ code terminal (PTY) làm dự phòng — hiện frontend dùng khung chat.
