# Quy trình build lặp lại an toàn

Khi soạn thảo văn bản dựa trên mẫu nguồn và phải sửa nhiều vòng theo phản hồi thực tế (bố cục,
thể thức, câu chữ...), sửa chồng lên file đã sửa nhiều lần rất dễ phá cấu trúc mà khó phát hiện
ngay. Áp dụng 5 bước sau:

## 1. Luôn copy lại mẫu gốc sạch trước mỗi lần build lại

Không patch chồng lên file đích đã qua nhiều lần sửa — copy lại file mẫu nguồn nguyên bản về file
đích, rồi chạy lại toàn bộ script build từ đầu. Vá từng phần lên file đã biến dạng nhiều lần rủi ro
cao hơn nhiều so với build lại từ trạng thái sạch đã biết.

## 2. Một script build duy nhất, idempotent

Toàn bộ logic (nội dung + format + shape + orphan-fix + kiểm soát spacing...) nằm trong **1** script
chạy trọn vẹn từ mẫu gốc đến file hoàn chỉnh — không phải chuỗi nhiều script vá nối tiếp nhau. Khi
có phản hồi mới, sửa trực tiếp trong script đó rồi chạy lại toàn bộ (bước 1), không viết thêm
script vá riêng.

## 3. Verify có mục tiêu, không đọc lại toàn văn bản

Sau mỗi lần build, viết script kiểm tra nhỏ, có mục tiêu cụ thể (dump paragraph formatting của
đúng đoạn cần kiểm tra, table properties, hoặc XML của shape vừa chèn) thay vì đọc lại toàn bộ nội
dung văn bản mỗi lần — nhanh hơn và tập trung đúng vào phần vừa sửa.

## 4. Chạy audit sau mỗi lần sửa

```bash
python scripts/check_nd30_docx.py output.docx --document-type <loai-van-ban>
```

## 5. So sánh cảnh báo với chính mẫu gốc chưa sửa

Trước khi coi 1 cảnh báo audit là "lỗi tôi gây ra", chạy lại `check_nd30_docx.py` trên **chính file
mẫu gốc chưa qua chỉnh sửa nào**:

```bash
python scripts/check_nd30_docx.py mau-goc.docx --document-type <loai-van-ban>
```

Nếu cảnh báo đó **đã xuất hiện y hệt** trên mẫu gốc, đó là hạn chế của công cụ dò (ví dụ không đọc
được nội dung trong bảng, nhận nhầm loại văn bản khi có nhiều bảng phụ lục) — không phải lỗi mới.
Chỉ cảnh báo **mới xuất hiện** sau khi sửa mới cần điều tra/vá.

## Xử lý file đang mở trong Word

Ghi đè file có thể gặp `PermissionError`/`IOError` nếu file đang mở trong Word. Bắt lỗi này rõ
ràng và yêu cầu người dùng đóng file trước khi thử lại — không âm thầm bỏ qua hay báo thành công
giả.

```python
try:
    doc.save(output_path)
except PermissionError:
    print(f'Khong the ghi {output_path} - co the dang mo trong Word. Dong file roi thu lai.')
    raise
```
