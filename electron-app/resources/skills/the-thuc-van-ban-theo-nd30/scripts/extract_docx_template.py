
#!/usr/bin/env python3
"""Extract a reusable formatting/reference profile from a DOCX file.

Usage:
    python extract_docx_template.py source.docx output.json
"""
from __future__ import annotations

import sys
from pathlib import Path

from nd30_docx_tools import dump_json, extract_template_profile


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print('Usage: python extract_docx_template.py source.docx output.json')
        return 1
    source = Path(argv[1])
    out = Path(argv[2])
    if not source.exists():
        print(f'Source file not found: {source}')
        return 2
    profile = extract_template_profile(source)
    out.parent.mkdir(parents=True, exist_ok=True)
    dump_json(profile, out)
    print(f'Extracted template profile to {out}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv))
