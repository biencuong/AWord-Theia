#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, shutil, subprocess, sys
from pathlib import Path

def run(cmd: list[str], optional: bool = False):
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    if p.returncode and not optional:
        raise subprocess.CalledProcessError(p.returncode, cmd, output=p.stdout)
    return p.returncode, p.stdout

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('input_docx')
    parser.add_argument('--document-type')
    parser.add_argument('--template')
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--json-manifest')
    args = parser.parse_args()
    src = Path(args.input_docx)
    if not src.exists():
        print(f'Input DOCX not found: {src}')
        return 2
    out = Path(args.output_dir)
    out.mkdir(parents=True, exist_ok=True)
    render_script = Path(__file__).with_name('render_docx.py')
    check_script = Path(__file__).with_name('check_nd30_docx.py')
    compare_script = Path(__file__).with_name('compare_docx_visual.py')
    manifest = {'input_docx': str(src), 'template': args.template, 'render_available': True, 'notes': []}
    compliance_json = out/'nd30-compliance-report.json'
    cmd = [sys.executable, str(check_script), str(src), '--json', str(compliance_json)]
    if args.document_type: cmd.extend(['--document-type', args.document_type])
    if args.template: cmd.extend(['--template', args.template])
    rc, txt = run(cmd, optional=True)
    manifest['compliance_returncode'] = rc
    manifest['compliance_stdout'] = txt
    soffice = shutil.which('soffice')
    pdftoppm = shutil.which('pdftoppm')
    if not soffice or not pdftoppm:
        manifest['render_available'] = False
        if not soffice: manifest['notes'].append('LibreOffice/soffice is missing. Install LibreOffice and ensure `soffice` is in PATH.')
        if not pdftoppm: manifest['notes'].append('Poppler pdftoppm is missing. Install Poppler to render PDF pages to PNG.')
    else:
        rr, rt = run([sys.executable, str(render_script), str(src), '--output_dir', str(out/'rendered')], optional=True)
        manifest['render_returncode'] = rr
        manifest['render_stdout'] = rt
        if args.template:
            vr = out/'visual-diff-report.json'
            cr, ct = run([sys.executable, str(compare_script), str(src), str(args.template), '--output-dir', str(out/'compare'), '--json', str(vr)], optional=True)
            manifest['visual_compare_returncode'] = cr
            manifest['visual_compare_stdout'] = ct
    manifest_path = Path(args.json_manifest) if args.json_manifest else out/'preview_manifest.json'
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'render_available': manifest['render_available'], 'manifest': str(manifest_path)}, ensure_ascii=False))
    return 0
if __name__ == '__main__':
    raise SystemExit(main())
