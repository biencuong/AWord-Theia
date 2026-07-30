---
name: nghiep-vu-tong-hop-bao-cao
description: Tổng hợp báo cáo từ văn bản đến trên VNPT iOffice cho chuyên viên Sở GD&ĐT — thu thập BC các đơn vị gửi (rà soát CSDL ngành cuối năm học, triển khai KH80/NQ57...), tải file đính kèm, trích nội dung PDF/DOCX, tổng hợp vào JSON + Excel + báo cáo Markdown. Dùng khi người dùng nói "tổng hợp báo cáo", "rà soát CSDL ngành", "tổng hợp BC các trường/đơn vị", "thu báo cáo qua iOffice", "tổng hợp KH80".
---

# Skill: Tổng hợp Báo cáo CSDL ngành Giáo dục

**Dùng cho:** Sở GD&ĐT — thu thập, tổng hợp báo cáo các đơn vị (trường học, UBND xã) gửi qua iOffice.

> **Nguyên tắc bảo mật (BẮT BUỘC):** tài khoản iOffice, cookie phiên và khóa API **không ghi
> trong skill này** — lấy từ phiên đăng nhập trình duyệt của người dùng và file cấu hình cục bộ
> (`auth.local.json`, `~\.claude\settings.json`). Chưa có cấu hình thì HỎI người dùng, dùng tạm
> trong phiên, và **chỉ lưu xuống máy khi người dùng đồng ý** (file chỉ nằm trên máy họ).
> TUYỆT ĐỐI không ghi bí mật vào file kết quả.

---

## Mô tả nghiệp vụ

Thu thập báo cáo kết quả rà soát, cập nhật, hoàn thiện dữ liệu cuối năm học từ các đơn vị
(trường học, UBND xã) gửi qua iOffice; trích xuất nội dung; tổng hợp vào file JSON + Excel +
báo cáo Markdown.

---

## Quy trình thực hiện (Step-by-step)

### Bước 1 — Quét văn bản đến trên iOffice
- Đăng nhập iOffice của cơ quan (ví dụ Sở GDĐT Tuyên Quang:
  `https://vpdttq.vnptioffice.vn/qlvbdh/main?lang=vi`) bằng **tài khoản iOffice của người dùng**
  (đã đăng nhập sẵn trên trình duyệt; không lưu mật khẩu vào skill).
- Vào **Văn bản đến → Chờ xử lý**
- Quét toàn bộ trang bằng JS:
  ```js
  page.gotoPage(n)  // lặp qua từng trang
  document.querySelectorAll("#dt_basic tbody tr[id^='vb_']")
  ```
- Lọc VB theo từ khóa trong `trich_yeu`:
  - `"rà soát"`, `"CSDL ngành"`, `"cuối năm học"`, `"hoàn thiện dữ liệu"`, `"bc kết quả rà soát"`
- Ghi lại: `doc_id`, `so_ky_hieu`, `trich_yeu`, `don_vi_ban_hanh`, `ngay_den`, `role_type_code`

### Bước 2 — Lấy URL file đính kèm
```js
// Gọi API nội bộ iOffice
NEORemoting.getRSet('qlvb.van_ban_den.getFileAttachLst("DOC_ID",0)', callback)
// Kết quả: [{hdd_file, name, file_size, ...}]

// Tạo URL download
var encPath = Base64_Coder.encode(hdd_file)
var encName = Base64_Coder.encode(name)
var url = 'https://vpdttq.vnptioffice.vn/qlvbdh/smartoffice/jbm/download.jsp?5E1XCBS.='
        + encodeURIComponent(encName) + '&5FpXTEW.=' + encodeURIComponent(encPath) + '&TFbm5O..=dmI~'
```

### Bước 3 — Tải file PDF bằng Python
```python
import urllib.request, ssl
# Cần 2 cookie: JSESSIONID + SESSIONID (lấy từ browser sau khi đăng nhập — KHÔNG hardcode)
req = urllib.request.Request(url, headers={
    'Cookie': f'JSESSIONID={JSESSIONID}; SESSIONID={SESSION}',
    'User-Agent': 'Mozilla/5.0',
    'Referer': 'https://vpdttq.vnptioffice.vn/qlvbdh/main'
})
ctx = ssl.create_default_context(); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_NONE
with urllib.request.urlopen(req, timeout=60, context=ctx) as r:
    data = r.read()
open(out_path, 'wb').write(data)
```

### Bước 4 — Đọc nội dung PDF
```python
import pdfplumber
with pdfplumber.open(pdf_path) as pdf:
    text = "\n".join(pg.extract_text() or "" for pg in pdf.pages)
# Lưu .txt song song với .pdf
Path(pdf_path.replace('.pdf','.pdf.txt')).write_text(text, encoding='utf-8')
```
- Nếu file là `.doc` cũ (binary): chuyển bằng Word COM (pywin32, máy có Office) hoặc LibreOffice CLI
- Nếu là `.docx`: dùng `python-docx`

### Bước 5 — Tổng hợp vào JSON
Cấu trúc mỗi entry trong `_tong_hop.json`:
```json
{
  "stt": 1,
  "unit": "Tên đơn vị",
  "place": "Tên xã/địa bàn",
  "so": "Số ký hiệu VB",
  "content": "Tóm tắt kết quả 9 nhóm dữ liệu...",
  "folder": "Đường dẫn thư mục đơn vị",
  "files": ["Đường dẫn file PDF"],
  "note": "Ghi chú nếu có (vd: gửi nhầm file)"
}
```

### Bước 6 — Cập nhật Excel (mẫu TH_RaSoatDuLieuCSDL)
```python
import openpyxl
wb = openpyxl.load_workbook(XLSX_PATH)
ws = wb['TH_RaSoatCSDL']
# 4 cột: STT | Tên cơ sở/đơn vị | Tên xã | Nội dung tổng hợp
ws.append([stt, unit, place, content])
wb.save(XLSX_PATH)
```
- **Không thêm/xóa cột** — giữ nguyên 4 cột mẫu gốc
- Kiểm tra trùng theo tên đơn vị trước khi thêm

### Bước 7 — Tạo/cập nhật Báo cáo tổng hợp (.md)
Trong AWord, việc tóm tắt từng đơn vị và viết báo cáo tổng hợp do **chính trợ lý thực hiện
trực tiếp** (đọc các file .txt đã trích → viết .md), KHÔNG cần gọi API LLM riêng.
Nếu chạy script tự động ngoài AWord (`regen_baocao.py`): endpoint + khóa API đọc từ biến môi
trường `AWORD_LLM_URL` / `AWORD_LLM_KEY` (hoặc `env` trong `~\.claude\settings.json`) —
không hardcode khóa vào script.

### Bước 8 — Kết thúc VB trên iOffice
```js
// Tích checkbox
var row = document.querySelector("tr[flyid='DOC_ID']")
row.querySelector('input[type=checkbox]').checked = true

// Bấm Kết thúc hàng loạt
document.querySelector('button.btn-warning').click()  // "Kết thúc hàng loạt"
```
**CHỈ bấm "Kết thúc" sau khi người dùng xác nhận đã tổng hợp xong VB đó.**

---

## Cấu trúc thư mục làm việc

Gốc do người dùng chọn (ví dụ thư mục nghiệp vụ trên Google Drive của cơ quan):

```
<THƯ MỤC GỐC>\RaSoatDuLieu\01_DonDocCuoiNam\<NĂM HỌC>\
├── _tong_hop.json                        ← Dữ liệu tổng hợp tất cả đơn vị
├── TH_RaSoatDuLieuCSDL-<NĂM HỌC>.xlsx   ← Excel tổng hợp (mẫu gốc, 4 cột)
├── BC_TongHop_RaSoatCSDL_<NĂM HỌC>.md   ← Báo cáo tổng hợp
├── 01_UBND xã .....\
│   └── Báo cáo CSDL ngành.pdf
└── NN_Tên đơn vị\
    ├── file_BC.pdf
    └── file_BC.pdf.txt                  ← Text trích từ PDF
```

---

## File Excel mẫu — Cấu trúc cố định

| Cột | Tên | Ghi chú |
|-----|-----|---------|
| A | STT | Số thứ tự |
| B | Tên cơ sở/đơn vị | Tên đầy đủ |
| C | Tên xã | Địa bàn (xã/thị trấn) |
| D | Nội dung tổng hợp | Tóm tắt kết quả 9 nhóm dữ liệu |

Sheet: `TH_RaSoatCSDL`
**Lưu ý: KHÔNG thêm/xóa/dịch chuyển cột. Giữ nguyên 4 cột này.**

---

## 9 Nhóm dữ liệu CSDL cần rà soát

| # | Nhóm dữ liệu |
|---|---|
| 1 | Hồ sơ trường, điểm trường, loại hình, đơn vị chủ quản, địa chỉ, tọa độ |
| 2 | Lớp học, khối lớp, môn học, phân công chuyên môn |
| 3 | Đội ngũ (CBQL, GV, NV) |
| 4 | Học sinh (hồ sơ, định danh cá nhân) |
| 5 | Chuyên cần, kết quả học tập, rèn luyện, cuối năm |
| 6 | Học bạ số |
| 7 | Cơ sở vật chất |
| 8 | Thiết bị dạy học |
| 9 | Làm sạch dữ liệu |

---

## Môi trường kỹ thuật

| Thành phần | Giá trị |
|---|---|
| Python | Bộ Python AWord cài kèm (hoặc python có sẵn trên máy) |
| Encoding | `set PYTHONIOENCODING=utf-8` trước khi chạy |
| Thư viện | `pdfplumber`, `openpyxl`, `python-docx`, `rarfile` |
| iOffice URL | URL iOffice của cơ quan (vd `https://vpdttq.vnptioffice.vn/qlvbdh/`) |
| iOffice account | Tài khoản của người dùng — phiên trình duyệt/`auth.local.json`, KHÔNG ghi vào skill |

---

## Các lưu ý quan trọng

- **KHÔNG** tạo văn bản đi / không bấm nút đổi trạng thái VB ngoài "Kết thúc"
- File `.doc` cũ (binary): `python-docx` không đọc được → Word COM hoặc LibreOffice CLI
- Đơn vị gửi nhầm file (xlsx biểu mẫu thay vì BC): ghi note, yêu cầu gửi lại
- Cookie iOffice: cần cả `JSESSIONID` + `SESSIONID` mới tải được file
- Mỗi năm học mới: tạo thư mục mới `YYYY-YYYY\`, copy mẫu Excel, bắt đầu từ stt=1

---

## Scripts kèm theo skill

| Script | Chức năng |
|---|---|
| `update_excel.py` | Cập nhật Excel tổng hợp từ `_tong_hop.json` (kiểm trùng theo tên đơn vị) |
| `regen_baocao.py` | Tái tạo báo cáo tổng hợp .md (endpoint/key qua biến môi trường) |

Scripts nằm ngay trong thư mục skill này (`~\.claude\skills\nghiep-vu-tong-hop-bao-cao\`);
thư mục làm việc đặt qua biến môi trường `AWORD_TH_WORKDIR` (mặc định: thư mục hiện hành).

Các script THEO ĐỢT (tải file từ iOffice với cookie phiên, thêm entries vào JSON, tạo thư
mục đơn vị...) mang dữ liệu cụ thể từng đợt — trợ lý tự viết mới mỗi đợt theo code mẫu ở
các bước trên, chạy trong thư mục làm việc, KHÔNG lưu cookie/dữ liệu đợt vào thư mục skill.

---

## Nghiệp vụ 2: Tổng hợp BC Triển khai KH80/NQ57

**Mục đích:** Thu thập BC tổng kết triển khai KH số 80/KH-SGDĐT (KHCN, ĐMST, CĐS) từ các
trường gửi qua iOffice → tổng hợp Excel + .md

**Thư mục đầu ra:** `<THƯ MỤC GỐC>\NQ57\<NĂM>\12_BC-Trienkhai KH80 cua So\`

**Quy trình:**
1. Vào iOffice → **Văn bản đến chờ xử lý** → click filter **[XLC]** (span.color_clk[c-val="xlc"])
2. Tìm kiếm từ khóa **"tổng kết"** trong ô tìm kiếm
3. Chọn đúng VB có trích yếu: *"tổng kết việc triển khai thực hiện nhiệm vụ phát triển khoa học, công nghệ, đổi mới sáng tạo và chuyển đổi số năm học ..."*
4. Lấy file đính kèm qua API: `NEORemoting.getRSet('qlvb.van_ban_den.getFileAttachLst("DOC_ID",0)', callback)`
5. Tải PDF bằng Python (cần cả JSESSIONID + SESSIONID từ phiên trình duyệt)
6. Đọc PDF bằng pdfplumber → .txt
7. Tóm tắt từng đơn vị (trợ lý làm trực tiếp) → lưu `_summary.json` → `_tomtat_all.json`
8. Viết báo cáo tổng hợp → `BC_TongHop_TrienKhai_KH80_YYYY-YYYY.md`
9. Tạo Excel: `TH_TrienKhaiKH80_YYYY-YYYY.xlsx` (sheet TH_TrienKhaiKH80)
10. Tick checkbox các VB → click "Kết thúc hàng loạt" (sau khi người dùng xác nhận)

**Cấu trúc Excel:**
| Cột | Nội dung |
|-----|----------|
| A | STT |
| B | Tên đơn vị (trường) |
| C | Số văn bản |
| D | Ngày BC |
| E | Cấp trường |
| F | Hiệu trưởng ký |
| G | Nội dung tổng hợp (tóm tắt) |
| H | Ghi chú |

**Lưu ý quan trọng:**
- Từ 01/7/2025 không còn cấp huyện/Phòng GD — BC gửi thẳng từ trường lên Sở
- Chỉ lấy VB role **XLC** (Xử lý chính), **không** lấy PH/QH
- Đơn vị gửi 2 file PDF giống nhau → chỉ đọc file 1
- Bước tóm tắt có cache: nếu đã có `_summary.json` thì không tóm tắt lại
- Mỗi lần thêm đơn vị mới: tạo thư mục `NN_TenTruong`, tải PDF, chạy lại bước 7→8→9
