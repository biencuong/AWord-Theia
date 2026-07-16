#!/usr/bin/env python3
"""Render DOCX to PNG pages for visual QA.

Usage:
    python render_docx.py input.docx --output_dir out [--emit_pdf]
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import tempfile
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('input_docx')
    parser.add_argument('--output_dir', required=True)
    parser.add_argument('--emit_pdf', action='store_true')
    args = parser.parse_args()

    input_docx = Path(args.input_docx).resolve()
    if not input_docx.exists():
        print(f'Input file not found: {input_docx}')
        return 1

    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    basename = input_docx.stem

    soffice = shutil.which('soffice')
    pdftoppm = shutil.which('pdftoppm')
    if not soffice:
        print('Missing dependency: soffice (LibreOffice)')
        return 2
    if not pdftoppm:
        print('Missing dependency: pdftoppm (Poppler)')
        return 2

    with tempfile.TemporaryDirectory(prefix='lo_profile_') as lo_profile, tempfile.TemporaryDirectory(prefix='docx_pdf_') as pdf_out:
        env = os.environ.copy()
        env['HOME'] = pdf_out
        convert_cmd = [
            soffice,
            f'-env:UserInstallation=file://{lo_profile}',
            '--headless',
            '--convert-to', 'pdf',
            '--outdir', pdf_out,
            str(input_docx),
        ]
        subprocess.run(convert_cmd, check=True, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        pdf_path = Path(pdf_out) / f'{basename}.pdf'
        if not pdf_path.exists():
            print('Failed to create PDF during render step.')
            return 3

        if args.emit_pdf:
            shutil.copy2(pdf_path, output_dir / pdf_path.name)

        png_prefix = output_dir / basename
        subprocess.run([pdftoppm, '-png', str(pdf_path), str(png_prefix)], check=True)
        pages = sorted(output_dir.glob(f'{basename}-*.png'))
        print(f'Rendered {len(pages)} page(s) into {output_dir}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
