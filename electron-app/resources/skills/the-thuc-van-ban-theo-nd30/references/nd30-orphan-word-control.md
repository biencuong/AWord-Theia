# Xử lý từ mồ côi (orphan word)

## Phân biệt `widowControl` chuẩn Word vs "từ mồ côi" thật

`w:widowControl` (bật mặc định trong Word, và trong `create_nd30_docx.apply_pagination_controls`)
chỉ tránh 1 **DÒNG** đơn độc bị tách đầu/cuối **TRANG** (widow/orphan line theo thuật ngữ dàn
trang cổ điển). Nó **không** phát hiện hay xử lý trường hợp 1 **TỪ** đơn lẻ trôi xuống dòng cuối
cùng của 1 **ĐOẠN VĂN** justify (ví dụ đoạn văn dài, dòng cuối chỉ còn đúng 1 từ ngắn) — đây là 2
vấn đề khác nhau. Skill này gọi trường hợp thứ 2 là "từ mồ côi" thật, và nó KHÔNG được `widowControl`
xử lý.

## Thuật toán mô phỏng word-wrap

Không có LibreOffice/Poppler để render thật và đo trực tiếp trên máy trong mọi môi trường, nên cần
mô phỏng ngắt dòng bằng font-metrics thật (xem `nd30-line-rules-and-vml-shapes.md` về
`measure_text_width_pt`):

1. Đọc `size_pt`/`bold` **thật** từ run đầu tiên của đoạn (không giả định giá trị mặc định).
2. Cộng dồn độ rộng từng từ (đo bằng font thật) so với usable-width của cột (trừ first-line-indent
   ở dòng đầu tiên), ngắt sang dòng mới khi vượt quá.
3. Nếu dòng cuối cùng sau mô phỏng chỉ còn **đúng 1 từ** → coi là mồ côi.

```python
from nd30_shape_and_measure import fix_orphan_if_present

changed = fix_orphan_if_present(
    paragraph,
    column_width_cm=16.0,           # usable width cua cot/trang chua doan nay
    first_line_indent_cm=1.25,      # thut le dong dau, neu co
)
```

## Mức condense an toàn: 0.2–0.5pt, KHÔNG hơn

Khi phát hiện mồ côi, kéo bớt 1 chữ vào dòng trên bằng cách thu hẹp khoảng cách ký tự
(`w:spacing`, character tracking) — nhưng mức thu hẹp **bắt buộc nằm trong 0.2–0.5pt** (tức -4 đến
-10 twips, vì 1pt = 20 twips).

**Cấm dùng mức lớn hơn 0.5pt** (ví dụ 2.5pt/-50 twips đã từng dùng thử) — mức lớn làm **chữ dính/
lồng vào nhau**, đây là lỗi thực tế đã xảy ra và bị người dùng phản hồi ngay khi nhìn thấy file.
`nd30_shape_and_measure.condense_paragraph_runs()` tự raise `ValueError` nếu truyền `twips` ngoài
khoảng `[-10, -4]`, để lỗi này không lặp lại.

Vì mức condense rất nhẹ, kỹ thuật này **không đảm bảo cứu được mọi trường hợp mồ côi** (từ dài,
đoạn ngắn dòng cuối vẫn có thể còn 1 từ dù đã condense) — đây là đánh đổi chủ động ưu tiên "không
làm hỏng chữ" hơn "luôn triệt để hết mồ côi".

## Thứ tự gọi bắt buộc

Chỉ gọi `fix_orphan_if_present`/`detect_orphan_last_line` **SAU KHI** đoạn văn đã hoàn thiện toàn
bộ định dạng cuối cùng (size/bold/italic của từng run đã chốt) — vì hàm đọc định dạng **hiện tại**
của run để mô phỏng, gọi giữa chừng pipeline dựng văn bản (trước khi set size/italic cuối) sẽ cho
kết quả sai.
