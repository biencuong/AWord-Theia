# -*- coding: utf-8 -*-
"""Tái tạo báo cáo tổng hợp .md từ _tong_hop.json.
Thư mục làm việc: biến môi trường AWORD_TH_WORKDIR (mặc định: thư mục hiện hành).
Endpoint/khóa LLM: AWORD_LLM_URL / AWORD_LLM_KEY — KHÔNG hardcode bí mật vào script."""
import os, sys, json, urllib.request, time
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE = Path(os.environ.get('AWORD_TH_WORKDIR', '.'))
JSON_PATH = BASE / "_tong_hop.json"
MD_PATH = BASE / "BC_TongHop_RaSoatCSDL_2025-2026.md"

data = json.loads(JSON_PATH.read_text(encoding='utf-8'))
print(f"Tổng: {len(data)} đơn vị")

# Xây prompt
items = []
for x in data:
    note = f" [{x.get('note','')}]" if x.get('note') else ''
    items.append(f"- {x['stt']}. **{x['unit']}** (số: {x.get('so','')}, xã/địa bàn: {x.get('place','')}): {x['content']}{note}")

prompt = f"""Viết báo cáo tổng hợp kết quả rà soát, cập nhật, hoàn thiện dữ liệu cuối năm học 2025-2026 trên Hệ thống CSDL ngành Giáo dục và Đào tạo tỉnh Tuyên Quang.

Có {len(data)} đơn vị đã gửi báo cáo. Dữ liệu từng đơn vị:

{chr(10).join(items)}

Yêu cầu báo cáo tổng hợp:
1. **Mở đầu**: Căn cứ CV 1417/SGDĐT, tổng số đơn vị nhận được báo cáo ({len(data)} đơn vị).
2. **Kết quả tổng hợp theo 9 nhóm dữ liệu** (bảng tổng hợp): đơn vị hoàn thành / còn tồn tại với mỗi nhóm.
3. **Đánh giá chung**: đơn vị hoàn thành tốt, đơn vị còn tồn tại, tồn tại phổ biến.
4. **Lưu ý đặc biệt**: đơn vị 22 (PTDT NT Vị Xuyên) và 23 (THPT Lê Hồng Phong) gửi nhầm file; đơn vị 18 (Bạch Xa) file .doc cũ không đọc được.
5. **Kiến nghị** tổng hợp từ các đơn vị.

Văn phong hành chính, ngắn gọn, số liệu cụ thể. Định dạng Markdown. Tiếng Việt."""

print(f"Gọi LLM ({len(prompt)} ký tự prompt)...")
url = os.environ.get('AWORD_LLM_URL', 'http://127.0.0.1:12345/v1') + '/chat/completions'
api_key = os.environ.get('AWORD_LLM_KEY', '')
if not api_key:
    print("❌ Thiếu AWORD_LLM_KEY (khóa API gateway). Đặt biến môi trường rồi chạy lại,")
    print("   hoặc để trợ lý AWord viết báo cáo trực tiếp (không cần script này).")
    sys.exit(1)
body = json.dumps({
    'model': os.environ.get('AWORD_LLM_MODEL', 'claude-sonnet-4-6'),
    'messages': [{'role': 'user', 'content': prompt}],
    'max_tokens': 4000,
    'temperature': 0
}).encode('utf-8')

t0 = time.time()
try:
    req = urllib.request.Request(url, data=body, headers={
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + api_key
    })
    with urllib.request.urlopen(req, timeout=350) as r:
        result = json.load(r)
    report = result['choices'][0]['message']['content']
    print(f"✅ LLM OK ({time.time()-t0:.0f}s, {len(report)} ký tự)")
except Exception as e:
    print(f"❌ LLM lỗi: {e}")
    sys.exit(1)

# Ghi file
from datetime import date
header = f"""# BÁO CÁO TỔNG HỢP
## Kết quả rà soát, cập nhật, hoàn thiện dữ liệu cuối năm học 2025-2026
### trên Hệ thống CSDL ngành Giáo dục và Đào tạo tỉnh Tuyên Quang

*Tổng hợp từ {len(data)} đơn vị — Cập nhật: {date.today().strftime('%d/%m/%Y')}*

---

"""
MD_PATH.write_text(header + report, encoding='utf-8')
print(f"📄 Đã ghi: {MD_PATH}")
print(f"   Dung lượng: {len(header+report):,} ký tự")
