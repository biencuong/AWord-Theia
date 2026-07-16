# Quy trình soạn thảo văn bản end-to-end

Quy trình tổng quát khi nhận 1 yêu cầu soạn thảo thực tế (không chỉ báo cáo NQ57 — áp dụng cho mọi
loại văn bản hành chính cần soạn theo NĐ30), từ lúc đọc yêu cầu đến khi giao file hoàn chỉnh. Đây
là bước **triage** đứng trước các mode A-E ở `SKILL.md` — quyết định dùng mode/chiến lược nào, chứ
không thay thế chúng.

## Bước 1: Đọc văn bản yêu cầu/chỉ đạo

Đọc kỹ công văn/chỉ đạo/đề cương làm căn cứ soạn thảo, xác định:

- **Loại văn bản cần soạn** — dùng `nd30-document-type-matrix.md` để chọn đúng `document_type`.
- **Kỳ báo cáo/phạm vi trách nhiệm** — kỳ nào, đơn vị nào chịu trách nhiệm phần nào (khi văn bản là
  báo cáo tổng hợp nhiều đơn vị, xác định rõ phần việc của riêng đơn vị đang soạn).
  cơ quan/đơn vị nhận.
- Nếu có **đề cương bắt buộc** kèm theo (cấu trúc phần/mục cố định do cấp trên quy định), bám sát
  đúng đề cương đó — không tự ý gộp/đổi tên mục.

## Bước 2: Xác định nguồn dữ liệu

Nguồn dữ liệu điển hình: báo cáo kỳ trước (đọc bằng skill đọc tài liệu cục bộ), phụ lục/số liệu
kèm theo, kế hoạch/quyết định liên quan đang có hiệu lực, chỉ đạo cấp trên mới nhất.

Quy tắc: khi thiếu dữ liệu (số liệu, ngày ban hành văn bản viện dẫn, tên người ký...), **hỏi người
dùng**, không tự bịa. Với mọi văn bản được viện dẫn làm căn cứ, cố gắng lấy đủ **số ký hiệu + ngày
ban hành** — nếu không có sẵn trong bất kỳ nguồn nào đã cung cấp, để trống rõ ràng kèm ghi chú, và
hỏi người dùng thay vì đoán.

## Bước 3: Chọn mẫu

Thứ tự ưu tiên:

1. **Mẫu người dùng/cơ quan đã dùng trước đó** (nếu có cung cấp hoặc tìm thấy trong thư mục làm
   việc) — ưu tiên `scripts/clone_patch_docx.py` (giữ 100% format, chỉ vá placeholder/text); nếu
   mẫu không có placeholder rõ, dùng `scripts/compose_preserve_fixed_blocks.py`
   (`--replicate-strategy preserve-fixed-blocks`) để giữ nguyên khối cố định (xem
   `nd30-replicate-fixed-block-preservation.md`).
2. **Mẫu built-in** trong `assets/templates/`.
3. **Dựng canonical NĐ30** (`scripts/create_nd30_docx.py`) nếu không có mẫu nào phù hợp.

## Bước 4: Sinh nội dung + kiểm soát thể thức

Thứ tự khuyến nghị khi build (mỗi bước có thể bỏ qua nếu văn bản không cần):

1. Sinh nội dung (theo đúng đề cương, giữ nguyên khối cố định nếu replicate).
2. Áp quy tắc spacing (`nd30-spacing-and-line-rules.md` — chỉ khi người dùng yêu cầu rõ, mặc định
   giữ nguyên `apply_pagination_controls`).
3. Table fixed-layout cho bảng **mới tạo** (`nd30-table-fixed-layout.md`).
4. Thêm landscape section nếu có bảng phụ lục rộng (`nd30-landscape-appendix-section.md`) — chú ý
   bẫy mất section-break khi xoá nội dung.
5. Thêm Shape Line nếu cần đường kẻ khớp chữ (`nd30-line-rules-and-vml-shapes.md`).
6. Sửa từ mồ côi — **luôn ở bước cuối cùng**, sau khi mọi định dạng đã chốt
   (`nd30-orphan-word-control.md`).
7. Chạy `scripts/check_nd30_docx.py`, đối chiếu với audit trên mẫu gốc chưa sửa để phân biệt cảnh
   báo có sẵn với lỗi mới (`nd30-safe-iterative-build-workflow.md`).

## Bước 5: Đầu ra

Bắt buộc gồm:

- File `.docx` hoàn chỉnh.
- Tóm tắt kết quả kiểm soát thể thức gửi người dùng: đã kiểm tra/sửa những gì, cảnh báo nào còn
  tồn đọng (và tại sao chưa/không thể tự sửa — ví dụ thiếu dữ liệu cần người dùng bổ sung). Không
  coi việc soạn thảo là "xong" chỉ vì file đã lưu — cần người dùng xác nhận trước khi bàn giao
  chính thức, đặc biệt với các chỗ còn để trống (số ký hiệu, ngày ban hành chưa xác định).
