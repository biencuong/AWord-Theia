#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib
import shutil
import subprocess
import sys

REQUIRED_PY = {
    'docx': 'python-docx',
    'openpyxl': 'openpyxl',
    'PIL': 'pillow',
}
OPTIONAL_TOOLS = {
    'soffice': 'LibreOffice / soffice for DOCX preview rendering',
    'pdftoppm': 'Poppler pdftoppm for PNG rendering',
}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--install-missing', action='store_true')
    args = parser.parse_args()

    missing = []
    print('Python dependencies:')
    for mod, pkg in REQUIRED_PY.items():
        try:
            importlib.import_module(mod)
            print(f'  [OK] {mod} ({pkg})')
        except Exception:
            print(f'  [MISSING] {mod} -> pip install {pkg}')
            missing.append(pkg)

    if missing and args.install_missing:
        subprocess.run([sys.executable, '-m', 'pip', 'install', *sorted(set(missing))], check=False)

    print('\nExternal tools:')
    for exe, desc in OPTIONAL_TOOLS.items():
        path = shutil.which(exe)
        if path:
            print(f'  [OK] {exe} -> {path}')
        else:
            print(f'  [MISSING] {exe} ({desc})')

    print('\nNotes:')
    print('- Install LibreOffice if DOCX preview render is unavailable because `soffice` is missing.')
    print('- Install Poppler if PNG render output is unavailable because `pdftoppm` is missing.')
    print('- Tesseract OCR is not required for this skill.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
