# Quy tắc biểu đồ trong dạy học (slide, phiếu, đề thi, học liệu)

## Chọn dạng biểu đồ theo câu hỏi dữ liệu (không theo sở thích)
| Muốn cho học sinh thấy | Dạng đúng | Tránh |
|---|---|---|
| So sánh độ lớn giữa các nhóm | Cột (dọc ≤ 6 nhóm; ngang khi tên dài) | Tròn nhiều lát |
| Xu hướng theo thời gian | Đường | Cột dày đặc |
| Cơ cấu phần trăm của MỘT tổng | Tròn ≤ 5 lát (gộp phần nhỏ thành "Khác") hoặc cột chồng | Tròn 2 hình so sánh nhau |
| Tương quan hai đại lượng | Tán xạ (điểm) | Đường nối điểm rời |
| Phân bố (điểm kiểm tra...) | Cột tần suất (histogram) | Tròn |

## Quy tắc vẽ (bắt buộc)
- **Trục cột bắt đầu từ 0** — cắt trục là bóp méo trực quan (riêng đường có thể không từ 0 nhưng
  phải ghi rõ). **Không 3D, không bóng đổ** — 3D làm sai thị giác độ lớn. **Không hai trục tung**
  ở phổ thông — tách 2 biểu đồ.
- **Tiêu đề là CÂU KẾT LUẬN**, không phải nhãn: viết "Nhiệt độ trung bình tăng nhanh sau năm 2000"
  thay vì "Biểu đồ nhiệt độ" — học sinh học được cách đọc dữ liệu từ chính tiêu đề.
- Nhãn dán TRỰC TIẾP lên cột/đường khi ≤ 4 chuỗi (bỏ chú giải rời — mắt khỏi nhảy qua lại);
  số liệu then chốt in đậm ngay trên cột.
- Cỡ chữ: nhãn trục/số liệu ≥ 18pt trên slide, ≥ 14px trong học liệu HTML, ≥ 11pt trên đề in.
- Màu: theo bảng chức năng của `../../soan-bai-trinh-chieu/references/bo-cuc-mau-chu.md`
  (1 màu chính + xám cho chuỗi nền; chuỗi cần nhấn mới có màu); in đề thi → **đen trắng**:
  phân biệt bằng nét (liền/đứt) và ký hiệu điểm (●/▲/■), không dựa vào màu.
- Ghi **nguồn số liệu + năm** dưới biểu đồ (rèn thói quen trích nguồn cho học sinh).
- Vẽ bằng matplotlib (có sẵn pytools) cho ảnh tĩnh, hoặc canvas/SVG trong học liệu HTML.

## Phép thử cuối: che tiêu đề, hỏi "biểu đồ nói gì?" — nếu không trả lời được trong 5 giây,
biểu đồ đang nhiều hơn một thông điệp → tách.
