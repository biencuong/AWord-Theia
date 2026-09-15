# AWord Web đa người dùng — máy chủ (Giai đoạn 1)

Mỗi cán bộ, giáo viên đăng nhập bằng tài khoản cá nhân để dùng AWord trên trình duyệt. Mỗi tài khoản chạy một
**phiên cô lập** (container AWord Web riêng, chỉ thấy ổ dữ liệu của mình); mọi lượt gọi AI đi qua **Cổng AI** giữ khóa
của tổ chức và trừ **hạn mức tháng quy ra đồng**. Thiết kế đầy đủ: bản thiết kế "AWord Web đa người dùng" (15/9/2026).

## Quyết định đã chốt (15/9/2026)

| Mục | Chốt |
|---|---|
| Tạo tài khoản | Quản trị hệ thống / quản trị đơn vị tạo (lẻ hoặc nhập Excel/CSV); mỗi tài khoản có email và/hoặc số điện thoại; đổi mật khẩu lần đầu |
| Đăng nhập | Đơn giản: **email hoặc số điện thoại + mật khẩu**. KHÔNG xác thực hai lớp, KHÔNG đăng nhập Zalo (người dùng chốt 15/9/2026). Quên mật khẩu: quản trị đặt lại |
| Lịch sử trò chuyện | Đồng bộ tệp + bộ nhớ làm việc (`.aword/bo-nho`), không đồng bộ nguyên văn phiên Claude Code |
| Hạn mức | Quy ra **đồng** = số token × bảng giá từng mô hình |
| Kho tri thức AI | Bản quyền theo tài khoản/đơn vị thay cho mã máy (Giai đoạn 2) |
| Hết hạn thuê bao | Chỉ đọc 30 ngày → lưu trữ nguội 90 ngày → xóa có báo trước |
| Nhà cung cấp AI | Claude (Anthropic), DeepSeek (cổng tương thích Anthropic), Codex (OpenAI — dịch Anthropic Messages ↔ OpenAI Responses) |
| Môi trường phát triển | WSL2 + Ubuntu 24.04 + Docker Engine trên máy Windows (`moi-truong/Cai_WSL_Docker.cmd`) |

## Chạy

Node.js ≥ 24 chạy thẳng TypeScript (bỏ kiểu khi nạp) và có sẵn SQLite (`node:sqlite`) — **không có bước build,
không có module native, không có thư viện chạy ngoài Node** (TypeScript + @types/node chỉ để kiểm tra kiểu).

```bash
npm install              # chỉ cài công cụ kiểm tra kiểu (devDependencies)
npm test                 # kiểm thử (node:test) — trên Windows dùng npm test, không dùng "node --test test/"
npm run kiem-tra         # kiểm tra kiểu bằng tsc
AWORD_WEB_BI_MAT=<32+ ký tự> node src/main.ts tao-quan-tri qt@so.gov.vn "Nguyễn Văn A"   # quản trị đầu tiên
AWORD_WEB_BI_MAT=<32+ ký tự> node src/main.ts
```

Biến môi trường chính: xem `src/cau-hinh.ts` (`AWORD_WEB_*`, `AWORD_KHOA_ANTHROPIC|DEEPSEEK|OPENAI`). Chạy thử trên máy
Windows không có Docker: `AWORD_WEB_TRINH_DIEU_PHOI=tien-trinh` (KHÔNG cô lập) — cần đã build `browser-app` và
`theia rebuild:browser`; mở `http://aword.localhost:8080/`.

## Tên miền — hai nguồn gốc tách biệt

| Máy | Phục vụ |
|---|---|
| `<tenMien>` (vd `web.aword.vn`, thử: `aword.localhost`) | đăng nhập, đổi mật khẩu, tài khoản, quản trị, `/api/*`, `/_aword/*`; `/` → sang phiên |
| `<tenMienUngDung>` (mặc định `app.<tenMien>`) và `{uuid}.webview.<tenMienUngDung>` | phiên AWord của người đang đăng nhập (proxy vào container) |
| mọi máy khác máy của phiên, đường dẫn `/ai/*` | Cổng AI (phiên gọi qua `ANTHROPIC_BASE_URL`) |

Mã chạy trong phiên do người dùng/AI điều khiển nên KHÔNG được cùng nguồn gốc với trang quản trị: từ máy của phiên không
đọc được trang cổng (không lấy được token CSRF) và API cổng kiểm Origin. Cookie `aword_phien` đặt `Domain=<tenMien>` để
máy của phiên nhận; proxy bỏ mọi cookie `aword_*` trước khi vào phiên. Triển khai thật cần chứng chỉ cho `<tenMien>`,
`<tenMienUngDung>` và wildcard `*.webview.<tenMienUngDung>`.

## Cấu trúc

```
src/
  main.ts                 khởi động: dòng lệnh, cấu hình → CSDL → Cổng AI + điều phối + cổng truy cập → lắng nghe, hẹn giờ
  may-chu.ts              máy chủ HTTP: định tuyến theo tên máy (bảng trên), WebSocket
  cau-hinh.ts             đọc AWORD_WEB_* (khóa AI, bí mật chỉ ở biến môi trường)
  csdl/csdl.ts            node:sqlite, nâng cấp lược đồ theo PRAGMA user_version, giaoDich, thangViet, ghiNhatKy
  xac-thuc/ma-hoa.ts      scrypt mật khẩu, token, AES-256-GCM cho bí mật lưu CSDL
  xac-thuc/totp.ts        TOTP RFC 6238 — KHÔNG dùng (người dùng chốt bỏ xác thực hai lớp), giữ cho nhu cầu sau
  cong-ai/                Cổng AI
  cong-truy-cap/          đăng nhập, phiên cookie, trang quản trị + trang tài khoản
  tai-khoan/              tạo tài khoản, nhập danh sách Excel (.xlsx tự đọc) / CSV
  dieu-phoi/              bộ điều phối phiên (trình docker | trình tiến trình cho phát triển), proxy HTTP/WebSocket
docker/                   ảnh AWord Web chạy Linux (chưa build thử — cần Docker)
moi-truong/               cài WSL2 + Docker cho máy phát triển Windows
test/                     node:test — không gọi mạng thật, nhà cung cấp AI giả lập bằng máy chủ HTTP cục bộ
```

Quy ước chung:
- Mã và tên định danh tiếng Việt không dấu, chú thích/thông báo người dùng tiếng Việt có dấu.
- Chỉ dùng thư viện chuẩn của Node (`node:http`, `node:crypto`, `node:sqlite`, `node:zlib`…). Cần thư viện ngoài thì hỏi trước.

### Cổng AI — `src/cong-ai/`
- `taoCongAi({ db, cauHinh, fetchFn?, bayGio?, gioiHanThanByte?, hanGioByteDauMs?, hanGioTongMs? })` →
  `{ xuLy, capToken(taiKhoanId, soGio), thuHoiToken(taiKhoanId), daDungThang(taiKhoanId, thang?) }`; `napBangGiaMacDinh(db)`
  chèn các mô hình mẫu ĐANG TẮT, giá 0 — quản trị nhập giá thật (đồng/1 triệu token) rồi bật.
- Nhận `POST /ai/v1/messages` (và `count_tokens`) dạng Anthropic Messages; token phiên ở `Authorization: Bearer` hoặc `x-api-key`.
- Kiểm tra: token (401) → tài khoản `hoat_dong`, còn `han_dung` → mô hình có trong `bang_gia`, `bat=1` → hạn mức tháng.
  Từ chối theo chính sách trả **400** `invalid_request_error` với thông điệp tiếng Việt: Claude Code coi 401/403 là lỗi đăng
  nhập (hiện "Failed to authenticate" + màn hình đăng nhập Claude), còn 429/5xx thì tự thử lại vô ích. Nhà cung cấp từ chối
  khóa tổ chức (401/403) → 503 "Khóa AI của tổ chức… không hợp lệ" cho quản trị.
- Anthropic/DeepSeek chuyển tiếp nguyên vẹn (SSE), OpenAI dịch sang Responses API; ghi `su_dung_ai` theo token thực tế.

### Cổng truy cập + quản trị — `src/cong-truy-cap/`, `src/tai-khoan/`
- `taoCongTruyCap({ db, cauHinh, dieuPhoi, congAi, bayGio? })` → `{ xuLy(req, res): Promise<boolean>, xacThucYeuCau(req): TaiKhoanDangNhap | null }`
  (đồng bộ); `TaiKhoanDangNhap = { id, hoTen, email, soDienThoai, vaiTro, donViId }`; `taoQuanTriDauTien(db, emailHoacSoDienThoai, hoTen)`.
- Đăng nhập: email hoặc số điện thoại + mật khẩu; sai 5 lần → khóa 15 phút; giới hạn theo IP; mật khẩu tạm phải đổi lần đầu.
- Trang quản trị: tài khoản (tạo lẻ, nhập Excel/CSV có xem trước và lỗi từng dòng, khóa/mở, đặt lại mật khẩu, vai trò, đơn vị,
  hạn dùng, hạn mức tháng), đơn vị và bảng giá (quản trị hệ thống), nhật ký. Quản trị đơn vị chỉ trong đơn vị mình.
- CSP `form-action 'self' <scheme>://<tenMienUngDung>:*` — biểu mẫu đăng nhập chuyển hướng qua `/` sang máy của phiên.

### Điều phối phiên — `src/dieu-phoi/`
- `taoDieuPhoi({ db, cauHinh, congAi, trinh?, … })` → `{ damBaoPhien, dungPhien, ghiNhanHoatDong, quetNgu, proxy, proxyWebSocket,
  dungTatCa, trangThai, xuLy(req, res, taiKhoanId), xuLyWebSocket(req, socket, head, taiKhoanId) }`.
- Mỗi lần khởi động phiên: token Cổng AI mới (thu hồi token cũ), env `ANTHROPIC_BASE_URL/AUTH_TOKEN`, `HOME`, `AWORD_HOME`,
  `CLAUDE_CONFIG_DIR`, `THEIA_CONFIG_DIR`, `AWORD_CHE_DO=web-da-nguoi-dung`; ghi `.theia/settings.json`:
  `security.workspace.trust.enabled=false`, `claudeCode.disableLoginPrompt=true` (không đè thiết lập khác).
- Trình `docker`: ổ riêng rw, thư mục hệ thống ro, user 1000, CapDrop ALL, no-new-privileges, giới hạn RAM/CPU/PID, mạng
  `aword-phien` tắt liên lạc giữa container; ngủ = dừng và xóa container (dữ liệu ở ổ riêng). Trình `tien-trinh` chỉ để phát triển.
- Proxy giữ nguyên Host (Theia kiểm Origin của WebSocket và vhost webview theo Host).

## Nghiệm thu Giai đoạn 1
1. Hai tài khoản không đọc được tệp của nhau, kể cả khi nhờ AI chạy lệnh. — *chờ Docker (trình tien-trinh không cô lập)*
2. Hết hạn mức thì khung chat báo lỗi tiếng Việt. — *ĐẠT 15/9/2026 (thử thật qua trình tien-trinh: khung chat Claude Code
   hiện "API Error: 400 Mô hình … đang tắt trên Cổng AI…", không hiện màn hình đăng nhập Claude)*
3. Đăng nhập lại tiếp tục đúng cuộc trò chuyện. — *chưa thử*
