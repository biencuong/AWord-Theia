AWord 2.0.0 — từ bản này, AWord đánh số phiên bản theo thông lệ chung (2.0.0, 2.0.1...); thời điểm
đóng gói vẫn được lưu kèm trong ứng dụng. Khi bộ cài hỏi về settings.json và CLAUDE.md, chọn "Yes"
(cập nhật): cấu hình được HỢP NHẤT, giữ nguyên mã kết nối AI, Kho dữ liệu và tùy chỉnh cá nhân.

Nội dung chính:
- **Thiết lập ban đầu theo vai trò**: trang Chào mừng có 2 nút "Tôi là giáo viên" và "Tôi làm công
  tác hành chính" — mỗi nhánh có bộ câu hỏi, cấu trúc thư mục và quy tắc làm việc riêng.
- **Bộ nhớ làm việc liền mạch**: Claude tự ghi nhớ việc đang dở, tóm tắt phiên, thông tin lâu dài,
  kinh nghiệm và thói quen vào thư mục ẩn .aword/bo-nho ngay trong thư mục làm việc — phiên sau nối
  tiếp mà không phải tìm lại lịch sử; công cụ AI khác (Codex, Cursor, Copilot...) cũng dùng chung
  được qua tệp AGENTS.md.
- **Bật/tắt nhóm kỹ năng**: tắt bớt nhóm không dùng (lập trình, thiết kế...) để Claude gọn và tiết
  kiệm token; mặc định vẫn giữ đủ. Skill đã tắt không bị cài lại khi cập nhật.
- **Sửa lỗi quan trọng**: AWord không còn tự thoát khoảng 10 giây sau khi bấm "Khởi động lại"; tự
  cập nhật không còn ép đóng khi đang hỏi "Lưu thay đổi?"; không còn đóng nhầm tệp CLAUDE.md và các
  tệp trong "CLAUDE OUTPUTS/" lúc khởi động; tải bản Claude Code mới không còn treo khi mạng chập chờn.
- **Nhẹ và tiết kiệm hơn**: khung chat Claude mở ở thanh bên thay vì sinh thêm khung giữa màn hình
  (bớt một tiến trình ~250 MB); rút gọn quy tắc nạp vào mỗi phiên; không còn yêu cầu đọc toàn bộ
  thư mục dự án trước mỗi nhiệm vụ; bỏ theo dõi tệp tạm (ảnh PDF, tệp khóa Office).
