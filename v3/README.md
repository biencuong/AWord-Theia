# AWord Lite (v3) — thử nghiệm vỏ nhẹ thay Electron/Theia

Mục tiêu: thay phần lõi nặng (Electron ~250MB + Theia ~178MB) bằng vỏ nhẹ, **giữ nguyên**
động cơ AI (`claude.exe`), skill, MCP, CLAUDE.md, và **giao diện giống bản AWord hiện tại**.

Đây là nhánh thử nghiệm (`aword-v3-lite`), thư mục `v3/` — **không đụng** bản Theia trên `main`.

## Kiến trúc

```
Trình duyệt/WebView2 (giao diện web giống AWord)
        │  POST /chat  (gửi tin)         GET /stream (SSE nhận phản hồi)
        ▼
   backend/server.js  (Node, KHÔNG cần thư viện ngoài)
        │  stdin (JSON)  ▲ stdout (stream-json)
        ▼                │
   claude.exe  --print --input-format stream-json --output-format stream-json --verbose
   (động cơ AI y như bản hiện tại: đọc ~/.claude/settings.json, skill, MCP, gateway)
```

- Node giữ MỘT tiến trình `claude.exe` sống (stdin mở) → chat **đa lượt, nhớ ngữ cảnh** (đã kiểm thử).
- Không dùng Electron, không dùng Theia. Không cần thư viện npm.
- `claude.exe` được tìm theo thứ tự: PATH → `~/.local/bin` → `%LOCALAPPDATA%\Programs\claude` →
  bản đóng kèm trong bộ cài AWord.

## Chạy thử (giai đoạn 1 — chạy được NGAY, không cần Rust/MSVC)

```
v3\AWord-Lite.cmd
```
Hoặc thủ công:
```
cd v3\backend
node server.js               (mặc định thư mục làm việc: Documents\AWord)
node server.js "D:\ho-so"    (chỉ định thư mục khác)
```
Rồi mở `msedge --app=http://127.0.0.1:41789` (Edge/WebView2 có sẵn Windows) — cửa sổ không có
thanh trình duyệt, nhìn như app thật.

### Đã chạy được
- Chat với Claude (streaming, đa lượt, nhớ ngữ cảnh) qua động cơ `claude.exe` thật.
- Explorer: liệt kê thư mục làm việc, bấm tệp → chèn `@tệp` vào ô nhập (như "Thêm vào Claude").
- Giao diện tối khớp AWord: logo cam, thanh tiêu đề + menu, activity bar, Explorer, khung chat.

### Chưa làm (giai đoạn sau)
- Xem tài liệu docx/xlsx/pdf trong app (dùng thư viện web: docx-preview, SheetJS, pdf.js).
- Cửa sổ thật (thu nhỏ/phóng to/đóng) — hiện là app-window của Edge.
- Nút bố cục, cập nhật, kết nối kho — port từ bản Theia sang.

## Giai đoạn 2 — đóng gói Tauri (ĐÃ LÀM XONG ✓)

Đã bọc bằng **Tauri** (Rust backend thuần + WebView2). Thư mục `tauri/`.
- `tauri/src-tauri/src/main.rs` — backend Rust điều khiển `claude.exe` (giữ tiến trình sống, luồng
  đọc stdout → phát sự kiện lên webview), lệnh chat/stop/list_files/read_file/open_external.
- Cửa sổ frameless (giữ thanh tiêu đề tùy biến giống AWord). `frontend/` dùng CHUNG với giai đoạn 1
  (transport tự nhận Tauri hay HTTP).

### Build lại
Cần (đã cài sẵn trên máy dev): Rust (rustup) + **VS Build Tools workload C++** (MSVC) + Tauri CLI.
```
cd v3\tauri
npx tauri build      (ra target\release\bundle\nsis\AWord_*-setup.exe)
```
Chạy nhanh khi dev:  `npx tauri dev`

### KẾT QUẢ THỰC ĐO
| | AWord (Theia) | **AWord Lite (Tauri)** |
|---|---|---|
| Vỏ ứng dụng (không tính claude.exe) | ~430 MB (Electron 250 + Theia asar 178) | **8.3 MB** (aword-lite.exe) |
| Bộ cài (chưa đóng claude.exe) | 285 MB | **1.8 MB** |
| RAM lúc mở | vài trăm MB | **~26 MB** |
| Khởi động | vài giây (nặng) | gần như tức thì |

→ Vỏ nhẹ **8.3MB thay cho toàn bộ ~430MB Electron+Theia**. Phần nặng duy nhất còn lại là chính
`claude.exe` (242MB, động cơ AI, không bỏ được) — GIỐNG cả hai bản.

### Còn lại để thành sản phẩm hoàn chỉnh
- **Đóng kèm `claude.exe`** vào bộ cài Tauri (thêm vào `bundle.resources`) để cài offline độc lập
  → bộ cài ~245MB (vs Theia 285MB), nhưng vỏ vẫn 8MB. Hiện prototype tìm claude.exe có sẵn trên máy.
- Port nốt: xem docx/xlsx/pdf trong app (thư viện web), nút bố cục/cập nhật/kết nối kho, tự cập nhật.
- Ký số (chung với bản Theia) để hết cảnh báo antivirus/SmartScreen.

## Đánh giá
ĐÃ CHỨNG MINH ĐẦY ĐỦ: có thể loại bỏ toàn bộ phần lõi nặng Electron+Theia (~430MB → 8MB) mà vẫn
giữ nguyên động cơ AI, giao diện AWord, chat đa lượt. Đây là bằng chứng cho hướng "xử lý phần lõi nặng".
