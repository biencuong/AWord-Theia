#!/usr/bin/env python3
"""Font-metric measurement, VML shape lines, fixed-layout tables, landscape
appendix sections, and real orphan-word detection for ND30 DOCX generation.

Tach rieng khoi nd30_docx_tools.py (thien ve doc/phan tich OOXML, khong phu
thuoc Pillow) vi day la nhom ham "do luong that + ve moi" - dung Pillow de doc
truc tiep font .ttf, khong uoc luong do rong chu bang tay (da sai nhieu lan
trong thuc te khi lam vay).

Bai hoc rut ra tu phien dung Bao cao NQ57 thang 7/2026 (So GDDT Tuyen Quang):
xem references/nd30-line-rules-and-vml-shapes.md, nd30-table-fixed-layout.md,
nd30-landscape-appendix-section.md, nd30-orphan-word-control.md.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

from docx.oxml import OxmlElement
from docx.oxml.ns import qn, nsmap
from docx.shared import Cm, Pt
from docx.enum.section import WD_SECTION, WD_ORIENT

sys.path.insert(0, str(Path(__file__).resolve().parent))
from nd30_docx_tools import set_run_tracking  # noqa: E402  (tai su dung primitive co san)

try:
    from PIL import ImageFont
except ImportError as exc:  # pragma: no cover
    raise ImportError(
        "Pillow can thiet de do do rong chu that (measure_text_width_pt). "
        "Chay: python scripts/ensure_python_deps.py --install-missing"
    ) from exc

WINDOWS_FONTS_DIR = Path(r"C:\Windows\Fonts")
_MEASURE_SCALE = 1000  # do o kich thuoc lon roi quy doi ve pt de giam sai so hinting
_font_cache: dict[Path, "ImageFont.FreeTypeFont"] = {}


def resolve_windows_font_path(*, bold: bool = False, italic: bool = False) -> Path:
    """Map bold/italic sang dung file Times New Roman .ttf duoi C:\\Windows\\Fonts.
    Rai RuntimeError ro rang neu thieu font - khong fallback am tham sang font
    khac (se lam sai lech do do so voi font thuc su dung trong .docx)."""
    if bold and italic:
        name = "timesbi.ttf"
    elif bold:
        name = "timesbd.ttf"
    elif italic:
        name = "timesi.ttf"
    else:
        name = "times.ttf"
    path = WINDOWS_FONTS_DIR / name
    if not path.exists():
        raise RuntimeError(
            f"Khong tim thay font {path}. Can Times New Roman that de do do rong "
            "chinh xac - khong doan/uoc luong thay the."
        )
    return path


def _get_font(font_path: Path) -> "ImageFont.FreeTypeFont":
    if font_path not in _font_cache:
        _font_cache[font_path] = ImageFont.truetype(str(font_path), _MEASURE_SCALE)
    return _font_cache[font_path]


def measure_text_width_pt(text: str, size_pt: float, *, bold: bool = False,
                           italic: bool = False, font_path: Path | None = None) -> float:
    """Do do rong THAT cua text (khong phai uoc luong theo so ky tu) bang
    font-metrics cua chinh file .ttf, o dung size_pt/bold/italic yeu cau.
    font_path cho phep override khi khong chay tren Windows hoac khi test."""
    if not text:
        return 0.0
    path = font_path or resolve_windows_font_path(bold=bold, italic=italic)
    font = _get_font(path)
    bbox = font.getbbox(text)
    width_at_scale = bbox[2] - bbox[0]
    return width_at_scale * (size_pt / _MEASURE_SCALE)


def compute_rule_length_pt(text: str, size_pt: float, *, bold: bool = True,
                            kind: str, font_path: Path | None = None) -> float:
    """Quy tac the thuc thuc te da doi chieu voi nhieu van ban chinh thuc:
    - kind='tieu-ngu': duong ke duoi 'Doc lap - Tu do - Hanh phuc' dai DUNG
      BANG do rong that cua chinh dong chu do (cum co dinh, giong het moi
      van ban).
    - kind='co-quan': duong ke duoi ten co quan ban hanh NGAN HON, toi da
      khoang 2/3 (dung 0.6) do rong that - khong ke het ca dong vi ten co
      quan dai ngan khac nhau tuy don vi."""
    width = measure_text_width_pt(text, size_pt, bold=bold, font_path=font_path)
    if kind == "tieu-ngu":
        return width
    if kind == "co-quan":
        return round(width * 0.6, 1)
    raise ValueError(f"kind phai la 'tieu-ngu' hoac 'co-quan', nhan duoc: {kind!r}")


def register_vml_namespace() -> None:
    """Dang ky (idempotent) namespace 'v' (VML) vao docx.oxml.ns.nsmap - can
    thiet vi python-docx khong co san namespace nay (chi co w/wp/a cho
    DrawingML hien dai). Goi 1 lan truoc khi dung add_vml_line."""
    nsmap.setdefault("v", "urn:schemas-microsoft-com:vml")
    nsmap.setdefault("o", "urn:schemas-microsoft-com:office:office")


_shape_id_counter = [1000]


def add_vml_line(paragraph, *, length_pt: float, weight_pt: float = 0.75,
                  color: str = "000000", align: str = "center",
                  offset_y_pt: float = 2.0) -> None:
    """Chen 1 SHAPE LINE THAT (tuong duong thao tac Insert > Shapes > Line
    trong Word, luu duoi dang VML) vao paragraph - KHONG dung ky tu Unicode
    gia ('___', '---') va KHONG dung border paragraph (w:pBdr) khi nguoi dung
    yeu cau ro 'dung Line cua Office'. offset_y_pt nho (~2pt) de duong ke sat
    ngay duoi dong chu ma khong dinh vao chan chu."""
    register_vml_namespace()
    _shape_id_counter[0] += 1
    run = paragraph.add_run()
    pict = OxmlElement("w:pict")
    line = OxmlElement("v:line")
    line.set("id", f"_x0000_s{_shape_id_counter[0]}")
    h_pos = f"mso-position-horizontal:{align};" if align else ""
    line.set("style", (
        "position:absolute;"
        f"{h_pos}"
        "mso-position-horizontal-relative:text;"
        "mso-position-vertical-relative:text;"
        "z-index:1"
    ))
    line.set("from", f"0pt,{offset_y_pt}pt")
    line.set("to", f"{length_pt}pt,{offset_y_pt}pt")
    line.set("strokeweight", f"{weight_pt}pt")
    line.set("strokecolor", color if color.startswith("#") else f"#{color}" if len(color) == 6 else color)
    pict.append(line)
    run._r.append(pict)


def add_shape_line_paragraph(container, *, length_pt: float, space_before=Pt(0),
                              space_after=Pt(2), **vml_kwargs):
    """Tien ich: tao 1 paragraph moi can giua roi goi add_vml_line - cung
    phong cach voi create_nd30_docx.add_rule_paragraph nhung dung Shape thay
    vi border."""
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    p = container.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = space_before
    p.paragraph_format.space_after = space_after
    p.paragraph_format.line_spacing = 1.0
    add_vml_line(p, length_pt=length_pt, **vml_kwargs)
    return p


def set_table_fixed_layout(table, widths_cm: list[float]) -> None:
    """Ep Word TON TRONG dung do rong cot da tinh (fixed layout), thay vi tu
    dong autofit theo noi dung - chi set cell.width la CHUA DU (Word van co
    the tu resize lai). CANH BAO BAT BUOC: hàm nay CHI duoc dung cho bang
    TU TAO MOI (phu luc, bang so lieu). TUYET DOI KHONG dung cho bang lay
    tu mau nguon can giu nguyen dinh dang (quoc hieu-tieu ngu, noi nhan,
    chu ky) - xem references/nd30-replicate-fixed-block-preservation.md."""
    tbl = table._tbl
    tblPr = tbl.tblPr
    for tag in ("w:tblW", "w:tblLayout"):
        el = tblPr.find(qn(tag))
        if el is not None:
            tblPr.remove(el)
    total_twips = int(round(sum(widths_cm) * 567))  # 1 cm = 567 twips (dxa)
    tblW = OxmlElement("w:tblW")
    tblW.set(qn("w:w"), str(total_twips))
    tblW.set(qn("w:type"), "dxa")
    tblPr.append(tblW)
    tblLayout = OxmlElement("w:tblLayout")
    tblLayout.set(qn("w:type"), "fixed")
    tblPr.append(tblLayout)
    table.autofit = False
    table.allow_autofit = False
    grid = tbl.find(qn("w:tblGrid"))
    if grid is not None:
        for gc in list(grid):
            grid.remove(gc)
        for w in widths_cm:
            gc = OxmlElement("w:gridCol")
            gc.set(qn("w:w"), str(int(round(w * 567))))
            grid.append(gc)
    for row in table.rows:
        for j, w in enumerate(widths_cm):
            if j < len(row.cells):
                row.cells[j].width = Cm(w)


def add_landscape_section(doc, *, top_mm: float = 20, bottom_mm: float = 20,
                           left_mm: float = 20, right_mm: float = 20):
    """Them 1 section moi kho A4 NGANG (cho bang phu luc rong khong bi ep
    co cot). Section moi mac dinh ke thua header/footer (bao gom PAGE field
    neu da bat ensure_page_numbers) tu section truoc do, tru khi caller tu
    doi header.is_linked_to_previous. Neu section moi can so trang rieng,
    goi lai nd30_docx_tools.ensure_page_numbers(doc, sections=[new_section])."""
    from docx.shared import Mm
    new_sec = doc.add_section(WD_SECTION.NEW_PAGE)
    new_sec.orientation = WD_ORIENT.LANDSCAPE
    # A4 ngang: hoan doi width/height so voi portrait chuan (210x297mm)
    new_sec.page_width = Mm(297)
    new_sec.page_height = Mm(210)
    new_sec.top_margin = Mm(top_mm)
    new_sec.bottom_margin = Mm(bottom_mm)
    new_sec.left_margin = Mm(left_mm)
    new_sec.right_margin = Mm(right_mm)
    return new_sec


def _simulate_wrap(words: list[str], size_pt: float, usable_width_pt: float,
                    first_line_indent_pt: float, *, bold: bool,
                    font_path: Path | None) -> list[list[str]]:
    if not words:
        return []
    space_w = measure_text_width_pt(" ", size_pt, bold=bold, font_path=font_path) or size_pt * 0.28
    lines: list[list[str]] = []
    current: list[str] = []
    cur_width = 0.0
    line_limit = usable_width_pt - first_line_indent_pt
    for w in words:
        ww = measure_text_width_pt(w, size_pt, bold=bold, font_path=font_path)
        add = ww if not current else ww + space_w
        if current and cur_width + add > line_limit:
            lines.append(current)
            current = [w]
            cur_width = ww
            line_limit = usable_width_pt  # tu dong 2 tro di khong con first-line indent
        else:
            current.append(w)
            cur_width += add
    if current:
        lines.append(current)
    return lines


def detect_orphan_last_line(paragraph, *, column_width_cm: float,
                             first_line_indent_cm: float = 0.0,
                             font_path: Path | None = None) -> bool:
    """True neu dong CUOI CUNG cua doan (sau khi mo phong word-wrap bang
    font-metrics that) chi con DUNG 1 tu don doc - day la 'tu mo coi' thuc
    su, KHAC voi widowControl chuan cua Word (chi tranh 1 DONG don le o
    dau/cuoi TRANG, khong lien quan toi 1 TU le o cuoi DOAN). Doc size/bold
    THAT tu run dau tien cua doan, khong gia dinh gia tri mac dinh nao."""
    text = paragraph.text.strip()
    runs = paragraph.runs
    if not text or not runs:
        return False
    r0 = runs[0]
    size_pt = r0.font.size.pt if r0.font.size else 14
    bold = bool(r0.font.bold)
    usable_width_pt = column_width_cm * 28.3465
    indent_pt = first_line_indent_cm * 28.3465
    lines = _simulate_wrap(text.split(), size_pt, usable_width_pt, indent_pt,
                            bold=bold, font_path=font_path)
    if len(lines) < 2:
        return False
    return len(lines[-1]) == 1


def condense_paragraph_runs(paragraph, *, twips: int = -6) -> None:
    """Ap character spacing (thu hep chu) cho toan bo run trong doan, dung
    lai create_nd30_docx.set_run_tracking lam primitive OOXML (khong viet
    lai). CLAMP BAT BUOC trong [-10, -4] twips (0.2-0.5pt): muc lon hon (vd
    -50 twips/2.5pt) da gay loi chu dinh/long vao nhau trong thuc te - day
    la sai lam da xay ra va duoc nguoi dung phan hoi ngay."""
    if not (-10 <= twips <= -4):
        raise ValueError(
            f"twips={twips} vuot bien an toan [-10,-4] (0.2-0.5pt). "
            "Muc condense lon hon se lam chu dinh/long vao nhau."
        )
    set_run_tracking(paragraph, twips)


def fix_orphan_if_present(paragraph, *, column_width_cm: float,
                           first_line_indent_cm: float = 0.0,
                           twips: int = -6, font_path: Path | None = None) -> bool:
    """Ghep detect_orphan_last_line + condense_paragraph_runs. CHI duoc goi
    SAU KHI dinh dang cuoi cung cua doan (size/bold/italic tung run) da
    hoan tat - khong goi giua chung pipeline dung van ban, vi ham doc size
    THAT tu run hien tai de mo phong wrap."""
    if detect_orphan_last_line(paragraph, column_width_cm=column_width_cm,
                                first_line_indent_cm=first_line_indent_cm,
                                font_path=font_path):
        condense_paragraph_runs(paragraph, twips=twips)
        return True
    return False
