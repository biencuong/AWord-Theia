#!/usr/bin/env python3
"""Validate an ND30 JSON spec before DOCX generation.

Usage:
    python validate_nd30_spec.py input.json
"""
from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

SUPPORTED = {
    'cong-van',
    'nghi-quyet-ca-biet',
    'quyet-dinh-truc-tiep',
    'quyet-dinh-gian-tiep',
    'van-ban-co-ten-loai',
    'cong-dien',
    'giay-moi',
    'giay-gioi-thieu',
    'bien-ban',
    'giay-nghi-phep',
    'phu-luc',
    'ban-sao-giay',
    'ban-sao-dien-tu',
}

REQUIRED_COMMON = [
    'issuing_agency',
    'document_type',
]

REQUIRED_BY_TYPE = {
    'cong-van': ['subject', 'kinh_gui', 'body_paragraphs', 'signer_position', 'signer_name'],
    'nghi-quyet-ca-biet': ['subject', 'legal_bases', 'body_paragraphs', 'signer_name'],
    'quyet-dinh-truc-tiep': ['subject', 'legal_bases', 'articles', 'signer_position', 'signer_name'],
    'quyet-dinh-gian-tiep': ['subject', 'legal_bases', 'articles', 'signer_position', 'signer_name'],
    'van-ban-co-ten-loai': ['document_title', 'subject', 'body_paragraphs', 'signer_position', 'signer_name'],
    'cong-dien': ['subject', 'kinh_gui', 'body_paragraphs', 'signer_position', 'signer_name'],
    'giay-moi': ['invitee', 'event_name', 'event_time', 'event_location', 'signer_position', 'signer_name'],
    'giay-gioi-thieu': ['introduced_person', 'destination_agency', 'purpose', 'signer_position', 'signer_name'],
    'bien-ban': ['subject', 'meeting_start', 'meeting_location', 'meeting_attendees', 'meeting_chair', 'meeting_secretary'],
    'giay-nghi-phep': ['leave_person', 'leave_period', 'signer_position', 'signer_name'],
    'phu-luc': ['appendix_number', 'appendix_title', 'appendix_parent_note'],
    'ban-sao-giay': ['copy_form', 'copy_agency', 'copy_number', 'location', 'issue_date', 'signer_position', 'signer_name'],
    'ban-sao-dien-tu': ['copy_form', 'copy_agency', 'location', 'issue_date'],
}

WARNING_RULES = {
    'cong-van': 'subject should usually start with "V/v" or be a short communication phrase.',
    'quyet-dinh-truc-tiep': 'prefer article-based structure for decisions.',
    'quyet-dinh-gian-tiep': 'subject usually starts with "Ban hành" or "Phê duyệt".',
}


def is_blank(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    if isinstance(value, list):
        return len(value) == 0
    return False


def parse_json(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(data, dict):
        raise ValueError('JSON root must be an object')
    return data


def check_date(value: str) -> bool:
    try:
        datetime.fromisoformat(value)
        return True
    except Exception:
        return False


def validate(data: dict[str, Any]) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    for key in REQUIRED_COMMON:
        if is_blank(data.get(key)):
            errors.append(f'missing required field: {key}')

    document_type = data.get('document_type', '')
    if document_type not in SUPPORTED:
        errors.append(f'unsupported document_type: {document_type!r}')
        return errors, warnings

    for key in REQUIRED_BY_TYPE.get(document_type, []):
        if is_blank(data.get(key)):
            errors.append(f'missing required field for {document_type}: {key}')

    issue_date = data.get('issue_date')
    if issue_date and isinstance(issue_date, str) and not check_date(issue_date):
        warnings.append('issue_date is not ISO format YYYY-MM-DD; the generator will keep the raw value.')

    if document_type == 'cong-van':
        subj = str(data.get('subject', '')).strip()
        if subj and not subj.lower().startswith('v/v'):
            warnings.append(WARNING_RULES['cong-van'])

    if document_type in {'quyet-dinh-truc-tiep', 'quyet-dinh-gian-tiep'}:
        articles = data.get('articles', [])
        if not isinstance(articles, list) or len(articles) == 0:
            warnings.append(WARNING_RULES[document_type])

    if document_type == 'quyet-dinh-gian-tiep':
        subj = str(data.get('subject', '')).strip().lower()
        if subj and not (subj.startswith('ban hành') or subj.startswith('phê duyệt')):
            warnings.append(WARNING_RULES['quyet-dinh-gian-tiep'])

    noi_nhan = data.get('noi_nhan', [])
    if noi_nhan and isinstance(noi_nhan, list):
        if not any('Lưu:' in str(x) or 'Luu:' in str(x) for x in noi_nhan):
            warnings.append('noi_nhan does not include a lưu line; ND30 documents usually include one.')

    body_paragraphs = data.get('body_paragraphs', [])
    if body_paragraphs and isinstance(body_paragraphs, list):
        for idx, item in enumerate(body_paragraphs):
            if isinstance(item, dict):
                item_type = str(item.get('type', 'paragraph')).strip().lower()
                if item_type in {'heading', 'section', 'de-muc'} and not str(item.get('text', '')).strip():
                    warnings.append(f'body_paragraphs[{idx}] heading block is missing text')
                if item_type == 'heading' and str(item.get('level', '')).strip() not in {'phan', 'chuong', 'muc', 'tieu-muc', 'major', 'minor', 'khoan', 'point', 'diem'}:
                    warnings.append(f'body_paragraphs[{idx}] heading level is unusual for ND30 hierarchy')

    signer_prefix = str(data.get('signer_authority', '')).strip()
    allowed_prefixes = {'', 'TM.', 'KT.', 'TL.', 'TUQ.', 'Q.'}
    if signer_prefix not in allowed_prefixes:
        warnings.append('signer_authority is unusual; expected one of TM., KT., TL., TUQ., Q., or blank.')

    return errors, warnings


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print('Usage: python validate_nd30_spec.py input.json')
        return 1
    path = Path(argv[1])
    if not path.exists():
        print(f'Input file not found: {path}')
        return 1
    try:
        data = parse_json(path)
    except Exception as exc:
        print(f'ERROR: failed to parse JSON: {exc}')
        return 1

    errors, warnings = validate(data)
    if warnings:
        print('WARNINGS:')
        for item in warnings:
            print(f'- {item}')
    if errors:
        print('ERRORS:')
        for item in errors:
            print(f'- {item}')
        return 2
    print('Spec is valid for generation.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv))
