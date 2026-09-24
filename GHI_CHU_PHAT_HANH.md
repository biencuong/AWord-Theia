AWord Pro 3.0.5 — **Claude Code tự cập nhật theo thời gian thực** và **Claude đọc được trang web** (Playwright).
Khi bộ cài hỏi về settings.json và CLAUDE.md, chọn "Yes" (cập nhật): cấu hình được HỢP NHẤT, giữ nguyên mã kết nối AI,
Kho dữ liệu và tùy chỉnh cá nhân. Kỹ năng đã có sẵn trên máy KHÔNG bị ghi đè — chỉ kỹ năng còn thiếu mới được cài thêm.

Nội dung:
- **Claude Code tự cập nhật, không chờ bản AWord mới**: lúc mở AWord và cứ 6 giờ một lần, AWord kiểm tra bản Claude Code
  mới nhất Anthropic vừa phát hành, tải ngầm rồi mời khởi động lại (bấm "Để sau" thì lần mở AWord tới tự dùng bản mới).
  Bản tải về vẫn giữ tiếng Việt như bản đóng gói sẵn. Bật/tắt ở menu Trợ giúp → Tự động cập nhật Claude Code; cập nhật
  ngay bằng tay ở Trợ giúp → Cập nhật Claude Code. Chỉ cần cài bản 3.0.5 này một lần, từ đó Claude Code tự lên bản mới.
- **Claude đọc được trang web bằng trình duyệt thật (Playwright)**: đọc trang phải đăng nhập (iOffice, cổng dịch vụ công,
  hệ thống báo cáo ngành), trích bảng số liệu ra Excel, tải tệp đính kèm, điền biểu mẫu, chụp màn hình làm minh chứng.
  Bật một lần: Start Menu → **"Bật đọc trang web (AWord Pro)"** (máy cần Node.js — tệp này tự báo nếu thiếu), rồi mở lại
  AWord. Mặc định Claude CHỈ ĐỌC; việc gửi, nộp, trình ký, phát hành chỉ làm khi bạn đồng ý rõ. Mật khẩu không gõ vào
  khung chat.
- **Kỹ năng mới "Làm việc với trang web"** (`dung-web-playwright`): hướng dẫn Claude chọn đúng cách đọc web, các việc
  hay gặp và quy tắc an toàn.
- **Kỹ năng iOffice**: ưu tiên đọc bằng Playwright, kèm sẵn script đăng nhập, lấy văn bản đến chờ xử lý (Xử lý chính /
  Phối hợp) và văn bản đi đã phát hành theo kỳ.
- **Khung chat Claude Code bằng tiếng Việt**: nút, menu, chế độ làm việc (Hỏi trước khi sửa / Tự động sửa / Lập kế hoạch),
  hộp hỏi quyền, danh sách cuộc trò chuyện… (gần 500 chuỗi). Bảng dịch đặt trên máy chủ cập nhật nên bản Claude Code mới tải về
  vẫn giữ tiếng Việt, chuỗi mới được dịch bổ sung mà không cần cài lại AWord.
- **Cửa sổ khởi động** hiện đúng tên **AWord Pro** kèm số phiên bản.
- Sửa lỗi: nút "Khởi động lại" sau khi cập nhật Claude Code trước đây chỉ mở lại cửa sổ nên vẫn chạy bản cũ — nay khởi động lại
  toàn bộ ứng dụng và dùng ngay bản mới; cập nhật Claude Code lần thứ hai không còn thất bại vì bản đang chạy bị Windows khoá tệp.

---

AWord Pro 3.0.4 — thêm **9 kỹ năng mới** (thiết kế bài trình chiếu và 8 kỹ năng giảng dạy) và **Thống kê token — chi phí**.
Khi bộ cài hỏi về settings.json và CLAUDE.md, chọn "Yes" (cập nhật): cấu hình được HỢP NHẤT, giữ nguyên mã kết nối AI,
Kho dữ liệu và tùy chỉnh cá nhân. Kỹ năng đã có sẵn trên máy KHÔNG bị ghi đè — chỉ kỹ năng còn thiếu mới được cài thêm.

Nội dung:
- **Thiết kế bài trình chiếu** (kỹ năng mới): 5 bộ màu dựng sẵn cho hội nghị, tập huấn, đề án, báo cáo số liệu và bài
  giảng tiểu học; thang cỡ chữ theo phòng họp hay hội trường; 12 bố cục slide kèm tọa độ (bìa, mục lục, ba thẻ, số liệu
  nổi bật, biểu đồ kèm nhận xét, ảnh lớn, dòng thời gian, bảng…); bộ hàm dựng bằng python-pptx; cách xuất PDF rồi tự
  render ra ảnh để soát trước khi giao. Cứ nói "làm slide báo cáo cho đẹp", Claude tự dùng kỹ năng này.
- **8 kỹ năng giảng dạy**: phiếu học tập; sơ đồ dạy học (sơ đồ tư duy, sơ đồ khối, trục thời gian); vẽ hình giáo khoa;
  kỹ thuật dạy học tích cực cho từng hoạt động; sinh hoạt lớp và hoạt động trải nghiệm; sổ chủ nhiệm và nhận xét học
  sinh theo Thông tư 27/2020, 22/2021; trộn đề kiểm tra; kế hoạch chuyên môn của tổ.
- **Thống kê token và chi phí**: chỉ báo ngay trên thanh tiêu đề, bấm vào mở trang thống kê chi tiết (menu Trợ giúp →
  Thống kê token và chi phí). Số liệu đọc từ chính các phiên Claude Code trên máy, không đếm trùng phiên đã tính.
- **Bản trên trình duyệt**: chạy hoàn toàn ẩn, không còn cửa sổ dòng lệnh của node và claude; sửa nhóm lỗi khi chạy dài
  (chậm dần, treo).
- Skill tra cứu Kho tri thức AI: bổ sung mục giới thiệu KHO KỸ NĂNG đóng kèm AWord.

---

AWord Pro 3.0.3 — sửa lỗi bộ cài **"AWord Pro cannot be closed"**: bộ cài đóng AWord Pro kèm các tiến trình con (Terminal, tác vụ
Claude…) trước khi cài; nếu một tiến trình cũ bị Windows giữ lại không đóng được thì báo rõ bằng tiếng Việt — khởi động lại máy
tính rồi chạy lại bộ cài. Nhật ký gọn hơn: gỡ khung "danh sách phiên" ẩn của Claude Code (trước đây sinh lỗi webview mỗi lần mở).
Hộp Giới thiệu hiện số phiên bản. Bản trên trình duyệt: menu Cập nhật phiên bản mới báo đúng (bản web cập nhật trên máy chủ).

---

AWord Pro 3.0.2 — Kho tri thức AI giảng dạy: **giới thiệu trước khi mua, bán theo gói**. Chưa kích hoạt vẫn hỏi Claude "Kho tri
thức AI có những gì?" để xem giới thiệu ngắn gọn các nguồn và gói (công cụ `tt_gioi_thieu`, được phép sẵn không hỏi lại); skill
tra-cuu-tri-thuc cập nhật theo máy chủ mới (giới thiệu bài khi chưa mở gói, mã lỗi `khoa_moi_can_duyet`). Kết nối kiên nhẫn hơn với
mạng chậm (chờ máy chủ tới 15 giây).

---

AWord Pro 3.0.1 — Kho tri thức AI giảng dạy chuyển sang địa chỉ chính thức **https://trithuc.aword.vn**. Máy đã cài 3.0.0:
cập nhật rồi mở lại AWord Pro là tự kết nối (địa chỉ cũ đã lưu tự chuyển, giữ nguyên token và bản quyền) — không phải làm gì
thêm. Script "Kết nối Kho tri thức AI (AWord Pro)", hook thông báo đầu phiên và skill tra-cuu-tri-thuc cũng dùng địa chỉ mới.

---

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
