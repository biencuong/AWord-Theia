AWord — vai Giáo viên và Kho tri thức AI giảng dạy. Khi bộ cài hỏi về settings.json và CLAUDE.md, chọn
"Yes" (cập nhật): cấu hình được HỢP NHẤT, giữ nguyên mã kết nối AI, Kho dữ liệu, quy tắc riêng và lựa chọn vai.

Nội dung chính:
- **Chọn vai ở trang Chào mừng**: khối "Vai của bạn" — *Cán bộ hành chính* / *Giáo viên* / *Cả hai*.
  Chọn Giáo viên: AWord nạp khối quy tắc soạn giảng (kế thừa AGiaoAn) vào CLAUDE.md cấp người dùng
  theo kiểu hợp nhất có sao lưu, tạo thư mục `Documents\AWord\GIAO VIEN` (HO SO CUA TOI, TU LIEU MON
  HOC, KE HOACH BAI DAY, BAI TRINH CHIEU, DE KIEM TRA, HOC LIEU TRUC QUAN, BO NHO) kèm CLAUDE.md riêng,
  và bật thông báo Kho tri thức AI đầu phiên. Đổi vai bất cứ lúc nào; tắt vai chỉ gỡ quy tắc, không xóa dữ liệu.
- **Kho tri thức AI giảng dạy (aword.vn)**: dữ liệu tri thức giảng dạy được số hóa, cấu trúc hóa và lập chỉ
  mục cho AI từ nguồn sách giáo khoa và tài liệu chuyên môn. Lối tắt Start Menu "Kết nối Kho tri thức AI
  (AWord)" — không cần mã khóa, tự tính mã máy và token thiết bị; trong chat gõ "kiểm tra trạng thái Kho tri
  thức AI" để xem trạng thái dịch vụ và thanh toán bằng quét QR ngay trong cửa sổ chat. Skill mới
  `tra-cuu-tri-thuc` (tra theo bài, tiết kiệm token, trích dẫn "SGK <môn> <lớp>, Bài x, tr. y", tải hình
  vào giáo án/slide, mở gói dữ liệu).
- **Đóng góp tài liệu đổi điểm tích lũy**: giáo viên đóng góp giáo án, đề, chuyên đề... ngay trong chat
  (xác nhận quyền chia sẻ, tệp tải thẳng lên máy chủ, không đi qua AI); tài liệu được duyệt được cộng điểm
  để đổi dữ liệu tri thức cập nhật mới. Điểm không cho tặng, không chuyển nhượng, không quy đổi thành tiền.
  Trang Chào mừng (vai Giáo viên) có thêm "Đóng góp tài liệu" và "Xem điểm tích lũy".
- **Kỹ năng sư phạm cập nhật từ AGiaoAn**: soạn kế hoạch bài dạy theo 2 pha (chốt nền → vòng lặp từng
  hoạt động, bảng phân tích bài dạy, tích hợp nội dung giáo dục, gói PPDH theo cấp × môn), ra đề, trình
  chiếu, thẩm định có góc nhìn theo vai trò; thêm skill `cap-nhat-quy-dinh-nam-hoc` (sổ hiệu lực, hồ sơ
  sổ sách giáo viên).
- **Chuyển dữ liệu từ AGiaoAn**: lối tắt "Chuyển dữ liệu AGiaoAn sang AWord" sao chép `Documents\AGiaoAn`
  vào `Documents\AWord\GIAO VIEN` (giữ cấu trúc, không xóa nguồn, chạy lại an toàn).
- **Sửa lỗi**: script "Kết nối Kho dữ liệu (AWord)" trước đây dừng ngay sau khi đăng ký (lỗi cú pháp cmd
  ở dòng thông báo), không kiểm tra kết nối và không ghi nhớ địa chỉ — đã sửa.

---

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
