#!/usr/bin/env python3
"""Validate a canonical ND30 content spec for Word or Excel generation.

Usage:
    python validate_nd30_content_spec.py input.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from validate_nd30_spec import SUPPORTED as WORD_SUPPORTED, validate as validate_word
from create_nd30_workbook import TYPE_MAP as WORKBOOK_TYPE_MAP


def is_blank(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    if isinstance(value, list):
        return len(value) == 0
    return False


def validate_workbook(data: dict[str, Any]) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    workbook_type = data.get('workbook_type', '')
    if workbook_type not in WORKBOOK_TYPE_MAP:
        errors.append(f'unsupported workbook_type: {workbook_type!r}')
        return errors, warnings
    if is_blank(data.get('title')):
        warnings.append('title is blank; generator will fall back to workbook_type label')
    rows = data.get('rows', [])
    sheets = data.get('sheets', [])
    if not rows and not sheets:
        warnings.append('workbook has no rows yet; output will be an empty structure/template')
    if workbook_type == 'phu-luc-bang' and not data.get('columns'):
        errors.append('phu-luc-bang requires columns')
    return errors, warnings


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print('Usage: python validate_nd30_content_spec.py input.json')
        return 1
    path = Path(argv[1])
    if not path.exists():
        print(f'Input file not found: {path}')
        return 1
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
    except Exception as exc:
        print(f'ERROR: failed to parse JSON: {exc}')
        return 1
    if not isinstance(data, dict):
        print('ERROR: JSON root must be an object')
        return 1

    has_doc = 'document_type' in data
    has_wb = 'workbook_type' in data or 'sheets' in data
    if has_doc and has_wb:
        print('ERROR: content spec should describe either one Word document or one workbook, not both')
        return 2
    if not has_doc and not has_wb:
        print('ERROR: missing document_type or workbook_type')
        return 2

    if has_doc:
        errors, warnings = validate_word(data)
    else:
        errors, warnings = validate_workbook(data)

    mode = str(data.get('generation_mode', '')).strip()
    if mode and mode not in {'canonical', 'replicate', 'auto'}:
        warnings.append('generation_mode should be canonical, replicate, or auto')

    if warnings:
        print('WARNINGS:')
        for item in warnings:
            print(f'- {item}')
    if errors:
        print('ERRORS:')
        for item in errors:
            print(f'- {item}')
        return 2
    print('Content spec is valid for generation.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv))
