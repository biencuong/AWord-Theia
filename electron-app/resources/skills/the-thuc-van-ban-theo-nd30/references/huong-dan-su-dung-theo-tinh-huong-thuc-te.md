# Hướng dẫn sử dụng theo tình huống thực tế

## 1. Soạn mới công văn hoặc quyết định
- Chuẩn bị JSON spec
- Chạy `create_nd30_docx.py`
- Chạy `preview_nd30_layout.py` để xem bố cục có sát mẫu và đúng ND30 không

## 2. Kiểm tra một file Word sẵn có
- Chạy `check_nd30_docx.py`
- Chạy `preview_nd30_layout.py` để render và phát hiện các lỗi vỡ khối tiêu ngữ / ký / nơi nhận

## 3. Rà nội dung bằng model mặc định của QwenPaw
- Chạy `review_nd30_language.py` để tạo normalized input và prompt payload
- Để model hiện tại của QwenPaw tạo JSON findings theo prompt contract
- Chạy lại script để validate và xuất report

## 4. Áp các sửa an toàn vào DOCX
- Xem danh sách rewrite được đánh số
- Dùng `apply_nd30_rewrites.py --select 1,3,4`
- Nhận lại DOCX đã chỉnh an toàn + preview diff
