# Quy tắc spacing và line-spacing chuẩn

## Quy tắc đã đúc kết từ thực tế

Khi người dùng/mẫu yêu cầu spacing "chuẩn, đều đặn" cho toàn văn bản:

- `space_before = space_after = 6pt` cho **MỌI** đoạn văn — kể cả tiêu đề, trích yếu, không chỉ
  đoạn nội dung thân bài. (Chỉ set `space_after` mà bỏ qua `space_before` sẽ làm khoảng cách phía
  trên mỗi đoạn không đều — dễ nhận ra khi so 2 đoạn liền kề.)
- `line_spacing = 1.0` (single) **đồng nhất toàn văn bản**, không phân biệt heading/body.
- Tiêu đề/tên phụ lục dài phải word-wrap thành 2+ dòng: **không** giãn dòng riêng bên trong chính
  đoạn đó — tự động đúng nếu `line_spacing = 1.0` được set ngay trên paragraph đó (không cần xử lý
  gì thêm, vì single-spacing áp dụng cho mọi dòng trong cùng 1 paragraph).

```python
pf = paragraph.paragraph_format
pf.space_before = Pt(6)
pf.space_after = Pt(6)
pf.line_spacing = 1.0
```

## Đối chiếu với default hiện tại của skill

`create_nd30_docx.apply_pagination_controls()` dùng default **khác**:

- `role='body'`: `line_spacing=1.1`, `space_after=Pt(6)` (không set `space_before`)
- `role='title'/'heading'/...'`: `line_spacing=1.0`, `space_after=Pt(4)`

Đây là default lịch sử của skill cho văn bản hành chính nói chung (công văn, quyết định...) — vẫn
đúng NĐ30 (line spacing "giữa single và 1.5" theo `nd30-core-rules.md`), **không tự động đổi**
sang quy tắc 6pt/single ở trên cho mọi loại văn bản, để tránh phá vỡ layout đã ổn định của các
document family khác.

## Khi nào áp dụng quy tắc 6pt/single nghiêm ngặt

- Khi người dùng yêu cầu rõ ràng ("dãn dòng các khổ chữ là 6pt trên dưới", "Line spacing để là
  single").
- Khi replicate theo 1 mẫu báo cáo/văn bản đã xác nhận dùng đúng kiểu này (ví dụ mẫu báo cáo định
  kỳ của 1 Sở đã dùng ổn định qua nhiều kỳ).

Trong các trường hợp khác, giữ default của `apply_pagination_controls()`.
