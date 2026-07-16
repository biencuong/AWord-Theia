# Replicate mode: giữ nguyên khối cố định

## Khối cố định là gì

Khi replicate từ 1 mẫu nguồn có sẵn, 4 khối sau là **cố định** — không được rebuild:

- Quốc hiệu - tiêu ngữ (`CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM` / `Độc lập - Tự do - Hạnh phúc`)
- Tên cơ quan ban hành (kể cả cơ quan chủ quản phía trên nếu có)
- Khối `Nơi nhận`
- Khối chữ ký (`TM./KT./TL./Q.` + chức vụ + tên người ký)

## Chỉ được làm 2 việc với các khối này

1. Sửa **TEXT** bên trong run có sẵn (giữ nguyên `rPr`/`pPr` của run/paragraph đó).
2. Chèn **thêm** nội dung mới vào đúng vị trí đã có (ví dụ thêm 1 Shape Line vào 1 paragraph
   rỗng có sẵn — xem `nd30-line-rules-and-vml-shapes.md`).

**Tuyệt đối không**: đổi width cột bảng, đổi table layout, tạo lại paragraph/run từ đầu, hay gọi
`cell.text = "..."` lên 1 cell có định dạng phức tạp (nhiều run khác kiểu nhau trong cùng ô).

Ví dụ lỗi thực tế đã xảy ra: gọi `cell.text = ""` rồi viết lại toàn bộ nội dung ô "Nơi nhận" bằng
1 run duy nhất (dùng `add_break()` giữa các dòng) đã làm mất định dạng gốc — dòng `Nơi nhận:` đáng
lẽ đậm-nghiêng riêng, các dòng `- ...` bên dưới đáng lẽ chữ thường, nhưng vì viết lại bằng 1 run
nên khi set `italic=True` cho "cả đoạn" đã làm TOÀN BỘ khối bị nghiêng hết. Cách đúng: giữ nguyên
số lượng run gốc, chỉ gán lại `.text` cho từng run theo đúng vị trí.

## `generate_replicate_shell()` KHÔNG bảo toàn khối cố định

`scripts/generate_from_profile_and_content.py::generate_replicate_shell()` (dùng khi
`--mode replicate --replicate-strategy shell-rebuild`, cũng là fallback mặc định của `auto`) gọi
`clear_body_preserve_sections()` rồi `build()` — hàm `build()` này **rebuild toàn bộ** khối cố định
bằng các hàm cứng của `create_nd30_docx.py` (`three_zone_table(widths=(7.2, 1.2, 8.0))`,
`signature_block`...). Nó chỉ giữ khổ giấy/lề/header-footer ở cấp *section*, không đọc lại width
cột hay cấu trúc paragraph/run gốc của mẫu người dùng cung cấp.

Chỉ dùng shell-rebuild khi người dùng chấp nhận layout tổng thể gần giống nhưng **không** cần đúng
tỷ lệ mẫu gốc.

## Thứ tự ưu tiên chiến lược khi có mẫu nguồn cần giữ đúng tỷ lệ

1. `scripts/clone_patch_docx.py` — giữ 100% định dạng, chỉ vá text tại các vị trí có placeholder
   hoặc anchor ổn định. Ưu tiên hàng đầu khi mẫu có sẵn placeholder.
2. `scripts/compose_preserve_fixed_blocks.py` (`--replicate-strategy preserve-fixed-blocks`) —
   giữ nguyên khối đầu (header) và khối cuối (Nơi nhận/chữ ký) byte-for-byte, chỉ rebuild phần
   thân bài nằm giữa 2 khối đó. Dùng khi mẫu không có placeholder rõ nhưng vẫn cần giữ đúng tỷ lệ
   khối cố định. Xem chi tiết cách hoạt động, giới hạn phạm vi (chỉ xử lý vùng giữa header và
   "Nơi nhận", không đụng nội dung sau đó) trong docstring của script.
3. Shell-rebuild (`generate_replicate_shell`) — chỉ dùng khi 2 cách trên không khả thi (mẫu không
   có placeholder VÀ cấu trúc quá bất thường để tự động xác định ranh giới khối cố định). Phải
   cảnh báo người dùng rõ ràng rằng khối cố định sẽ không giữ đúng tỷ lệ mẫu gốc.

`choose_replicate_strategy()` mặc định **không bao giờ** tự chọn `preserve-fixed-blocks` — đây là
lựa chọn opt-in, người dùng/agent phải biết mẫu cần giữ nguyên và truyền tường minh
`--replicate-strategy preserve-fixed-blocks`.

## Liên quan

- `nd30-table-fixed-layout.md` — kỹ thuật fixed-layout chỉ dùng cho bảng **tự tạo mới**, không
  dùng cho bảng lấy từ mẫu (đúng nguyên tắc ở trên).
- `nd30-line-rules-and-vml-shapes.md` — khi cần thêm đường kẻ vào 1 khối cố định, chỉ chèn thêm
  Shape, không vẽ lại cả khối.
- `nd30-safe-iterative-build-workflow.md` — quy trình build lặp lại an toàn khi phải sửa nhiều
  vòng theo phản hồi.
