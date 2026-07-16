#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fetch_vanban.py — Lấy "Văn bản đến chờ xử lý" trên VNPT iOffice (vai trò Sở GDĐT).

Phần CODE deterministic: mở phiên đã đăng nhập, quét danh sách, lọc theo người
được phân công + nhãn xử lý, tải đính kèm, trích text, xuất inbox.json.
KHÔNG bấm bất kỳ nút nào thay đổi trạng thái văn bản. KHÔNG chứa mật khẩu.

Cài đặt 1 lần:
    pip install playwright python-docx pdfplumber lxml
    playwright install chromium

Chạy:
    python fetch_vanban.py        # mở cửa sổ; BẠN tự đăng nhập -> script tự quét tiếp
    # (iOffice dùng cookie phiên KHÔNG bền qua lần đóng trình duyệt nên phải đăng nhập
    #  ngay trong phiên chạy; xem references/conventions.md §5. --headless chỉ dùng khi
    #  thực sự còn phiên hợp lệ.)

Selector iOffice đã dò DOM thật và điền xong (2026-06-01) — chi tiết & cách dò lại khi đổi
giao diện: references/conventions.md §1. Nguyên tắc: CHỈ đọc/điều hướng/tải file, KHÔNG bấm
nút đổi trạng thái (Chuyển xử lý, Trình ký, Phát hành, Hoàn thành...).
"""

import argparse, json, os, re, sys, zipfile
from pathlib import Path

LOGIN_URL = "https://vpdttq.vnptioffice.vn/qlvbdh/main?lang=vi"
ASSIGNEE_USERNAME = "cvhssv1.sgd"          # Bùi Biên Cương
ASSIGNEE_NAME = "Bùi Biên Cương"
# Bộ lọc cần quét: c-val của legend filter -> nhãn xử lý hiển thị.
# QUAN TRỌNG: phải BẤM legend filter này thì danh sách mới đúng là văn bản giao cho
# tài khoản đăng nhập (cvhssv1.sgd) ở vai trò tương ứng. KHÔNG được đọc role_type_code
# trên dòng của danh sách MẶC ĐỊNH (mặc định trộn cả văn bản người khác là XLC).
ROLE_FILTERS = [("xlc", "Xử lý chính"), ("ph", "Phối hợp")]

# --- Selector iOffice đã dò DOM thật (xem references/conventions.md) ---
SEL_LOGIN_FORM   = "#form_login_qlvb, input#passWord"          # dấu hiệu trang đăng nhập
SEL_MENU_VBDEN_CXL = "#m2766"   # anchor "Văn bản đến chờ xử lý" (href javascript:link("m2766",<token>))
SEL_FILTER_TMPL  = "span.color_clk[c-val='{cval}']"          # legend lọc theo vai trò: xlc / ph
SEL_LIST_ROWS    = "#dt_basic tbody tr[id^='vb_']"            # mỗi DÒNG văn bản
SEL_HAN_XULY     = "td.vanbanden_hienthi_han_xuly"           # ô Hạn xử lý trong dòng
SEL_DOWNLOAD_ALL = "a.btnDownloadAllFileVBDen"               # tải toàn bộ đính kèm của dòng
SEL_PAGER_LINKS  = "ul.pagination a[onclick*='gotoPage']"    # link phân trang (page.gotoPage(N))

WORKDIR = Path(__file__).resolve().parent.parent      # thư mục skill
PROFILE_DIR = WORKDIR / ".browser_profile"            # nơi lưu phiên đăng nhập
ATTACH_DIR = WORKDIR / "attachments"
OUT_JSON = WORKDIR / "inbox.json"
# File credential CỤC BỘ (KHÔNG commit, KHÔNG đưa vào gói skill). Ưu tiên biến môi trường
# IOFFICE_USER / IOFFICE_PASS; nếu không có thì đọc file này. Đăng nhập tự động chỉ là tiện
# ích tuỳ chọn — script vẫn chỉ ĐỌC, không bao giờ bấm nút đổi trạng thái văn bản.
AUTH_FILE = WORKDIR / "auth.local.json"               # {"username": "...", "password": "..."}


def safe_name(s: str) -> str:
    """Số/ký hiệu chứa '/' '&' ... -> tên thư mục/file an toàn."""
    return re.sub(r"[^0-9A-Za-zÀ-ỹ._-]+", "_", (s or "vb")).strip("_")[:80] or "vb"


# Đường dẫn UnRAR (ưu tiên WinRAR có sẵn trên Windows). Có thể override qua ENV UNRAR_TOOL.
UNRAR_CANDIDATES = [os.environ.get("UNRAR_TOOL"),
                    r"C:\Program Files\WinRAR\UnRAR.exe",
                    r"C:\Program Files\WinRAR\WinRAR.exe",
                    r"C:\Program Files (x86)\WinRAR\UnRAR.exe"]


def extract_archive(fp: Path, dest: Path) -> list:
    """Giải nén .zip (zipfile) / .rar (rarfile + UnRAR) vào dest. Trả list file con đã giải nén.
    Lỗi -> trả [str(fp)] để caller giữ nguyên file nén và ghi chú."""
    suffix = fp.suffix.lower()
    try:
        if suffix == ".zip":
            with zipfile.ZipFile(fp) as z:
                z.extractall(dest)
        elif suffix == ".rar":
            import rarfile
            for cand in UNRAR_CANDIDATES:
                if cand and Path(cand).exists():
                    rarfile.UNRAR_TOOL = cand
                    break
            with rarfile.RarFile(str(fp)) as rf:
                rf.extractall(str(dest))
        else:
            return [str(fp)]
        inner = [str(q) for q in dest.rglob("*") if q.is_file() and q.resolve() != fp.resolve()]
        return inner or [str(fp)]
    except Exception:
        return [str(fp)]


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


# --- Ưu tiên xử lý (theo yêu cầu người dùng): độ khẩn -> văn bản cấp trên (UBND/Bộ) ->
#     hạn gần nhất -> cũ nhất trước. Số nhỏ = ưu tiên cao, xử lý trước. ---
KHAN_RANK = {"hỏa tốc": 0, "hoả tốc": 0, "thượng khẩn": 0, "khẩn": 1}   # khác -> 2 (Thường)
SUPERIOR_KEYWORDS = ("ủy ban nhân dân", "uỷ ban nhân dân", "ubnd", "bộ ", "chính phủ",
                     "thủ tướng", "tỉnh ủy", "tỉnh uỷ", "trung ương")


def parse_dmy(s: str):
    """'dd/mm/yyyy' -> (y, m, d) để sắp xếp. Rỗng/không hợp lệ -> rất xa (xếp cuối)."""
    m = re.match(r"\s*(\d{1,2})/(\d{1,2})/(\d{4})", s or "")
    return (int(m.group(3)), int(m.group(2)), int(m.group(1))) if m else (9999, 99, 99)


def is_superior(noi_gui: str) -> bool:
    t = (noi_gui or "").lower()
    return any(k in t for k in SUPERIOR_KEYWORDS)


def priority_key(it: dict):
    khan = KHAN_RANK.get((it.get("do_khan") or "").strip().lower(), 2)   # hỏa tốc/khẩn trước
    sup = 0 if is_superior(it.get("noi_gui")) else 1                     # cấp trên trước
    han = parse_dmy(it.get("han_xu_ly"))                                 # hạn gần nhất trước
    den = parse_dmy(it.get("ngay_den"))                                 # cũ nhất trước
    return (khan, sup, han, den)


# Đọc TẤT CẢ dòng của trang hiện tại trong 1 lần evaluate (tránh round-trip từng ô -> nhanh &
# không bị lỗi stale khi DataTables re-render giữa chừng).
ROWS_JS = r"""
() => Array.from(document.querySelectorAll("#dt_basic tbody tr[id^='vb_']")).map(tr => {
  const han = tr.querySelector("td.vanbanden_hienthi_han_xuly");
  const dl  = tr.querySelector("a.btnDownloadAllFileVBDen");
  const g = n => (tr.getAttribute(n) || "").trim();
  return {
    doc_id: (g("flyid") || (tr.id||"").replace("vb_","")),
    so_ky_hieu: g("so_ky_hieu"), trich_yeu: g("trich_yeu"),
    noi_gui: g("don_vi_ban_hanh"), han_xu_ly: han ? han.innerText.trim() : "",
    hinh_thuc: g("hinh_thuc"), ngay_den: g("ngay_den"), do_khan: g("do_khan"),
    role_attr_raw: g("role_type_code"), has_attachment: !!dl
  };
})
"""


def read_page_rows(page, role_label: str) -> list:
    """Trả về list metadata mọi dòng của trang hiện tại (1 lần evaluate)."""
    out = []
    for r in page.evaluate(ROWS_JS):
        r["nhan_xu_ly"] = role_label          # vai trò lấy từ FILTER đang bật
        r["attachments"] = []
        out.append(r)
    return out


def download_attachments(page, item: dict) -> None:
    """Tải đính kèm của 1 văn bản qua hàm global allFileDownload(docId) (read-only).
    Có CACHE: nếu thư mục đích đã có file thì bỏ qua (khỏi tải lại). Tự giải nén .zip/.rar."""
    doc_id = item["doc_id"]
    dest = ATTACH_DIR / safe_name(item["so_ky_hieu"] or doc_id)
    if dest.exists():                                   # cache: đã tải trước đó
        for arc in [q for q in dest.iterdir() if q.is_file() and q.suffix.lower() in (".zip", ".rar")]:
            extract_archive(arc, dest)                  # giải nén nốt file nén đã tải lần trước
        existing = [str(q) for q in dest.rglob("*") if q.is_file()]
        if existing:
            item["attachments"] = existing
            item["cached"] = True
            return
    if not item.get("has_attachment"):
        return
    try:
        with page.expect_download(timeout=25000) as dl_info:
            page.evaluate("(id) => allFileDownload(id)", doc_id)
        dest.mkdir(parents=True, exist_ok=True)
        fp = dest / dl_info.value.suggested_filename
        dl_info.value.save_as(str(fp))
        if fp.suffix.lower() in (".zip", ".rar"):       # nhiều đính kèm -> gói nén
            inner = extract_archive(fp, dest)
            if inner == [str(fp)]:                       # giải nén thất bại -> giữ file nén
                item["attachments"] = [str(fp)]
                item["archive_note"] = f"Không giải nén được {fp.suffix} (giữ nguyên file nén)."
            else:
                item["attachments"] = inner
        else:
            item["attachments"] = [str(fp)]
    except Exception as e:
        item["download_note"] = f"Không tải được đính kèm: {e}"


def first_doc_id(page) -> str:
    """flyid của dòng đầu bảng (để phát hiện bảng đã đổi trang)."""
    try:
        return page.evaluate(
            "() => { const r = document.querySelector(\"#dt_basic tbody tr[id^='vb_']\");"
            " return r ? (r.getAttribute('flyid') || r.id || '') : ''; }") or ""
    except Exception:
        return ""


def wait_table_change(page, prev_first: str, timeout_ms: int = 20000) -> None:
    """Chờ bảng cập nhật: dòng đầu có flyid KHÁC trước đó. KHÔNG dùng networkidle vì iOffice
    giữ kết nối nền (NotificationCenter) nên networkidle gần như không bao giờ 'rảnh'."""
    try:
        page.wait_for_selector(SEL_LIST_ROWS, timeout=timeout_ms)
    except Exception:
        return
    for _ in range(max(1, timeout_ms // 250)):
        cur = first_doc_id(page)
        if cur and cur != prev_first:
            return
        page.wait_for_timeout(250)


def scan_all_pages(page, role_label: str, max_pages: int = 200) -> list:
    """Quét metadata theo ĐÚNG thứ tự iOffice đang hiển thị.

    Nghiệp vụ "văn bản mới" = dòng đầu trang 1 của bộ lọc đang bật, rồi các dòng tiếp theo,
    sau đó mới sang trang 2... KHÔNG suy ngược từ hạn xử lý, ngày đến rỗng, hay thứ tự ưu tiên.
    Các trường thu_tu_moi_trong_vai_tro/trang_danh_sach/dong_tren_trang được lưu để các tool
    đọc lại đúng "mới nhất ở đầu trang".
    """
    out, visited = [], set()
    page_no = 1
    while page_no <= max_pages:
        page.wait_for_selector(SEL_LIST_ROWS, timeout=20000)
        rows = read_page_rows(page, role_label)
        base = len(out)
        for row_idx, it in enumerate(rows, 1):
            it["thu_tu_moi_trong_vai_tro"] = base + row_idx
            it["trang_danh_sach"] = page_no
            it["dong_tren_trang"] = row_idx
        out.extend(rows)
        visited.add(page_no)
        # Các số trang còn truy cập được (đọc từ onclick="page.gotoPage(N)").
        pager = page.locator(SEL_PAGER_LINKS)
        avail = set()
        for j in range(pager.count()):
            m = re.search(r"gotoPage\((\d+)\)", pager.nth(j).get_attribute("onclick") or "")
            if m:
                avail.add(int(m.group(1)))
        nxt = sorted(p for p in avail if p not in visited)
        if not nxt:
            break
        prev_first = first_doc_id(page)
        page_no = nxt[0]
        try:
            page.evaluate("(n) => page.gotoPage(n)", page_no)
        except Exception:
            break
        wait_table_change(page, prev_first)              # nhanh: chờ tới khi dòng đầu đổi
    else:
        print(f"[cảnh báo] {role_label}: chạm trần {max_pages} trang — có thể còn sót.")
    return out


def load_credentials():
    """Lấy (username, password) từ ENV trước, rồi tới auth.local.json. Thiếu -> (None, None)."""
    user, pw = os.environ.get("IOFFICE_USER"), os.environ.get("IOFFICE_PASS")
    if user and pw:
        return user, pw
    if AUTH_FILE.exists():
        try:
            d = json.loads(AUTH_FILE.read_text(encoding="utf-8"))
            import secret                       # mật khẩu có thể là "dpapi:..." (mã hoá DPAPI)
            return d.get("username"), secret.reveal(d.get("password"))
        except Exception as e:
            print(f"[login] Không đọc được {AUTH_FILE.name}: {e}")
    return None, None


def attempt_login(page) -> bool:
    """Tự điền form đăng nhập nếu có credential. Trả True nếu vào được app (#m2766 xuất hiện).
    Nếu iOffice bắt mã xác nhận (captcha) thì sẽ KHÔNG vào được -> trả False để rơi về nhập tay."""
    user, pw = load_credentials()
    if not (user and pw):
        return False
    if page.locator("input#passWord").count() == 0:
        return False
    try:
        page.fill("input#userName", user)
        page.fill("input#passWord", pw)        # không in mật khẩu ra log
        page.locator("input#submitBtn").click()
        for _ in range(15):                    # chờ tối đa ~15s
            if page.locator(SEL_MENU_VBDEN_CXL).count() > 0:
                return True
            page.wait_for_timeout(1000)
    except Exception as e:
        print(f"[login] Lỗi khi tự đăng nhập: {e}")
    # Captcha hiện ra hoặc sai thông tin -> để người dùng xử lý tay.
    if page.locator("#txtMaXacNhan:visible").count() > 0:
        print("[login] iOffice yêu cầu mã xác nhận (captcha) — cần nhập tay.")
    return page.locator(SEL_MENU_VBDEN_CXL).count() > 0


def run(headless: bool, download_limit: int = 0, max_pages: int = 200, roles=("xlc",)):
    from playwright.sync_api import sync_playwright
    import iolock                              # khoá đa phiên: chỉ 1 phiên dùng browser (xem AGENTS.md)
    ok, holder = iolock.acquire("browser", session="fetch_vanban")
    if not ok:
        print(f"[KHOÁ] Phiên khác đang dùng browser: {holder}. Dừng. (xem AGENTS.md)")
        return

    ATTACH_DIR.mkdir(exist_ok=True)
    with sync_playwright() as p:
        # LƯU Ý: iOffice dùng cookie phiên KHÔNG bền qua lần đóng trình duyệt (xem
        # references/conventions.md §5) -> không thể "đăng nhập 1 lần rồi chạy headless ngầm".
        # Vì vậy MẶC ĐỊNH mở cửa sổ và CHỜ người dùng đăng nhập ngay trong phiên này.
        ctx = p.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE_DIR),
            headless=headless,
            accept_downloads=True,
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(LOGIN_URL, wait_until="domcontentloaded")

        # Đăng nhập: thử tự động bằng credential local trước; nếu không được (thiếu cred /
        # captcha / sai) thì chờ người dùng đăng nhập tay trong cửa sổ (poll #m2766, tối đa 5').
        if page.locator(SEL_MENU_VBDEN_CXL).count() == 0:
            if attempt_login(page):
                print(">>> Đã tự đăng nhập bằng credential local.")
            elif headless:
                print("CHƯA ĐĂNG NHẬP & không tự đăng nhập được (thiếu cred hoặc captcha)."
                      " Hãy chạy KHÔNG --headless.")
                ctx.close(); sys.exit(2)
            else:
                print(">>> Hãy ĐĂNG NHẬP iOffice trong cửa sổ vừa mở. Script tự tiếp tục sau khi xong.")
                for _ in range(150):
                    if page.locator(SEL_MENU_VBDEN_CXL).count() > 0:
                        break
                    page.wait_for_timeout(2000)
                else:
                    print("Hết thời gian chờ đăng nhập."); ctx.close(); sys.exit(2)
        print(">>> Đã đăng nhập. Bắt đầu quét (chỉ đọc).")

        # --- Điều hướng tới Văn bản đến > chờ xử lý ---
        # Menu "Văn bản đến chờ xử lý" là <a id="m2766">; href dạng javascript:link("m2766",<token-phiên>).
        # Token đổi theo phiên nên KHÔNG hardcode URL — gọi thẳng click handler của anchor (read-only).
        page.wait_for_selector(SEL_MENU_VBDEN_CXL, state="attached", timeout=30000)
        page.eval_on_selector(SEL_MENU_VBDEN_CXL, "el => el.click()")
        page.wait_for_selector(SEL_LIST_ROWS, timeout=30000)

        # --- Quét theo TỪNG bộ lọc vai trò (bấm legend [XLC] rồi [PH]) ---
        # Legend là bộ lọc đơn-chọn: bấm [XLC] -> danh sách chỉ còn văn bản giao cho mình ở
        # vai trò Xử lý chính; bấm [PH] -> thay bằng văn bản mình Phối hợp. Vai trò lấy từ
        # FILTER đang bật, KHÔNG đọc role_type_code trên danh sách mặc định (mặc định trộn lẫn
        # cả văn bản người khác là XLC -> đó là lỗi nếu bỏ qua bước lọc này).
        results, seen = [], set()
        role_filters = [rf for rf in ROLE_FILTERS if rf[0] in roles]
        print(f">>> Vai trò quét: {[r[1] for r in role_filters]}")
        for cval, role_label in role_filters:
            flt = page.locator(SEL_FILTER_TMPL.format(cval=cval))
            if flt.count() == 0:
                print(f"[cảnh báo] Không thấy bộ lọc [{cval}] — bỏ qua.")
                continue
            prev_first = first_doc_id(page)
            try:
                flt.first.click(timeout=8000)
            except Exception:
                flt.first.evaluate("el => el.click()")
            wait_table_change(page, prev_first)          # chờ bộ lọc đổi tập kết quả

            items = scan_all_pages(page, role_label, max_pages=max_pages)
            added = 0
            for it in items:
                if it["doc_id"] and it["doc_id"] in seen:
                    continue
                seen.add(it["doc_id"])
                results.append(it)
                added += 1
            print(f"[{role_label}] {added} văn bản (quét {len(items)} dòng).")

        # --- Sắp theo ƯU TIÊN: độ khẩn -> cấp trên (UBND/Bộ) -> hạn gần nhất -> cũ nhất ---
        results.sort(key=priority_key)
        for idx, it in enumerate(results, 1):
            it["thu_tu_uu_tien"] = idx

        # --- Tải đính kèm theo đúng thứ tự ưu tiên (có cache; --limit giới hạn mỗi lần) ---
        budget = download_limit if download_limit and download_limit > 0 else len(results)
        downloaded = 0
        for it in results:
            if downloaded >= budget:
                it["download_note"] = "Chưa tải (vượt --limit lần chạy này)."
                continue
            download_attachments(page, it)
            for fp in it["attachments"]:                 # trích text từng file đã có
                ex = extract_text(Path(fp)); ex["file"] = fp
                it.setdefault("extracted", []).append(ex)
            if not it.get("cached"):
                downloaded += 1
            if it.get("attachments") or it.get("download_note"):
                print(f"  #{it['thu_tu_uu_tien']:>3} {it['nhan_xu_ly'][:3]} "
                      f"{it['so_ky_hieu'][:28]:<28} {'cache' if it.get('cached') else 'tải'} "
                      f"{len(it['attachments'])} file")

        OUT_JSON.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Đã lưu {len(results)} văn bản (đã sắp ưu tiên) vào {OUT_JSON}. "
              f"Tải mới {downloaded} văn bản lần này.")
        ctx.close()

    iolock.release("browser")

    # --- Có văn bản mới -> tự dựng chỉ mục + file tri thức (best-effort) ---
    for mod in ("build_index", "build_knowledge"):
        try:
            __import__(mod).build()
        except Exception as e:
            print(f"[lưu ý] chưa cập nhật {mod}: {e}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--headless", action="store_true",
                    help="Chạy ẩn (chỉ dùng khi đã có phiên đăng nhập hợp lệ — hiếm khi đúng "
                         "với iOffice này, xem conventions §5). Mặc định mở cửa sổ để đăng nhập.")
    ap.add_argument("--limit", type=int, default=0,
                    help="Số văn bản TẢI ĐÍNH KÈM mỗi lần (theo thứ tự ưu tiên). 0 = tải tất cả "
                         "(file đã tải sẽ bỏ qua nhờ cache). VD --limit 30 để xử lý dần.")
    ap.add_argument("--max-pages", type=int, default=200,
                    help="Số TRANG quét mỗi vai trò. Theo nghiệp vụ 'mỗi lần 1 trang' dùng "
                         "--max-pages 1 để CHỉ lấy trang đầu (10 dòng), khỏi tải hết các trang.")
    ap.add_argument("--roles", default="xlc",
                    help="Vai trò cần quét, phân tách bằng dấu phẩy. Mặc định 'xlc' (CHỈ Xử lý "
                         "chính, KHÔNG Phối hợp). Dùng 'xlc,ph' nếu muốn cả Phối hợp.")
    a = ap.parse_args()
    run(a.headless, a.limit, a.max_pages,
        roles=tuple(r.strip().lower() for r in a.roles.split(",") if r.strip()))
