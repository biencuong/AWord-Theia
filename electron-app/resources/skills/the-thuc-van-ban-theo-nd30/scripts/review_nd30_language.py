#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from docx import Document

CATEGORIES = {'spelling', 'punctuation', 'wording', 'logic', 'consistency', 'normalization'}
SEVERITIES = {'critical', 'warn', 'suggest'}
SECTIONS = {'title', 'subject', 'legal_bases', 'kinh_gui', 'body', 'requests', 'noi_nhan', 'signoff', 'metadata', 'cross_section'}


def load_json(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(data, dict):
        raise ValueError('JSON root must be an object')
    return data


def extract_from_docx(path: Path) -> dict[str, Any]:
    doc = Document(path)
    paragraphs = [p.text.strip() for p in doc.paragraphs if p.text and p.text.strip()]
    full_text = '\n'.join(paragraphs)
    upper = [p.upper() for p in paragraphs[:20]]
    document_type = 'unknown'
    if any('KÍNH GỬI' in p for p in upper) and any('V/V' in p or 'VỀ VIỆC' in p for p in upper):
        document_type = 'cong-van'
    elif any(p == 'QUYẾT ĐỊNH' for p in upper):
        document_type = 'quyet-dinh-truc-tiep'
    elif any(p == 'KẾ HOẠCH' for p in upper):
        document_type = 'van-ban-co-ten-loai'

    title = next((p for p in paragraphs[:20] if p.isupper() and len(p) < 80 and 'CỘNG HÒA' not in p and 'UBND' not in p and 'SỞ' not in p), '')
    legal_bases: list[str] = []
    kinh_gui: list[str] = []
    body: list[str] = []
    noi_nhan: list[str] = []
    signoff = {'position': '', 'name': ''}
    in_noi_nhan = False
    for p in paragraphs:
        if p.startswith('Căn cứ '):
            legal_bases.append(p)
        elif p.upper().startswith('KÍNH GỬI'):
            tail = p.split(':', 1)
            if len(tail) > 1 and tail[1].strip():
                kinh_gui.append(tail[1].strip())
        elif p.startswith('- ') and kinh_gui and not body:
            kinh_gui.append(p[2:].strip())
        elif p.startswith('Nơi nhận'):
            in_noi_nhan = True
            tail = p.split(':', 1)
            if len(tail) > 1 and tail[1].strip():
                noi_nhan.append(tail[1].strip())
        elif in_noi_nhan and p.startswith('- '):
            noi_nhan.append(p[2:].strip())
        elif in_noi_nhan and p.isupper() and len(p) < 60:
            signoff['position'] = p
            in_noi_nhan = False
        else:
            body.append(p)
    subject = body[0][:160] if body else ''
    return {
        'document_type': document_type,
        'review_mode': 'suggest-only',
        'metadata': {'source_docx': path.name},
        'structured_blocks': {
            'title': title,
            'subject': subject,
            'legal_bases': legal_bases,
            'kinh_gui': kinh_gui,
            'body_paragraphs': body,
            'requests': [],
            'noi_nhan': noi_nhan,
            'signoff': signoff,
        },
        'full_text': full_text,
    }


def build_prompt_payload(inp: dict[str, Any], review_mode: str) -> dict[str, Any]:
    return {
        'uses_qwenpaw_default_model': True,
        'review_mode': review_mode,
        'system_contract_ref': 'references/nd30-llm-review-prompt.md',
        'input': inp,
    }


def assign_ids(report: dict[str, Any]) -> dict[str, Any]:
    for i, item in enumerate(report.get('findings', []), 1):
        item.setdefault('id', i)
    for i, item in enumerate(report.get('rewrite_suggestions', []), 1):
        item.setdefault('id', i)
    return report


def heuristic_review(inp: dict[str, Any], review_mode: str) -> dict[str, Any]:
    findings = []
    rewrites = []
    full_text = inp.get('full_text', '')
    blocks = inp.get('structured_blocks', {})
    low = full_text.lower()
    typo_map = {
        'kính gởi': 'kính gửi',
        'gởi': 'gửi',
        'sát nhập': 'sáp nhập',
        'triễn khai': 'triển khai',
    }

    def add(cat, sev, sec, quote, issue, reason, suggestion, safe, confirm):
        findings.append({
            'category': cat,
            'severity': sev,
            'section': sec,
            'quote': quote,
            'issue': issue,
            'reason': reason,
            'suggestion': suggestion,
            'safe_to_apply': safe,
            'needs_confirmation': confirm,
        })

    for bad, good in typo_map.items():
        if bad in low:
            add('spelling', 'warn', 'body', bad, 'Cụm từ có khả năng sai chính tả.', f'Dạng viết chuẩn thường là “{good}”.', f'Sửa thành “{good}”.', True, False)
            rewrites.append({'section': 'body', 'original': bad, 'rewritten': good, 'change_type': 'safe_rewrite', 'reason': 'Sửa chính tả thông dụng.'})

    phrase = 'Đề nghị các đơn vị khẩn trương nhanh chóng thực hiện ngay nội dung nêu trên.'
    if phrase in full_text:
        add('wording', 'warn', 'body', phrase, 'Cụm từ có nhiều từ gần nghĩa, làm câu nặng.', '“khẩn trương”, “nhanh chóng”, “ngay” chồng nghĩa.', 'Rút gọn để câu gọn hơn mà không đổi ý.', True, False)
        rewrites.append({'section': 'body', 'original': phrase, 'rewritten': 'Đề nghị các đơn vị khẩn trương thực hiện nội dung nêu trên.', 'change_type': 'safe_rewrite', 'reason': 'Lược bỏ từ gần nghĩa, giữ nguyên ý chỉ đạo.'})

    if not blocks.get('legal_bases') and str(inp.get('document_type', '')).startswith('quyet-dinh'):
        add('logic', 'warn', 'legal_bases', '', 'Quyết định thường cần khối căn cứ.', 'Thiếu căn cứ có thể làm yếu logic ban hành.', 'Kiểm tra lại các căn cứ pháp lý cần dẫn.', False, True)
    if blocks.get('kinh_gui') and 'Kính gửi' not in full_text:
        add('consistency', 'warn', 'kinh_gui', '', 'Có dữ liệu kính gửi nhưng không thấy dòng nhãn rõ ràng.', 'Người đọc có thể khó xác định đối tượng nhận văn bản.', 'Bảo đảm có dòng “Kính gửi:” rõ ràng.', False, True)

    report = {
        'summary': {'critical': 0, 'warn': 0, 'suggest': 0},
        'findings': findings,
        'normalized_terms': [],
        'rewrite_suggestions': rewrites if review_mode != 'strict-audit' else [],
        'open_questions': [],
        'uses_qwenpaw_default_model': True,
        'review_mode': review_mode,
    }
    report = assign_ids(report)
    counts = {'critical': 0, 'warn': 0, 'suggest': 0}
    for item in report['findings']:
        counts[item['severity']] += 1
    report['summary'] = counts
    return report


def validate_report(report: dict[str, Any]) -> dict[str, Any]:
    report = assign_ids(report)
    report.setdefault('summary', {'critical': 0, 'warn': 0, 'suggest': 0})
    report.setdefault('findings', [])
    report.setdefault('normalized_terms', [])
    report.setdefault('rewrite_suggestions', [])
    report.setdefault('open_questions', [])
    for item in report['findings']:
        if item.get('category') not in CATEGORIES:
            item['category'] = 'wording'
        if item.get('severity') not in SEVERITIES:
            item['severity'] = 'warn'
        if item.get('section') not in SECTIONS:
            item['section'] = 'body'
        item.setdefault('safe_to_apply', False)
        item.setdefault('needs_confirmation', True)
    counts = {'critical': 0, 'warn': 0, 'suggest': 0}
    for item in report['findings']:
        counts[item['severity']] += 1
    report['summary'] = counts
    return report


def write_md(report: dict[str, Any], path: Path) -> None:
    lines = ['# ND30 language review', '', f"- critical: {report['summary']['critical']}", f"- warn: {report['summary']['warn']}", f"- suggest: {report['summary']['suggest']}", '', '## Findings']
    for item in report.get('findings', []):
        lines.append(f"### {item.get('id','?')}. [{item['severity']}] {item['category']} / {item['section']}")
        if item.get('quote'):
            lines.append(f"> {item['quote']}")
        lines.append(f"- Issue: {item['issue']}")
        lines.append(f"- Reason: {item['reason']}")
        lines.append(f"- Suggestion: {item['suggestion']}")
        lines.append(f"- safe_to_apply: {item.get('safe_to_apply')} / needs_confirmation: {item.get('needs_confirmation')}")
        lines.append('')
    lines.append('## Rewrite suggestions')
    for item in report.get('rewrite_suggestions', []):
        lines.append(f"- {item.get('id','?')}. {item.get('original','')} -> {item.get('rewritten','')} ({item.get('change_type','')})")
    path.write_text('\n'.join(lines), encoding='utf-8')


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('input_path')
    parser.add_argument('--mode', choices=['suggest-only', 'safe-rewrite', 'strict-audit'], default='suggest-only')
    parser.add_argument('--model-output-json')
    parser.add_argument('--normalized-input')
    parser.add_argument('--prompt-json')
    parser.add_argument('--json')
    parser.add_argument('--md')
    args = parser.parse_args()

    src = Path(args.input_path)
    if not src.exists():
        print(f'Input not found: {src}')
        return 2
    inp = extract_from_docx(src) if src.suffix.lower() == '.docx' else load_json(src)
    inp['review_mode'] = args.mode
    if args.normalized_input:
        Path(args.normalized_input).write_text(json.dumps(inp, ensure_ascii=False, indent=2), encoding='utf-8')
    if args.prompt_json:
        Path(args.prompt_json).write_text(json.dumps(build_prompt_payload(inp, args.mode), ensure_ascii=False, indent=2), encoding='utf-8')
    report = validate_report(load_json(Path(args.model_output_json))) if args.model_output_json else heuristic_review(inp, args.mode)
    if args.json:
        Path(args.json).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    if args.md:
        write_md(report, Path(args.md))
    print(json.dumps(report['summary'], ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
