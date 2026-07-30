#!/usr/bin/env python3
"""Mở browser headed, check PH count thủ công."""
import re, sys, json
sys.path.insert(0, "scripts")
import fetch_vanban as F
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(str(F.PROFILE_DIR), headless=False,
                                               viewport={"width":1500,"height":900})
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto(F.LOGIN_URL, wait_until="domcontentloaded")
    if page.locator(F.SEL_MENU_VBDEN_CXL).count() == 0:
        F.attempt_login(page)
    if page.locator(F.SEL_MENU_VBDEN_CXL).count() == 0:
        print(">>> ĐĂNG NHẬP BẰNG TAY (captcha).")
        for _ in range(150):
            if page.locator(F.SEL_MENU_VBDEN_CXL).count():
                break
            page.wait_for_timeout(2000)
    page.eval_on_selector(F.SEL_MENU_VBDEN_CXL, "el=>el.click()")

    # đọc tổng badge
    t = page.locator(F.SEL_MENU_VBDEN_CXL).first.inner_text()
    m = re.search(r"\((\d+)\)", t)
    print(f"Tổng badge: {m.group(1) if m else '?'}")

    # bấm filter PH
    flt = page.locator(F.SEL_FILTER_TMPL.format(cval="ph"))
    if flt.count():
        print("Bấm filter PH...")
        flt.first.click(timeout=8000)
        page.wait_for_timeout(2000)
        rows = page.locator(F.SEL_LIST_ROWS)
        rcount = rows.count()
        print(f"PH rows: {rcount}")
        # lấy 5 số ký hiệu đầu
        if rcount:
            for i in range(min(rcount, 5)):
                skh = rows.nth(i).get_attribute("so_ky_hieu")
                print(f"  {i+1}. {skh}")
        else:
            print("(danh sách trống — PH đã hết)")
    input("Nhấn Enter để đóng...")
    ctx.close()
