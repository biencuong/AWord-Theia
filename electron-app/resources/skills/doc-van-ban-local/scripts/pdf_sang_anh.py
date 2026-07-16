"""Chuyển PDF scan thành ảnh để Claude đọc bằng thị giác — tối ưu tốc độ.

Cách dùng:
    python pdf_sang_anh.py "duong_dan.pdf" [--trang 1-5,8] [--dpi 150] [--mau]
                           [--chat-luong 72] [--thu-muc-ra DIR]

Mặc định: JPEG thang xám 150dpi chất lượng 72 — nhỏ gấp 3-5 lần PNG 200dpi,
Claude đọc nhanh hơn hẳn mà chữ in văn bản hành chính vẫn rõ.

Cache: ảnh lưu vào %TEMP%/aword_pdf_cache/<khóa>/trang_NNN.jpg, khóa tính từ
đường dẫn + kích thước + mtime + tham số render — chạy lại cùng file với cùng
tham số thì KHÔNG render lại, chỉ in danh sách ảnh đã có.

Đầu ra: mỗi dòng một đường dẫn ảnh (theo thứ tự trang) để Read từng ảnh.
"""

import argparse
import hashlib
import os
import sys
from pathlib import Path

try:
    import fitz  # pymupdf
except ImportError:
    print("LỖI: thiếu thư viện pymupdf — chạy scripts/ensure_deps.py rồi thử lại.", file=sys.stderr)
    sys.exit(2)


def phan_tich_trang(chuoi: str, tong: int) -> list[int]:
    """'1-3,7' -> [0,1,2,6] (chỉ số 0-based, lọc trong phạm vi tài liệu)."""
    if not chuoi:
        return list(range(tong))
    ket_qua: set[int] = set()
    for phan in chuoi.split(","):
        phan = phan.strip()
        if not phan:
            continue
        if "-" in phan:
            dau, cuoi = phan.split("-", 1)
            ket_qua.update(range(int(dau) - 1, int(cuoi)))
        else:
            ket_qua.add(int(phan) - 1)
    return sorted(i for i in ket_qua if 0 <= i < tong)


def main() -> int:
    p = argparse.ArgumentParser(description="Render PDF scan thành ảnh JPEG cho Claude đọc bằng thị giác.")
    p.add_argument("pdf", help="đường dẫn file PDF")
    p.add_argument("--trang", default="", help="các trang cần render, vd: 1-5,8 (mặc định: tất cả)")
    p.add_argument("--dpi", type=int, default=150, help="độ phân giải (mặc định 150; chữ nhỏ dùng 200)")
    p.add_argument("--mau", action="store_true", help="giữ màu (mặc định thang xám cho nhẹ)")
    p.add_argument("--chat-luong", type=int, default=72, dest="chat_luong", help="chất lượng JPEG 1-100 (mặc định 72)")
    p.add_argument("--thu-muc-ra", default="", dest="thu_muc_ra", help="thư mục lưu ảnh (mặc định: cache trong %%TEMP%%)")
    a = p.parse_args()

    pdf = Path(a.pdf)
    if not pdf.is_file():
        print(f"LỖI: không thấy file {pdf}", file=sys.stderr)
        return 1

    st = pdf.stat()
    khoa = hashlib.md5(
        f"{pdf.resolve()}|{st.st_size}|{st.st_mtime_ns}|{a.dpi}|{a.mau}|{a.chat_luong}".encode("utf-8")
    ).hexdigest()[:16]
    if a.thu_muc_ra:
        thu_muc = Path(a.thu_muc_ra)
    else:
        thu_muc = Path(os.environ.get("TEMP") or os.environ.get("TMP") or ".") / "aword_pdf_cache" / khoa
    thu_muc.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(pdf)
    cac_trang = phan_tich_trang(a.trang, doc.page_count)
    if not cac_trang:
        print("LỖI: phạm vi --trang không khớp trang nào.", file=sys.stderr)
        return 1

    ma_tran = fitz.Matrix(a.dpi / 72, a.dpi / 72)
    he_mau = fitz.csRGB if a.mau else fitz.csGRAY
    so_render = 0
    duong_dan_anh: list[str] = []
    for i in cac_trang:
        f = thu_muc / f"trang_{i + 1:03d}.jpg"
        if not f.exists():
            pix = doc[i].get_pixmap(matrix=ma_tran, colorspace=he_mau)
            try:
                pix.save(str(f), jpg_quality=a.chat_luong)
            except (TypeError, ValueError, RuntimeError):
                # pymupdf cũ không xuất JPEG trực tiếp — đi vòng qua Pillow.
                from PIL import Image
                che_do = "RGB" if a.mau else "L"
                Image.frombytes(che_do, (pix.width, pix.height), pix.samples).save(
                    str(f), "JPEG", quality=a.chat_luong
                )
            so_render += 1
        duong_dan_anh.append(str(f))
    doc.close()

    print(f"# {pdf.name}: {len(cac_trang)} trang yêu cầu, "
          f"{so_render} trang render mới, {len(cac_trang) - so_render} trang lấy từ cache", file=sys.stderr)
    for duong_dan in duong_dan_anh:
        print(duong_dan)
    return 0


if __name__ == "__main__":
    sys.exit(main())
