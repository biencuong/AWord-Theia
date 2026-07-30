"""
SKILL: Tạo văn bản KH/CV hành chính — Sở GD&ĐT Tuyên Quang
Phiên bản: 1.0 | 25/6/2026
Tác giả: Bùi Biên Cương (biencuong.hg@gmail.com)

NGUYÊN TẮC: LUÔN copy template → sửa nội dung. KHÔNG tạo từ đầu.
Template KH: ...CDS\2026\02_Ke_hoach_Quy_che_Kinh_phi\00_TongHop\20260101_SGD_KH-115...docx
"""
import sys, shutil
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')

from docx import Document
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

NS  = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
TNR = 'Times New Roman'

# ── Đường dẫn cố định ────────────────────────────────────────────────────────
# Gốc Google Drive khác nhau theo máy — tự dò
DRIVE = next((p for p in (Path(r"G:\My Drive"), Path(r"E:\Drive của tôi")) if p.exists()), None)
if DRIVE is None:
    sys.exit("Không tìm thấy Google Drive (G:\\My Drive hoặc E:\\Drive của tôi)")

KH_TMPL = str(DRIVE / r"TUYEN QUANG\CDS\2026\02_Ke_hoach_Quy_che_Kinh_phi\00_TongHop"
                      r"\20260101_SGD_KH-115_ke-hoach-thuc-hien-tuyenquang-2026"
                      r"-chuan-phat-hanh-tich-hop-phat-hanh.docx")

# ── Phân công nhân sự ────────────────────────────────────────────────────────
GIAM_DOC     = 'Vũ Đình Hưng'
PHO_GIAM_DOC = 'Đinh Thế Hiệp'  # phụ trách CDS, KHCN, HSSV

# ── XML Helpers ──────────────────────────────────────────────────────────────

def get_text(el):
    return ''.join(t.text or '' for t in el.findall(f'.//{{{NS}}}t'))

def make_run(text, size=13, bold=False, italic=False):
    r = OxmlElement('w:r')
    rPr = OxmlElement('w:rPr')
    rf = OxmlElement('w:rFonts')
    rf.set(qn('w:ascii'), TNR); rf.set(qn('w:hAnsi'), TNR); rf.set(qn('w:cs'), TNR)
    rPr.insert(0, rf)
    for tag in ('w:sz', 'w:szCs'):
        e = OxmlElement(tag); e.set(qn('w:val'), str(size * 2)); rPr.append(e)
    if bold:
        rPr.append(OxmlElement('w:b'))
    if italic:
        rPr.append(OxmlElement('w:i'))
    r.insert(0, rPr)
    t = OxmlElement('w:t'); t.text = text
    if text and (text[0] == ' ' or text[-1] == ' '):
        t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    r.append(t)
    return r

def make_para(text='', bold=False, size=13, italic=False,
              align='both', sp_before=0, sp_after=100,
              first_line=None, left_indent=None):
    """Tạo phần tử <w:p> với font TNR."""
    p = OxmlElement('w:p')
    pPr = OxmlElement('w:pPr')
    jc = OxmlElement('w:jc'); jc.set(qn('w:val'), align); pPr.append(jc)
    sp = OxmlElement('w:spacing')
    sp.set(qn('w:before'), str(sp_before)); sp.set(qn('w:after'), str(sp_after))
    pPr.append(sp)
    if first_line or left_indent:
        ind = OxmlElement('w:ind')
        if first_line:  ind.set(qn('w:firstLine'), str(int(first_line * 567)))
        if left_indent: ind.set(qn('w:left'),      str(int(left_indent * 567)))
        pPr.append(ind)
    p.append(pPr)
    if text:
        p.append(make_run(text, size=size, bold=bold, italic=italic))
    return p

# ── Core functions ────────────────────────────────────────────────────────────

def find_footer_tbl(body):
    """Tìm bảng footer (chứa 'Nơi nhận')."""
    for child in body:
        if child.tag == f'{{{NS}}}tbl' and 'Nơi nhận' in get_text(child):
            return child
    return None

def clear_content(doc):
    """Xóa nội dung giữa header table [0] và footer table. Trả về footer_el."""
    body = doc.element.body
    children = list(body)
    header_el = children[0]
    footer_el = find_footer_tbl(body)
    if footer_el is None:
        raise RuntimeError("Không tìm thấy bảng Nơi nhận trong template")
    collecting = False
    to_del = []
    for el in children:
        if el is header_el: collecting = True; continue
        if el is footer_el: break
        if collecting: to_del.append(el)
    for el in to_del: body.remove(el)
    return footer_el

def update_so_ngay(doc, so_vb, ngay_thang):
    """Cập nhật số VB (Col 0, Para[-1]) và ngày (Col 1, Para[-1]) trong Row[0]."""
    tbl = doc.tables[0]
    for cell, txt, italic in [
        (tbl.cell(0, 0), f'Số: {so_vb}', False),
        (tbl.cell(0, 1), ngay_thang, True),
    ]:
        p = cell.paragraphs[-1]._p
        for r in list(p.findall(f'{{{NS}}}r')): p.remove(r)
        p.append(make_run(txt, size=13, italic=italic))

def update_tieu_de_kh(doc, dong1, dong2):
    """Cập nhật tiêu đề KH tại Row[2]: 1 đoạn có <w:br/>."""
    cell = doc.tables[0].cell(2, 0)
    p = cell.paragraphs[0]._p
    for child in list(p):
        if child.tag.split('}')[-1] in ('r', 'br', 'hyperlink'): p.remove(child)
    p.append(make_run(dong1, size=14, bold=True))
    br_r = OxmlElement('w:r'); br_r.append(OxmlElement('w:br')); p.append(br_r)
    p.append(make_run(dong2, size=14, bold=True))

def xoa_hang_tieu_de(doc):
    """Xóa hàng Row[2] (tiêu đề KH) khỏi header table — để làm CV."""
    tbl_el = doc.tables[0]._tbl
    rows = tbl_el.findall(f'{{{NS}}}tr')
    if len(rows) >= 3: tbl_el.remove(rows[2])

def update_noi_nhan(doc, recipients):
    """Cập nhật danh sách Nơi nhận trong Col[0] footer table."""
    for tbl in doc.tables:
        if 'Nơi nhận' in get_text(tbl._element):
            tc = tbl.cell(0, 0)._tc
            paras = tc.findall(f'{{{NS}}}p')
            for p in paras[1:]: tc.remove(p)
            for line in recipients:
                tc.append(make_para(line, size=12, align='left', sp_after=40))
            return

def update_ky_ten(doc, chuc_danh_list, ho_ten):
    """Cập nhật ô chữ ký (Col[-1] footer table)."""
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
    """Chèn phần tử XML trước footer table."""
    footer_el.addprevious(p_el)

# ── API chính ────────────────────────────────────────────────────────────────

def tao_ke_hoach(so_vb, ngay_thang, tieu_de_tuple, noi_dung_fn,
                 noi_nhan, out_path):
    """
    Tạo file Kế hoạch từ template.

    Params:
        so_vb         : '42/KH-SGDĐT'
        ngay_thang    : 'Tuyên Quang, ngày 25 tháng 6 năm 2026   '
        tieu_de_tuple : ('KẾ HOẠCH', 'Triển khai...')
        noi_dung_fn   : hàm(footer_el, ins_fn) chèn nội dung
        noi_nhan      : list các dòng Nơi nhận
        out_path      : đường dẫn file output
    """
    shutil.copy2(KH_TMPL, out_path)
    doc = Document(out_path)
    footer_el = clear_content(doc)
    update_so_ngay(doc, so_vb, ngay_thang)
    update_tieu_de_kh(doc, tieu_de_tuple[0], tieu_de_tuple[1])
    update_noi_nhan(doc, noi_nhan)
    # Footer mặc định: GIÁM ĐỐC Vũ Đình Hưng (đã có trong template)

    def ins(p): ins_before(footer_el, p)
    noi_dung_fn(footer_el, ins)
    doc.save(out_path)
    print(f'✓ Đã tạo KH: {out_path}')

def tao_cong_van(so_vb, ngay_thang, vv_text, noi_dung_fn,
                 noi_nhan, out_path,
                 ky_ten=('KT. GIÁM ĐỐC', 'PHÓ GIÁM ĐỐC', PHO_GIAM_DOC)):
    """
    Tạo file Công văn từ template.

    Params:
        vv_text  : nội dung dòng V/v (có thể dùng \\n)
        ky_ten   : tuple (dong1, dong2, ho_ten) — mặc định PGĐ Đinh Thế Hiệp
    """
    shutil.copy2(KH_TMPL, out_path)
    doc = Document(out_path)
    footer_el = clear_content(doc)
    update_so_ngay(doc, so_vb, ngay_thang)
    xoa_hang_tieu_de(doc)
    update_noi_nhan(doc, noi_nhan)
    update_ky_ten(doc, list(ky_ten[:-1]), ky_ten[-1])

    def ins(p): ins_before(footer_el, p)
    ins(make_para(vv_text, size=13, align='center', sp_before=40, sp_after=60))
    noi_dung_fn(footer_el, ins)
    doc.save(out_path)
    print(f'✓ Đã tạo CV: {out_path}')

# ── Ví dụ / Test ─────────────────────────────────────────────────────────────

if __name__ == '__main__':
    OUT = str(DRIVE / r"TUYEN QUANG\CDS\2026\16_TrienKhai 1 so nv CDS")

    def noi_dung_mau(footer_el, ins):
        ins(make_para('Căn cứ:', size=13, sp_after=60))
        ins(make_para('Kết luận số 868-KL/TU ngày 18/5/2026...', size=13,
                      sp_after=60, first_line=1))
        ins(make_para('I. NỘI DUNG', bold=True, size=13,
                      align='center', sp_before=60, sp_after=60))
        ins(make_para('Nội dung chi tiết...', size=13, sp_after=60, first_line=1))

    tao_ke_hoach(
        so_vb='42/KH-SGDĐT',
        ngay_thang='Tuyên Quang, ngày 25 tháng 6 năm 2026   ',
        tieu_de_tuple=('KẾ HOẠCH', 'Triển khai nhiệm vụ CDS...'),
        noi_dung_fn=noi_dung_mau,
        noi_nhan=[
            '- UBND tỉnh (để báo cáo);',
            '- Giám đốc Sở;',
            '- Lưu: VT, HSSV&KHCNTT.',
        ],
        out_path=OUT + r'\KH_test.docx',
    )
