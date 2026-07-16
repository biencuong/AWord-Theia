# Khổ ngang cho bảng phụ lục rộng

## Khi nào cần khổ ngang

Khi 1 bảng phụ lục có nhiều cột (thường ≥5-6 cột với nội dung câu dài), ép co cột lại cho vừa khổ
đứng làm chữ dồn/khó đọc. NĐ30 cho phép landscape "only when truly needed for wide tables" — dùng
cho riêng phần phụ lục đó, không đổi khổ toàn văn bản.

## Cách thêm section mới

```python
from nd30_shape_and_measure import add_landscape_section

new_section = add_landscape_section(doc, top_mm=20, bottom_mm=20, left_mm=20, right_mm=20)
```

Hàm này gọi `doc.add_section(WD_SECTION.NEW_PAGE)`, hoán đổi `page_width`/`page_height` sang A4
ngang, và set lại margin. Section mới **tự động kế thừa** header/footer (bao gồm PAGE field nếu đã
bật `ensure_page_numbers`) từ section trước, trừ khi bị đụng vào `header.is_linked_to_previous`.

## BẪY: mất section-break khi xoá nội dung

Nếu văn bản có **nhiều section** (ví dụ thân báo cáo khổ đứng + phụ lục khổ ngang) và cần xoá hàng
loạt paragraph/table (để thay nội dung thân bài), có nguy cơ **vô tình xoá luôn paragraph chứa
section-break** (`sectPr` nhúng trong `pPr` của 1 paragraph, đánh dấu ranh giới giữa 2 section).
Khi đó, phần còn lại sẽ **âm thầm kế thừa sectPr của section SAU** — ví dụ thân báo cáo bị lật
sang khổ ngang vì kế thừa nhầm sectPr của phần phụ lục.

Đây là lỗi thực tế đã xảy ra: sau khi xoá nội dung cũ để thay nội dung mới, toàn bộ thân báo cáo bị
đổi thành khổ ngang + lề sai, chỉ phát hiện được khi chạy audit thể thức.

**Quy tắc bắt buộc**: sau bất kỳ thao tác xoá hàng loạt paragraph/table nào trong văn bản nhiều
section, **luôn** gọi lại:

```python
from nd30_docx_tools import reset_section_page_setup

reset_section_page_setup(doc.sections[0], orientation='portrait', ...)
```

để đặt lại tường minh khổ giấy/hướng/lề cho section đầu — không được tin tưởng "giữ nguyên mặc
định sau khi xoá". `compose_from_source_docx.py::clear_body_preserve_sections()` đã áp dụng đúng
quy tắc này (chụp lại geometry gốc trước khi xoá, áp lại sau khi xoá) — dùng làm mẫu tham khảo nếu
tự viết logic xoá tương tự ở nơi khác.

## Đánh số trang cho section mới

Nếu section mới (landscape) không tự động có PAGE field đúng (ví dụ do `header.is_linked_to_previous`
bị tắt), gọi lại có chọn lọc:

```python
from nd30_docx_tools import ensure_page_numbers

ensure_page_numbers(doc, sections=[new_section])
```

Xem chi tiết cơ chế đánh số trang ở `nd30-page-numbering-technique.md`.
