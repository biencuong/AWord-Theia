#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""map_cds.py — Cầu nối với KHO TRI THỨC CDS để đối chiếu & dựng thư mục dự thảo.

Chức năng:
  --tree            : in cây thư mục CDS (2-3 cấp) để LLM đối chiếu lĩnh vực.
  --knowledge       : in nội dung file tri thức tổng `TRI_THUC_LAM_VIEC_CDS_2026.md`.
  --make <so> [--linh-vuc <ten>] : tạo thư mục đích CDS\\00_Trien_Khai_Van_Ban\\<so>,
                       in đường dẫn (để chuyển dự thảo + file tri thức dự thảo vào).

LLM (Claude) tự đọc --tree/--knowledge rồi QUYẾT lĩnh vực; script chỉ tạo thư mục, KHÔNG
di chuyển/đụng dữ liệu gốc trong cây tri thức CDS.
"""
import argparse, re, sys
from pathlib import Path

CDS_ROOT = Path(r"E:\Drive của tôi\TUYEN QUANG\CDS")
TARGET_PARENT = CDS_ROOT / "00_Trien_Khai_Van_Ban"        # nơi đặt thư mục từng văn bản
KNOWLEDGE_FILE = CDS_ROOT / "2026" / "TRI_THUC_LAM_VIEC_CDS_2026.md"

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def safe_name(s: str) -> str:
    return re.sub(r"[^0-9A-Za-zÀ-ỹ._-]+", "_", (s or "vb")).strip("_")[:80] or "vb"


def print_tree(root: Path, max_depth=2):
    if not root.exists():
        sys.exit(f"[LỖI] Không thấy kho tri thức: {root}")
    print(f"# CÂY TRI THỨC CDS (tối đa {max_depth} cấp)\n{root}")
    root_parts = len(root.parts)
    for p in sorted(root.rglob("*")):
        try:
            if not p.is_dir():
                continue
            depth = len(p.parts) - root_parts
            if depth > max_depth:
                continue
            print("  " * depth + "📁 " + p.name)
        except Exception:
            continue


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tree", action="store_true")
    ap.add_argument("--depth", type=int, default=2)
    ap.add_argument("--knowledge", action="store_true")
    ap.add_argument("--make", help="số/ký hiệu văn bản -> tạo thư mục đích.")
    ap.add_argument("--linh-vuc", default="", help="ghi chú lĩnh vực (chỉ để đặt tên gợi nhớ, tuỳ chọn).")
    a = ap.parse_args()

    if a.tree:
        print_tree(CDS_ROOT, a.depth)
        return

    if a.knowledge:
        if KNOWLEDGE_FILE.exists():
            print(KNOWLEDGE_FILE.read_text(encoding="utf-8", errors="replace"))
        else:
            print(f"[CẢNH BÁO] Không thấy {KNOWLEDGE_FILE}")
        return

    if a.make:
        name = safe_name(a.make)
        if a.linh_vuc:
            name = f"{name}_{safe_name(a.linh_vuc)}"
        target = TARGET_PARENT / name
        target.mkdir(parents=True, exist_ok=True)
        print(str(target))
        return

    ap.print_help()


if __name__ == "__main__":
    main()
