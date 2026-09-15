# AWord Web đa người dùng — máy chủ (Giai đoạn 1)

Mỗi cán bộ, giáo viên đăng nhập bằng tài khoản cá nhân để dùng AWord trên trình duyệt. Mỗi tài khoản chạy một
**phiên cô lập** (container AWord Web riêng, chỉ thấy ổ dữ liệu của mình); mọi lượt gọi AI đi qua **Cổng AI** giữ khóa
của tổ chức và trừ **hạn mức tháng quy ra đồng**. Thiết kế đầy đủ: bản thiết kế "AWord Web đa người dùng" (15/9/2026).

## Quyết định đã chốt (15/9/2026)

| Mục | Chốt |
|---|---|
| Tạo tài khoản | Quản trị hệ thống / quản trị đơn vị tạo (lẻ hoặc nhập Excel/CSV, kèm số điện thoại); đổi mật khẩu lần đầu |
| Đăng nhập | Đơn giản: **mật khẩu** hoặc **Zalo qua số điện thoại** (mã 6 số gửi bằng Zalo ZNS). KHÔNG dùng xác thực hai lớp (người dùng chốt 15/9/2026: phức tạp) |
| Lịch sử trò chuyện | Đồng bộ tệp + bộ nhớ làm việc (`.aword/bo-nho`), không đồng bộ nguyên văn phiên Claude Code |
| Hạn mức | Quy ra **đồng** = số token × bảng giá từng mô hình |
| Kho tri thức AI | Bản quyền theo tài khoản/đơn vị thay cho mã máy (Giai đoạn 2) |
| Hết hạn thuê bao | Chỉ đọc 30 ngày → lưu trữ nguội 90 ngày → xóa có báo trước |
| Nhà cung cấp AI | Claude (Anthropic), DeepSeek (cổng tương thích Anthropic), Codex (OpenAI — dịch Anthropic Messages ↔ OpenAI Responses) |
| Môi trường phát triển | WSL2 + Ubuntu 24.04 + Docker Engine trên máy Windows (`moi-truong/Cai_WSL_Docker.cmd`) |

## Chạy

Node.js ≥ 24 chạy thẳng TypeScript (bỏ kiểu khi nạp) và có sẵn SQLite (`node:sqlite`) — **không có bước build,
không có module native, không có thư viện chạy ngoài Node**.

```bash
npm test                 # kiểm thử (node:test)
npm run kiem-tra         # kiểm tra kiểu bằng tsc (cần: npm install -D)
AWORD_WEB_BI_MAT=<32+ ký tự> node src/main.ts
```

Biến môi trường chính: xem `src/cau-hinh.ts` (`AWORD_WEB_*`, `AWORD_KHOA_ANTHROPIC|DEEPSEEK|OPENAI`).

## Cấu trúc và hợp đồng giữa các khối

```
src/
  main.ts                 khởi động: cấu hình → CSDL → Cổng AI + điều phối + cổng truy cập → HTTP
  cau-hinh.ts             đọc AWORD_WEB_* (khóa AI, bí mật chỉ ở biến môi trường)
  csdl/csdl.ts            node:sqlite, nâng cấp lược đồ theo PRAGMA user_version, giaoDich, thangViet, ghiNhatKy
  xac-thuc/ma-hoa.ts      scrypt mật khẩu, token, AES-256-GCM cho bí mật lưu CSDL
  xac-thuc/totp.ts        TOTP RFC 6238 (xác thực hai lớp)
  cong-ai/                Cổng AI
  cong-truy-cap/          đăng nhập, phiên cookie, định tuyến, trang quản trị + trang tài khoản
  dieu-phoi/              bộ điều phối phiên (trình docker | trình tiến trình cho phát triển), proxy HTTP/WebSocket
docker/                   ảnh AWord Web chạy Linux
moi-truong/               cài WSL2 + Docker cho máy phát triển Windows
test/                     node:test — không gọi mạng thật, nhà cung cấp AI giả lập bằng máy chủ HTTP cục bộ
```

Quy ước chung:
- Mã và tên định danh tiếng Việt không dấu, chú thích/thông báo người dùng tiếng Việt có dấu.
- Chỉ dùng thư viện chuẩn của Node (`node:http`, `node:crypto`, `node:sqlite`, `node:zlib`…). Cần thư viện ngoài thì hỏi trước.
- Mọi đường dẫn HTTP của máy chủ nằm dưới: `/ai/*` (Cổng AI), `/dang-nhap`, `/dang-xuat`, `/doi-mat-khau`,
  `/xac-thuc-hai-lop`, `/tai-khoan`, `/quan-tri`, `/api/*`, `/_aword/*` (tài nguyên tĩnh của cổng). Mọi đường dẫn khác —
  kể cả máy `{uuid}.webview.<tenMien>` — là của phiên AWord Web người đang đăng nhập, được proxy tới container.
- Mỗi khối xuất một **bộ xử lý** dạng `(req, res) => Promise<boolean>` (true = đã xử lý) để `main.ts` ghép.

### Cổng AI — `src/cong-ai/`
- `taoCongAi({ db, cauHinh, fetchFn? })` → `{ xuLy(req, res): Promise<boolean>, capToken(taiKhoanId, soGio): string, thuHoiToken(taiKhoanId): void }`.
- Nhận `POST /ai/v1/messages` (và `/ai/v1/messages/count_tokens`) theo định dạng Anthropic Messages từ Claude Code trong
  phiên: `ANTHROPIC_BASE_URL=<diaChiCongAiChoPhien>`, `ANTHROPIC_AUTH_TOKEN=<token>` (header `Authorization: Bearer`)
  hoặc `x-api-key`.
- Kiểm tra: token (bảng `token_ai`, lưu băm) → tài khoản `hoat_dong` và còn `han_dung` → mô hình có trong `bang_gia` và
  `bat=1` → hạn mức tháng (`SUM(chi_phi_dong)` theo `thangViet`) chưa hết. Từ chối trả lỗi dạng Anthropic
  `{"type":"error","error":{"type":"permission_error","message":"<tiếng Việt>"}}`.
- Định tuyến theo `bang_gia.nha_cung_cap`; thay `model` bằng `mo_hinh_goc`; chuyển tiếp streaming (SSE) nguyên vẹn,
  đọc `usage` để tính phí; ghi `su_dung_ai`.

### Cổng truy cập + quản trị — `src/cong-truy-cap/`
- `taoCongTruyCap({ db, cauHinh, dieuPhoi })` → `{ xuLy(req, res), xacThucYeuCau(req): Promise<TaiKhoanDangNhap | null> }`.
- Cookie phiên `aword_phien` HttpOnly, SameSite=Lax, `Domain=<tenMien>` (webview ở tên miền con cũng nhận), Secure khi https.
- Sai mật khẩu 5 lần → khóa 15 phút; tài khoản mới phải đổi mật khẩu lần đầu.
- Đăng nhập Zalo: chỉ số điện thoại quản trị đã gán; mã 6 số hết hạn 5 phút, sai 5 lần hủy mã, gửi lại sau 60 giây,
  tối đa 5 mã/số/ngày. Cấu hình Zalo Official Account qua `AWORD_ZALO_*` (thiếu thì ẩn cách đăng nhập này).

### Điều phối phiên — `src/dieu-phoi/`
- `taoDieuPhoi({ db, cauHinh, congAi })` → `{ damBaoPhien(taiKhoanId): Promise<{ diaChi: string }>, dungPhien(taiKhoanId), proxy(req, res, diaChi), proxyWebSocket(req, socket, head, diaChi) }`.
- Trình `docker` (Docker Engine API qua socket): ổ riêng `du-lieu/tai-khoan/<id>` đọc-ghi, thư mục hệ thống chỉ đọc, giới hạn
  RAM/CPU, mạng ra ngoài chỉ tới Cổng AI và MCP. Trình `tien-trinh` chỉ để phát triển (KHÔNG cô lập).
- Phiên không hoạt động quá `phutNguKhiRanh` → dừng, dữ liệu giữ nguyên; đăng nhập lại thì đánh thức.

## Nghiệm thu Giai đoạn 1
1. Hai tài khoản không đọc được tệp của nhau, kể cả khi nhờ AI chạy lệnh.
2. Hết hạn mức thì khung chat báo lỗi tiếng Việt.
3. Đăng nhập lại tiếp tục đúng cuộc trò chuyện.
