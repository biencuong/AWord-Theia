# Bảng: fixed-layout để tôn trọng đúng độ rộng cột

## Vì sao chỉ `cell.width` là chưa đủ

Set `cell.width` không đủ để ép Word giữ đúng độ rộng đã định — Word vẫn tự động autofit lại theo
nội dung nếu bảng không ở chế độ fixed layout. Cần đồng thời:

- `table.autofit = False` và `table.allow_autofit = False`
- `w:tblLayout type="fixed"` (thay vì `autofit`, mặc định)
- `w:tblW type="dxa"` bằng tổng độ rộng các cột (đơn vị dxa/twips, 1cm = 567 twips)
- `w:tblGrid` với từng `w:gridCol` khớp đúng độ rộng từng cột

Thiếu bất kỳ phần nào trong 4 phần trên, bảng có thể vẫn co lại theo nội dung dù đã set
`cell.width` đúng — đây là nguyên nhân thực tế khiến 1 bảng phụ lục "chưa căn đủ rộng" dù đã set
width cho từng cell.

## Cách áp dụng đúng

```python
from nd30_shape_and_measure import set_table_fixed_layout

set_table_fixed_layout(table, widths_cm=[1.2, 5.5, 2.2, 2.2, 6.5, 5.5])
```

Hàm này làm đủ cả 4 phần ở trên trong 1 lần gọi, kể cả set lại `cell.width` cho mọi dòng.

Nếu tổng độ rộng mong muốn khác đúng usable-width của trang (khổ giấy trừ lề trái/phải), scale lại
tỷ lệ các cột trước khi gọi, để bảng luôn khớp khít trang — không hụt, không tràn lề.

## GIỚI HẠN BẮT BUỘC

**Chỉ áp dụng kỹ thuật này cho bảng tự tạo mới** (phụ lục, bảng số liệu, sổ đăng ký...).

**Tuyệt đối không áp dụng lên bảng lấy nguyên từ mẫu nguồn cần giữ nguyên** — quốc hiệu-tiêu ngữ +
tên cơ quan, khối "Nơi nhận", khối chữ ký. Các bảng này phải giữ đúng `table.autofit`/`tblLayout`
gốc của mẫu (thường không phải fixed, hoặc có tỷ lệ cột khác). Đổi layout của chúng sẽ phá vỡ tỷ lệ
trình bày mà người dùng yêu cầu giữ nguyên. Xem
`nd30-replicate-fixed-block-preservation.md`.

## Liên quan

- Với bảng phụ lục rộng cần nhiều cột, cân nhắc luôn cả khổ ngang — xem
  `nd30-landscape-appendix-section.md`.
- Nên đặt `WD_CELL_VERTICAL_ALIGNMENT.CENTER` cho mọi cell của bảng mới tạo, để chữ không dính sát
  mép trên khi các cột lệch số dòng.
