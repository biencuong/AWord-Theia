# Các công cụ Playwright MCP

Tên đầy đủ có tiền tố `mcp__playwright__`. Dưới đây viết gọn.

## Di chuyển và nhìn trang

| Công cụ | Việc | Ghi nhớ |
|---|---|---|
| `browser_navigate` | Mở địa chỉ | Trang chuyển hướng về đăng nhập là chuyện thường — kiểm tra lại URL sau khi mở |
| `browser_navigate_back` | Quay lại trang trước | |
| `browser_snapshot` | Cây cấu trúc trang + `ref` từng phần tử | Cách "nhìn" MẶC ĐỊNH; rẻ hơn ảnh nhiều |
| `browser_take_screenshot` | Ảnh thật | Chỉ khi cần bố cục/màu/con dấu, hoặc lấy ảnh cho báo cáo; thêm `element` để chụp một vùng |
| `browser_find` | Tìm phần tử theo mô tả bằng lời | Dùng khi snapshot quá dài, không rõ nên bấm cái nào |
| `browser_resize` | Đổi kích thước cửa sổ | Trang ẩn cột ở màn hẹp thì phóng rộng ra |
| `browser_tabs` | Liệt kê/chuyển/đóng thẻ | Bấm liên kết mở thẻ mới thì phải chuyển thẻ rồi mới thao tác |

## Thao tác

| Công cụ | Việc | Ghi nhớ |
|---|---|---|
| `browser_click` | Bấm | `ref` lấy từ snapshot gần nhất; trang đổi thì snapshot lại |
| `browser_type` | Gõ vào ô | `submit: true` để Enter luôn |
| `browser_fill_form` | Điền nhiều ô một lượt | Nhanh và ít sai hơn gõ từng ô |
| `browser_select_option` | Chọn trong danh sách xổ | |
| `browser_press_key` | Phím (`Escape`, `Enter`, `Tab`) | `Escape` để đóng lịch/hộp nổi hay che nút |
| `browser_hover`, `browser_drag`, `browser_drop` | Rê chuột, kéo thả | |
| `browser_file_upload` | Chọn tệp để tải lên | Gọi SAU khi bấm nút "Chọn tệp"; đường dẫn tuyệt đối |
| `browser_handle_dialog` | Trả lời hộp thoại `alert/confirm` của trình duyệt | Không trả lời thì mọi lệnh sau đứng im |

## Chờ, đọc dữ liệu, gỡ lỗi

| Công cụ | Việc | Ghi nhớ |
|---|---|---|
| `browser_wait_for` | Chờ chữ xuất hiện/biến mất, hoặc chờ N giây | Chờ theo CHỮ đáng tin hơn chờ thời gian |
| `browser_evaluate` | Chạy JS trong trang, trả kết quả | Cách lấy bảng/danh sách gọn nhất; trả về mảng đối tượng, đừng trả cả HTML |
| `browser_run_code_unsafe` | Chạy một tệp `.js` điều khiển `page` | Cho quy trình dài (đăng nhập, quét nhiều trang) — xem `viec-thuong-gap.md` |
| `browser_console_messages` | Đọc log console | Trang "im lặng" không chạy: xem lỗi JS ở đây |
| `browser_network_requests` | Danh sách yêu cầu mạng đã chạy | Tìm ra API thật của trang — nhiều khi gọi thẳng API còn nhanh hơn |
| `browser_network_request` | Tự gửi một yêu cầu (kèm cookie phiên đang đăng nhập) | Gọi API nội bộ sau khi đã đăng nhập |
| `browser_emulate_media` | Giả lập `print`, chế độ tối | Xem bản in của trang trước khi lưu PDF |
| `browser_close` | Đóng trình duyệt | Luôn làm khi xong việc |

## Mẹo chung

- **`ref` hết hạn khi trang đổi.** Bấm xong mà lệnh sau báo không tìm thấy phần tử → `browser_snapshot` lại rồi
  lấy `ref` mới. Đừng đoán `ref`.
- **Snapshot dài thì đừng đọc hết.** Trang danh sách lớn: dùng `browser_evaluate` lấy đúng các cột cần.
- **Trang dùng iframe**: snapshot có ghi rõ khung; thao tác vẫn theo `ref` bình thường.
- **Tìm được API là thắng.** `browser_network_requests` lộ ra endpoint JSON thì lấy dữ liệu bằng
  `browser_network_request` — gọn, không lo phân trang, không lo giao diện đổi.
- **Chụp ảnh để chèn báo cáo**: chụp xong nhớ đường dẫn tệp ảnh, chèn vào .docx bằng python-docx.
