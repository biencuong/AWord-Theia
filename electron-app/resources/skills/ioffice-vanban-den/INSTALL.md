# INSTALL — Cài đặt cho người dùng mới / đồng nghiệp

Trợ lý văn thư iOffice. Phần CHUNG (code + tri thức) cài từ repo; phần RIÊNG (`*.local.json`) mỗi
người tự tạo. Dữ liệu công vụ nằm trên máy mỗi người (không rời máy).

## 1. Yêu cầu hệ thống
- Python 3.10+ (đã test 3.14, Windows 11).
- WinRAR (UnRAR.exe) — giải nén `.rar`.
- MS Word **hoặc** LibreOffice — đọc `.doc` cũ.
- LLM cục bộ OpenAI-compatible có hỗ trợ ẢNH (vd **QwenPaw**) — cho OCR & soạn thảo.

## 2. Cài (3 bước)
```bat
pip install -r requirements.txt
playwright install chromium
```
Cấu hình riêng (`*.local.json`): KHÔNG cần tạo tay — lần đầu dùng, trợ lý sẽ HỎI tên đăng
nhập và **chỉ ghi `auth.local.json` xuống máy khi bạn đồng ý** (xem SKILL.md mục "Cấu hình
tài khoản — cơ chế ĐỒNG Ý"). Mật khẩu mặc định KHÔNG lưu — bạn tự đăng nhập trên cửa sổ
trình duyệt (`python scripts/fetch_vanban.py --login`). Ai muốn tạo tay: copy từ các file
`*.local.example.json`.
Lấy `chat_id` Telegram: nhắn 1 tin cho bot → `python scripts/telegram_send.py --discover`.

## 3. Dùng hằng ngày
```bat
python run_daily.py --digest          :: lấy VB + đẩy tóm tắt/điểm tin lên Telegram (đăng nhập khi cần)
python run_watcher.py                 :: chạy nền: nhận nút bấm + lệnh Telegram (auto-restart)
```
Trên Telegram: bấm nút mỗi văn bản, hoặc ra lệnh tự nhiên ("gửi tiếp 5 PH", "kết thúc 3 vừa gửi",
"trạng thái", "ping"). Soạn dự thảo: `python scripts/make_duthao.py "<số>" --send`.

## 4. Tích hợp QwenPaw (Nhánh B) — xem `MCP_SETUP.md`
Đăng ký `ioffice_mcp_server.py` làm MCP server trên QwenPaw → dùng 14 tool qua chat/lịch của QwenPaw.

## 5. Chia sẻ cho cả cơ quan
- CHUNG (git nội bộ): `scripts/`, `ioffice_mcp_server.py`, `bulk_ketthuc.py`, `run_*.py`,
  `skill_knowledge/`, `references/conventions.md`, `SKILL.md`, tài liệu.
- RIÊNG (mỗi người, KHÔNG commit): `*.local.json` + dữ liệu (`inbox/attachments/tri_thuc/...`).
- Sửa selector/quy trình ở repo chung → `git pull` là cả cơ quan đồng bộ.

## 6. An toàn (đọc `AGENTS.md` + `SKILL.md`)
- Mặc định CHỈ ĐỌC iOffice; thao tác đổi-trạng-thái (đóng/kết thúc) phải xác nhận + thử nhỏ + không hoàn tác.
- Đa phiên: tôn trọng khoá `scripts/iolock.py` (1 browser, 1 watcher). `python scripts/iolock.py` để xem.
- Bí mật để trong `*.local.json` (đã .gitignore). KHÔNG commit. Cân nhắc mã hoá (mục P5/DPAPI).
