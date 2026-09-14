---
name: tao-hoc-lieu-truc-quan
description: Tạo học liệu trực quan cho bài dạy — hình minh họa/phiếu học tập/poster, GIF động, mô phỏng thí nghiệm ảo tương tác (HTML chạy offline, bám đúng thí nghiệm trong SGK), mô hình 3D, bài giảng e-learning tương tác hướng chuẩn SCORM. Dùng khi người dùng nói "mô phỏng", "thí nghiệm ảo", "hình minh họa", "phiếu học tập", "poster", "GIF", "bài giảng e-learning", "SCORM", "học liệu số".
---

# Tạo học liệu trực quan

## Định tuyến theo nhu cầu

| Nhu cầu | Cách làm | Skill kỹ thuật |
|---|---|---|
| Hình minh họa, phiếu học tập, poster, thiệp | Thiết kế PNG/PDF | `canvas-design` |
| Sơ đồ/quá trình động ngắn (GIF) | GIF động | `slack-gif-creator` (tái mục đích cho lớp học) |
| **Mô phỏng thí nghiệm ảo tương tác** | HTML+JS tự chứa (mục dưới) | tự dựng + thẩm mỹ theo `frontend-design` |
| Mô hình 3D (phân tử, thiên văn, hình học không gian) | HTML + three.js nội tuyến | như trên |
| **Bài giảng e-learning hướng SCORM** | Gói HTML nhiều màn hình + imsmanifest | `web-artifacts-builder` + `frontend-design` |

GIỚI HẠN nói rõ với người dùng khi liên quan: không sinh được ảnh chụp/video thực — sản phẩm là
đồ họa vẽ bằng code, GIF, trang tương tác.

## Mô phỏng thí nghiệm ảo BÁM SGK (quan trọng nhất)

1. **Xác định thí nghiệm**: đọc ĐÚNG bài trong `TU LIEU MON HOC/<Môn>/SGK/` (PDF scan đọc bằng
   thị giác, chỉ đúng trang bài đó) — lấy: dụng cụ, các bước tiến hành, hiện tượng, số liệu của
   chính SGK. Không có file SGK → dựng theo yêu cầu cần đạt + kiến thức chuẩn, GHI RÕ
   "chưa đối chiếu SGK".
2. **Dựng file HTML TỰ CHỨA** (một file duy nhất, mở bằng trình duyệt, KHÔNG cần mạng): bắt đầu từ
   khuôn mẫu `references/mau-mo-phong/khuon-mau-mo-phong.html` (canvas thuần + bảng điều khiển
   tham số) — thay phần vẽ và mô hình vật lý/hóa/sinh theo thí nghiệm. Cần 3D thì nhúng three.js
   nội tuyến. Giao diện tiếng Việt, thẩm mỹ theo `frontend-design`.
3. **Bắt buộc có**: (a) bảng điều khiển cho học sinh THAY ĐỔI THAM SỐ (thanh trượt/nút) và thấy
   hiện tượng đổi theo; (b) nút "Làm lại"; (c) khung "Em quan sát được gì?" gợi ý ghi nhận;
   (d) đúng bản chất khoa học — TỰ KIỂM công thức/hiện tượng trước khi giao (sai khoa học là lỗi
   nghiêm trọng nhất của học liệu).
4. **Đối chiếu yêu cầu cần đạt** của bài; ghi chú cuối trang: bài học, SGK trang mấy, công thức dùng.
5. **Lưu** `HOC LIEU TRUC QUAN/<Môn>/MoPhong_<tên>.html`; mở thử bằng trình duyệt (skill
   `webapp-testing` nếu cần chụp kiểm tra) rồi bàn giao kèm hướng dẫn dùng 2–3 dòng cho giáo viên.

## Bài giảng e-learning hướng chuẩn SCORM

Dùng khi giáo viên cần bài giảng nộp thi "Thiết kế bài giảng điện tử" hoặc đưa lên LMS:
1. Dựng gói HTML nhiều màn hình theo tiến trình bài dạy (đọc KHBD nếu có): nội dung → tương tác
   (câu hỏi trắc nghiệm có phản hồi đúng/sai, kéo-thả đơn giản) → tổng kết. Kỹ thuật theo
   `web-artifacts-builder`, thẩm mỹ theo `frontend-design`, mọi tài nguyên nội tuyến.
2. Đóng gói SCORM 1.2: tạo `imsmanifest.xml` từ mẫu `references/mau-mo-phong/imsmanifest-mau.xml`
   (thay identifier, title, href trang khởi đầu), nén thư mục thành `.zip` (imsmanifest.xml ở GỐC zip).
3. Ghi rõ cho người dùng: gói đã theo cấu trúc SCORM 1.2 cơ bản (chạy trên LMS phổ biến); nếu cuộc
   thi yêu cầu chuẩn/phần mềm cụ thể (iSpring, Storyline...) thì sản phẩm này là bản HTML nền để
   tham khảo, không thay thế.

## Quy tắc chung

- Nội dung, thuật ngữ đúng SGK và chương trình; ngôn ngữ phù hợp lứa tuổi.
- Bố cục – cỡ chữ – màu theo `../soan-bai-trinh-chieu/references/bo-cuc-mau-chu.md`
  (lưới 1/3, thang 3 bậc chữ, màu theo chức năng, tương phản ≥ 4,5:1); điều khiển to dễ bấm.
- Biểu đồ/đồ thị trong mọi sản phẩm theo `references/bieu-do-day-hoc.md` (chọn dạng đúng câu hỏi
  dữ liệu, trục từ 0, tiêu đề là câu kết luận, đề in thì đen trắng).
- **KIỂM KỸ THUẬT trước khi giao** (bắt buộc với sản phẩm HTML): mở bằng skill `webapp-testing`
  (Playwright) — chụp màn hình xem hiển thị, đọc console log, bấm thử từng điều khiển;
  có lỗi JS/trang trắng là chưa được bàn giao.
- Một sản phẩm một file/một thư mục gọn — giáo viên chép USB mang đi được.
