# -*- coding: utf-8 -*-
"""Trộn đề trắc nghiệm từ một đề gốc: sinh N mã đề (đảo thứ tự câu + đảo phương án) kèm bảng đáp án.

    python tron_de.py <de_goc.docx> --so-ma 4 [--ra <thư mục>] [--seed 2026]

ĐỌC KỸ GIỚI HẠN trước khi dùng:
  - Chỉ xử lý đề TRẮC NGHIỆM THUẦN CHỮ. Câu hỏi có HÌNH ẢNH/BẢNG/CÔNG THỨC dạng ảnh sẽ bị mất hình —
    script ĐẾM và CẢNH BÁO, không tự bỏ qua im lặng.
  - Nhận diện câu hỏi theo dòng bắt đầu bằng "Câu <số>" (hoặc "Question <số>"). Đề không theo mẫu này
    sẽ được báo lỗi rõ, không đoán.
  - Phương án nhận diện theo "A." "B." "C." "D." ở đầu dòng (chấp nhận A) B) A- A:).
  - Chạy thử với --kiem-tra để XEM TRƯỚC số câu nhận được mà không ghi tệp.
"""
from __future__ import annotations

import argparse
import pathlib
import random
import re
import sys

try:
    import docx
except ImportError:
    sys.exit('Thiếu python-docx. Cài: python -m pip install --user python-docx')

MAU_CAU = re.compile(r'^\s*(?:Câu|CÂU|Question)\s*(\d+)\s*[.:)]', re.I)
MAU_PA = re.compile(r'^\s*([A-D])\s*[.):\-]\s*(.*)$')
PA_DUNG = re.compile(r'^\s*([A-D])\s*[.):\-]?\s*$')


def doc_de(duong: pathlib.Path) -> tuple[list[list[str]], list[str]]:
    """Trả ([khối câu hỏi], [đoạn đầu đề]). Mỗi khối = các dòng của một câu."""
    d = docx.Document(str(duong))
    dong = [p.text.rstrip() for p in d.paragraphs]
    khoi: list[list[str]] = []
    dau: list[str] = []
    hien = None
    for t in dong:
        if MAU_CAU.match(t):
            if hien is not None:
                khoi.append(hien)
            hien = [t]
        elif hien is None:
            dau.append(t)
        else:
            hien.append(t)
    if hien is not None:
        khoi.append(hien)
    return khoi, dau


def dem_rui_ro(d: docx.Document) -> int:
    """Đếm số đối tượng KHÔNG phải chữ (ảnh, bảng) — script không mang được sang đề mới."""
    n = 0
    for p in d.paragraphs:
        n += len(p._element.findall('.//{http://schemas.openxmlformats.org/drawingml/2006/main}blip'))
        n += len(p._element.findall('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}drawing'))
    n += len(d.tables) * 10   # bảng coi như rủi ro cao
    return n


def tach_pa(khoi: list[str]) -> tuple[str, list[str], list[str]]:
    """Tách khối câu thành (dòng hỏi, đoạn dẫn thêm, [các phương án])."""
    than = [t for t in khoi[1:] if t.strip()]
    pa = [t for t in than if MAU_PA.match(t)]
    dan = [t for t in than if not MAU_PA.match(t)]
    return (khoi[0], dan, pa)


def doc_dap_an(nguon: str, so_cau: int) -> list[int] | None:
    """Đáp án của ĐỀ GỐC, dạng 'ABCD…' (A=0) hoặc '1,2,3,4'. None nếu không có."""
    if not nguon:
        return None
    chu = re.sub(r'[^A-Da-d]', '', nguon).upper()
    if len(chu) == so_cau and set(chu) <= set('ABCD'):
        return ['ABCD'.index(c) for c in chu]
    so = [int(x) for x in re.findall(r'\d+', nguon)]
    if len(so) == so_cau and all(1 <= x <= 4 for x in so):
        return [x - 1 for x in so]
    raise SystemExit(f'LỖI: đáp án phải có đúng {so_cau} mục dạng "ABCD…" hoặc "1,2,3,4". '
                     f'Nhận được {len(chu) or len(so)} mục.')


def ghi_de(ra: pathlib.Path, dau: list[str], cau: list[tuple[str, list[str], list[str]]],
           ma: str, so_cau: int) -> None:
    d = docx.Document()
    for t in dau:
        if t.strip():
            d.add_paragraph(t)
    d.add_paragraph(f'MÃ ĐỀ: {ma}')
    for i, (hoi, dan, pa) in enumerate(cau, 1):
        d.add_paragraph(re.sub(r'^\s*(?:Câu|CÂU|Question)\s*\d+\s*[.:)]\s*', f'Câu {i}. ', hoi, flags=re.I))
        for t in dan:
            d.add_paragraph(t)
        for j, t in enumerate(pa):
            chu = 'ABCD'[j]
            noi_dung = MAU_PA.match(t).group(2)
            d.add_paragraph(f'{chu}. {noi_dung}')
        d.add_paragraph('')
    d.save(str(ra))


def main() -> None:
    ap = argparse.ArgumentParser(description='Trộn đề trắc nghiệm từ đề gốc')
    ap.add_argument('de_goc')
    ap.add_argument('--so-ma', type=int, default=4, help='số mã đề cần sinh (mặc định 4)')
    ap.add_argument('--ra', default='', help='thư mục ghi kết quả')
    ap.add_argument('--seed', type=int, default=0, help='khoá ngẫu nhiên — cùng seed cho cùng kết quả')
    ap.add_argument('--dap-an', default='', help='ĐÁP ÁN CỦA ĐỀ GỐC, dạng "ABCD…" hoặc "1,2,3,4" — '
                                                 'BẮT BUỘC để bảng đáp án đúng; không có thì để trống đáp án')
    ap.add_argument('--kiem-tra', action='store_true', help='chỉ xem trước, không ghi tệp')
    a = ap.parse_args()

    goc = pathlib.Path(a.de_goc)
    if not goc.is_file():
        sys.exit(f'LỖI: không thấy {goc}')
    if a.seed:
        random.seed(a.seed)

    khoi, dau = doc_de(goc)
    if len(khoi) < 2:
        sys.exit('LỖI: không nhận ra câu hỏi nào. Đề phải có dòng bắt đầu bằng "Câu 1." "Câu 2." …')

    d = docx.Document(str(goc))
    rui_ro = dem_rui_ro(d)
    cau = []
    thieu_pa = []
    for k in khoi:
        hoi, dan, pa = tach_pa(k)
        if len(pa) < 2:
            thieu_pa.append(k[0][:60])
        cau.append((hoi, dan, pa))

    print(f'Đọc: {goc.name}')
    print(f'  → {len(cau)} câu nhận được')
    if thieu_pa:
        print(f'  ⚠ {len(thieu_pa)} câu KHÔNG nhận ra phương án A/B/C/D (sẽ giữ nguyên thứ tự):')
        for t in thieu_pa[:5]:
            print(f'      {t}…')
    if rui_ro:
        print(f'  ⚠ Phát hiện {rui_ro} đối tượng KHÔNG phải chữ (ảnh/bảng). Script KHÔNG mang được sang')
        print('     đề mới — phải chèn lại hình bằng tay. Cân nhắc dùng cách soạn đề mới hoàn toàn.')

    goc_dap_an = doc_dap_an(a.dap_an, len(cau))
    if goc_dap_an is None:
        print('  ⚠ KHÔNG có --dap-an: bảng đáp án sẽ để trống cho giáo viên tự điền.')
        print('     Cách đúng: đọc đáp án của đề gốc rồi truyền --dap-an "ABCD…" (A là phương án đầu).')

    if a.kiem_tra:
        print('\n(chế độ --kiem-tra: không ghi tệp)')
        return

    ra = pathlib.Path(a.ra) if a.ra else goc.parent / (goc.stem + '-ma-de')
    ra.mkdir(parents=True, exist_ok=True)
    bang = []
    for so in range(1, a.so_ma + 1):
        ma = f'{so:03d}'
        thu_tu = list(range(len(cau)))
        random.shuffle(thu_tu)
        cau_moi = []
        dap_an = []
        for idx in thu_tu:
            hoi, dan, pa = cau[idx]
            dung_goc = goc_dap_an[idx] if goc_dap_an else None
            if len(pa) >= 2:
                vt = list(range(len(pa)))
                random.shuffle(vt)          # đảo phương án
                pa_moi = [pa[i] for i in vt]
                if dung_goc is None or dung_goc >= len(vt):
                    dap_an.append('?')
                else:
                    dap_an.append('ABCD'[vt.index(dung_goc)])
            else:
                pa_moi = pa
                dap_an.append('?')
            cau_moi.append((hoi, dan, pa_moi))
        tep = ra / f'{goc.stem}_Ma{ma}.docx'
        ghi_de(tep, dau, cau_moi, ma, len(cau_moi))
        bang.append((ma, dap_an))
        print(f'  ✔ {tep.name}')

    # bảng đáp án
    bd = docx.Document()
    bd.add_paragraph('BẢNG ĐÁP ÁN CÁC MÃ ĐỀ')
    bd.add_paragraph('(đáp án tính theo phương án ĐÚNG của đề gốc — kiểm lại với đề gốc trước khi dùng)')
    for ma, dap_an in bang:
        bd.add_paragraph(f'Mã {ma}: ' + ' '.join(f'{i+1}{x}' for i, x in enumerate(dap_an)))
    bd.save(str(ra / 'BANG-DAP-AN.docx'))
    print(f'  ✔ BANG-DAP-AN.docx')
    print(f'\nĐã ghi {a.so_ma} mã đề + bảng đáp án vào {ra}')
    print('⚠ BẮT BUỘC kiểm lại: mở một mã đề đối chiếu đề gốc — đáp án phải khớp câu hỏi sau khi đảo.')


if __name__ == '__main__':
    main()
