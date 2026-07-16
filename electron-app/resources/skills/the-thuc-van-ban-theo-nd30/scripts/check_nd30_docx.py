#!/usr/bin/env python3
"""Check a DOCX file against ND30-oriented rules and optionally a reference template.

Usage:
    python check_nd30_docx.py file.docx
    python check_nd30_docx.py file.docx --document-type cong-van --template reference.docx --json report.json
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path
from typing import Any

from nd30_docx_tools import EXPECTED_TITLE_BY_TYPE, compare_profiles, dump_json, extract_template_profile


def add_issue(issues: list[dict[str, str]], bucket: str, level: str, code: str, message: str) -> None:
    issues.append({'bucket': bucket, 'level': level, 'code': code, 'message': message})


def check_profile(profile: dict[str, Any], expected_type: str | None = None) -> list[dict[str, str]]:
    issues: list[dict[str, str]] = []
    m = profile.get('section_metrics', {})
    if not (20 <= m.get('top_margin_mm', 0) <= 25):
        add_issue(issues, 'nd30-format', 'warn', 'top-margin', f"Top margin {m.get('top_margin_mm')} mm is outside ND30 range 20-25 mm")
    if not (20 <= m.get('bottom_margin_mm', 0) <= 25):
        add_issue(issues, 'nd30-format', 'warn', 'bottom-margin', f"Bottom margin {m.get('bottom_margin_mm')} mm is outside ND30 range 20-25 mm")
    if not (30 <= m.get('left_margin_mm', 0) <= 35):
        add_issue(issues, 'nd30-format', 'warn', 'left-margin', f"Left margin {m.get('left_margin_mm')} mm is outside ND30 range 30-35 mm")
    if not (15 <= m.get('right_margin_mm', 0) <= 20):
        add_issue(issues, 'nd30-format', 'warn', 'right-margin', f"Right margin {m.get('right_margin_mm')} mm is outside ND30 range 15-20 mm")

    if not profile.get('has_quoc_hieu'):
        add_issue(issues, 'nd30-format', 'fail', 'quoc-hieu', 'Missing or unreadable Quốc hiệu line')
    if not profile.get('has_tieu_ngu'):
        add_issue(issues, 'nd30-format', 'fail', 'tieu-ngu', 'Missing or unreadable Tiêu ngữ line')
    if not profile.get('has_number_line'):
        add_issue(issues, 'nd30-format', 'warn', 'so-ky-hieu', 'Could not find a Số:/ký hiệu line')
    if not profile.get('has_date_line'):
        add_issue(issues, 'nd30-format', 'warn', 'dia-danh-ngay-thang', 'Could not find a địa danh, ngày tháng năm line')

    p = profile.get('paragraphs_preview', [])
    preview_texts = [x.get('text', '') for x in p]
    preview_upper = ' '.join(preview_texts).upper()
    detected = profile.get('detected_document_type', 'unknown')
    if expected_type and detected != 'unknown' and expected_type != detected:
        add_issue(issues, 'document-family', 'warn', 'document-type-mismatch', f'Detected type {detected} differs from expected {expected_type}')
    if detected == 'unknown':
        add_issue(issues, 'document-family', 'warn', 'document-type-unknown', 'Could not confidently identify the document family from the upper layout')
    target_type = expected_type or detected
    if target_type in EXPECTED_TITLE_BY_TYPE:
        expected_title = EXPECTED_TITLE_BY_TYPE[target_type]
        title_blob = ' | '.join(profile.get('title_candidates', []))
        if expected_title not in title_blob and expected_title not in preview_upper:
            add_issue(issues, 'document-family', 'warn', 'title-block', f'Expected title block {expected_title} not found near the top of the document')
    elif target_type == 'cong-van':
        if 'KÍNH GỬI' not in preview_upper:
            add_issue(issues, 'document-family', 'warn', 'kinh-gui', 'Công văn usually needs a Kính gửi block but none was detected')
    detect_named_title_issue(profile, issues, target_type)

    all_text = ' '.join(preview_texts).upper()
    if target_type != 'phu-luc' and 'NƠI NHẬN' not in all_text and 'LƯU:' not in all_text:
        add_issue(issues, 'nd30-format', 'warn', 'noi-nhan', 'Could not detect a Nơi nhận/Lưu block near the visible preview')

    font_names = []
    for entry in profile.get('paragraphs_preview', []):
        font_names.extend(entry.get('font_names', []))
    if font_names:
        tnr_ratio = sum(1 for x in font_names if 'Times New Roman' in x) / max(1, len(font_names))
        if tnr_ratio < 0.6:
            add_issue(issues, 'nd30-format', 'warn', 'font-family', f'Only about {tnr_ratio:.0%} of sampled explicit font assignments are Times New Roman')
    else:
        add_issue(issues, 'layout-risk', 'info', 'font-family', 'Sampled runs did not expose explicit font-family assignments; inspect visually if needed')

    issues.extend(heading_issues(profile))

    placeholders = profile.get('placeholder_keys', [])
    if placeholders:
        add_issue(issues, 'template-similarity', 'info', 'template-placeholders', f'Detected placeholder fields: {", ".join(placeholders)}')
    return issues


def heading_issues(profile: dict[str, Any]) -> list[dict[str, str]]:
    issues: list[dict[str, str]] = []
    entries = profile.get('paragraphs_preview', [])
    for entry in entries[:80]:
        text = entry.get('text', '').strip()
        upper = text.upper()
        bold_ratio = float(entry.get('bold_ratio', 0.0))
        all_caps = bool(entry.get('all_caps', False))
        centered = entry.get('alignment') == 1
        if re.match(r'^(PHẦN|CHƯƠNG)\s+[IVXLC]+$', upper):
            if bold_ratio < 0.5 or not centered:
                add_issue(issues, 'nd30-format', 'warn', 'part-chapter-format', f'Heading "{text}" should usually be centered and bold')
        elif re.match(r'^(MỤC|TIỂU MỤC)\s+\d+', upper):
            if bold_ratio < 0.5 or not centered:
                add_issue(issues, 'nd30-format', 'warn', 'section-format', f'Heading "{text}" should usually be centered and bold')
        elif re.match(r'^ĐIỀU\s+\d+\.', upper):
            if bold_ratio < 0.25:
                add_issue(issues, 'nd30-format', 'warn', 'article-format', f'Article line "{text}" should usually have bold number/title prefix')
        elif re.match(r'^[IVXLC]+\.\s+', upper):
            if bold_ratio < 0.5 or not all_caps:
                add_issue(issues, 'nd30-format', 'warn', 'major-heading-format', f'Major heading "{text}" should usually be bold and uppercase')
        elif re.match(r'^\d+\.\s+', text):
            if len(text) < 120 and bold_ratio < 0.3:
                add_issue(issues, 'layout-risk', 'info', 'minor-heading-format', f'Numbered subheading "{text}" may need stronger emphasis if it is intended as a heading')
        elif re.match(r'^[a-zà-ỹ]\)\s+', text, re.I):
            if bold_ratio > 0.6:
                add_issue(issues, 'layout-risk', 'info', 'point-format', f'Point line "{text}" looks heavily bold; most point lines are plain text after the label')
    return issues


def detect_named_title_issue(profile: dict[str, Any], issues: list[dict[str, str]], target_type: str) -> None:
    titles = profile.get('title_candidates', [])
    named = profile.get('named_title_candidate')
    if target_type == 'van-ban-co-ten-loai' and not named:
        add_issue(issues, 'document-family', 'warn', 'named-title', 'Could not confidently detect a named-document title block in the upper layout')
    if target_type == 'cong-van' and named:
        add_issue(issues, 'document-family', 'warn', 'possible-named-doc', f'Upper title block resembles a named document ({named}) more than a công văn')


def render_text_report(profile: dict[str, Any], issues: list[dict[str, str]], template_compare: dict[str, Any] | None) -> str:
    lines: list[str] = []
    lines.append(f"Detected document type: {profile.get('detected_document_type', 'unknown')}")
    metrics = profile.get('section_metrics', {})
    lines.append('Section metrics (mm): ' + ', '.join(f"{k}={v}" for k, v in metrics.items()))
    for bucket in ['document-family', 'nd30-format', 'template-similarity', 'layout-risk']:
        bucket_items = [x for x in issues if x['bucket'] == bucket]
        lines.append(f'{bucket}:')
        if not bucket_items:
            lines.append('- PASS: no quick issues detected')
        else:
            for issue in bucket_items:
                lines.append(f"- {issue['level'].upper()} [{issue['code']}]: {issue['message']}")
    if template_compare is not None:
        lines.append('Template comparison:')
        if template_compare.get('matched'):
            lines.append('- PASS: candidate structure is reasonably close to template')
        else:
            for diff in template_compare.get('differences', []):
                lines.append(f'- WARN [template-diff]: {diff}')
    return '\n'.join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('docx')
    parser.add_argument('--document-type')
    parser.add_argument('--template')
    parser.add_argument('--json')
    args = parser.parse_args()

    docx = Path(args.docx)
    if not docx.exists():
        print(f'File not found: {docx}')
        return 2

    profile = extract_template_profile(docx)
    issues = check_profile(profile, args.document_type)
    template_compare = None
    if args.template:
        template_compare = compare_profiles(profile, extract_template_profile(args.template))

    payload = {
        'profile': profile,
        'issues': issues,
        'template_compare': template_compare,
        'summary': {
            'fail_count': sum(1 for x in issues if x['level'] == 'fail'),
            'warn_count': sum(1 for x in issues if x['level'] == 'warn'),
            'info_count': sum(1 for x in issues if x['level'] == 'info'),
        }
    }
    print(render_text_report(profile, issues, template_compare))
    if args.json:
        dump_json(payload, args.json)
    return 0 if payload['summary']['fail_count'] == 0 else 3


if __name__ == '__main__':
    raise SystemExit(main())
