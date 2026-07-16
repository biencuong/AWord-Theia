#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""search_cds.py — TÌM SỐ LIỆU / TRI THỨC trong kho `E:\\Drive của tôi\\TUYEN QUANG\\CDS`.

Mục đích: khi soạn dự thảo gặp chỗ cần số liệu, ĐỪNG để [CẦN SỐ LIỆU] vội — tra ở kho CDS
trước. Script quét full-text các file .md/.txt (và tên file mọi loại), trả các ĐOẠN khớp kèm
đường dẫn + số dòng để LLM trích số liệu chính xác và dẫn nguồn.

Dùng:
  python search_cds.py "chữ ký số"                 # tìm 1 cụm
  python search_cds.py "chữ ký số" "tập huấn" --any  # khớp BẤT KỲ từ khoá
  python search_cds.py "CSDL" --max 8 --ctx 2        # số kết quả / số dòng ngữ cảnh
  python search_cds.py --names "báo cáo"             # chỉ tìm theo TÊN file/thư mục
"""
import argparse, sys
from pathlib import Path

CDS_ROOT = Path(r"E:\Drive của tôi\TUYEN QUANG\CDS")
TEXT_EXT = {".md", ".txt", ".csv"}
SKIP_DIR = {"__pycache__", ".git", "OLD", ".browser_profile"}

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def iter_files(root: Path):
    for p in root.rglob("*"):
        if any(s in p.parts for s in SKIP_DIR):
            continue
        if p.is_file():
            yield p


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("terms", nargs="*", help="Các cụm từ khoá cần tìm.")
    ap.add_argument("--any", action="store_true", help="Khớp BẤT KỲ từ khoá (mặc định: TẤT CẢ).")
    ap.add_argument("--max", type=int, default=12, help="Số đoạn kết quả tối đa.")
    ap.add_argument("--ctx", type=int, default=1, help="Số dòng ngữ cảnh trước/sau.")
    ap.add_argument("--names", action="store_true", help="Chỉ tìm theo TÊN file/thư mục.")
    a = ap.parse_args()

    if not CDS_ROOT.exists():
        sys.exit(f"[LỖI] Không thấy kho tri thức: {CDS_ROOT}")
    if not a.terms:
        sys.exit("Cần ít nhất 1 từ khoá. VD: python search_cds.py \"chữ ký số\"")

    terms = [t.lower() for t in a.terms]
    match = (lambda s: any(t in s for t in terms)) if a.any else (lambda s: all(t in s for t in terms))

    # 1) Khớp theo TÊN (file + thư mục)
    print("=== KHỚP THEO TÊN FILE/THƯ MỤC ===")
    name_hits = 0
    for p in iter_files(CDS_ROOT):
        rel = str(p).replace(str(CDS_ROOT), "CDS")
        if match(rel.lower()):
            print(f"  {rel}")
            name_hits += 1
            if name_hits >= a.max:
                print("  ... (còn nữa)")
                break
    if name_hits == 0:
        print("  (không có)")

    if a.names:
        return

    # 2) Khớp NỘI DUNG (full-text .md/.txt/.csv)
    print("\n=== KHỚP NỘI DUNG (đoạn trích) ===")
    shown = 0
    for p in iter_files(CDS_ROOT):
        if p.suffix.lower() not in TEXT_EXT:
            continue
        try:
            lines = p.read_text(encoding="utf-8", errors="replace").splitlines()
        except Exception:
            continue
        rel = str(p).replace(str(CDS_ROOT), "CDS")
        for i, ln in enumerate(lines):
            if match(ln.lower()):
                lo, hi = max(0, i - a.ctx), min(len(lines), i + a.ctx + 1)
                print(f"\n--- {rel}:{i+1} ---")
                for j in range(lo, hi):
                    mark = ">> " if j == i else "   "
                    print(mark + lines[j].rstrip())
                shown += 1
                break  # 1 đoạn/ file là đủ để định vị; mở file nếu cần thêm
        if shown >= a.max:
            print("\n... (đạt giới hạn --max, thu hẹp từ khoá nếu cần)")
            break
    if shown == 0:
        print("  (không thấy trong nội dung — thử --any hoặc từ khoá khác)")


if __name__ == "__main__":
    main()
