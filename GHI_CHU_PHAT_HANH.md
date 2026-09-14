AWord Pro 3.0.0 — dòng sản phẩm mới của AWord, chạy song song bản web (bản web đăng nhập bằng tài khoản cá nhân
sẽ ra mắt trong các bản 3.x tiếp theo). AWord Pro **cài song song**, không gỡ AWord 2.x: hai bản dùng chung thư
mục làm việc Documents\AWord, cấu hình Claude, bộ nhớ, vai và kết nối Kho dữ liệu/Kho tri thức — không mất dữ
liệu; cài đặt giao diện, bố cục và cấu hình DeepSeek của mỗi app tách riêng. Dòng AWord 2.x dừng cập nhật ở 2.0.1.
Khi bộ cài hỏi về settings.json và CLAUDE.md, chọn "Yes" (cập nhật): cấu hình được HỢP NHẤT, giữ nguyên mã kết
nối AI, Kho dữ liệu, quy tắc riêng và lựa chọn vai.

Nội dung chính:
- **Vai của bạn ở trang Chào mừng** — *Cán bộ hành chính* / *Giáo viên* / *Cả hai*. Chọn Giáo viên: nạp khối
  quy tắc soạn giảng (kế thừa AGiaoAn) vào CLAUDE.md theo kiểu hợp nhất có sao lưu, tạo thư mục
  `Documents\AWord\GIAO VIEN`, bật thông báo Kho tri thức AI đầu phiên. Tắt vai chỉ gỡ quy tắc, không xóa dữ liệu.
- **Kho tri thức AI giảng dạy — kết nối tự động**: chọn vai Giáo viên là xong. AWord tự tính mã máy, sinh token
  thiết bị, đăng ký với Claude, cho phép sẵn các công cụ tra cứu (đổi điểm, chuyển máy vẫn hỏi) và khởi động lại
  khung chat — không cần mã khóa, không phải chạy tệp nào; mất mạng thì tự kết nối ở lần mở sau. Trang Chào mừng
  hiện trạng thái dịch vụ; trong chat gõ "Thanh toán Kho tri thức AI" để quét QR. Dự phòng: Trợ giúp → "Kết nối
  lại Kho tri thức AI giảng dạy".
- **Đóng góp tài liệu đổi điểm tích lũy** ngay trong chat (xác nhận quyền chia sẻ, tệp tải thẳng lên máy chủ);
  kỹ năng sư phạm cập nhật từ AGiaoAn; lối tắt "Chuyển dữ liệu AGiaoAn sang AWord Pro".
- **Mô hình AI DeepSeek cho AWord Pro** (Tệp → Tùy chọn): nhập khóa DeepSeek, chọn mô hình và mức suy luận, kiểm
  tra kết nối — chỉ áp dụng cho AWord Pro, không ảnh hưởng Claude Code khác trên máy.
- **Claude Code 2.1.270**: chế độ xem tập trung (Ctrl+Alt+F), đổi tên/nhóm thẻ phiên, đánh dấu phiên chưa đọc.
- **Gọn và nhẹ hơn**: khởi động chỉ nạp một khung Claude ở thanh bên phụ (bỏ khung danh sách phiên ở thanh
  trái); thông báo hiện giữa cửa sổ; "Khởi động lại Claude" đóng đúng khung chat thanh bên.
- **Sửa lỗi**: script "Kết nối Kho dữ liệu" trước đây dừng ngay sau khi đăng ký — đã sửa.
