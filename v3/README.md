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

## Giai đoạn 2 — đóng gói Tauri (app ~15–20MB)

Bọc giao diện + backend bằng **Tauri** (Rust + WebView2) để ra 1 file cài nhẹ, khởi động ~1s,
RAM giảm 3–5 lần so với Electron. Cần cài trước:
- **Rust** (rustup): https://rustup.rs
- **Visual Studio Build Tools** với workload "Desktop development with C++" (link.exe/cl.exe) — Tauri
  trên Windows bắt buộc MSVC. (~6GB, 30–60 phút.)

Sau khi có toolchain: `npm create tauri-app`, đưa `frontend/` vào, chuyển `server.js` thành
Rust sidecar (hoặc giữ Node làm sidecar). `claude.exe` đóng kèm như tài nguyên.

## Đánh giá
Giai đoạn 1 đã CHỨNG MINH: vỏ nhẹ + `claude.exe` chạy được toàn bộ chat AWord với UI đúng như
hiện tại, **không cần Electron/Theia**. Phần nặng còn lại chỉ là `claude.exe` (242MB, động cơ AI,
không bỏ được). So với bản Theia (~900MB), bản Lite chỉ còn `claude.exe` + vài MB vỏ.
