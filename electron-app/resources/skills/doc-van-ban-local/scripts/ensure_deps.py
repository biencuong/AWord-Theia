"""Kiểm tra và cài bù thư viện đọc tài liệu cho skill doc-van-ban-local.

Bộ cài AWord đã cài sẵn toàn bộ danh sách dưới đây (offline, từ wheel đóng kèm).
Script này chỉ để CÀI BÙ khi máy thiếu: ưu tiên kho wheel offline của AWord,
không có mới cài qua mạng. Luôn cài CỐ ĐỊNH với --user (không cài tạm) để lần
sau dùng lại được ngay — đúng LUẬT VỀ THƯ VIỆN trong CLAUDE.md của AWord.

Cách dùng:
    python ensure_deps.py            # kiểm tra/cài tất cả
    python ensure_deps.py pymupdf pillow   # chỉ kiểm tra/cài các gói nêu tên
"""

import importlib
import os
import subprocess
import sys
from pathlib import Path

PACKAGES = [
    # (tên pip,      tên import,   lý do)
    ("pdfplumber",   "pdfplumber", "đọc PDF có lớp text"),
    ("pymupdf",      "fitz",       "render PDF scan thành ảnh (pdf_sang_anh.py)"),
    ("pillow",       "PIL",        "xử lý ảnh"),
    ("python-docx",  "docx",       "đọc DOCX"),
    ("openpyxl",     "openpyxl",   "đọc XLSX"),
    ("xlrd",         "xlrd",       "đọc XLS đời cũ"),
    ("pypdf",        "pypdf",      "thao tác PDF (tách/gộp trang)"),
    ("lxml",         "lxml",       "nền cho python-docx"),
    ("defusedxml",   "defusedxml", "đọc XML an toàn"),
    ("pywin32",      "win32com",   "gọi Word/Excel qua COM cho .doc/.xls cũ"),
]


def thu_muc_wheel_offline() -> Path | None:
    """Kho wheel đóng kèm bộ cài AWord (nếu app được cài trên máy này)."""
    goc = os.environ.get("LOCALAPPDATA", "")
    if not goc:
        return None
    duong_dan = Path(goc) / "Programs" / "AWord" / "resources" / "pytools" / "wheels"
    return duong_dan if duong_dan.is_dir() else None


def cai(pip_name: str) -> bool:
    lenh_goc = [sys.executable, "-m", "pip", "install", "--user", "-q", pip_name]
    wheels = thu_muc_wheel_offline()
    cac_lenh = []
    if wheels:
        cac_lenh.append(lenh_goc + ["--no-index", "--find-links", str(wheels)])
    cac_lenh.append(lenh_goc)  # trực tuyến, khi kho offline không có/không đủ
    for lenh in cac_lenh:
        try:
            subprocess.check_call(lenh, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return True
        except subprocess.CalledProcessError:
            continue
    return False


def main(chi_dinh: list[str] | None = None) -> int:
    loi = []
    for pip_name, import_name, ly_do in PACKAGES:
        if chi_dinh and pip_name not in chi_dinh:
            continue
        try:
            importlib.import_module(import_name)
            continue
        except ImportError:
            pass
        print(f"[cài] {pip_name} ({ly_do})...")
        if cai(pip_name):
            print(f"[OK]  {pip_name}")
        else:
            print(f"[LỖI] không cài được {pip_name}")
            loi.append(pip_name)

    if loi:
        print(f"\nCần cài thủ công: pip install --user {' '.join(loi)}")
        print('Hoặc chạy "Cài công cụ tài liệu (AWord)" trong Start Menu (cài offline).')
        return 1
    print("\nTất cả thư viện sẵn sàng.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:] or None))
