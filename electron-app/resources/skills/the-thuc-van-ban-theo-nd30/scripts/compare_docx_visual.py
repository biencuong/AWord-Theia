#!/usr/bin/env python3
"""Render two DOCX files and compute a lightweight visual diff summary.

Usage:
    python compare_docx_visual.py candidate.docx template.docx --output-dir out [--json report.json]
"""
from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

from PIL import Image, ImageChops, ImageStat


def analyze_page_tail(img: Image.Image) -> dict:
    gray = img.convert('L')
    width, height = gray.size
    # dark text pixels; tolerate anti-aliasing
    mask = gray.point(lambda v: 255 if v < 235 else 0)
    bbox = mask.getbbox()
    if not bbox:
        return {
            'content_bbox': None,
            'bottom_whitespace_ratio': 1.0,
            'line_count': 0,
            'last_line_width_ratio': None,
            'last_two_lines_sparse': False,
        }
    left, top, right, bottom = bbox
    rows = []
    for y in range(height):
        row_box = mask.crop((0, y, width, y + 1)).getbbox()
        rows.append(row_box is not None)
    groups = []
    start = None
    for y, has in enumerate(rows):
        if has and start is None:
            start = y
        elif not has and start is not None:
            groups.append((start, y - 1))
            start = None
    if start is not None:
        groups.append((start, height - 1))
    line_boxes = []
    for y0, y1 in groups:
        box = mask.crop((0, y0, width, y1 + 1)).getbbox()
        if box:
            line_boxes.append((box[0], y0, box[2], y1))
    last_width_ratio = None
    sparse_tail = False
    if line_boxes:
        last = line_boxes[-1]
        last_width_ratio = round((last[2] - last[0]) / width, 3)
        if len(line_boxes) >= 2:
            tail = line_boxes[-2:]
            sparse_tail = all(((b[2] - b[0]) / width) < 0.45 for b in tail)
        else:
            sparse_tail = last_width_ratio < 0.35
    return {
        'content_bbox': [left, top, right, bottom],
        'bottom_whitespace_ratio': round((height - bottom) / height, 3),
        'line_count': len(line_boxes),
        'last_line_width_ratio': last_width_ratio,
        'last_two_lines_sparse': sparse_tail,
    }


def render(docx: Path, output_dir: Path) -> list[Path]:
    script = Path(__file__).with_name('render_docx.py')
    subprocess.run([sys.executable, str(script), str(docx), '--output_dir', str(output_dir)], check=True)
    return sorted(output_dir.glob(f'{docx.stem}-*.png'))


def compare_page(a: Path, b: Path) -> dict:
    img_a = Image.open(a).convert('RGB')
    img_b = Image.open(b).convert('RGB')
    if img_a.size != img_b.size:
        img_b = img_b.resize(img_a.size)
    diff = ImageChops.difference(img_a, img_b)
    stat = ImageStat.Stat(diff)
    mean = sum(stat.mean) / len(stat.mean)
    rms = math.sqrt(sum(v * v for v in stat.mean) / len(stat.mean))
    bbox = diff.getbbox()
    tail_a = analyze_page_tail(img_a)
    tail_b = analyze_page_tail(img_b)
    return {
        'page_a': a.name,
        'page_b': b.name,
        'mean_abs_diff': round(mean, 3),
        'rms_diff': round(rms, 3),
        'changed': bbox is not None,
        'candidate_tail': tail_a,
        'template_tail': tail_b,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('candidate_docx')
    parser.add_argument('template_docx')
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--json')
    args = parser.parse_args()

    cand = Path(args.candidate_docx)
    tmpl = Path(args.template_docx)
    if not cand.exists() or not tmpl.exists():
        print('Both candidate and template DOCX files must exist')
        return 2
    outdir = Path(args.output_dir)
    outdir.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix='visual_diff_') as tmp:
        tmp = Path(tmp)
        cand_pages = render(cand, tmp / 'candidate')
        tmpl_pages = render(tmpl, tmp / 'template')
        results = []
        for a, b in zip(cand_pages, tmpl_pages):
            results.append(compare_page(a, b))
        summary = {
            'candidate': str(cand),
            'template': str(tmpl),
            'candidate_pages': len(cand_pages),
            'template_pages': len(tmpl_pages),
            'page_count_match': len(cand_pages) == len(tmpl_pages),
            'pages': results,
            'mean_abs_diff_avg': round(sum(x['mean_abs_diff'] for x in results) / len(results), 3) if results else None,
            'sparse_tail_pages': [x['page_a'] for x in results if x.get('candidate_tail', {}).get('last_two_lines_sparse')],
            'bottom_whitespace_ratio_avg': round(sum((x.get('candidate_tail') or {}).get('bottom_whitespace_ratio', 0) for x in results) / len(results), 3) if results else None,
        }
        report_path = Path(args.json) if args.json else outdir / 'visual-diff-report.json'
        report_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
