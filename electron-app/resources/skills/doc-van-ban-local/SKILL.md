---
name: doc-van-ban-local
description: Đọc hiểu và tóm tắt văn bản từ file trong thư mục cục bộ (PDF — kể cả PDF scan, DOCX, DOC, XLSX, XLS, TXT, ảnh). Dùng skill này khi người dùng yêu cầu đọc, tóm tắt, phân tích nội dung một hoặc nhiều file văn bản trên máy — kể cả khi chỉ nói "đọc file này", "xem văn bản đó", "tóm tắt cho tôi", hoặc cung cấp đường dẫn file. Áp dụng ngay cả khi không nói rõ định dạng file.
---

# Skill: Đọc & hiểu văn bản cục bộ

## Mục tiêu

Đọc nội dung file văn bản trên máy người dùng, xử lý đúng ký tự Unicode tiếng Việt trong
đường dẫn, tóm tắt có cấu trúc, và hỏi lại khi cần xác định file chính.

**Nguyên tắc AWord (bắt buộc):**
- KHÔNG gửi nội dung văn bản cơ quan ra dịch vụ bên ngoài (Gemini, Google Vision, OCR online...).
  Mọi việc đọc diễn ra tại máy hoặc qua thị giác của Claude trong phiên chat.
- KHÔNG dùng OCR cục bộ (tesseract/easyocr — kém tiếng Việt, kéo thư viện nặng). PDF scan và ảnh
  đọc bằng THỊ GIÁC của Claude (Read tệp ảnh) — Claude là mô hình đa phương thức, đọc chữ trong ảnh
  chính xác hơn OCR truyền thống.

---

## Bước 1 — Xác định file cần đọc

### Nếu người dùng cung cấp đường dẫn cụ thể
Dùng ngay đường dẫn đó, chuyển sang Bước 2.

### Nếu người dùng chỉ nói chung chung ("đọc file trong thư mục này")
Dùng PowerShell để liệt kê file trong thư mục làm việc:

```powershell
Get-ChildItem "ĐƯỜNG_DẪN_THƯ_MỤC" -Recurse -Include "*.pdf","*.docx","*.doc","*.txt","*.xlsx","*.xls" |
  Select-Object Name, LastWriteTime, @{N='Size(KB)';E={[math]::Round($_.Length/1KB,1)}} |
  Sort-Object LastWriteTime -Descending
```

**Quy tắc khi có nhiều file:**
- Nếu ≤ 3 file → đọc tất cả, không hỏi
- Nếu 4–10 file → hỏi: "Tôi thấy các file sau, file nào là văn bản chính cần đọc hiểu?"
  Liệt kê tên + ngày sửa đổi để người dùng chọn
- Nếu > 10 file → hỏi thêm: "File nào là nguồn chính? File nào cung cấp dữ liệu bổ sung?"
  Phân biệt rõ vai trò: **văn bản chính** vs **dữ liệu tham chiếu**

---

## Bước 2 — Lấy đường dẫn chính xác (xử lý Unicode)

**QUAN TRỌNG:** Công cụ `Read` thường lỗi với đường dẫn có ký tự tiếng Việt.
Luôn dùng PowerShell để lấy đường dẫn chính xác trước:

```powershell
$file = Get-ChildItem "THƯ_MỤC_CHA" -Recurse -Filter "TÊN_FILE_GẦN_ĐÚNG*" | Select-Object -First 1
Write-Output $file.FullName
```

Sau đó dùng đường dẫn từ `$file.FullName` trong các bước tiếp theo.

---

## Bước 3 — Thư viện: máy AWord đã cài sẵn, chỉ bổ sung khi thiếu

Bộ cài AWord đã cài offline: `pdfplumber`, `python-docx`, `openpyxl`, `xlrd`, `pypdf`,
`pymupdf` (fitz), `pillow`, `lxml`, `defusedxml`, `pywin32`. Bình thường KHÔNG cần cài gì —
cứ chạy thẳng.

Chỉ khi gặp `ModuleNotFoundError`, chạy script kiểm tra/cài bù (ưu tiên kho wheel offline
của AWord, không có mới dùng mạng; luôn cài CỐ ĐỊNH `--user`, không cài tạm):

```powershell
python "%USERPROFILE%\.claude\skills\doc-van-ban-local\scripts\ensure_deps.py"
```

---

## Bước 4 — Đọc nội dung theo định dạng

### PDF (có lớp text — không phải scan)
```powershell
python -c "
import pdfplumber
with pdfplumber.open(r'ĐƯỜNG_DẪN') as pdf:
    for i, page in enumerate(pdf.pages):
        print(f'=== Trang {i+1} ===')
        t = page.extract_text()
        if t: print(t)
"
```

Nếu `pdfplumber` trả về rỗng/rất ít text trên trang có nội dung → đó là trang scan,
chuyển sang quy trình PDF scan bên dưới (có thể trộn: trang text đọc trực tiếp,
trang scan render thành ảnh).

### PDF scan (ảnh chụp — không có lớp text) — QUY TRÌNH NHANH

Dùng script đóng kèm skill — render trang thành **JPEG thang xám 150dpi có cache**
(nhỏ gấp 3–5 lần PNG 200dpi → đọc nhanh hơn hẳn; chạy lại cùng file KHÔNG render lại):

```powershell
python "%USERPROFILE%\.claude\skills\doc-van-ban-local\scripts\pdf_sang_anh.py" "ĐƯỜNG_DẪN.pdf"
```

- Script in ra danh sách đường dẫn ảnh (mỗi dòng một trang). Dùng công cụ `Read` đọc TỪNG ảnh —
  Claude đọc nội dung bằng thị giác, không cần OCR.
- Chỉ cần vài trang: thêm `--trang 1-3,7`. Văn bản có dấu đỏ/con dấu cần phân biệt màu: thêm `--mau`.
- Chữ quá nhỏ, đọc không rõ: chạy lại với `--dpi 200`.
- PDF dài (> 20 trang): render trước 5 trang đầu để nắm loại văn bản, hỏi người dùng cần
  tập trung phần nào rồi mới render tiếp.

### Ảnh rời (.png/.jpg/.tiff...)
Dùng công cụ `Read` đọc TRỰC TIẾP — không cần chuyển đổi gì.

### DOCX
```powershell
python -c "
from docx import Document
doc = Document(r'ĐƯỜNG_DẪN')
for para in doc.paragraphs:
    if para.text.strip(): print(para.text)
# Đọc cả bảng biểu nếu có
for table in doc.tables:
    for row in table.rows:
        print([cell.text.strip() for cell in row.cells])
"
```

### DOC / XLS đời cũ (định dạng nhị phân)
Ưu tiên chuyển đổi qua Word/Excel bằng COM (`pywin32`) — máy công sở thường có Microsoft Office.
Không có Office thì báo rõ cho người dùng, đề nghị họ lưu lại thành .docx/.xlsx.

### TXT
Dùng công cụ `Read` trực tiếp (sau khi đã lấy đường dẫn chính xác từ PowerShell).

### XLSX
```powershell
python -c "
import openpyxl
wb = openpyxl.load_workbook(r'ĐƯỜNG_DẪN', data_only=True)
for sheet in wb.sheetnames:
    ws = wb[sheet]
    print(f'=== Sheet: {sheet} ===')
    for row in ws.iter_rows(values_only=True):
        if any(c is not None for c in row):
            print(row)
"
```

---

## Bước 5 — Phát hiện loại văn bản & trình bày kết quả

Sau khi có nội dung, xác định loại văn bản:

| Loại | Dấu hiệu nhận biết | Cách trình bày |
|---|---|---|
| Văn bản hành chính | Có số ký hiệu, nơi nhận, kính gửi | Tiêu đề → Căn cứ → Nội dung chính → Yêu cầu/Giao việc |
| Kết luận họp | "Kết luận", phân công theo đơn vị | Nhiệm vụ chung → Bảng phân công theo đơn vị |
| Báo cáo | Tiêu đề báo cáo, phần kết | Tóm tắt → Các mục chính → Kết luận/Kiến nghị |
| Hợp đồng/Biên bản | Các bên, điều khoản | Các bên → Điều khoản chính → Hiệu lực |
| Dữ liệu/Bảng biểu | Cột, hàng, số liệu | Tóm tắt cấu trúc + số liệu nổi bật |

**Nguyên tắc trình bày:**
- Dùng bảng Markdown cho nội dung phân công/danh sách nhiệm vụ
- Dùng đầu mục (`###`) cho từng phần lớn
- Giữ nguyên số ký hiệu văn bản, ngày tháng, tên người ký
- Không bịa đặt nội dung ngoài file

---

## Xử lý lỗi thường gặp

| Lỗi | Nguyên nhân | Cách xử lý |
|---|---|---|
| `File does not exist` từ công cụ Read | Đường dẫn có ký tự Unicode | Dùng PowerShell lấy `$file.FullName` |
| `FileNotFoundError` trong Python | Truyền đường dẫn có dấu trực tiếp | Dùng biến PowerShell `$($file.FullName)` |
| PDF không có text | File scan/ảnh | `pdf_sang_anh.py` → Read từng ảnh bằng thị giác |
| Ảnh render mờ, đọc không rõ | DPI thấp so với cỡ chữ | Chạy lại `pdf_sang_anh.py --dpi 200` |
| `ModuleNotFoundError` | Thiếu thư viện Python | Chạy `ensure_deps.py` — cài cố định `--user`, ưu tiên wheel offline |
| Nội dung rỗng sau extract | PDF bảo vệ hoặc mã hóa | Thông báo và gợi ý mở khóa trước |
| Lỗi COM khi đọc .doc/.xls | Máy không có Microsoft Office | Báo người dùng, đề nghị lưu lại thành .docx/.xlsx |

---

## Lưu ý cuối

- Luôn trích dẫn tên file, số trang khi tóm tắt
- Nếu nội dung dài > 5 trang, hỏi người dùng muốn tóm tắt toàn bộ hay tập trung phần nào
- Văn bản hành chính: giữ nguyên văn phong chuẩn mực khi trình bày lại
