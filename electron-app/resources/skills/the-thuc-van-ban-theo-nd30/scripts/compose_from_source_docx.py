
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


def clear_body_preserve_sections(doc: Document) -> None:
    body = doc._element.body
    sect_pr = body.sectPr
    for child in list(body):
        if child is not sect_pr:
            body.remove(child)


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
