# Bố cục slide (khổ 16:9)

Slide 16:9 = **13,333 × 7,5 inch**. Mọi tọa độ dưới đây tính bằng inch, dùng thẳng với `Inches(...)` của python-pptx.

## 1. Lưới và vùng an toàn

- Lề trái/phải **0,6"**; lề trên **0,5"**; lề dưới **0,45"**. Không đặt chữ ra ngoài vùng này.
- Bề rộng dùng được: **12,133"**. Lưới 12 cột: mỗi cột **0,828"**, máng giữa hai cột **0,2"**.
- Dải tiêu đề: y = **0,5 → 1,25"**. Nội dung: y = **1,55 → 6,55"**. Chân slide: y = **6,8 → 7,15"**.
- Khoảng cách tối thiểu giữa hai khối: **0,25"**. Chữ cách mép khung trong của nó ít nhất **0,1"**.
- Mọi slide nội dung phải thẳng lề trái 0,6" — đây là thứ người nghe nhận ra ngay khi bài bị lệch.

## 2. Mười hai bố cục mẫu

Ký hiệu: (x, y, rộng, cao).

### 2.1 Bìa
Nền màu chủ đạo, chữ trắng.
- Logo: (0,6 · 0,5 · 1,0 · 1,0) — nếu có.
- Tên cơ quan: (0,9 · 1,8 · 11,5 · 0,5) 18pt, viết hoa, giãn chữ nhẹ.
- Tiêu đề: (0,9 · 2,6 · 11,5 · 1,7) 44pt đậm, tối đa 2 dòng.
- Phụ đề / căn cứ: (0,9 · 4,4 · 11,5 · 0,8) 22pt.
- Người trình bày – địa điểm – ngày: (0,9 · 6,2 · 11,5 · 0,6) 16pt.

### 2.2 Mục lục
- Tiêu đề "Nội dung": dải tiêu đề chuẩn.
- Mỗi mục i (0..n-1), y = 1,9 + i × 1,05:
  - Số thứ tự trong hình tròn nền màu nhấn: (0,6 · y · 0,7 · 0,7), chữ trắng 20pt đậm, canh giữa.
  - Tên mục: (1,55 · y · 10,5 · 0,7) 24pt, canh giữa theo chiều dọc.
- Tối đa 5 mục. Nhiều hơn thì gộp lại.

### 2.3 Phân cách phần
Nền màu chủ đạo.
- Số phần: (0,9 · 2,0 · 2,5 · 1,8) 80pt đậm, màu trắng mờ (alpha ~35%).
- Tên phần: (0,9 · 3,7 · 11,5 · 1,3) 36pt đậm, trắng.

### 2.4 Một cột (mặc định cho nội dung)
- Tiêu đề: (0,6 · 0,5 · 12,133 · 0,85) 30pt đậm, màu chủ đạo.
- Gạch chân nhấn: (0,6 · 1,38 · 1,6 · 0,05) màu nhấn.
- Nội dung: (0,6 · 1,65 · 12,133 · 4,9) 22pt, giãn dòng 1,35, cách đoạn 10pt.

### 2.5 Hai cột
- Cột trái: (0,6 · 1,65 · 5,87 · 4,9). Cột phải: (6,87 · 1,65 · 5,87 · 4,9).
- Dùng khi so sánh (trước – sau, ưu – nhược) hoặc chữ bên trái, ảnh bên phải.

### 2.6 Ba thẻ
- Thẻ i (0..2): x = 0,6 + i × 4,11; (x · 1,8 · 3,91 · 3,7).
- Nền thẻ `#F2F5F9` bo góc; viền trên dày 0,06" màu chủ đạo.
- Tiêu đề thẻ: 22pt đậm, cách mép thẻ 0,25". Nội dung thẻ: 18pt, tối đa 4 dòng.

### 2.7 Số liệu nổi bật (2–4 ô)
- Với 4 ô: ô i, x = 0,6 + i × 3,083; (x · 2,1 · 2,883 · 2,4).
- Số: 60pt đậm màu nhấn, canh giữa. Nhãn dưới số: 16pt màu phụ, tối đa 2 dòng.
- Ghi rõ đơn vị và mốc thời gian ngay trong nhãn ("học sinh, năm học 2026–2027").

### 2.8 Biểu đồ kèm nhận xét
- Biểu đồ: (0,6 · 1,65 · 7,6 · 4,8).
- Nhận xét: (8,5 · 1,65 · 4,23 · 4,8) — 2–3 gạch đầu dòng 18pt, mỗi ý một câu.
- Tiêu đề slide là KẾT LUẬN rút ra từ biểu đồ, không phải "Biểu đồ số liệu".

### 2.9 Ảnh lớn
- Ảnh phủ kín: (0 · 0 · 13,333 · 7,5), cắt theo khung (xem hàm `them_anh_phu` ở tệp dựng).
- Dải mờ: (0 · 5,5 · 13,333 · 2,0) màu đen, độ trong suốt ~45%.
- Chú thích: (0,8 · 5,85 · 11,7 · 1,3) 24pt trắng.

### 2.10 Dòng thời gian
- Trục: (0,8 · 3,72 · 11,7 · 0,04) màu phụ.
- Mốc i trong n mốc: x = 0,8 + i × (11,7 / (n − 1)); chấm tròn 0,26" tâm trên trục, màu chủ đạo.
- Nhãn xen kẽ trên (y = 2,5) và dưới (y = 4,1), khung rộng 2,2", 16–18pt; mốc thời gian đậm, việc làm ở dòng dưới.

### 2.11 Bảng
- Bảng: (0,6 · 1,7 · 12,133 · tự giãn). Tối đa 6 cột × 8 hàng; nhiều hơn thì tách slide hoặc chuyển thành biểu đồ.
- Hàng tiêu đề: nền màu chủ đạo, chữ trắng 18pt đậm, cao 0,5".
- Hàng nội dung: 16–18pt, cao ≥ 0,42"; kẻ ngang mảnh màu phụ, bỏ kẻ dọc.
- Cột số canh phải, cột chữ canh trái; đơn vị ghi ở tiêu đề cột.

### 2.12 Kết luận / cảm ơn
- Nền màu chủ đạo; "Xin trân trọng cảm ơn!" (0,9 · 3,0 · 11,5 · 1,2) 40pt đậm trắng.
- Liên hệ (họ tên, đơn vị, điện thoại, email): (0,9 · 4,4 · 11,5 · 1,2) 18pt trắng mờ.

## 3. Chân slide và số trang

- Tên bài hoặc tên cơ quan: (0,6 · 6,85 · 8,0 · 0,3) 11pt màu phụ.
- Số trang: (11,8 · 6,85 · 0,93 · 0,3) 11pt màu phụ, canh phải.
- Bìa và slide phân cách KHÔNG đánh số.

## 4. Lỗi bố cục hay gặp

| Lỗi | Sửa |
|---|---|
| Chữ tràn khỏi khung, đè hình | Tách slide hoặc rút câu; không thu nhỏ chữ dưới ngưỡng |
| Mỗi slide lệch lề một kiểu | Dùng đúng tọa độ lưới ở trên cho mọi slide |
| Nhồi 3–4 ý vào một slide | Mỗi slide một ý; ý phụ chuyển sang phần ghi chú của slide |
| Ảnh kéo giãn méo người, méo chữ | Cắt theo khung (giữ tỷ lệ), đừng đổi riêng chiều rộng |
| Bảng số liệu dày đặc | Giữ 3–5 dòng quan trọng, phần còn lại để phụ lục hoặc biểu đồ |
| Màu nhấn dùng khắp nơi | Mỗi slide nhấn tối đa 2 chỗ |
