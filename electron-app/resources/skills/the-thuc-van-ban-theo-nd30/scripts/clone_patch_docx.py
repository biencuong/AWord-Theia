#!/usr/bin/env python3
"""Clone a DOCX template and patch placeholder values directly in OOXML.

This preserves far more of the original template than rebuilding the body.

Usage:
    python clone_patch_docx.py source.docx data.json output.docx
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from docx import Document
from optimize_docx_layout import optimize
from create_nd30_docx import ensure_page_numbers
from nd30_docx_tools import clone_patch_docx, content_to_placeholder_map


def main(argv: list[str]) -> int:
    if len(argv) != 4:
        print('Usage: python clone_patch_docx.py source.docx data.json output.docx')
        return 1
    source = Path(argv[1])
    data_path = Path(argv[2])
    output = Path(argv[3])
    if not source.exists():
        print(f'Source DOCX not found: {source}')
        return 2
    if not data_path.exists():
        print(f'Data JSON not found: {data_path}')
        return 2
    data = json.loads(data_path.read_text(encoding='utf-8'))
    if not isinstance(data, dict):
        print('Data JSON root must be an object')
        return 3
    mapping = content_to_placeholder_map(data)
    result = clone_patch_docx(source, output, mapping)
    doc = Document(output)
    ensure_page_numbers(doc)
    optimize(doc, "balanced")
    doc.save(output)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv))
