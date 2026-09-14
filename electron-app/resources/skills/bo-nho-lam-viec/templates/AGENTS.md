# Chỉ dẫn cho trợ lý AI trong thư mục này

Tệp này dành cho MỌI công cụ AI làm việc trong thư mục (AWord/Claude Code, OpenAI Codex, Cursor,
GitHub Copilot, Gemini CLI...). Đọc trước khi bắt đầu nhiệm vụ.

- Quy tắc làm việc, cấu trúc thư mục, văn phong: xem `CLAUDE.md` (áp dụng cho mọi công cụ, không riêng Claude).
- Mọi tài liệu, tệp đầu ra tiếng Việt phải có đầy đủ dấu.

<!-- AWORD-BO-NHO:BEGIN -->
## Bộ nhớ làm việc — `.aword/bo-nho/` (thư mục ẩn)

Lưu ngữ cảnh xuyên phiên để phiên sau làm tiếp mà không phải lục lịch sử của từng công cụ.
Công cụ nào cũng đọc/ghi theo cùng quy ước dưới đây.

| Tệp | Nội dung | Cách ghi |
|---|---|---|
| `ban-giao.md` | Việc đang dở: trạng thái, bước tiếp theo, tệp liên quan | Thêm khi dừng giữa chừng; XÓA mục khi xong |
| `ngan-han.md` | Tóm tắt phiên gần nhất | GHI ĐÈ mỗi phiên |
| `dai-han.md` | Thông tin bền vững về người dùng, đơn vị, lớp/môn, dự án, quy ước đã chốt | Chỉ cập nhật/bổ sung |
| `kinh-nghiem.md` | Vướng mắc đã gặp và cách xử lý | `[dd/mm/yyyy] — vấn đề → cách xử lý → ghi chú` |
| `thoi-quen.md` | Thói quen, cách làm lặp lại ≥ 2 lần của người dùng | Chỉ ghi khi đã lặp lại |

**Đầu phiên có nhiệm vụ:** đọc `ban-giao.md` (có việc dở thì hỏi người dùng có làm tiếp không) rồi
`ngan-han.md`; việc phức tạp/thuộc dự án thì đọc thêm `dai-han.md`, `kinh-nghiem.md`, `thoi-quen.md`.

**Khi ghi** (kết thúc phiên, xong việc lớn, vừa gỡ được vướng mắc, người dùng dặn nhớ) — chọn ĐÚNG MỘT
tệp theo thứ tự: chưa xong → `ban-giao.md`; chỉ đúng cho phiên này → `ngan-han.md`; lỗi + cách xử lý →
`kinh-nghiem.md`; thói quen lặp ≥ 2 lần → `thoi-quen.md`; bền vững → `dai-han.md`; không thuộc loại nào → không ghi.

**Quy tắc:** không ghi mật khẩu/mã khóa/token/số định danh cá nhân; không bịa — chỉ ghi điều đã thấy;
ngắn gọn (`ban-giao.md` ≤ 60 dòng, `ngan-han.md` ≤ 40 dòng); không xóa tệp, chỉ sửa nội dung.

**Công cụ không tự đọc AGENTS.md** (vd Gemini CLI mặc định đọc GEMINI.md): cấu hình tên tệp ngữ cảnh
của công cụ thành `AGENTS.md`, hoặc dán nội dung tệp này vào phần chỉ dẫn/quy tắc dự án của công cụ đó.
<!-- AWORD-BO-NHO:END -->
