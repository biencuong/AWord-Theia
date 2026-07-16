#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, re, shutil
from pathlib import Path
from check_nd30_docx import check_profile
from nd30_docx_tools import dump_json, extract_template_profile

def slugify(text: str) -> str:
    value = ''.join(ch.lower() if ch.isalnum() else '-' for ch in text.strip())
    while '--' in value:
        value = value.replace('--', '-')
    return value.strip('-') or 'template'

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('source_docx')
    parser.add_argument('template_dir')
    parser.add_argument('profile_dir')
    parser.add_argument('template_name')
    parser.add_argument('--allow-noncompliant', action='store_true')
    args = parser.parse_args()
    src = Path(args.source_docx)
    if not src.exists():
        print(f'Source DOCX not found: {src}')
        return 2
    key = slugify(args.template_name)
    template_dir = Path(args.template_dir)
    profile_dir = Path(args.profile_dir)
    template_dir.mkdir(parents=True, exist_ok=True)
    profile_dir.mkdir(parents=True, exist_ok=True)
    profile = extract_template_profile(src)
    issues = check_profile(profile)
    fail_count = sum(1 for x in issues if x['level'] == 'fail')
    if fail_count and not args.allow_noncompliant:
        print(json.dumps({'status': 'rejected', 'issues': issues}, ensure_ascii=False, indent=2))
        print('Template has fail-level issues. Re-run with --allow-noncompliant only after user approval.')
        return 3
    shutil.copy2(src, template_dir / f'{key}.docx')
    dump_json(profile, profile_dir / f'{key}.profile.json')
    meta = {
        'template_name': args.template_name,
        'source_name': src.name,
        'allow_noncompliant': bool(args.allow_noncompliant),
        'issues': issues,
        'status': 'warning' if fail_count else ('warning' if any(i['level']=='warn' for i in issues) else 'ok')
    }
    (template_dir / f'{key}.meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(meta, ensure_ascii=False, indent=2))
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
