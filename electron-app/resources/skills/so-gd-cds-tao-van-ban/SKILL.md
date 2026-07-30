---
name: so-gd-cds-tao-van-ban
description: Soạn thảo văn bản hành chính chuẩn NĐ30 cho Sở GD&ĐT Tuyên Quang — tạo Kế hoạch (KH), Công văn (CV), Quyết định (QĐ) từ template docx chuẩn phát hành. Dùng skill này khi người dùng yêu cầu soạn/tạo kế hoạch, công văn, quyết định của Sở, văn bản triển khai CDS/NQ57, hoặc nói "tạo văn bản", "soạn KH/CV/QĐ". LUÔN copy template rồi sửa, KHÔNG tạo docx từ đầu.
---

# SKILL: Soạn thảo văn bản hành chính — Sở GD&ĐT Tuyên Quang

**Nghiệp vụ:** Tạo Kế hoạch (KH), Công văn (CV), Quyết định (QĐ) cho Sở GD&ĐT TQ  
**Phiên bản:** 1.1 — 16/7/2026  
**Tác giả:** Bùi Biên Cương (biencuong.hg@gmail.com)

> **ĐƯỜNG DẪN GOOGLE DRIVE KHÁC NHAU THEO MÁY:** máy này là `G:\My Drive\`, máy khác có thể
> là `E:\Drive của tôi\`. Mọi đường dẫn `E:\Drive của tôi\...` trong tài liệu này phải quy đổi
> theo máy đang dùng. Trong script Python, luôn dò gốc Drive trước:
>
> ```python
> from pathlib import Path
> DRIVE = next(p for p in [Path(r"G:\My Drive"), Path(r"E:\Drive của tôi")] if p.exists())
> KH_TMPL = str(DRIVE / r"TUYEN QUANG\CDS\2026\02_Ke_hoach_Quy_che_Kinh_phi\00_TongHop"
>                       r"\20260101_SGD_KH-115_ke-hoach-thuc-hien-tuyenquang-2026-chuan-phat-hanh-tich-hop-phat-hanh.docx")
> ```

---

## 1. NGUYÊN TẮC CỐT LÕI

> **TUYỆT ĐỐI KHÔNG** tạo file docx từ đầu bằng `Document()`.  
> **LUÔN LUÔN** `shutil.copy2(TEMPLATE, OUTPUT)` rồi mới sửa nội dung.

> **LUẬT của người dùng (28/7/2026 — bắt buộc mọi văn bản):**
> 1. Số ký hiệu, ngày ban hành của MỌI văn bản viện dẫn phải **đọc bằng mắt LLM** từ bản
>    PDF ban hành (render trang 1 ra ảnh rồi nhìn) — text layer thường mất số điền tay
>    (vd CV 45/CV-THHVT: text trống nhưng ảnh có số); không suy từ tên file, không bịa.
> 2. Kính gửi/nơi nhận: **cơ quan cấp trên đứng dòng trên** (UBND xã trước trường học...).
> 3. Danh mục văn bản chỉ đạo **sắp theo thứ bậc hành chính** (TW/Bộ → UBND tỉnh → Sở),
>    trong cùng cấp thì **thời gian cũ lên trước**.

Lý do: tạo mới bị lỗi thể thức header/footer (đơn vị, quốc hiệu, tiêu ngữ, nơi nhận, chữ ký) — 99% văn bản sai ở chỗ đó.

> **BẮT BUỘC CÓ CĂN CỨ KH CỦA SỞ:** Mọi KH/CV/QĐ của Sở về CDS phải có ít nhất 1 căn cứ là Kế hoạch của Sở gần nhất, cụ thể:
> - **56/KH-SGDĐT ngày 09/4/2026** — KH triển khai KH115/KH-BCĐ + KH148/KH-UBND trong ngành GD *(KH CDS chủ đạo của Sở năm 2026)*
> - **38/KH-SGDĐT ngày 16/3/2026** — KH chi tiết về KHCN, ĐMST, CĐS năm 2026

---

## 2. PHÂN CÔNG NHÂN SỰ (BẮT BUỘC DÙNG ĐÚNG)

### Lãnh đạo ký văn bản

| Loại VB | Người ký | Thể hiện trong VB |
|---------|----------|-------------------|
| Kế hoạch (KH) | Vũ Đình Hưng | `GIÁM ĐỐC` / `Vũ Đình Hưng` |
| Công văn (CV) | Đinh Thế Hiệp | `KT. GIÁM ĐỐC` / `PHÓ GIÁM ĐỐC` / `Đinh Thế Hiệp` |
| Quyết định (QĐ) | Vũ Đình Hưng | `GIÁM ĐỐC` / `Vũ Đình Hưng` |

### Phòng ban chủ chốt

| Phòng | Trưởng phòng | Chuyên viên đầu mối |
|-------|-------------|---------------------|
| HSSV-KHCNTT | Vũ Trọng Hiền | Bùi Biên Cương (CDS), Nguyễn Văn Binh (GD dân tộc) |
| Văn phòng Sở | | |
| KH-TC | | |

> ⚠️ **Không có "Phòng Giáo dục dân tộc"** — chức năng này thuộc Phòng HSSV-KHCNTT (đ/c Nguyễn Văn Binh).  
> Tham chiếu: QĐ 50/QĐ-SGDĐT ngày 10/7/2025 (chỉ dùng nội bộ, **không đưa vào căn cứ văn bản**).

---

## 3. TEMPLATE CÁC LOẠI VĂN BẢN

### 3.1 Template Kế hoạch (dùng cho KH và CV)

```
E:\Drive của tôi\TUYEN QUANG\CDS\2026\02_Ke_hoach_Quy_che_Kinh_phi\00_TongHop\
20260101_SGD_KH-115_ke-hoach-thuc-hien-tuyenquang-2026-chuan-phat-hanh-tich-hop-phat-hanh.docx
```

**Cấu trúc body (python-docx):**

```
[0]   TABLE 3×2 — HEADER (org name + motto + số VB + ngày)
[1-117]  PARA    — Nội dung (XÓA HẾT, thay mới)
[118] TABLE 1×2 — FOOTER (Nơi nhận | Giám đốc Vũ Đình Hưng)
[119+]   TABLE   — Phụ lục (giữ hoặc xóa tùy VB)
```

**Chi tiết bảng Header Row[0]:**
```
Col[0]: Para[0]="UBND TỈNH TUYÊN QUANG"
        Para[1]="SỞ GIÁO DỤC VÀ ĐÀO TẠO"
        Para[2]="" (trống)
        Para[3]="Số: .../KH-SGDĐT"   ← CẬP NHẬT ĐOẠN NÀY
Col[1]: Para[0]="CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"
        Para[1]="Độc lập - Tự do - Hạnh phúc"
        Para[2]="" (trống)
        Para[3]="Tuyên Quang, ngày..."  ← CẬP NHẬT ĐOẠN NÀY

Row[2] Col[0]: 1 đoạn DUY NHẤT với <w:br/> bên trong: "KẾ HOẠCH\n[tiêu đề]"
               → dùng update_title_para_with_break()
```

**Để làm Công văn:** Xóa hàng Row[2] khỏi bảng header (còn 2 hàng).

> ⚠️ Mẫu này (KH-115 cắt hàng tiêu đề) dùng cho CV **chỉ đạo/phân công/thông báo** thông
> thường. **KHÔNG dùng cho nghiệp vụ GÓP Ý** (xem mục 3.2) — cấu trúc bảng đầu khác nhau
> (V/v nằm NGOÀI bảng ở mẫu này, nhưng nằm TRONG cell bảng đầu ở mẫu góp ý), dùng nhầm sẽ
> sai thể thức nghiêm trọng (đã xảy ra thực tế 20/7/2026 — xem `lessons.md`).

### 3.2 Template Công văn GÓP Ý (dùng cho nghiệp vụ góp ý dự thảo văn bản của cơ quan khác)

```
G:\My Drive\TUYEN QUANG\CDS\2026\08_Gop_y\20_DeAn_PTKTDL\CV_gop_y_SGDDT_DeAn_KTDL_CNDL.docx
```

Dùng khi Sở GD&ĐT được xin ý kiến/góp ý dự thảo văn bản của cơ quan khác (không phải soạn
CV chỉ đạo/phân công của Sở). Đây là mẫu ĐÃ PHÁT HÀNH THẬT, khác hẳn mẫu KH-115 ở mục 3.1.

**Cấu trúc body (python-docx) — chỉ 2 bảng, KHÔNG có phụ lục kèm theo:**

```
[0]  TABLE 1×2 — HEADER (org name + Số + V/v NẰM TRONG cell[0,0]; quốc hiệu + ngày ở cell[0,1])
[..] PARA — Kính gửi (CENTER, 1 dòng nếu 1 nơi nhận) → nội dung (XÓA HẾT, thay mới)
[N]  TABLE 1×2 — FOOTER (Nơi nhận | KT. GIÁM ĐỐC/PHÓ GIÁM ĐỐC Đinh Thế Hiệp)
[N+1] SECTPR
```

**Chi tiết bảng Header (khác mẫu KH-115 — V/v nằm TRONG bảng, không phải đoạn riêng bên ngoài):**
```
Cell[0,0]: Para[0]="UBND TỈNH TUYÊN QUANG" (đậm)
           Para[1]="SỞ GIÁO DỤC VÀ ĐÀO TẠO" (đậm)
           Para[2]="" (trống)
           Para[3]="Số:           /SGDĐT-HSSVKHCNTT"   ← CẬP NHẬT
           Para[4]="V/v [trích yếu]"                    ← CẬP NHẬT (không đậm, không nghiêng, cỡ 12)
Cell[0,1]: Para[0]="CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM" (đậm)
           Para[1]="Độc lập - Tự do - Hạnh phúc" (đậm)
           Para[2]="" (trống)
           Para[3]="Tuyên Quang, ngày     tháng ... năm ..."  ← CẬP NHẬT (nghiêng)
```

**Nội dung thân bài (mẫu chuẩn quan sát được từ văn bản thật):**
1. `Kính gửi: [cơ quan chủ trì xin ý kiến].` — CENTER nếu 1 nơi nhận.
2. Đoạn 1: "[Tên Sở] nhận được Công văn số .../... ngày .../... của [cơ quan] về việc xin ý
   kiến/góp ý dự thảo ...; hồ sơ gồm: ... (sau đây gọi là dự thảo)."
3. Đoạn 2: "Sau khi nghiên cứu, [Tên Sở] cơ bản thống nhất với ...; đề nghị [cơ quan] tổng
   hợp một số ý kiến sau:"
4. Từng mục "1. Về ...", "2. Về ..." (đậm, không đánh số La Mã) — mỗi mục có thể có đoạn dẫn
   thường rồi các ý a) b) c) (không đậm) — TẤT CẢ đoạn thân bài (kể cả a) b) c)) dùng chung
   1 kiểu paragraph: justify, thụt đầu dòng đầu 0.5in (720 twips), space before/after 120
   twips (~6pt) — không cần tự set vì đã kế thừa `docDefaults`/pPr sẵn trong mẫu, **clone
   nguyên paragraph node có sẵn rồi chỉ thay chữ trong run** (xem hàm `clone_para` /
   `set_single_run_text` trong script mẫu) thay vì tự dựng `OxmlElement` từ đầu — an toàn và
   đúng font/cỡ chữ tuyệt đối vì lấy nguyên rPr gốc.
5. Kết: "[Tên Sở] trân trọng đề nghị [cơ quan] tổng hợp./." — đoạn cuối có space_after lớn
   hơn (~12pt) so với đoạn thường.

**Nơi nhận mặc định:** `- Như trên; - Lãnh đạo Sở (báo cáo); - Lưu: VT, HSSV-KHCNTT (Cương).`
Chữ ký mặc định: `KT. GIÁM ĐỐC / PHÓ GIÁM ĐỐC / Đinh Thế Hiệp` (giữ nguyên, không cần sửa).

> ⚠️ Đây là mẫu duy nhất được xác nhận đúng cho nghiệp vụ góp ý — KHÔNG dùng mẫu KH-115
> (mục 3.1) rồi tự bịa cấu trúc bảng đầu/đoạn mở, sẽ sai thể thức dù script chạy không lỗi.

---

## 4. SCRIPT MẪU

```python
"""
Tạo văn bản KH/CV từ template — Sở GD&ĐT TQ
SKILL: so-gd-cds-tao-van-ban v1.0
"""
import sys, shutil
sys.stdout.reconfigure(encoding='utf-8')

from docx import Document
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

NS  = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
TNR = 'Times New Roman'

from pathlib import Path
DRIVE = next((p for p in (Path(r"G:\My Drive"), Path(r"E:\Drive của tôi")) if p.exists()), None)
if DRIVE is None:
    sys.exit("Không tìm thấy Google Drive (G:\\My Drive hoặc E:\\Drive của tôi)")

KH_TMPL = str(DRIVE / r"TUYEN QUANG\CDS\2026\02_Ke_hoach_Quy_che_Kinh_phi\00_TongHop"
                      r"\20260101_SGD_KH-115_ke-hoach-thuc-hien-tuyenquang-2026"
                      r"-chuan-phat-hanh-tich-hop-phat-hanh.docx")

# ── Helpers ──────────────────────────────────────────────────────────────────

def get_text(el):
    return ''.join(t.text or '' for t in el.findall(f'.//{{{NS}}}t'))

def make_run(text, size=13, bold=False, italic=False):
    r = OxmlElement('w:r')
    rPr = OxmlElement('w:rPr')
    rf = OxmlElement('w:rFonts')
    rf.set(qn('w:ascii'), TNR); rf.set(qn('w:hAnsi'), TNR); rf.set(qn('w:cs'), TNR)
    rPr.insert(0, rf)
    for tag in ('w:sz','w:szCs'):
        e=OxmlElement(tag); e.set(qn('w:val'), str(size*2)); rPr.append(e)
    if bold:  rPr.append(OxmlElement('w:b'))
    if italic: rPr.append(OxmlElement('w:i'))
    r.insert(0, rPr)
    t = OxmlElement('w:t'); t.text = text
    if text and (text[0]==' ' or text[-1]==' '):
        t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    r.append(t)
    return r

def make_para(text='', bold=False, size=13, italic=False,
              align='both', sp_before=0, sp_after=100,
              first_line=None, left_indent=None):
    p = OxmlElement('w:p')
    pPr = OxmlElement('w:pPr')
    jc = OxmlElement('w:jc'); jc.set(qn('w:val'), align); pPr.append(jc)
    sp = OxmlElement('w:spacing')
    sp.set(qn('w:before'), str(sp_before)); sp.set(qn('w:after'), str(sp_after))
    pPr.append(sp)
    if first_line or left_indent:
        ind = OxmlElement('w:ind')
        if first_line:  ind.set(qn('w:firstLine'), str(int(first_line*567)))
        if left_indent: ind.set(qn('w:left'),      str(int(left_indent*567)))
        pPr.append(ind)
    p.append(pPr)
    if text:
        p.append(make_run(text, size=size, bold=bold, italic=italic))
    return p

def find_footer_tbl(body):
    for child in body:
        if child.tag==f'{{{NS}}}tbl' and 'Nơi nhận' in get_text(child):
            return child
    return None

def clear_content(doc):
    """Xóa nội dung giữa header table và footer table."""
    body = doc.element.body
    children = list(body)
    header_el = children[0]
    footer_el = find_footer_tbl(body)
    if footer_el is None:
        raise RuntimeError("Không tìm thấy bảng Nơi nhận")
    collecting = False
    to_del = []
    for el in children:
        if el is header_el: collecting=True; continue
        if el is footer_el: break
        if collecting: to_del.append(el)
    for el in to_del: body.remove(el)
    return footer_el

def update_so_ngay(doc, so_vb, ngay_thang):
    """Cập nhật số VB và ngày trong header."""
    tbl = doc.tables[0]
    for cell, txt in [(tbl.cell(0,0), f'Số: {so_vb}'),
                      (tbl.cell(0,1), ngay_thang)]:
        p = cell.paragraphs[-1]._p
        for r in list(p.findall(f'{{{NS}}}r')): p.remove(r)
        p.append(make_run(txt, size=13, italic=(cell==tbl.cell(0,1))))

def update_tieu_de_kh(doc, dong1, dong2):
    """Cập nhật tiêu đề KH (row[2] có <w:br/>)."""
    cell = doc.tables[0].cell(2,0)
    p = cell.paragraphs[0]._p
    for child in list(p):
        if child.tag.split('}')[-1] in ('r','br','hyperlink'): p.remove(child)
    p.append(make_run(dong1, size=14, bold=True))
    br_r = OxmlElement('w:r'); br_r.append(OxmlElement('w:br')); p.append(br_r)
    p.append(make_run(dong2, size=14, bold=True))

def xoa_hang_tieu_de(doc):
    """Xóa hàng tiêu đề (row[2]) khỏi header table — dùng cho CV."""
    tbl_el = doc.tables[0]._tbl
    rows = tbl_el.findall(f'{{{NS}}}tr')
    if len(rows) >= 3: tbl_el.remove(rows[2])

def update_noi_nhan(doc, recipients):
    """Cập nhật Nơi nhận."""
    for tbl in doc.tables:
        if 'Nơi nhận' in get_text(tbl._element):
            tc = tbl.cell(0,0)._tc
            paras = tc.findall(f'{{{NS}}}p')
            for p in paras[1:]: tc.remove(p)
            for line in recipients:
                tc.append(make_para(line, size=12, align='left', sp_after=40))
            return

def update_ky_ten(doc, chuc_danh_list, ho_ten):
    """Cập nhật ô chữ ký (col cuối của footer table)."""
    for tbl in doc.tables:
        if 'Nơi nhận' in get_text(tbl._element):
            tc = tbl.rows[0].cells[-1]._tc
            for p in list(tc.findall(f'{{{NS}}}p')): tc.remove(p)
            for cd in chuc_danh_list:
                tc.append(make_para(cd, bold=True, size=13, align='center', sp_after=40))
            for _ in range(3):
                tc.append(make_para('', size=13, align='center', sp_after=40))
            tc.append(make_para(ho_ten, bold=True, size=13, align='center', sp_after=0))
            return

def ins_before(footer_el, p_el):
    footer_el.addprevious(p_el)


# ── Tạo Kế hoạch ─────────────────────────────────────────────────────────────

def tao_ke_hoach(so_vb, ngay_thang, tieu_de, noi_dung_func, noi_nhan, out_path):
    """
    so_vb       : ví dụ '42/KH-SGDĐT'
    ngay_thang  : ví dụ 'Tuyên Quang, ngày 25 tháng 6 năm 2026   '
    tieu_de     : ('KẾ HOẠCH', 'Triển khai...')  — tuple 2 dòng
    noi_dung_func: hàm nhận (footer_el, ins_fn) và chèn nội dung
    noi_nhan    : list các dòng Nơi nhận
    out_path    : đường dẫn file đầu ra
    """
    shutil.copy2(KH_TMPL, out_path)
    doc = Document(out_path)
    footer_el = clear_content(doc)
    update_so_ngay(doc, so_vb, ngay_thang)
    update_tieu_de_kh(doc, tieu_de[0], tieu_de[1])
    update_noi_nhan(doc, noi_nhan)
    # Mặc định ký: GIÁM ĐỐC Vũ Đình Hưng
    # (đã có sẵn trong template, không cần gọi update_ky_ten)

    def ins(p): ins_before(footer_el, p)
    noi_dung_func(footer_el, ins)
    doc.save(out_path)
    print(f'✓ {out_path}')


# ── Tạo Công văn ──────────────────────────────────────────────────────────────

def tao_cong_van(so_vb, ngay_thang, vv_text, noi_dung_func, noi_nhan, out_path,
                 ky_ten=('KT. GIÁM ĐỐC', 'PHÓ GIÁM ĐỐC', 'Đinh Thế Hiệp')):
    """
    vv_text: nội dung dòng V/v
    ky_ten : tuple (dong1, dong2, ho_ten) — mặc định PGĐ Đinh Thế Hiệp
    """
    shutil.copy2(KH_TMPL, out_path)
    doc = Document(out_path)
    footer_el = clear_content(doc)
    update_so_ngay(doc, so_vb, ngay_thang)
    xoa_hang_tieu_de(doc)  # CV không có hàng tiêu đề
    update_noi_nhan(doc, noi_nhan)
    update_ky_ten(doc, list(ky_ten[:-1]), ky_ten[-1])

    def ins(p): ins_before(footer_el, p)
    # V/v
    ins(make_para(vv_text, size=13, align='center', sp_before=40, sp_after=60))
    noi_dung_func(footer_el, ins)
    doc.save(out_path)
    print(f'✓ {out_path}')


# ── Ví dụ sử dụng ────────────────────────────────────────────────────────────

if __name__ == '__main__':
    # Ví dụ tạo KH
    def noi_dung_kh_mau(footer_el, ins):
        ins(make_para('Căn cứ:', bold=False, size=13, sp_before=0, sp_after=60))
        ins(make_para('Kết luận số 868-KL/TU ngày 18/5/2026...', size=13,
                      sp_after=60, first_line=1))
        ins(make_para('I. MỤC ĐÍCH, YÊU CẦU', bold=True, size=13,
                      align='center', sp_before=60, sp_after=60))
        # ... thêm nội dung ...

    tao_ke_hoach(
        so_vb       = '42/KH-SGDĐT',
        ngay_thang  = 'Tuyên Quang, ngày 25 tháng 6 năm 2026   ',
        tieu_de     = ('KẾ HOẠCH', 'Nội dung kế hoạch...'),
        noi_dung_func = noi_dung_kh_mau,
        noi_nhan    = ['- UBND tỉnh (để báo cáo);', '- Lưu: VT, HSSV&KHCNTT.'],
        out_path    = str(DRIVE / r'TUYEN QUANG\CDS\2026\KH_mau.docx'),
    )
```

### 4.2 Script mẫu — Công văn GÓP Ý (clone-and-patch từ mục 3.2)

Dùng đúng mẫu `CV_gop_y_SGDDT_DeAn_KTDL_CNDL.docx` (mục 3.2) — KHÔNG dùng `KH_TMPL` ở trên.
Kỹ thuật: clone nguyên `<w:p>` node có sẵn trong mẫu (giữ trọn `pPr`/`rPr` gốc — font, cỡ
chữ, thụt dòng, canh lề, đậm/nhạt đều đúng tuyệt đối), chỉ thay chữ trong run.

```python
import shutil, copy
from docx import Document

NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
GOPY_TMPL = str(DRIVE / r"TUYEN QUANG\CDS\2026\08_Gop_y\20_DeAn_PTKTDL"
                        r"\CV_gop_y_SGDDT_DeAn_KTDL_CNDL.docx")

def get_text(el):
    return ''.join(t.text or '' for t in el.findall(f'.//{{{NS}}}t'))

def set_single_run_text(p_el, new_text):
    """Xoá hết run, chèn 1 run mới copy rPr từ run đầu (giữ nguyên font/size/bold/italic)."""
    runs = p_el.findall(f'{{{NS}}}r')
    if not runs: return
    rPr = runs[0].find(f'{{{NS}}}rPr')
    for r in runs: p_el.remove(r)
    new_r = p_el.makeelement(f'{{{NS}}}r', {})
    if rPr is not None: new_r.append(copy.deepcopy(rPr))
    t = new_r.makeelement(f'{{{NS}}}t', {}); t.text = new_text
    if new_text and (new_text[0] == ' ' or new_text[-1] == ' '):
        t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    new_r.append(t); p_el.append(new_r)

def clone_para(p_el, new_text):
    new_p = copy.deepcopy(p_el)
    set_single_run_text(new_p, new_text)
    return new_p

def tao_cv_gop_y(so_vb, ngay_thang, vv_text, kinh_gui_text, doan_func, out_path):
    shutil.copy2(GOPY_TMPL, out_path)
    doc = Document(out_path)

    # 1. Cập nhật Số / V-v / Ngày (NẰM TRONG bảng đầu, khác mẫu KH-115)
    hdr = doc.tables[0]
    set_single_run_text(hdr.cell(0,0).paragraphs[3]._p, f'Số:           /{so_vb}')
    set_single_run_text(hdr.cell(0,0).paragraphs[4]._p, vv_text)
    set_single_run_text(hdr.cell(0,1).paragraphs[3]._p, ngay_thang)

    # 2. Tìm bảng chữ ký (footer) + các paragraph mẫu để clone
    body = doc.element.body
    children = list(body)
    footer_el = next(el for el in children
                      if el.tag == f'{{{NS}}}tbl' and 'Nơi nhận' in get_text(el))
    kinh_gui_tpl = plain_tpl = heading_tpl = closing_tpl = None
    for el in children:
        if el.tag != f'{{{NS}}}p': continue
        txt = get_text(el).strip()
        if txt.startswith('Kính gửi'): kinh_gui_tpl = el
        elif txt.startswith('Sở Giáo dục và Đào tạo nhận được Công văn số'): plain_tpl = el
        elif txt.startswith('1. Về chỉ tiêu'): heading_tpl = el
        elif txt.startswith('Sở Giáo dục và Đào tạo trân trọng đề nghị'): closing_tpl = el
    kinh_gui_tpl, plain_tpl, heading_tpl, closing_tpl = (
        copy.deepcopy(x) for x in (kinh_gui_tpl, plain_tpl, heading_tpl, closing_tpl))

    # 3. Xoá nội dung cũ giữa 2 bảng (giữ nguyên header_el/footer_el)
    header_el = children[0]
    collecting, to_del = False, []
    for el in children:
        if el is header_el: collecting = True; continue
        if el is footer_el: break
        if collecting: to_del.append(el)
    for el in to_del: body.remove(el)

    # 4. Chèn nội dung mới — doan_func nhận (ins, kinh_gui_tpl, plain_tpl, heading_tpl, closing_tpl)
    def ins(p_el): footer_el.addprevious(p_el)
    ins(clone_para(kinh_gui_tpl, kinh_gui_text))
    doan_func(ins, plain_tpl, heading_tpl, closing_tpl, clone_para)

    doc.save(out_path)
    print(f'✓ {out_path}')
```

**Lưu ý bắt buộc:** nếu vô tình dùng mẫu KH-115 (mục 3.1) cho CV góp ý — hoặc dùng đúng mẫu
góp ý nhưng lại xoá nội dung theo kiểu "xoá hết sau bảng chữ ký" — luôn kiểm tra `len(doc.tables)`
sau khi tạo: mẫu góp ý CHỈ được có đúng 2 bảng (đầu + chữ ký), không được sót bảng phụ lục.

---

## 5. CÁC LỖI HAY GẶP VÀ CÁCH FIX

| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| `if not el:` FutureWarning lxml | Phần tử XML không dùng bool | `if el is None:` |
| `IndexError` khi update row[2] tiêu đề | Row[2] chỉ có 1 đoạn với `<w:br/>`, không phải 2 đoạn | Dùng `update_tieu_de_kh()` trong script |
| Font sai / lề sai | Tạo từ đầu bằng `Document()` | Copy template trước |
| Nơi nhận rỗng | Quên gọi `update_noi_nhan()` | Gọi ngay sau `clear_content()` |
| Viết nhầm "Phòng Giáo dục dân tộc" | Phòng này không tồn tại | Dùng "Phòng HSSV-KHCNTT (đ/c Nguyễn Văn Binh)" |
| `PackageNotFoundError` | Path có tiếng Việt trong inline Python | Viết ra file .py rồi chạy |
| **Sai thể thức nghiêm trọng khi soạn CV góp ý** | Dùng nhầm mẫu KH-115 (mục 3.1, dành cho CV chỉ đạo) thay vì mẫu góp ý riêng (mục 3.2) — cấu trúc bảng đầu, vị trí V/v, canh Kính gửi đều khác | Nghiệp vụ **góp ý dự thảo văn bản cơ quan khác** LUÔN dùng mẫu `CV_gop_y_SGDDT_DeAn_KTDL_CNDL.docx` + script mục 4.2 |
| Sót bảng Phụ lục của mẫu gốc (vd Phụ lục I/II/III của KH-115) khi copy nhầm mẫu KH để làm CV | `clear_content()` chỉ xoá nội dung GIỮA bảng đầu và bảng chữ ký, không đụng tới nội dung SAU bảng chữ ký | Sau khi tạo xong, kiểm `len(doc.tables)` — CV thường chỉ nên có 2 bảng |
| Mất `sectPr` cuối body → Word/python-docx báo lỗi mở file khi xoá "mọi thứ sau bảng chữ ký" | `sectPr` (khổ giấy/lề) nằm trong 1 paragraph ở cuối body, bị xoá nhầm cùng phụ lục | Tìm `sectPr` đầu tiên, deepcopy, xoá xong rồi `body.append()` lại làm phần tử cuối cùng |

---

## 6. QUY TRÌNH TRIỂN KHAI VĂN BẢN MỘT NHIỆM VỤ MỚI

```
1. Đọc PDF văn bản gốc  →  xác định nhiệm vụ cụ thể của Sở GD
2. Kiểm tra phân công   →  ai làm (phòng/CV nào), hạn bao giờ
3. Soạn căn cứ         →  chuỗi VB đầy đủ (số hiệu, ngày, cơ quan)
4. copy2(TEMPLATE, OUT) →  tạo file output từ template
5. Sửa header           →  số VB, ngày tháng, tiêu đề/V/v
6. Xóa nội dung cũ     →  clear_content()
7. Chèn nội dung mới   →  ins() trước footer_el
8. Cập nhật Nơi nhận   →  update_noi_nhan()
9. Cập nhật chữ ký     →  nếu là CV → update_ky_ten()
10. doc.save(OUT)
```

---

## 7. CÁC TÀI LIỆU TRI THỨC THAM CHIẾU

```
E:\Drive của tôi\TUYEN QUANG\CDS\            ← Toàn bộ tri thức CDS
  2026\16_TrienKhai 1 so nv CDS\             ← Thư mục làm việc
    868_KL_TU.pdf                            ← Kết luận gốc
    30_CV_BCĐ.pdf                            ← CV Ban Chỉ đạo
    CV thực hiện 30_CV_BCĐ tỉnh.pdf         ← CV UBND tỉnh (4350)

E:\Drive của tôi\TUYEN QUANG\CHUC NANG NHIEM VU\
  So\3. QĐ 48 SGD - phân công nv Lãnh đạo Sở T7.2025.pdf
  So\Quy định về chức năng, nhiệm vụ của phòng thuộc Sở GDĐT Tuyên Quang.pdf
  Phong\14.7.2025 Phân công nhiệm vụ lãnh đạo, chuyên viên Phòng HSSV-KHCNTT.docx
```
