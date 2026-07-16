#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""enrich_text.py — Bổ sung TEXT cho các văn bản 'needs_ocr' trong inbox.json (PDF scan / .doc cũ)
bằng extract_ocr (LLM-vision / Word COM). Ưu tiên văn bản hạng cao trước; có --limit để làm dần.

Dùng: python scripts/enrich_text.py --limit 5 [--max-pages 5]
Sau đó nên chạy build_index + build_knowledge để cập nhật.
"""
import argparse, json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import fetch_vanban as F
import extract_ocr

WORKDIR = F.WORKDIR
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=5, help="Số văn bản xử lý lần này (theo ưu tiên)")
    ap.add_argument("--max-pages", type=int, default=5, help="Số trang OCR tối đa mỗi PDF")
    a = ap.parse_args()

    inbox = json.loads((WORKDIR / "inbox.json").read_text(encoding="utf-8"))
    order = sorted(range(len(inbox)), key=lambda i: (inbox[i].get("thu_tu_uu_tien") or 99999))
    done = 0
    for i in order:
        if done >= a.limit:
            break
        x = inbox[i]
        changed = False
        for e in x.get("extracted", []):
            f = e.get("file", "")
            if e.get("needs_ocr") and f and Path(f).exists():
                print(f">>> #{x.get('thu_tu_uu_tien')} {x.get('so_ky_hieu')} <- {Path(f).name} (đang đọc...)")
                t = extract_ocr.extract(f, a.max_pages)
                if t and not t.lstrip().startswith(("[chưa", "[lỗi")) and len(t.strip()) >= 20:
                    e["text"] = t
                    e["needs_ocr"] = False
                    e["ocr"] = "llm-vision" if Path(f).suffix.lower() != ".doc" else "word-com"
                    changed = True
                    print(f"    OK {len(t)} ký tự.")
                else:
                    print(f"    chưa đọc được: {t[:80]}")
        if changed:
            done += 1
    (WORKDIR / "inbox.json").write_text(json.dumps(inbox, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f">>> Đã bổ sung text cho {done} văn bản. Nên chạy: "
          f"python scripts/build_index.py && python scripts/build_knowledge.py")


if __name__ == "__main__":
    main()
