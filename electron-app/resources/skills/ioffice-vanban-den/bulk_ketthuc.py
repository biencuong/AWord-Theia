#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""bulk_ketthuc.py — Kết thúc xử lý HÀNG LOẠT văn bản [PH] Phối hợp trên iOffice.

⚠️ ĐỔI TRẠNG THÁI THẬT, KHÔNG HOÀN TÁC (PH không 'lấy lại' được). Chỉ chạy khi người dùng
đã đồng ý ghi đè rào an toàn của SKILL. Nhiều lớp bảo vệ:
  - Chỉ thao tác khi MỌI dòng hiển thị đều role_type_code='PH' (nếu lẫn dòng khác -> DỪNG).
  - --max N giới hạn số văn bản kết thúc (mặc định 2 để chạy thử). --max 0 = tất cả.
  - Mặc định HIỆN cửa sổ để theo dõi; đóng cửa sổ là hủy ngay.

Luồng mỗi lượt: lọc [PH] -> tick N ô (hoặc chọn-tất-cả) -> 'Kết thúc văn bản' -> 'Kết thúc'
-> nếu hiện modal Hồ sơ thì bấm 'Lưu và Kết thúc xử lý VB' -> chờ danh sách giảm.

Chạy:  python bulk_ketthuc.py --max 2          # thử 2 cái (có cửa sổ)
       python bulk_ketthuc.py --max 0 --headless   # toàn bộ, chạy ẩn
"""
import argparse, re, sys
from pathlib import Path
try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception: pass
sys.path.insert(0, "scripts")
import fetch_vanban as F
from playwright.sync_api import sync_playwright

ROW = "#dt_basic tbody tr[id^='vb_']"
ROW_CB = "#dt_basic tbody tr[id^='vb_'] input[name='chk_vanban']"


def rows_info(page):
    return page.eval_on_selector_all(
        ROW, "els => els.map(e => e.getAttribute('role_type_code'))")


def get_count(page):
    """Số 'Văn bản đến chờ xử lý (N)' từ menu (đợi tới khi render được số)."""
    for _ in range(12):
        try:
            t = page.locator(F.SEL_MENU_VBDEN_CXL).first.inner_text()
        except Exception:
            t = ""
        m = re.search(r"\((\d+)\)", t)
        if m:
            return int(m.group(1))
        page.wait_for_timeout(500)
    return None


def logged_out(page):
    return page.locator("input#passWord").count() > 0


def apply_ph_filter(page):
    prev = F.first_doc_id(page)
    flt = page.locator(F.SEL_FILTER_TMPL.format(cval="ph"))
    if flt.count():
        try: flt.first.click(timeout=8000)
        except Exception: flt.first.evaluate("el=>el.click()")
        F.wait_table_change(page, prev)
        page.wait_for_timeout(800)


def click_first_visible(page, selector, timeout=8000):
    loc = page.locator(selector)
    for i in range(loc.count()):
        if loc.nth(i).is_visible():
            loc.nth(i).click(timeout=timeout)
            return True
    return False


def finish_selected(page) -> bool:
    """Bấm 'Kết thúc hàng loạt' (ketthuc_vb_hangloat_hni) cho các văn bản đã tick.
    Hộp thoại xác nhận (confirm) được tự chấp nhận qua handler page.on('dialog')."""
    if not click_first_visible(page, "button:has-text('Kết thúc hàng loạt')"):
        try:
            page.evaluate("ketthuc_vb_hangloat_hni()")        # gọi thẳng nếu không click được
        except Exception:
            print("[!] Không thấy nút 'Kết thúc hàng loạt'."); return False
    page.wait_for_timeout(1800)
    # nếu có modal hồ sơ -> bấm 'Lưu và Kết thúc xử lý VB'
    if page.locator("#myModalHoSo").count() and page.locator("#myModalHoSo").first.is_visible():
        click_first_visible(page, "#btnsaveClose") or \
            click_first_visible(page, "button:has-text('Lưu và Kết thúc xử lý VB')")
    page.wait_for_timeout(2800)
    return True


def run(headless, max_docs):
    import iolock
    ok, holder = iolock.acquire("browser", session="bulk_ketthuc")
    if not ok:
        print(f"[KHOÁ] Phiên khác đang dùng browser: {holder}. Dừng. (xem AGENTS.md)"); return
    try:
        _run(headless, max_docs)
    finally:
        iolock.release("browser")


def _run(headless, max_docs):
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(str(F.PROFILE_DIR), headless=headless,
                                                   accept_downloads=True,
                                                   viewport={"width":1500,"height":900})
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        # Tự chấp nhận hộp thoại xác nhận "kết thúc N văn bản?" (đúng ý người dùng).
        page.on("dialog", lambda d: (print(f"  [hộp thoại] {d.message[:70]} -> đồng ý"), d.accept()))
        page.goto(F.LOGIN_URL, wait_until="domcontentloaded")
        if page.locator(F.SEL_MENU_VBDEN_CXL).count()==0:
            F.attempt_login(page)                      # thử tự đăng nhập
            if page.locator(F.SEL_MENU_VBDEN_CXL).count()==0:
                if headless:
                    print("Chưa đăng nhập được (captcha?) — chạy KHÔNG --headless để nhập tay.")
                    ctx.close(); sys.exit(2)
                print(">>> Hãy ĐĂNG NHẬP (nhập captcha) trong cửa sổ. Tự chạy tiếp sau khi vào.")
                ok = False
                for _ in range(150):
                    if page.locator(F.SEL_MENU_VBDEN_CXL).count() > 0:
                        ok = True; break
                    page.wait_for_timeout(2000)
                if not ok:
                    print("Hết thời gian chờ đăng nhập."); ctx.close(); sys.exit(2)
        page.eval_on_selector(F.SEL_MENU_VBDEN_CXL, "el=>el.click()")
        page.wait_for_selector(ROW, timeout=60000)

        done = 0
        budget = max_docs if max_docs and max_docs > 0 else 10**9
        n0 = get_count(page)
        print(f">>> Bắt đầu: chờ xử lý = {n0}")
        for loop in range(120):                        # trần an toàn
            if logged_out(page):
                print("[DỪNG] MẤT PHIÊN (hiện trang đăng nhập). Đăng nhập lại rồi chạy tiếp."); break
            apply_ph_filter(page)
            codes = rows_info(page)
            if not codes:
                print("Hết văn bản PH trong danh sách."); break
            if any(c != "PH" for c in codes):          # AN TOÀN: chỉ đụng PH
                print(f"[DỪNG] Có dòng KHÔNG phải PH: {set(codes)} — không thao tác."); break
            before = get_count(page)
            before_first = F.first_doc_id(page)
            cbs = page.locator(ROW_CB)
            n = min(cbs.count(), budget - done)
            if n <= 0: break
            for i in range(n):
                cb = cbs.nth(i)
                if not cb.is_checked():
                    cb.check(timeout=5000)
            print(f"Lượt {loop+1}: chọn {n} PH (chờ xử lý trước={before}), đang kết thúc...")
            if not finish_selected(page):
                print("[DỪNG] Không bấm được 'Kết thúc hàng loạt'."); break
            # KIỂM TRA TIẾN TRIỂN THẬT: badge phải giảm, hoặc dòng đầu phải đổi.
            after = get_count(page)
            apply_ph_filter(page)
            after_first = F.first_doc_id(page)
            real = (before - after) if (before is not None and after is not None) else None
            if (real is None or real <= 0) and after_first == before_first:
                print(f"[DỪNG] KHÔNG tiến triển (trước={before}, sau={after}, dòng đầu không đổi). "
                      f"Có thể mất phiên/đổi giao diện — KHÔNG đếm ảo."); break
            done += real if (real and real > 0) else n
            print(f"  -> giảm thật: {real} | luỹ kế đã đóng: {done} | chờ xử lý còn: {after}")
            if done >= budget:
                print(f"Đạt giới hạn --max {max_docs}."); break
            page.wait_for_selector(ROW, timeout=60000)
        nf = get_count(page)
        print(f">>> XONG. Đã đóng (ước theo badge): {done}. Chờ xử lý: {n0} -> {nf}.")
        ctx.close()


ROWS_SO_JS = ("() => Array.from(document.querySelectorAll(\"#dt_basic tbody tr[id^='vb_']\"))"
              ".map(tr => tr.getAttribute('so_ky_hieu'))")
CLOSE_QUEUE = F.WORKDIR / "close_queue.json"


def _ensure_login(page, headless):
    page.goto(F.LOGIN_URL, wait_until="domcontentloaded")
    if page.locator(F.SEL_MENU_VBDEN_CXL).count() == 0:
        F.attempt_login(page)
        if page.locator(F.SEL_MENU_VBDEN_CXL).count() == 0:
            if headless:
                print("Chưa đăng nhập được (captcha?) — bỏ --headless."); return False
            print(">>> Hãy ĐĂNG NHẬP (captcha) trong cửa sổ...")
            for _ in range(150):
                if page.locator(F.SEL_MENU_VBDEN_CXL).count() > 0:
                    break
                page.wait_for_timeout(2000)
            else:
                return False
    page.eval_on_selector(F.SEL_MENU_VBDEN_CXL, "el=>el.click()")
    page.wait_for_selector(ROW, timeout=30000)
    return True


def run_queue(headless):
    """Đóng THẬT trên iOffice đúng các văn bản trong close_queue.json (đã được xác nhận qua Telegram)."""
    import json as _j
    queue = _j.loads(CLOSE_QUEUE.read_text(encoding="utf-8")) if CLOSE_QUEUE.exists() else []
    want = {q.get("so_ky_hieu") for q in queue if q.get("so_ky_hieu")}
    if not want:
        print("Hàng đợi đóng rỗng."); return
    print(f"Cần đóng {len(want)} văn bản: {sorted(want)}")
    import iolock
    ok, holder = iolock.acquire("browser", session="bulk_ketthuc.queue")
    if not ok:
        print(f"[KHOÁ] Phiên khác đang dùng browser: {holder}. Dừng. (xem AGENTS.md)"); return
    try:
        _run_queue(headless, queue, want)
    finally:
        iolock.release("browser")


def _run_queue(headless, queue, want):
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(str(F.PROFILE_DIR), headless=headless,
                                                   accept_downloads=True, viewport={"width":1500,"height":900})
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.on("dialog", lambda d: (print(f"  [hộp thoại] {d.message[:60]} -> đồng ý"), d.accept()))
        if not _ensure_login(page, headless):
            print("Không đăng nhập được."); ctx.close(); return
        closed = []
        for outer in range(150):
            if not want:
                break
            apply_ph_filter(page)
            visited, acted, page_no = set(), False, 1
            while True:
                page.wait_for_selector(ROW, timeout=20000)
                sos = page.evaluate(ROWS_SO_JS)
                idxs = [i for i, s in enumerate(sos) if s in want]
                if idxs:
                    cbs = page.locator(ROW_CB)
                    for i in idxs:
                        if not cbs.nth(i).is_checked():
                            cbs.nth(i).check(timeout=5000)
                    before = get_count(page)
                    print(f"  Đóng {len(idxs)} VB: {[sos[i] for i in idxs]} (chờ xử lý={before})")
                    if finish_selected(page):
                        after = get_count(page)
                        if before is None or after is None or after < before:
                            for i in idxs:
                                want.discard(sos[i]); closed.append(sos[i])
                        else:
                            print("  [DỪNG] không giảm — có thể không đóng được loại này."); want = set()
                    acted = True; break
                visited.add(page_no)
                pager = page.locator(F.SEL_PAGER_LINKS); avail = set()
                for j in range(pager.count()):
                    m = re.search(r"gotoPage\((\d+)\)", pager.nth(j).get_attribute("onclick") or "")
                    if m: avail.add(int(m.group(1)))
                nxt = sorted(pn for pn in avail if pn not in visited)
                if not nxt:
                    break
                prev = F.first_doc_id(page)
                page.evaluate("(n)=>page.gotoPage(n)", nxt[0]); page_no = nxt[0]
                wait_table_change(page, prev)
            if not acted:
                print("Không còn văn bản hàng đợi trên danh sách (đã đóng / không đóng được)."); break
        remaining = [q for q in queue if q.get("so_ky_hieu") in want]
        CLOSE_QUEUE.write_text(_j.dumps(remaining, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f">>> XONG. Đã đóng {len(closed)}: {closed}. Hàng đợi còn: {len(remaining)}.")
        ctx.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=2, help="Số VB kết thúc (mặc định 2; 0=tất cả)")
    ap.add_argument("--queue", action="store_true", help="Đóng đúng văn bản trong close_queue.json")
    ap.add_argument("--headless", action="store_true", help="Chạy ẩn (mặc định hiện cửa sổ)")
    a = ap.parse_args()
    if a.queue:
        run_queue(a.headless)
    else:
        run(a.headless, a.max)
