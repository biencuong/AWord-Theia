---
name: ve-hinh-giao-khoa
description: Vẽ hình giáo khoa CHÍNH XÁC theo toán học để chèn vào giáo án, phiếu học tập, bài trình chiếu, đề kiểm tra — hình học (tam giác, đường tròn, dựng hình, chứng minh), biểu diễn lực, mạch điện, quang học (thấu kính, tia sáng, ảnh), cấu tạo nguyên tử, tế bào, đồ thị hàm số và hệ trục toạ độ. Dùng khi giáo viên nói "vẽ hình", "vẽ hình minh họa", "hình cho bài …", "vẽ tam giác/đường tròn/thấu kính/mạch điện", hoặc khi bài dạy cần hình mà `canvas-design` không đảm bảo đúng hình học.
---

# Vẽ hình giáo khoa

Hình trong bài dạy **sai hình học là sai kiến thức** — nghiêm trọng hơn sai chữ. Vì vậy skill này vẽ bằng
**toạ độ tính toán** (SVG), không vẽ ước lượng bằng mắt, và **tự kiểm** các ràng buộc hình học trước khi giao.

## Nguyên tắc bắt buộc

1. **Toạ độ tính, không đoán.** Mọi điểm đặt bằng số trong hệ toạ độ xác định trước. Ví dụ tam giác ABC:
   chọn A(60,220), B(300,220), C(180,60) — rồi tính đường cao chân H bằng công thức, KHÔNG đặt H "đại khái".
2. **Ràng buộc hình học phải đúng**, kiểm bằng máy trước khi giao:
   - Góc vuông: vẽ ký hiệu vuông và **kiểm tích vô hướng = 0**.
   - Tiếp tuyến: khoảng cách từ tâm tới đường = bán kính.
   - Trung điểm/trung tuyến: toạ độ đúng bằng trung bình cộng.
   - Tia sáng qua thấu kính: kiểm bằng công thức $\frac{1}{f} = \frac{1}{d} + \frac{1}{d'}$.
3. **Ký hiệu đúng chuẩn SGK Việt Nam** — xem `references/ky-hieu-chuan.md`. Không tự chế ký hiệu.
4. **Nhãn tiếng Việt có dấu**, phông hỗ trợ tiếng Việt; cỡ chữ đọc được khi in (≥ 9 pt ở khổ A4).
5. **In đen trắng vẫn đọc được**: phân biệt bằng nét liền/nét đứt/hoa văn, không chỉ bằng màu.
6. **Nói rõ nếu hình là minh hoạ**, không phải hình chứng minh — giáo viên cần biết chỗ nào phải vẽ chính xác
   theo số liệu bài, chỗ nào chỉ để nhìn.

## Quy trình (5 bước)

1. **Xác định yêu cầu hình**: môn, lớp, bài, hình cần vẽ gì, dùng vào đâu (giáo án / phiếu / slide / đề).
   Hỏi nếu chưa rõ — vẽ sai loại hình thì làm lại từ đầu.
2. **Chọn loại hình và tra khuôn**: đọc đúng mục trong `references/khuon-theo-mon.md` (hình học · lực ·
   mạch điện · quang học · hoá · sinh · đồ thị). Mỗi mục có khuôn SVG và cách tính toạ độ.
3. **Tính toạ độ và dựng SVG** theo khuôn. Đặt tên lớp/nhãn rõ ràng để dễ sửa.
4. **Tự kiểm ràng buộc** (mục 2 ở trên) — chạy phép tính, không nhìn bằng mắt. Sai thì sửa toạ độ, không
   "chấp nhận gần đúng".
5. **Xuất và bàn giao**: lưu `.svg` (nguồn, sửa được) + `.png` 300 dpi để chèn vào docx/pptx. Ghi rõ bài,
   trang SGK đã đối chiếu, và những chỗ giáo viên nên kiểm lại.

## Vì sao SVG chứ không phải ảnh

- Nét sắc ở mọi cỡ, in giấy không vỡ — quan trọng vì hình sẽ in trong đề kiểm tra.
- Toạ độ là số nên **sửa được chính xác** khi giáo viên yêu cầu đổi (khác ảnh phải vẽ lại).
- Chèn vào Word/PowerPoint được, và giữ được nét khi phóng to trong bài giảng.

## Các nhóm hình thường gặp

| Nhóm | Ví dụ | Chú ý riêng |
|---|---|---|
| **Hình học phẳng** | tam giác + đường cao/trung tuyến/phân giác, đường tròn, tiếp tuyến, tứ giác nội tiếp | Đường phụ vẽ nét đứt; góc vuông có ký hiệu; đỉnh có nhãn chữ in hoa |
| **Dựng hình** | dựng trung trực, dựng tam giác biết 3 cạnh | Phải vẽ **đúng trình tự cung tròn** như SGK, không chỉ vẽ kết quả |
| **Biểu diễn lực** | trọng lực, phản lực, lực ma sát, hợp lực, phân tích lực | Mũi tên từ điểm đặt; độ dài tỉ lệ độ lớn (ghi rõ tỉ xích); nhãn $\vec{P}, \vec{N}, \vec{F}_{ms}$ |
| **Mạch điện** | nguồn, điện trở, bóng đèn, ampe kế, vôn kế, khoá K | Ký hiệu theo chuẩn; dây nối vuông góc; ampe kế mắc nối tiếp, vôn kế song song |
| **Quang học** | thấu kính hội tụ/phân kì, tia sáng, ảnh của vật, gương | Trục chính nét chấm gạch; ký hiệu tiêu điểm F, F′; ảnh ảo vẽ nét đứt |
| **Đồ thị hàm số** | parabol, đường thẳng, hàm bậc ba, hệ trục toạ độ | Trục Ox/Oy có mũi tên, gốc O, vạch chia đúng tỉ lệ, đường cong trơn |
| **Hoá học** | cấu tạo nguyên tử, sơ đồ liên kết, chiều phản ứng | Electron vẽ đúng số lớp/số e lớp ngoài |
| **Sinh học** | tế bào, cơ quan, sơ đồ vòng tuần hoàn, chuỗi thức ăn | Nhãn bộ phận có đường dẫn (không đè lên hình) |

## Nguyên tắc sư phạm

- **Một hình một ý.** Hình chứng minh không nhồi thêm chi tiết trang trí; hình minh hoạ không đưa ký hiệu
  chứng minh vào nếu bài chưa học.
- **Đúng độ phức tạp theo lớp**: tiểu học vẽ đơn giản, cỡ to; THCS bắt đầu có ký hiệu; THPT đủ ký hiệu hình học.
- **Không vẽ chi tiết SGK không nhắc** — học sinh sẽ hỏi về thứ không có trong bài.
- Hình dùng trong **đề kiểm tra** thì không ghi đáp án lên hình (không vẽ sẵn đường cao, không ghi số đo
  nếu đề yêu cầu học sinh tính).

## Liên kết skill khác

- `docx` · `pptx` — chèn hình đã xuất vào văn bản/trình chiếu.
- `soan-ke-hoach-bai-day` · `phieu-hoc-tap` · `ra-de-kiem-tra` — các sản phẩm cần hình.
- `tao-hoc-lieu-truc-quan` — nếu cần hình ĐỘNG hoặc mô phỏng tương tác (khác skill này: hình tĩnh chính xác).
- `canvas-design` — hình trang trí, poster (không đảm bảo hình học — đừng dùng cho hình chứng minh).
