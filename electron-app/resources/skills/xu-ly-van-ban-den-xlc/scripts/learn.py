#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""learn.py — BỘ NHỚ TÍCH LUỸ KINH NGHIỆM. Sau mỗi lần xử lý văn bản, ghi lại để lần sau tốt hơn.

Ghi vào:
  - memory/KINH_NGHIEM.md  (mục "Nhật ký lần làm" + mục kinh nghiệm/bài học)
  - memory/SO_LIEU.md      (số liệu tra được kèm nguồn)

Dùng:
  # Ghi 1 dòng nhật ký cho văn bản vừa xử lý
  python learn.py log --so "7456/CQTTBCĐ" --linhvuc "NQ57/CĐS" --loai "công văn" \
        --viec "đối chiếu CDS, dựng thư mục, dự thảo NĐ30" --note "PDF scan, đọc OCR"

  # Thêm 1 bài học/kinh nghiệm (xuất hiện ở mục 4 — tránh lặp lỗi)
  python learn.py tip "Văn bản từ Công an tỉnh hay đính kèm phụ lục scan -> luôn read_pdf trước"

  # Ghi 1 số liệu đã tra (kèm nguồn) vào SO_LIEU.md
  python learn.py solieu --chude "Chữ ký số" --giatri "100% lãnh đạo Sở đã cấp CKS" \
        --nguon "CDS\\...\\Phần A.III.4.5..."

  # Xem nhanh trí nhớ hiện có
  python learn.py show
"""
import argparse, sys
from datetime import date
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
MEM = SKILL_DIR / "memory"
KN = MEM / "KINH_NGHIEM.md"
SL = MEM / "SO_LIEU.md"

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def insert_log(line: str):
    txt = KN.read_text(encoding="utf-8")
    marker = "<!-- LOG_START -->"
    if marker in txt:
        txt = txt.replace(marker, marker + "\n" + line, 1)
    else:
        txt += "\n" + line + "\n"
    KN.write_text(txt, encoding="utf-8")


def add_tip(tip: str):
    txt = KN.read_text(encoding="utf-8")
    anchor = "## 4. Bài học kỹ thuật (tránh lặp lỗi)"
    bullet = f"- {tip}"
    if anchor in txt:
        head, rest = txt.split(anchor, 1)
        # chèn ngay sau dòng tiêu đề mục 4
        nl = rest.find("\n")
        rest = rest[:nl+1] + bullet + "\n" + rest[nl+1:]
        txt = head + anchor + rest
    else:
        txt += f"\n{bullet}\n"
    KN.write_text(txt, encoding="utf-8")


def add_solieu(chude: str, giatri: str, nguon: str):
    txt = SL.read_text(encoding="utf-8")
    bullet = f"- [{chude}] {giatri} — nguồn: {nguon} — tra ngày {date.today().isoformat()}"
    header = f"## {chude}"
    if header in txt:
        head, rest = txt.split(header, 1)
        nl = rest.find("\n")
        rest = rest[:nl+1] + bullet + "\n" + rest[nl+1:]
        txt = head + header + rest
    else:
        txt += f"\n## {chude}\n{bullet}\n"
    SL.write_text(txt, encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)

    g = sub.add_parser("log", help="Ghi nhật ký 1 lần xử lý.")
    g.add_argument("--so", required=True)
    g.add_argument("--linhvuc", default="")
    g.add_argument("--loai", default="")
    g.add_argument("--viec", default="")
    g.add_argument("--note", default="")

    t = sub.add_parser("tip", help="Thêm 1 bài học/kinh nghiệm.")
    t.add_argument("text")

    s = sub.add_parser("solieu", help="Ghi 1 số liệu đã tra kèm nguồn.")
    s.add_argument("--chude", required=True)
    s.add_argument("--giatri", required=True)
    s.add_argument("--nguon", required=True)

    sub.add_parser("show", help="In trí nhớ hiện có.")
    a = ap.parse_args()

    if a.cmd == "log":
        line = (f"- **{date.today().isoformat()}** · {a.so} · lĩnh vực: {a.linhvuc or '-'} · "
                f"loại VB đi: {a.loai or '-'} · việc: {a.viec or '-'}"
                + (f" · ghi chú: {a.note}" if a.note else ""))
        insert_log(line)
        print("Đã ghi nhật ký:", line)
    elif a.cmd == "tip":
        add_tip(a.text)
        print("Đã thêm kinh nghiệm:", a.text)
    elif a.cmd == "solieu":
        add_solieu(a.chude, a.giatri, a.nguon)
        print(f"Đã ghi số liệu [{a.chude}]: {a.giatri}")
    elif a.cmd == "show":
        print("===== KINH_NGHIEM.md =====")
        print(KN.read_text(encoding="utf-8"))
        print("\n===== SO_LIEU.md =====")
        print(SL.read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()
