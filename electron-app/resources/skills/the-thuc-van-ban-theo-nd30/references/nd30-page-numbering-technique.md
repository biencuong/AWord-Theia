# Đánh số trang theo NĐ30

## Vị trí số trang

Số trang đặt **giữa lề trên** (trong header), **không phải footer**. Trang đầu tiên (trang có
quốc hiệu-tiêu ngữ) **không hiển thị số trang**.

## Kỹ thuật different-first-page + PAGE field

```python
from nd30_docx_tools import ensure_page_numbers

ensure_page_numbers(doc)                       # ap dung cho MOI section
ensure_page_numbers(doc, sections=[new_section])  # chi ap dung cho 1 section cu the
```

Cơ chế bên trong (`nd30_docx_tools.ensure_page_numbers`):

1. `section.different_first_page_header_footer = True` — bật chế độ header trang đầu khác trang
   sau.
2. Chèn field `PAGE` (dùng `fldChar begin/instrText/separate/end`) vào paragraph đầu tiên của
   **header mặc định** (áp dụng cho trang 2 trở đi), căn giữa.
3. Xoá text của `section.first_page_header` — trang đầu tiên dùng header rỗng riêng, không thừa
   hưởng field PAGE từ header mặc định.

Nếu chỉ set `different_first_page_header_footer = True` mà không xử lý bước 3, Word vẫn có thể
hiện số trang ở trang đầu tùy version — luôn xử lý cả 2 bước để chắc chắn.

## Khi có landscape section phụ lục

1 section mới (xem `nd30-landscape-appendix-section.md`) mặc định kế thừa header của section
trước — bao gồm cả field PAGE, nên số trang thường tự động tiếp tục đúng mà không cần gọi lại gì.
Chỉ cần gọi lại `ensure_page_numbers(doc, sections=[new_section])` nếu:

- section mới có `header.is_linked_to_previous = False` (bị tách header riêng), hoặc
- cần xác nhận lại field PAGE tồn tại sau khi thao tác khác đã đụng vào header của section đó.

## Kiểm tra nhanh sau khi build

```python
sec = doc.sections[0]
assert sec.different_first_page_header_footer is True
assert 'PAGE' in sec.header.paragraphs[0]._p.xml
assert not sec.first_page_header.paragraphs[0].text  # trang dau khong co so
```
