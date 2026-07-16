#!/usr/bin/env python3
from __future__ import annotations
import argparse, json

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--has-template', action='store_true')
    parser.add_argument('--template-risk', choices=['low','medium','high'], default='low')
    parser.add_argument('--need-fidelity', action='store_true')
    parser.add_argument('--has-scan', action='store_true')
    args = parser.parse_args()
    if args.has_scan:
        strategy = 'scan-then-rebuild'
    elif args.has_template and args.need_fidelity and args.template_risk == 'low':
        strategy = 'replicate-or-clone-patch'
    elif args.has_template and args.template_risk in {'medium','high'}:
        strategy = 'audit-then-regenerate'
    else:
        strategy = 'canonical'
    print(json.dumps({'strategy': strategy}, ensure_ascii=False))
    return 0
if __name__ == '__main__':
    raise SystemExit(main())
