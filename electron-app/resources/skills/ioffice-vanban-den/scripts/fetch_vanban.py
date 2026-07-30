#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fetch_vanban.py — Lấy "Văn bản đến chờ xử lý" trên VNPT iOffice (vai trò Sở GDĐT).

Phần CODE deterministic: mở phiên đã đăng nhập, quét danh sách, lọc theo người
được phân công + nhãn xử lý, tải đính kèm, trích text, xuất inbox.json.
KHÔNG bấm bất kỳ nút nào thay đổi trạng thái văn bản. KHÔNG chứa mật khẩu.

Cài đặt 1 lần:
    pip install playwright python-docx pdfplumber
    playwright install chromium

Lần đầu (để lưu phiên đăng nhập):
    python fetch_vanban.py --login      # mở cửa sổ, bạn TỰ đăng nhập rồi đóng
Các lần sau:
    python fetch_vanban.py              # chạy nền, dùng lại phiên đã lưu

GHI CHÚ CHO CLAUDE CODE / CLAUDE IN CHROME:
    Các chỗ đánh dấu  >>> TODO(selector)  cần được điền bằng cách mở trang thật
    và đọc DOM (read_page / find). Sau khi điền, ghi lại selector vào
    references/conventions.md để lần sau khỏi dò lại.
"""

import argparse, json, sys
from pathlib import Path

LOGIN_URL = "https://vpdttq.vnptioffice.vn/qlvbdh/main?lang=vi"
# Tài khoản/tên người dùng đọc từ auth.local.json (xem auth.local.example.json) — không hardcode.
_AUTH_FILE = Path(__file__).resolve().parent.parent / "auth.local.json"
_auth = json.loads(_AUTH_FILE.read_text(encoding="utf-8")) if _AUTH_FILE.exists() else {}
ASSIGNEE_USERNAME = _auth.get("username", "")
ASSIGNEE_NAME = _auth.get("display_name", ASSIGNEE_USERNAME)
if not ASSIGNEE_USERNAME:
    sys.exit("Thiếu auth.local.json (copy từ auth.local.example.json và điền username).")
WANTED_LABELS = ["XLC", "PH"]               # Xử lý chính, Phối hợp

WORKDIR = Path(__file__).resolve().parent.parent      # thư mục skill
PROFILE_DIR = WORKDIR / ".browser_profile"            # nơi lưu phiên đăng nhập
ATTACH_DIR = WORKDIR / "attachments"
OUT_JSON = WORKDIR / "inbox.json"


def extract_text(path: Path) -> dict:
    """Trích text thô từ đính kèm. PDF scan (không có lớp text) -> needs_ocr."""
    suffix = path.suffix.lower()
    try:
        if suffix == ".docx":
            import docx
            return {"text": "\n".join(p.text for p in docx.Document(str(path)).paragraphs),
                    "needs_ocr": False}
        if suffix == ".pdf":
            import pdfplumber
            with pdfplumber.open(str(path)) as pdf:
                text = "\n".join((pg.extract_text() or "") for pg in pdf.pages)
            return {"text": text, "needs_ocr": len(text.strip()) < 20}  # gần như rỗng -> scan
        # .doc cũ hoặc định dạng khác: để LLM/đọc ảnh xử lý
        return {"text": "", "needs_ocr": True, "note": f"Chưa trích được {suffix}"}
    except Exception as e:
        return {"text": "", "needs_ocr": True, "note": f"Lỗi trích: {e}"}


def run(login_mode: bool):
    from playwright.sync_api import sync_playwright

    ATTACH_DIR.mkdir(exist_ok=True)
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE_DIR),
            headless=not login_mode,        # --login -> hiện cửa sổ để đăng nhập tay
            accept_downloads=True,
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(LOGIN_URL, wait_until="networkidle")

        if login_mode:
            print(">>> Hãy đăng nhập thủ công trong cửa sổ vừa mở, rồi đóng cửa sổ.")
            print(">>> Phiên sẽ được lưu lại để các lần sau dùng tự động.")
            page.wait_for_event("close", timeout=0)   # chờ tới khi bạn đóng
            return

        # Phát hiện phiên hết hạn / bị đẩy về trang đăng nhập
        # >>> TODO(selector): thay 'input[type=password]' bằng dấu hiệu trang login thật của iOffice
        if page.locator("input[type=password]").count() > 0:
            print("PHIÊN HẾT HẠN — vui lòng chạy lại với --login và đăng nhập lại.")
            ctx.close(); sys.exit(2)

        # --- Điều hướng tới Văn bản đến > chờ xử lý ---
        # >>> TODO(selector): click menu "Văn bản đến" rồi "Văn bản đến chờ xử lý"
        # page.get_by_text("Văn bản đến").click()
        # page.get_by_text("Văn bản đến chờ xử lý").click()
        # page.wait_for_load_state("networkidle")

        # --- Quét bảng danh sách ---
        # >>> TODO(selector): xác định selector các DÒNG trong bảng văn bản
        rows = page.locator("table tbody tr")   # selector tạm, cần kiểm chứng
        results = []
        for i in range(rows.count()):
            row = rows.nth(i)
            row_text = row.inner_text()

            # Lọc: chỉ lấy văn bản phân công cho mình + đúng nhãn xử lý
            assigned_to_me = (ASSIGNEE_USERNAME in row_text) or (ASSIGNEE_NAME in row_text)
            label = next((lb for lb in WANTED_LABELS if f"[{lb}]" in row_text or lb in row_text), None)
            if not (assigned_to_me and label):
                continue

            # >>> TODO(selector): lấy đúng ô số/ký hiệu, trích yếu, nơi gửi, hạn xử lý
            item = {
                "so_ky_hieu": "",       # TODO
                "trich_yeu": "",        # TODO
                "noi_gui": "",          # TODO
                "han_xu_ly": "",        # TODO
                "nhan_xu_ly": "Xử lý chính" if label == "XLC" else "Phối hợp",
                "attachments": [],
            }

            # Mở văn bản để tải đính kèm
            # >>> TODO(selector): click vào dòng/đường dẫn mở chi tiết văn bản
            # row.click(); page.wait_for_load_state("networkidle")
            # >>> TODO(selector): với mỗi link đính kèm -> tải về ATTACH_DIR/<so_ky_hieu>/
            #   with page.expect_download() as dl: link.click()
            #   fp = ATTACH_DIR / item["so_ky_hieu"] / dl.value.suggested_filename
            #   dl.value.save_as(str(fp)); item["attachments"].append(str(fp))
            # >>> TODO(selector): quay lại danh sách (back) để xử lý dòng tiếp theo

            # Trích text cho từng đính kèm
            for fp in item["attachments"]:
                ex = extract_text(Path(fp))
                ex["file"] = fp
                item.setdefault("extracted", []).append(ex)

            results.append(item)

        OUT_JSON.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Đã lưu {len(results)} văn bản vào {OUT_JSON}")
        ctx.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--login", action="store_true", help="Mở cửa sổ để đăng nhập tay (lưu phiên)")
    run(ap.parse_args().login)
