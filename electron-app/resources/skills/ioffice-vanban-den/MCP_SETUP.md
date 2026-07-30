# MCP_SETUP — Đăng ký server `ioffice-vanban` (lớp chia sẻ Nhánh B)

`ioffice_mcp_server.py` là **MCP server** phơi năng lực xử lý Văn bản đến iOffice thành tool dùng
chung. QwenPaw (hỗ trợ MCP) và Claude Code/Desktop đều nối vào cùng server này.

## Tool có sẵn (10)
**Đọc (an toàn):** `get_status`, `list_documents(role, limit, only_need_draft)`,
`get_document(so_ky_hieu)`, `search_documents(keyword)`, `list_close_queue`.
**Cập nhật (không browser):** `rebuild_index`, `rebuild_knowledge`, `queue_close(so_ky_hieu_list)`.
**Mở browser / đổi trạng thái (cảnh báo, tôn trọng khoá `browser`):** `fetch_inbox(headless)`,
`run_close_queue` (⚠️ ĐÓNG THẬT, không hoàn tác — chỉ đóng những gì đã xếp hàng + xác nhận trước).

## Cài đặt
```
pip install "mcp[cli]"
python ioffice_mcp_server.py     # chạy thử (stdio)
```

## Đăng ký với QwenPaw (hỗ trợ MCP)
QwenPaw → mục **MCP / MCP Registry** → thêm MCP server kiểu **stdio**:
- command: `python` (hoặc đường dẫn python đầy đủ)
- args: `["D:\\CODE\\09_ioffice-vanban-den\\ioffice_mcp_server.py"]`
- cwd: `D:\CODE\09_ioffice-vanban-den`
Sau đó tạo **QwenPaw skill** "văn thư iOffice" dùng các tool trên + kênh Telegram + Heartbeat (lịch
chạy `fetch_inbox` mỗi sáng). Tri thức nghiệp vụ (cách dùng tool đúng, mẫu) lấy từ `SKILL.md`.

## Đăng ký với Claude Code (CLI)
```
claude mcp add ioffice -- python D:\CODE\09_ioffice-vanban-den\ioffice_mcp_server.py
```
(hoặc thêm vào `.mcp.json` của dự án). Sau đó Claude gọi được `get_status`, `list_documents`, ...

## Chia sẻ cho đồng nghiệp (xem plan Mục L)
- **Chung** (git nội bộ): `ioffice_mcp_server.py` + `scripts/` (lõi) + `SKILL.md`/`conventions.md`/templates.
- **Riêng** (mỗi người): `*.local.json` (iOffice/Telegram/LLM) + dữ liệu công vụ (`inbox/attachments/...`).
- Mỗi đồng nghiệp: clone repo chung → tạo `*.local.json` riêng → đăng ký MCP trên QwenPaw máy mình.
  Selector/quy trình cập nhật tập trung qua git → cả cơ quan đồng bộ. Dữ liệu KHÔNG rời máy cá nhân.

## Lưu ý an toàn
- Tool stdio: KHÔNG in ra stdout trong tool (hỏng giao thức) — các tool gọi `build_*` đã chặn stdout.
- `fetch_inbox`/`run_close_queue` mở browser + cần đăng nhập (captcha) → không hoàn toàn tự động;
  tôn trọng khoá đa phiên (`scripts/iolock.py`). `run_close_queue` chỉ đóng nội dung đã xếp hàng.
