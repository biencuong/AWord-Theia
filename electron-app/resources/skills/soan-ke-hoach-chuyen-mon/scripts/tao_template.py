# -*- coding: utf-8 -*-
"""Sinh template docx cho kế hoạch chuyên môn (tách rời để tái tạo được khi khung thay đổi).

    python tao_template.py [--ra <thư mục>]

Sinh 3 khung trung học theo CV 5512: PL I (tổ — dạy học môn học), PL II (tổ — hoạt động giáo dục),
PL III (giáo viên). Khổ NGANG A4. Đây là khung để ĐIỀN, không phải văn bản hoàn chỉnh.
"""
from __future__ import annotations

import argparse
import pathlib
import sys

try:
    import docx
    from docx.enum.section import WD_ORIENT
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.shared import Cm, Pt
except ImportError:
    sys.exit('Thiếu python-docx. Cài: python -m pip install --user python-docx')

FONT = 'Times New Roman'


def kho_ngang(d) -> None:
    s = d.sections[0]
    s.orientation = WD_ORIENT.LANDSCAPE
    s.page_width, s.page_height = Cm(29.7), Cm(21)
    s.left_margin = s.right_margin = Cm(2)
    s.top_margin = s.bottom_margin = Cm(1.5)


def dau_trang(d, to_chuc: str, tieu_de: str, giao_vien: bool = False) -> None:
    """Khối đầu theo mẫu 5512: TRƯỜNG/TỔ (trái) — Quốc hiệu, Tiêu ngữ (phải)."""
    t = d.add_table(rows=1, cols=2)
    t.autofit = True
    o = t.rows[0].cells
    p = o[0].paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for i, dong in enumerate([to_chuc, 'TỔ: ……………………'] + (['Họ và tên GV: …………………'] if giao_vien else [])):
        if i:
            p = o[0].add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(dong)
        r.font.name, r.font.size, r.bold = FONT, Pt(12), (i == 0)
    p = o[1].paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for i, dong in enumerate(['CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 'Độc lập - Tự do - Hạnh phúc', '———————']):
        if i:
            p = o[1].add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(dong)
        r.font.name, r.font.size, r.bold = FONT, Pt(12), (i == 0)
    for _ in range(2):
        d.add_paragraph()
    p = d.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(tieu_de)
    r.font.name, r.font.size, r.bold = FONT, Pt(13), True


def tieu_de_muc(d, chu: str) -> None:
    p = d.add_paragraph()
    r = p.add_run(chu)
    r.font.name, r.font.size, r.bold = FONT, Pt(12.5), True


def bang(d, cot: list[str], so_hang: int = 8) -> None:
    t = d.add_table(rows=1 + so_hang, cols=len(cot))
    t.style = 'Table Grid'
    for i, c in enumerate(cot):
        p = t.rows[0].cells[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(c)
        r.font.name, r.font.size, r.bold = FONT, Pt(11.5), True
    for hang in range(1, so_hang + 1):
        p = t.rows[hang].cells[0].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(str(hang))
        r.font.name, r.font.size = FONT, Pt(11.5)
    d.add_paragraph()


def chan_ky(d, phai: str, giao_vien: bool = False) -> None:
    d.add_paragraph()
    t = d.add_table(rows=1, cols=2)
    for i, (chu, phu) in enumerate([('TỔ TRƯỞNG', '(Ký và ghi rõ họ tên)'),
                                    (phai, '(Ký và ghi rõ họ tên)')]):
        p = t.rows[0].cells[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(chu)
        r.font.name, r.font.size, r.bold = FONT, Pt(12), True
        p2 = t.rows[0].cells[i].add_paragraph()
        p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p2.add_run(phu)
        r.font.name, r.font.size, r.italic = FONT, Pt(11), True
        for _ in range(4):
            t.rows[0].cells[i].add_paragraph()


def pl1(ra: pathlib.Path) -> None:
    d = docx.Document()
    kho_ngang(d)
    dau_trang(d, 'TRƯỜNG: ………………………',
              'KẾ HOẠCH DẠY HỌC CỦA TỔ CHUYÊN MÔN\nMÔN HỌC/HOẠT ĐỘNG GIÁO DỤC: ………, KHỐI LỚP: ………\n(Năm học 20… - 20…)')
    tieu_de_muc(d, 'I. Đặc điểm tình hình')
    d.add_paragraph('1. Số lớp: ………; Số học sinh: ………; Số học sinh học chuyên đề lựa chọn (nếu có): ………')
    d.add_paragraph('2. Tình hình đội ngũ: Số giáo viên: ………; Trình độ đào tạo: Cao đẳng: ……; Đại học: ……; Trên đại học: ……')
    d.add_paragraph('   Mức đạt chuẩn nghề nghiệp giáo viên: Tốt: ……; Khá: ……; Đạt: ……; Chưa đạt: ……')
    d.add_paragraph('3. Thiết bị dạy học:')
    bang(d, ['STT', 'Thiết bị dạy học', 'Số lượng', 'Các bài thí nghiệm/thực hành', 'Ghi chú'], 6)
    d.add_paragraph('4. Phòng học bộ môn/phòng thí nghiệm/phòng đa năng/sân chơi, bãi tập:')
    bang(d, ['STT', 'Tên phòng', 'Số lượng', 'Phạm vi và nội dung sử dụng', 'Ghi chú'], 4)
    tieu_de_muc(d, 'II. Kế hoạch dạy học')
    d.add_paragraph('1. Phân phối chương trình')
    bang(d, ['STT', 'Bài học', 'Số tiết', 'Yêu cầu cần đạt'], 12)
    d.add_paragraph('2. Chuyên đề lựa chọn (đối với cấp THPT)')
    bang(d, ['STT', 'Chuyên đề', 'Số tiết', 'Yêu cầu cần đạt'], 4)
    d.add_paragraph('3. Kiểm tra, đánh giá định kỳ')
    t = d.add_table(rows=5, cols=5)
    t.style = 'Table Grid'
    for i, c in enumerate(['Bài kiểm tra, đánh giá', 'Thời gian', 'Thời điểm', 'Yêu cầu cần đạt', 'Hình thức']):
        p = t.rows[0].cells[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(c)
        r.font.name, r.font.size, r.bold = FONT, Pt(11.5), True
    for i, ten in enumerate(['Giữa Học kỳ 1', 'Cuối Học kỳ 1', 'Giữa Học kỳ 2', 'Cuối Học kỳ 2'], start=1):
        r = t.rows[i].cells[0].paragraphs[0].add_run(ten)
        r.font.name, r.font.size = FONT, Pt(11.5)
    d.add_paragraph()
    tieu_de_muc(d, 'III. Các nội dung khác (nếu có)')
    for _ in range(3):
        d.add_paragraph('…………………………………………………………………………………………………')
    chan_ky(d, '…, ngày … tháng … năm 20…\nHIỆU TRƯỞNG')
    d.save(str(ra / 'khdh-to-chuyen-mon-5512-pl1.docx'))


def pl2(ra: pathlib.Path) -> None:
    d = docx.Document()
    kho_ngang(d)
    dau_trang(d, 'TRƯỜNG: ………………………', 'KẾ HOẠCH TỔ CHỨC CÁC HOẠT ĐỘNG GIÁO DỤC CỦA TỔ CHUYÊN MÔN\n(Năm học 20… - 20…)')
    for k in range(1, 4):
        tieu_de_muc(d, f'{k}. Khối lớp: ………; Số học sinh: ………')
        bang(d, ['STT', 'Chủ đề', 'Yêu cầu cần đạt', 'Số tiết', 'Thời điểm', 'Địa điểm', 'Chủ trì', 'Phối hợp', 'Điều kiện thực hiện'], 5)
    chan_ky(d, '…, ngày … tháng … năm 20…\nHIỆU TRƯỞNG')
    d.save(str(ra / 'kh-hoat-dong-giao-duc-5512-pl2.docx'))


def pl3(ra: pathlib.Path) -> None:
    d = docx.Document()
    kho_ngang(d)
    dau_trang(d, 'TRƯỜNG: ………………………',
              'KẾ HOẠCH GIÁO DỤC CỦA GIÁO VIÊN\nMÔN HỌC/HOẠT ĐỘNG GIÁO DỤC: ………, LỚP: ………\n(Năm học 20… - 20…)', giao_vien=True)
    tieu_de_muc(d, 'I. Kế hoạch dạy học')
    d.add_paragraph('1. Phân phối chương trình')
    bang(d, ['STT', 'Bài học', 'Số tiết', 'Thời điểm (tuần)', 'Thiết bị dạy học', 'Địa điểm dạy học'], 12)
    d.add_paragraph('2. Chuyên đề lựa chọn (đối với cấp THPT)')
    bang(d, ['STT', 'Chuyên đề', 'Số tiết', 'Thời điểm (tuần)', 'Thiết bị dạy học', 'Địa điểm dạy học'], 4)
    tieu_de_muc(d, 'II. Nhiệm vụ khác (nếu có)')
    d.add_paragraph('(Bồi dưỡng học sinh giỏi; Tổ chức hoạt động giáo dục...)')
    for _ in range(3):
        d.add_paragraph('…………………………………………………………………………………………………')
    chan_ky(d, '…, ngày … tháng … năm 20…\nGIÁO VIÊN', giao_vien=True)
    d.save(str(ra / 'khgd-giao-vien-5512-pl3.docx'))


def _bang_gop(d, hang1: list[tuple[str, int]], hang2: list[str], so_hang: int = 6) -> None:
    """Bảng 2 tầng tiêu đề: mỗi mục ở hang1 là (nhãn, số cột con) — cột con 1 thì gộp dọc."""
    tong = sum(n for _, n in hang1)
    t = d.add_table(rows=2 + so_hang, cols=tong)
    t.style = 'Table Grid'
    c = 0
    for nhan, n in hang1:
        o = t.rows[0].cells[c]
        if n > 1:
            o = o.merge(t.rows[0].cells[c + n - 1])
        p = o.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(nhan)
        r.font.name, r.font.size, r.bold = FONT, Pt(10.5), True
        if n > 1:
            for k in range(n):
                p2 = t.rows[1].cells[c + k].paragraphs[0]
                p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
                r2 = p2.add_run(hang2[c + k])
                r2.font.name, r2.font.size, r2.bold = FONT, Pt(10.5), True
        else:
            t.rows[0].cells[c].merge(t.rows[1].cells[c])
        c += n
    d.add_paragraph()


def pl1_2345(ra: pathlib.Path) -> None:
    d = docx.Document()
    kho_ngang(d)
    dau_trang(d, 'TRƯỜNG: ………………………', 'KẾ HOẠCH GIÁO DỤC NHÀ TRƯỜNG\nNăm học 20… - 20…')
    for muc, noi in [
        ('I. Căn cứ xây dựng kế hoạch', 'Chỉ thị nhiệm vụ năm học; hướng dẫn nhiệm vụ năm học cấp tiểu học; kế hoạch thời gian năm học do UBND tỉnh ban hành; chỉ đạo của cơ quan quản lý…'),
    ]:
        tieu_de_muc(d, muc)
        d.add_paragraph(noi)
    tieu_de_muc(d, 'II. Điều kiện thực hiện chương trình năm học')
    d.add_paragraph('1. Đặc điểm tình hình kinh tế, văn hóa, xã hội địa phương: …………')
    d.add_paragraph('2. Đặc điểm tình hình nhà trường:')
    d.add_paragraph('  2.1. Đặc điểm học sinh (số lớp, tổng số HS, HS nữ, HS dân tộc, HS học 2 buổi/ngày, HS khuyết tật, HS hoàn cảnh khó khăn, HS bán trú, tỉ lệ HS/lớp — theo từng khối lớp): …………')
    d.add_paragraph('  2.2. Đội ngũ giáo viên, nhân viên, CBQL (tổng số, tỉ lệ nữ, tỉ lệ GV/lớp, trình độ đào tạo): …………')
    d.add_paragraph('  2.3. Cơ sở vật chất, thiết bị dạy học; điểm trường, lớp ghép; CSVC bán trú, nội trú: …………')
    tieu_de_muc(d, 'III. Mục tiêu giáo dục năm học')
    d.add_paragraph('1. Mục tiêu chung: …………')
    d.add_paragraph('2. Chỉ tiêu cụ thể (phẩm chất, năng lực học sinh theo từng khối lớp; số lượng, chất lượng môn học và HĐGD cam kết): …………')
    tieu_de_muc(d, 'IV. Tổ chức các môn học và hoạt động giáo dục trong năm học')
    d.add_paragraph('1. Phân phối thời lượng các môn học và hoạt động giáo dục (Phụ lục 1.1)')
    hang1 = [('TT', 1), ('Hoạt động giáo dục', 1)]
    hang2 = ['', '']
    for k in range(1, 6):
        hang1.append((f'Lớp {k}', 3))
        hang2 += ['Tổng', 'HK1', 'HK2']
    _bang_gop(d, hang1, hang2, 8)
    d.add_paragraph('2.1. Hoạt động giáo dục tập thể trong năm học (Phụ lục 1.2)')
    bang(d, ['Tháng', 'Chủ điểm', 'Nội dung trọng tâm', 'Hình thức tổ chức', 'Thời gian thực hiện', 'Người thực hiện', 'Lực lượng cùng tham gia'], 5)
    d.add_paragraph('2.2. Hoạt động sau giờ học chính thức trong ngày, theo nhu cầu người học, bán trú (Phụ lục 1.3)')
    bang(d, ['STT', 'Nội dung', 'Hoạt động', 'Đối tượng/quy mô', 'Thời gian', 'Địa điểm', 'Ghi chú'], 4)
    d.add_paragraph('4.1. Khung thời gian thực hiện chương trình (Phụ lục 1.4 — thời khóa biểu khung theo tuần)')
    d.add_paragraph('Dạy học 2 buổi/ngày, mỗi ngày không quá 7 tiết, mỗi tiết 35 phút; tối thiểu 9 buổi/tuần với 32 tiết/tuần; khai giảng 05/9; Học kỳ I (… tuần thực học), Học kỳ II (… tuần).')
    bang(d, ['Buổi', 'Tiết', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN', 'Điều chỉnh kế hoạch tuần'], 7)
    tieu_de_muc(d, 'V. Giải pháp thực hiện')
    for i, noi in enumerate(['Tăng cường cơ sở vật chất, thiết bị dạy học', 'Công tác đội ngũ', 'Thực hiện quy chế sinh hoạt chuyên môn', '…'], 1):
        d.add_paragraph(f'{i}. {noi}: …………')
    tieu_de_muc(d, 'VI. Tổ chức thực hiện')
    for vai in ['Hiệu trưởng', 'Phó Hiệu trưởng', 'Tổ trưởng chuyên môn', 'Tổng phụ trách Đội', 'Giáo viên chủ nhiệm', 'Giáo viên phụ trách môn học', 'Nhân viên']:
        d.add_paragraph(f'— {vai}: …………')
    d.add_paragraph()
    chan_ky(d, '…, ngày … tháng … năm 20…\nHIỆU TRƯỞNG')
    d.save(str(ra / 'khgd-nha-truong-2345-pl1.docx'))


def pl2_2345(ra: pathlib.Path) -> None:
    d = docx.Document()
    kho_ngang(d)
    dau_trang(d, 'TRƯỜNG: ………………………', 'KẾ HOẠCH DẠY HỌC CÁC MÔN HỌC, HOẠT ĐỘNG GIÁO DỤC\nKHỐI LỚP ……… — Năm học 20… - 20…')
    tieu_de_muc(d, 'I. Căn cứ xây dựng kế hoạch')
    d.add_paragraph('…………………………………………………………………………………………………')
    tieu_de_muc(d, 'II. Điều kiện thực hiện các môn học, hoạt động giáo dục')
    d.add_paragraph('…………………………………………………………………………………………………')
    tieu_de_muc(d, 'III. Kế hoạch dạy học các môn học, hoạt động giáo dục')
    for k in range(1, 3):
        d.add_paragraph(f'{k}. Môn: …………………………')
        _bang_gop(d, [('Tuần, tháng', 1), ('Chương trình và sách giáo khoa', 3),
                      ('Nội dung điều chỉnh, bổ sung (nếu có)', 1), ('Ghi chú', 1)],
                  ['', 'Chủ đề/Mạch nội dung', 'Tên bài học', 'Tiết học/thời lượng', '', ''], 8)
    tieu_de_muc(d, 'IV. Tổ chức thực hiện')
    for i, vai in enumerate(['Giáo viên (phụ trách môn học, chủ nhiệm)', 'Tổ trưởng (Khối trưởng)', 'Tổng phụ trách Đội'], 1):
        d.add_paragraph(f'{i}. {vai}: …………')
    d.add_paragraph()
    chan_ky(d, '…, ngày … tháng … năm 20…\nHIỆU TRƯỞNG')
    d.save(str(ra / 'khdh-mon-hoc-2345-pl2.docx'))


def main() -> None:
    ap = argparse.ArgumentParser(description='Sinh template kế hoạch chuyên môn (CV 5512 và CV 2345)')
    ap.add_argument('--ra', default=str(pathlib.Path(__file__).resolve().parent.parent / 'templates'))
    a = ap.parse_args()
    ra = pathlib.Path(a.ra)
    ra.mkdir(parents=True, exist_ok=True)
    pl1(ra)
    pl2(ra)
    pl3(ra)
    pl1_2345(ra)
    pl2_2345(ra)
    for f in sorted(ra.glob('*.docx')):
        print(f'  ✔ {f.name}  ({f.stat().st_size // 1024} KB)')
    print(f'\nĐã sinh template vào {ra}')


if __name__ == '__main__':
    main()
