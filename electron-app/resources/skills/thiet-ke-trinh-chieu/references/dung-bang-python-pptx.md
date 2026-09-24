# Dựng slide bằng python-pptx

Kỹ thuật chung (đọc tệp có sẵn, dùng template .potx, pptxgenjs) xem skill `pptx`. Tệp này là bộ hàm dựng theo
đúng lưới ở `bo-cuc-slide.md` và bảng màu ở `bang-mau-phong-chu.md`.

## 1. Khung chương trình

```python
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

# Bộ màu đang dùng — đổi mấy giá trị này là đổi cả bài
MAU = {
    'nen': 'FFFFFF', 'chu': '1A1A1A', 'chu_dao': '0B3D91',
    'nhan': 'C81E2B', 'phu': '5B6B7C', 'trang': 'FFFFFF',
}
PHONG = 'Segoe UI'
C = lambda ten: RGBColor.from_string(MAU[ten])

prs = Presentation()                 # không dùng template: bắt đầu từ trắng
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
TRONG = prs.slide_layouts[6]         # layout trống, tự đặt mọi thứ theo lưới


def slide_moi(nen=None):
    s = prs.slides.add_slide(TRONG)
    if nen:
        s.background.fill.solid()
        s.background.fill.fore_color.rgb = C(nen)
    return s


def chu(slide, text, x, y, w, h, co=22, dam=False, mau='chu', canh=PP_ALIGN.LEFT,
        giua_doc=False, gian_dong=1.35):
    o = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = o.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = Inches(0.1)
    tf.margin_top = tf.margin_bottom = Inches(0.05)
    if giua_doc:
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    for i, dong in enumerate(str(text).split("\n")):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = dong
        p.alignment = canh
        p.line_spacing = gian_dong
        p.font.size = Pt(co)
        p.font.bold = dam
        p.font.name = PHONG
        p.font.color.rgb = C(mau)
    return o
```

## 2. Các bố cục

```python
def slide_bia(tieu_de, phu_de, don_vi, dong_cuoi):
    s = slide_moi('chu_dao')
    chu(s, don_vi.upper(), 0.9, 1.8, 11.5, 0.5, co=18, mau='trang')
    chu(s, tieu_de, 0.9, 2.6, 11.5, 1.7, co=44, dam=True, mau='trang')
    chu(s, phu_de, 0.9, 4.4, 11.5, 0.8, co=22, mau='trang')
    chu(s, dong_cuoi, 0.9, 6.2, 11.5, 0.6, co=16, mau='trang')
    return s


def tieu_de_slide(slide, text):
    chu(slide, text, 0.6, 0.5, 12.133, 0.85, co=30, dam=True, mau='chu_dao')
    gach = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.6), Inches(1.38), Inches(1.6), Inches(0.05))
    gach.fill.solid()
    gach.fill.fore_color.rgb = C('nhan')
    gach.line.fill.background()
    gach.shadow.inherit = False


def slide_mot_cot(tieu_de, cac_y):          # cac_y: danh sách câu, mỗi câu một gạch đầu dòng
    s = slide_moi('nen')
    tieu_de_slide(s, tieu_de)
    chu(s, "\n".join("•  " + y for y in cac_y), 0.6, 1.65, 12.133, 4.9, co=22)
    return s


def slide_ba_the(tieu_de, cac_the):          # cac_the: [(tiêu đề thẻ, nội dung), ...] tối đa 3
    s = slide_moi('nen')
    tieu_de_slide(s, tieu_de)
    for i, (dau, than) in enumerate(cac_the[:3]):
        x = 0.6 + i * 4.11
        khung = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(1.8), Inches(3.91), Inches(3.7))
        khung.adjustments[0] = 0.06
        khung.fill.solid()
        khung.fill.fore_color.rgb = RGBColor.from_string('F2F5F9')
        khung.line.color.rgb = C('phu')
        khung.line.width = Pt(0.75)
        khung.shadow.inherit = False
        chu(s, dau, x + 0.25, 2.05, 3.41, 0.7, co=22, dam=True, mau='chu_dao')
        chu(s, than, x + 0.25, 2.8, 3.41, 2.5, co=18)
    return s


def slide_so_lieu(tieu_de, cac_so):          # cac_so: [(số, nhãn), ...] 2–4 ô
    s = slide_moi('nen')
    tieu_de_slide(s, tieu_de)
    n = min(len(cac_so), 4)
    rong = (12.133 - 0.2 * (n - 1)) / n
    for i, (so, nhan) in enumerate(cac_so[:n]):
        x = 0.6 + i * (rong + 0.2)
        chu(s, so, x, 2.1, rong, 1.4, co=60, dam=True, mau='nhan', canh=PP_ALIGN.CENTER)
        chu(s, nhan, x, 3.5, rong, 1.0, co=16, mau='phu', canh=PP_ALIGN.CENTER)
    return s
```

## 3. Biểu đồ

```python
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION

def slide_bieu_do(tieu_de, nhom, cac_chuoi, nhan_xet, kieu=XL_CHART_TYPE.COLUMN_CLUSTERED):
    # nhom: ['2024', '2025', '2026'];  cac_chuoi: {'Tiểu học': (1200, 1350, 1480), ...}
    s = slide_moi('nen')
    tieu_de_slide(s, tieu_de)
    dl = CategoryChartData()
    dl.categories = nhom
    for ten, gia_tri in cac_chuoi.items():
        dl.add_series(ten, gia_tri)
    gf = s.shapes.add_chart(kieu, Inches(0.6), Inches(1.65), Inches(7.6), Inches(4.8), dl)
    bd = gf.chart
    bd.font.size = Pt(14)
    bd.font.name = PHONG
    bd.has_legend = len(cac_chuoi) > 1
    if bd.has_legend:
        bd.legend.position = XL_LEGEND_POSITION.BOTTOM
        bd.legend.include_in_layout = False
    o = bd.plots[0]
    # Tô màu từng chuỗi theo bộ màu của bài — không để màu mặc định của Office
    DAY_MAU = ['0B3D91', '1565C0', '4A90D9', '8AB6E8', 'C6DAF3']
    for i, chuoi in enumerate(o.series):
        chuoi.format.fill.solid()
        chuoi.format.fill.fore_color.rgb = RGBColor.from_string(DAY_MAU[i % len(DAY_MAU)])
    o.has_data_labels = True
    o.data_labels.font.size = Pt(12)
    o.data_labels.number_format = '#,##0'
    o.data_labels.number_format_is_linked = False
    bd.value_axis.tick_labels.number_format = '#,##0'
    chu(s, "\n".join("•  " + y for y in nhan_xet), 8.5, 1.65, 4.23, 4.8, co=18)
    return s
```

Chọn kiểu: cột (`COLUMN_CLUSTERED`) khi so sánh vài nhóm; đường (`LINE_MARKERS`) khi theo thời gian nhiều mốc;
thanh ngang (`BAR_CLUSTERED`) khi tên nhóm dài; tròn (`PIE`) chỉ khi không quá 5 phần và là cơ cấu của một tổng thể.
**Không** dùng biểu đồ 3D, không đổ bóng cho cột.

## 4. Ảnh cắt đúng khung (không méo)

```python
from PIL import Image

def them_anh_phu(slide, duong_dan, x, y, w, h):
    with Image.open(duong_dan) as im:
        ty_le_anh = im.width / im.height
    ty_le_khung = w / h
    pic = slide.shapes.add_picture(duong_dan, Inches(x), Inches(y), Inches(w), Inches(h))
    if ty_le_anh > ty_le_khung:                  # ảnh rộng hơn khung → cắt bớt hai bên
        cat = (1 - ty_le_khung / ty_le_anh) / 2
        pic.crop_left = pic.crop_right = cat
    else:                                        # ảnh cao hơn khung → cắt trên và dưới
        cat = (1 - ty_le_anh / ty_le_khung) / 2
        pic.crop_top = pic.crop_bottom = cat
    return pic
```

Dải mờ đặt trên ảnh để chữ đọc được — python-pptx chưa có API độ trong suốt nên chèn thẳng phần tử `a:alpha`:

```python
from lxml import etree
from pptx.oxml.ns import qn

def dat_do_trong(shape, phan_tram):              # 0 = đặc, 100 = trong suốt hoàn toàn
    to_mau = shape.fill._xPr.find(qn('a:solidFill')).find(qn('a:srgbClr'))
    alpha = etree.SubElement(to_mau, qn('a:alpha'))
    alpha.set('val', str(int((100 - phan_tram) * 1000)))

dai = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(5.5), Inches(13.333), Inches(2.0))
dai.fill.solid()
dai.fill.fore_color.rgb = RGBColor.from_string('000000')
dai.line.fill.background()
dat_do_trong(dai, 45)
```

## 5. Bảng

```python
def slide_bang(tieu_de, cot, cac_hang, rong_cot=None):
    s = slide_moi('nen')
    tieu_de_slide(s, tieu_de)
    n_hang, n_cot = len(cac_hang) + 1, len(cot)
    cao = 0.5 + 0.45 * len(cac_hang)
    bang = s.shapes.add_table(n_hang, n_cot, Inches(0.6), Inches(1.7), Inches(12.133), Inches(cao)).table
    if rong_cot:
        for i, r in enumerate(rong_cot):
            bang.columns[i].width = Inches(r)
    for j, ten in enumerate(cot):
        o = bang.cell(0, j)
        o.text = ten
        o.fill.solid()
        o.fill.fore_color.rgb = C('chu_dao')
        p = o.text_frame.paragraphs[0]
        p.font.size, p.font.bold, p.font.name = Pt(18), True, PHONG
        p.font.color.rgb = C('trang')
    for i, hang in enumerate(cac_hang, start=1):
        for j, gia_tri in enumerate(hang):
            o = bang.cell(i, j)
            o.text = str(gia_tri)
            p = o.text_frame.paragraphs[0]
            p.font.size, p.font.name = Pt(17), PHONG
            p.font.color.rgb = C('chu')
            if isinstance(gia_tri, (int, float)):
                p.alignment = PP_ALIGN.RIGHT
    return s
```

## 6. Chân slide, số trang, ghi chú người trình bày

```python
def hoan_thien(ten_bai, bo_qua=(0,)):            # bo_qua: chỉ số slide không đánh số (bìa, phân cách)
    for i, s in enumerate(prs.slides):
        if i in bo_qua:
            continue
        chu(s, ten_bai, 0.6, 6.85, 8.0, 0.3, co=11, mau='phu')
        chu(s, str(i + 1), 11.8, 6.85, 0.93, 0.3, co=11, mau='phu', canh=PP_ALIGN.RIGHT)

# Ghi chú để người trình bày đọc khi thuyết trình (không hiện trên màn chiếu)
s.notes_slide.notes_text_frame.text = 'Ý cần nói thêm khi trình bày slide này.'

prs.save('BAI_TRINH_CHIEU.pptx')
```

## 7. Xuất PDF và TỰ NHÌN LẠI

```bash
# Máy có LibreOffice
soffice --headless --convert-to pdf --outdir . BAI_TRINH_CHIEU.pptx
```

```python
# Máy có Microsoft Office (pywin32)
import os, win32com.client
ppt = win32com.client.Dispatch('PowerPoint.Application')
tep = ppt.Presentations.Open(os.path.abspath('BAI_TRINH_CHIEU.pptx'), WithWindow=False)
tep.SaveAs(os.path.abspath('BAI_TRINH_CHIEU.pdf'), 32)   # 32 = ppSaveAsPDF
tep.Close()
ppt.Quit()
```

```python
# Render vài trang thành ảnh rồi XEM (pymupdf có sẵn trên máy AWord)
import fitz
tl = fitz.open('BAI_TRINH_CHIEU.pdf')
for i in (0, 1, 2):
    tl[i].get_pixmap(dpi=110).save(f'xem-{i + 1}.png')
```

Mở các ảnh đó ra nhìn: chữ có tràn không, lề có thẳng không, màu có đúng không — rồi mới giao tệp cho người dùng.
