#!/usr/bin/env python3
"""Kiểm tra số lượng PH còn lại sau bulk_ketthuc."""
import re, sys, json
sys.path.insert(0, "scripts")
import fetch_vanban as F
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(F.PROFILE_DIR, headless=True, no_viewport=True)
    page = ctx.new_page()
    page.goto(F.LOGIN_URL, wait_until='domcontentloaded', timeout=30000)
    page.wait_for_timeout(2000)
    if page.locator('input#passWord').count():
        print("Cần đăng nhập lại.")
        a = json.load(open(F.AUTH_FILE))
        page.fill('input#userName', a['username'])
        page.fill('input#passWord', a['password'])
        page.click('button#btnLogin')
        page.wait_for_timeout(3000)
    page.goto("https://vpdttq.vnptioffice.vn/qlvbdh/main?lang=vi", wait_until='domcontentloaded')
    page.wait_for_timeout(2000)
    t = page.locator(F.SEL_MENU_VBDEN_CXL).first.inner_text()
    m = re.search(r'\((\d+)\)', t)
    if m:
        print(f"VB đến chờ xử lý: {m.group(1)}")
    # bấm filter PH
    flt = page.locator(F.SEL_FILTER_TMPL.format(cval="ph"))
    if flt.count():
        flt.first.click(timeout=8000)
        page.wait_for_timeout(1000)
    # đếm dòng
    rows = page.locator(F.SEL_LIST_ROWS)
    print(f"Số dòng PH hiển thị: {rows.count()}")
    ctx.close()
