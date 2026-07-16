
#!/usr/bin/env python3
"""Compose a new ND30 DOCX using an existing DOCX as the formatting shell.

This is useful when the user provides a sample/template document and wants a new
corresponding document that follows the same shell more closely than the generic generator.

Usage:
    python compose_from_source_docx.py source-template.docx spec.json output.docx
    python compose_from_source_docx.py source-template.docx spec.json output.docx --reset-nd30-layout
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from docx import Document

from create_nd30_docx import Spec, build, set_doc_defaults
from nd30_docx_tools import reset_section_page_setup


def clear_body_preserve_sections(doc: Document, *, reassert_page_setup: bool = True) -> None:
    """Xoa toan bo noi dung body, CHI giu lai sectPr CUOI CUNG cua body.

    CANH BAO: neu source co NHIEU section (vd than bao cao portrait + phu
    luc landscape), cac sectPr NHUNG TRONG pPr cua section truoc do se bi
    xoa cung voi paragraph chua no - phan con lai se am tham ke thua sectPr
    CUOI CUNG (co the sai orientation/kho giay). Day la loi thuc te da gap
    (than van ban bi lat sang kho ngang vi ke thua nham sectPr cua phu luc).

    reassert_page_setup=True (mac dinh) chup lai TRUOC KHI xoa dung kho
    giay/huong/le cua section DAU TIEN thuc su (khong phai gia tri NĐ30
    mac dinh cung), roi ap lai dung nhung gia tri do sau khi xoa - vua vo
    hieu hoa loi ke thua nham section, vua khong lam mat cac le tuy chinh
    hop le (trong khoang NĐ30) cua mau nguon."""
    orig_section = doc.sections[0]
    snapshot = None
    if reassert_page_setup:
        from docx.enum.section import WD_ORIENT
        snapshot = {
            'orientation': 'landscape' if orig_section.orientation == WD_ORIENT.LANDSCAPE else 'portrait',
            'page_width_mm': orig_section.page_width.mm,
            'page_height_mm': orig_section.page_height.mm,
            'top_mm': orig_section.top_margin.mm,
            'bottom_mm': orig_section.bottom_margin.mm,
            'left_mm': orig_section.left_margin.mm,
            'right_mm': orig_section.right_margin.mm,
        }
    body = doc._element.body
    sect_pr = body.sectPr
    for child in list(body):
        if child is not sect_pr:
            body.remove(child)
    if snapshot is not None:
        reset_section_page_setup(doc.sections[0], **snapshot)


def main(argv: list[str]) -> int:
    if len(argv) < 4:
        print('Usage: python compose_from_source_docx.py source-template.docx spec.json output.docx [--reset-nd30-layout]')
        return 1
    source = Path(argv[1])
    spec_path = Path(argv[2])
    output = Path(argv[3])
    reset_layout = '--reset-nd30-layout' in argv[4:]
    if not source.exists():
        print(f'Source template not found: {source}')
        return 2
    if not spec_path.exists():
        print(f'Spec not found: {spec_path}')
        return 2

    data = json.loads(spec_path.read_text(encoding='utf-8'))
    if not isinstance(data, dict):
        print('Spec JSON root must be an object')
        return 3
    spec = Spec(data)

    doc = Document(source)
    clear_body_preserve_sections(doc)
    if reset_layout:
        set_doc_defaults(doc)
    build(doc, spec)
    output.parent.mkdir(parents=True, exist_ok=True)
    doc.save(output)
    print(f'Created {output} from source shell {source}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv))
