#!/usr/bin/env python3
"""Apply ND30-oriented pagination controls and mild spacing tightening to an existing DOCX.

Usage:
    python optimize_docx_layout.py input.docx output.docx [--tightness balanced|compact]
"""
from __future__ import annotations

import argparse
from pathlib import Path

from docx import Document
from docx.shared import Pt

from create_nd30_docx import apply_pagination_controls, classify_text_role, ensure_page_numbers, set_run_tracking


def optimize(doc: Document, tightness: str = 'balanced') -> None:
    paragraphs = [p for p in doc.paragraphs if (p.text or '').strip()]
    for p in paragraphs:
        role = classify_text_role(p.text)
        keep_next = role in {'title', 'heading-major', 'heading-minor', 'label'}
        keep_lines = role in {'title', 'heading-major', 'heading-minor'} or (role == 'body' and len((p.text or '').split()) <= 10)
        apply_pagination_controls(p, role=role, keep_next=keep_next, keep_lines=keep_lines, widow_control=True)
        if role == 'body':
            words = len((p.text or '').split())
            if words > 90:
                p.paragraph_format.line_spacing = 1.02 if tightness == 'compact' else 1.04
                set_run_tracking(p, -4 if tightness == 'compact' else -3)
            elif words > 55:
                p.paragraph_format.line_spacing = 1.04 if tightness == 'compact' else 1.06
                set_run_tracking(p, -3 if tightness == 'compact' else -2)
            elif words > 35:
                p.paragraph_format.line_spacing = 1.06 if tightness == 'compact' else 1.08
                set_run_tracking(p, -2)
            else:
                p.paragraph_format.line_spacing = 1.08
            p.paragraph_format.space_after = Pt(5)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('input_docx')
    parser.add_argument('output_docx')
    parser.add_argument('--tightness', choices=['balanced', 'compact'], default='balanced')
    args = parser.parse_args()

    src = Path(args.input_docx)
    dst = Path(args.output_docx)
    if not src.exists():
        print(f'Input DOCX not found: {src}')
        return 2
    doc = Document(src)
    optimize(doc, args.tightness)
    ensure_page_numbers(doc)
    dst.parent.mkdir(parents=True, exist_ok=True)
    doc.save(dst)
    print(f'Optimized layout into {dst}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
