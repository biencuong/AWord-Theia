# -*- coding: utf-8 -*-
"""Cập nhật Excel tổng hợp từ _tong_hop.json (thêm các đơn vị chưa có, không trùng lặp).
Thư mục làm việc: biến môi trường AWORD_TH_WORKDIR (mặc định: thư mục hiện hành).
Tên file Excel: tham số dòng lệnh 1 (mặc định: file TH_*.xlsx đầu tiên trong thư mục)."""
import json, sys, os, openpyxl
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE = Path(os.environ.get('AWORD_TH_WORKDIR', '.'))
JSON_PATH = BASE / "_tong_hop.json"
if len(sys.argv) > 1:
    XLSX_PATH = BASE / sys.argv[1]
else:
    matches = sorted(BASE.glob("TH_*.xlsx"))
    if not matches:
        print(f"❌ Không thấy file TH_*.xlsx trong {BASE.resolve()}"); sys.exit(1)
    XLSX_PATH = matches[0]

data = json.loads(JSON_PATH.read_text(encoding='utf-8'))
print(f"JSON: {len(data)} đơn vị — Excel: {XLSX_PATH.name}")

wb = openpyxl.load_workbook(str(XLSX_PATH))
ws = wb.worksheets[0] if 'TH_RaSoatCSDL' not in wb.sheetnames else wb['TH_RaSoatCSDL']

# Các đơn vị đã có trong Excel (cột B) — kiểm trùng theo tên đơn vị
existing_units = set()
for row in ws.iter_rows(min_row=2, values_only=True):
    if row[1]:
        existing_units.add(str(row[1]).strip())
print(f"Excel hiện có: {len(existing_units)} đơn vị")

# Thêm dòng mới theo thứ tự stt — GIỮ NGUYÊN 4 cột mẫu, không thêm/xóa cột
added = 0
for item in sorted(data, key=lambda x: x['stt']):
    unit = item['unit']
    if unit not in existing_units:
        note_suffix = f" [{item.get('note','')}]" if item.get('note') else ""
        ws.append([item['stt'], unit, item.get('place', ''), item['content'] + note_suffix])
        existing_units.add(unit)
        added += 1
        print(f"  + {item['stt']}. {unit}")

wb.save(str(XLSX_PATH))
print(f"\n✅ Đã thêm {added} dòng. Tổng trong Excel: {len(existing_units)} đơn vị")
