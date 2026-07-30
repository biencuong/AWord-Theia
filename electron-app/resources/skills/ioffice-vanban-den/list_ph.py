#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""list_ph.py — Liệt kê văn bản [PH] Phối hợp chờ xử lý trên iOffice.

Chỉ ĐỌC: mở iOffice, bấm filter PH, thu thập số ký hiệu + trích yếu,
xuất ra JSON + Markdown để agent trình người dùng quyết định kết thúc hay không.
KHÔNG bấm bất kỳ nút nào đổi trạng thái văn bản.

Chạy:
    python list_ph.py              # hiện cửa sổ (nếu cần đăng nhập captcha)
    python list_ph.py --headless   # chạy ẩn (phiên cookie còn hạn)
"""
import argparse, json, re, sys
from pathlib import Path
try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception: pass
sys.path.insert(0, "scripts")
import fetch_vanban as F
from playwright.sync_api import sync_playwright

ROW = "#dt_basic tbody tr[id^='vb_']"
OUT_FILE = F.WORKDIR / "ph_list.json"
OUT_MD   = F.WORKDIR / "ph_list.md"


def extract_row_info(page):
    """Thu thập thông tin từ mỗi dòng văn bản PH hiện thị."""
    return page.eval_on_selector_all(ROW, """els => els.map(tr => ({
        doc_id:   tr.getAttribute('id') || '',
        so_ky_hieu: tr.getAttribute('so_ky_hieu') || '',
        trich_yeu:  tr.querySelector('td.vanbanden_hienthi_trichyeu')?.innerText
                    || tr.querySelector('td:nth-child(2)')?.innerText || '',
        han_xu_ly:  tr.querySelector('td.vanbanden_hienthi_han_xuly')?.innerText || '',
        noi_gui:    tr.querySelector('td.vanbanden_hienthi_nguoinhan')?.innerText || '',
        role:       tr.getAttribute('role_type_code') || '',
    }))""")


def run(headless):
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            str(F.PROFILE_DIR), headless=headless,
            viewport={"width": 1500, "height": 900})
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(F.LOGIN_URL, wait_until="domcontentloaded")
        # Đăng nhập nếu cần
        if page.locator(F.SEL_MENU_VBDEN_CXL).count() == 0:
            F.attempt_login(page)
            if page.locator(F.SEL_MENU_VBDEN_CXL).count() == 0:
                if headless:
                    print("⚠ Cần đăng nhập — chạy KHÔNG --headless để nhập tay.")
                    ctx.close(); sys.exit(2)
                print(">>> Đăng nhập trong cửa sổ rồi nhấn Enter...")
                ok = False
                for _ in range(150):
                    if page.locator(F.SEL_MENU_VBDEN_CXL).count():
                        ok = True; break
                    page.wait_for_timeout(2000)
                if not ok:
                    print("Hết thời gian."); ctx.close(); sys.exit(2)
        # Vào VB đến chờ xử lý
        page.eval_on_selector(F.SEL_MENU_VBDEN_CXL, "el=>el.click()")
        page.wait_for_selector(ROW, timeout=60000)

        # Đọc badge tổng
        badge_total = None
        for _ in range(12):
            try:
                t = page.locator(F.SEL_MENU_VBDEN_CXL).first.inner_text()
                m = re.search(r"\((\d+)\)", t)
                if m:
                    badge_total = int(m.group(1)); break
            except Exception:
                pass
            page.wait_for_timeout(500)

        # Áp dụng filter PH
        flt = page.locator(F.SEL_FILTER_TMPL.format(cval="ph"))
        if flt.count():
            try: flt.first.click(timeout=8000)
            except Exception: flt.first.evaluate("el=>el.click()")
            page.wait_for_timeout(2000)
        else:
            print("⚠ Không tìm thấy filter PH."); ctx.close(); sys.exit(1)

        # Quét TRANG ĐẦU
        items = []
        seen = set()
        page_no = 1
        while True:
            page.wait_for_selector(ROW, timeout=15000)
            rows = extract_row_info(page)
            if not rows:
                break
            # Kiểm tra có bị lẫn non-PH không
            non_ph = [r for r in rows if r['role'] != 'PH']
            if non_ph:
                print(f"⚠ Dòng non-PH: {[r['so_ky_hieu'] for r in non_ph]} — dừng quét.");
                break
            for r in rows:
                key = r['doc_id'] or r['so_ky_hieu']
                if key not in seen:
                    seen.add(key)
                    items.append(r)
            # Sang trang tiếp?
            pager = page.locator(F.SEL_PAGER_LINKS)
            avail = set()
            for j in range(pager.count()):
                onclick = pager.nth(j).get_attribute("onclick") or ""
                m = re.search(r"gotoPage\((\d+)\)", onclick)
                if m: avail.add(int(m.group(1)))
            nxt = sorted(pn for pn in avail if pn > page_no)
            if not nxt:
                break
            prev_first = F.first_doc_id(page)
            page.evaluate("(n)=>page.gotoPage(n)", nxt[0])
            page_no = nxt[0]
            F.wait_table_change(page, prev_first)
            page.wait_for_timeout(1000)

        ctx.close()

    if not items:
        print("✅ Không có văn bản PH nào cần xử lý.")
        return

    # Xuất JSON
    OUT_FILE.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"✅ {len(items)} văn bản PH → {OUT_FILE.name}")

    # Xuất Markdown
    lines = [f"# Danh sách VB [PH] chờ xử lý\n"]
    lines.append(f"Tổng badge: {badge_total} · Số dòng PH: **{len(items)}**\n")
    lines.append("| # | Số ký hiệu | Trích yếu | Hạn xử lý | Đơn vị gửi |")
    lines.append("|---|-----------|-----------|-----------|-----------|")
    for i, item in enumerate(items, 1):
        sy = item['so_ky_hieu'].replace('|', '/')
        ty = (item['trich_yeu'] or '').replace('|', '/').replace('\n', ' ')[:80]
        hx = item['han_xu_ly'] or '-'
        ng = (item['noi_gui'] or '').replace('|', '/')[:40]
        lines.append(f"| {i} | {sy} | {ty} | {hx} | {ng} |")
    lines.append("")
    lines.append("**Quyết:** Kết thúc tất cả / chọn số / bỏ qua.")
    OUT_MD.write_text("\n".join(lines), encoding="utf-8")
    print(f"📄 Markdown → {OUT_MD.name}")

    # In ra console
    print()
    print(lines[0].strip())
    for line in lines[1:]:
        print(line)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--headless", action="store_true")
    run(ap.parse_args().headless)
