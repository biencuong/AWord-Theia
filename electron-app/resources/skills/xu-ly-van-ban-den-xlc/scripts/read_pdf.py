#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""read_pdf.py — Render PDF (kể cả PDF SCAN không có lớp text) thành ảnh PNG để LLM đọc OCR.

Văn bản đến trên iOffice nhiều file là bản scan -> pdfplumber trích rỗng (needs_ocr).
Script này render từng trang thành PNG (PyMuPDF) trong thư mục chứa PDF, in ra đường dẫn
TUYỆT ĐỐI từng ảnh để dùng với công cụ view_image.

Cài 1 lần (vào venv đang chạy): python -m pip install pymupdf
Dùng:
  python read_pdf.py "<đường dẫn .pdf>" [--dpi 170] [--max 6]
"""
import argparse, sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf", help="Đường dẫn file PDF.")
    ap.add_argument("--dpi", type=int, default=170)
    ap.add_argument("--max", type=int, default=6, help="Số trang tối đa render (0 = tất cả).")
    a = ap.parse_args()

    try:
        import fitz  # PyMuPDF
    except ImportError:
        sys.exit("[LỖI] Thiếu PyMuPDF. Cài: python -m pip install pymupdf")

    pdf = Path(a.pdf)
    if not pdf.exists():
        sys.exit(f"[LỖI] Không thấy file: {pdf}")

    doc = fitz.open(str(pdf))
    n = doc.page_count if a.max == 0 else min(doc.page_count, a.max)
    out = []
    for i in range(n):
        img = pdf.parent / f"_render_{pdf.stem}_p{i+1}.png"
        doc.load_page(i).get_pixmap(dpi=a.dpi).save(str(img))
        out.append(str(img.resolve()))
    print(f"SO_TRANG={doc.page_count} RENDER={n}")
    for p in out:
        print(p)


if __name__ == "__main__":
    main()
