# Đường kẻ ngang: border vs Shape Line (VML)

## 2 cách vẽ đường kẻ trong skill này

- **Border đoạn văn** (`w:pBdr`, hàm `create_nd30_docx.set_paragraph_bottom_border` /
  `add_rule_paragraph`): đường kẻ luôn kéo dài hết chiều rộng của paragraph/cell chứa nó. Dùng khi
  dựng văn bản **canonical mode** (không có mẫu nguồn, tự thiết kế layout từ đầu) — đơn giản,
  không cần đo chữ.
- **Shape Line thật** (VML `<w:pict><v:line>`, hàm
  `nd30_shape_and_measure.add_vml_line`/`add_shape_line_paragraph`): tương đương thao tác
  **Insert > Shapes > Line** trong Word. Dùng khi:
  - người dùng yêu cầu tường minh dùng Shape/Line của Office (không chấp nhận ký tự Unicode giả
    `───`/`___` hay border giả);
  - cần đường kẻ có độ dài **co giãn chính xác theo chữ phía trên** (border cell cố định không
    làm được việc này — nó luôn full-width).

**Không dùng ký tự Unicode** (`─`, `_`, `.`) để giả lập đường kẻ — độ dài không khớp với chữ phía
trên (khác font-weight/kerning giữa ký tự đó và chữ thật), nhìn "lơ lửng" không cân đối.

## Đo độ dài chữ thật bằng font-metrics

Không được ước lượng bằng mắt/đếm ký tự — sai lệch đáng kể trong thực tế (đã thử ước lượng tay 1
lần, sai gần gấp rưỡi so với độ dài thật). Dùng
`nd30_shape_and_measure.measure_text_width_pt(text, size_pt, bold=..., italic=...)` — đọc trực
tiếp font `.ttf` thật (Times New Roman qua Pillow `ImageFont`), đo ở scale lớn rồi quy đổi ngược về
điểm (pt) theo đúng size cần dùng.

## Quy tắc độ dài 2 đường kẻ cố định (đã đúc kết từ đối chiếu văn bản thực tế)

- Đường kẻ dưới **tiêu ngữ** `Độc lập - Tự do - Hạnh phúc`: dài **đúng bằng 100%** độ rộng đo thật
  của chính dòng chữ đó — vì đây là cụm cố định, giống hệt độ dài ở mọi văn bản.
- Đường kẻ dưới **tên cơ quan ban hành**: dài khoảng **60% (tối đa 2/3)** độ rộng đo thật của tên
  cơ quan — không kẻ hết cả dòng, vì tên cơ quan dài ngắn khác nhau tuỳ đơn vị.

Dùng `nd30_shape_and_measure.compute_rule_length_pt(text, size_pt, bold=True, kind='tieu-ngu'|'co-quan')`
để tính sẵn theo đúng 2 quy tắc trên.

## Cấu trúc XML VML line

```xml
<w:pict>
  <v:line id="_x0000_s1051"
          style="position:absolute;mso-position-horizontal:center;
                 mso-position-horizontal-relative:text;
                 mso-position-vertical-relative:text;z-index:1"
          from="0pt,2.0pt" to="{length_pt}pt,2.0pt"
          strokeweight="0.75pt" strokecolor="black"/>
</w:pict>
```

Cần đăng ký namespace `v` (`urn:schemas-microsoft-com:vml`) vào `docx.oxml.ns.nsmap` trước khi tạo
element `v:line` — python-docx không có sẵn namespace này (chỉ có `w`/`wp`/`a` cho DrawingML hiện
đại). `nd30_shape_and_measure.register_vml_namespace()` làm việc này (idempotent, gọi bao nhiêu
lần cũng an toàn) — `add_vml_line()` tự gọi hàm này, không cần gọi tay.

`offset_y_pt` nhỏ (mặc định 2pt) đặt đường kẻ sát ngay dưới dòng chữ hiện tại nhưng không dính vào
chân chữ.

## Khi nào KHÔNG dùng kỹ thuật này

Nếu khối chứa đường kẻ (quốc hiệu-tiêu ngữ, tên cơ quan) đến từ **mẫu nguồn cần giữ nguyên**, không
vẽ lại toàn bộ khối bằng Shape mới — chỉ **xoá text của ký tự giả cũ trong đúng paragraph rỗng đã
có sẵn** rồi chèn Shape vào đúng paragraph đó, giữ nguyên mọi thứ khác (width cell, cấu trúc bảng).
Xem `nd30-replicate-fixed-block-preservation.md`.
