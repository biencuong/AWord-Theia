#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ioffice_mcp_server.py — MCP server phơi năng lực xử lý Văn bản đến iOffice.

Đây là LỚP CHIA SẺ (Nhánh B): QwenPaw (hỗ trợ MCP) và Claude Code/Desktop đều nối vào server này
để gọi cùng một bộ tool. Lõi tất định nằm ở các script trong `scripts/` (tái dùng, không viết lại).

An toàn: tool ĐỌC là chính. Tool mở browser / đổi-trạng-thái được tách riêng, có cảnh báo, và việc
ĐÓNG chỉ thực thi những gì đã nằm trong `close_queue.json` (đã xác nhận trước qua Telegram).

Chạy thử (stdio): python ioffice_mcp_server.py
Đăng ký vào client MCP (QwenPaw/Claude): trỏ command tới file này.
"""
import io, json, sys, subprocess
from contextlib import redirect_stdout
from pathlib import Path

WORKDIR = Path(__file__).resolve().parent
SCRIPTS = WORKDIR / "scripts"
sys.path.insert(0, str(SCRIPTS))

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("ioffice-vanban")


def _load(name, default):
    f = WORKDIR / name
    if f.exists():
        try:
            return json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            return default
    return default


def _inbox():
    return _load("inbox.json", [])


def _index_docs():
    return _load("index.json", {"documents": []}).get("documents", [])


def _parse_dmy(s: str):
    """Parse dd/mm/yyyy; invalid/empty dates sort as very old."""
    from datetime import datetime
    try:
        return datetime.strptime((s or "").strip(), "%d/%m/%Y")
    except Exception:
        return datetime.min


def _doc_id_num(x: dict) -> int:
    try:
        return int(x.get("doc_id") or 0)
    except Exception:
        return 0


def _sort_inbox(items: list, order: str = "latest") -> list:
    """Business sorting.

    - latest/newest/moi_nhat: ĐÚNG thứ tự iOffice đang hiển thị sau khi bấm bộ lọc vai trò:
      dòng đầu trang 1 là mới nhất, rồi xuống dưới, sau đó trang 2...
    - priority/uu_tien: việc cần xử lý trước (thu_tu_uu_tien asc).
    """
    o = (order or "latest").strip().lower()
    if o in {"priority", "uu_tien", "ưu tiên", "uu tien"}:
        return sorted(items, key=lambda x: (x.get("thu_tu_uu_tien") or 99999))
    return sorted(items, key=lambda x: (x.get("thu_tu_moi_trong_vai_tro") or 999999, x.get("trang_danh_sach") or 9999, x.get("dong_tren_trang") or 9999, -_doc_id_num(x)))


# ---------------- TOOL ĐỌC (an toàn) ----------------
@mcp.tool()
def get_status() -> dict:
    """Tổng quan: số văn bản, theo vai trò, cần dự thảo, trạng thái vòng đời, hàng đợi đóng."""
    inbox = _inbox()
    idx = _load("index.json", {"summary": {}})
    s = idx.get("summary", {})
    import collections
    roles = collections.Counter(x.get("nhan_xu_ly") for x in inbox)
    return {
        "tong": len(inbox),
        "theo_vai_tro": dict(roles),
        "can_du_thao_chua_lam": len(s.get("can_du_thao_chua_lam", [])),
        "khong_can_du_thao": s.get("khong_can_du_thao"),
        "theo_trang_thai": s.get("theo_trang_thai"),
        "hang_doi_dong": len(_load("close_queue.json", [])),
    }


@mcp.tool()
def list_documents(role: str = "", limit: int = 20, only_need_draft: bool = False, order: str = "latest") -> list:
    """Liệt kê văn bản.

    Nghiệp vụ sắp xếp:
    - order='latest' (mặc định): mới đến trước, dùng khi người dùng nói "mới nhất", "vừa đến".
    - order='priority': ưu tiên xử lý trước, dùng khi người dùng nói "ưu tiên", "khẩn", "cần xử lý trước".
    role='Phối hợp'|'Xử lý chính'|'' (tất cả). only_need_draft=True chỉ lấy văn bản cần dự thảo.
    """
    inbox = _sort_inbox(_inbox(), order=order)
    meta = {d["so_ky_hieu"]: d for d in _index_docs()}
    out = []
    for x in inbox:
        if role and x.get("nhan_xu_ly") != role:
            continue
        m = meta.get(x.get("so_ky_hieu"), {})
        if only_need_draft and not m.get("can_du_thao"):
            continue
        out.append({
            "thu_tu_uu_tien": x.get("thu_tu_uu_tien"),
            "ngay_den": x.get("ngay_den"),
            "so_ky_hieu": x.get("so_ky_hieu"),
            "trich_yeu": x.get("trich_yeu"), "vai_tro": x.get("nhan_xu_ly"),
            "do_khan": x.get("do_khan"), "han_xu_ly": x.get("han_xu_ly"),
            "de_xuat": m.get("de_xuat"), "trang_thai": m.get("trang_thai"),
        })
        if len(out) >= limit:
            break
    return out


@mcp.tool()
def get_document(so_ky_hieu: str, include_drafts: bool = False) -> dict:
    """Chi tiết 1 văn bản đến.

    Mặc định KHÔNG trả/nhắc file dự thảo. Chỉ include_drafts=True khi người dùng nói rõ
    cần dự thảo/soạn thảo/gửi dự thảo.
    """
    x = next((d for d in _inbox() if d.get("so_ky_hieu") == so_ky_hieu), None)
    if not x:
        return {"error": f"Không thấy văn bản {so_ky_hieu}"}
    m = next((d for d in _index_docs() if d.get("so_ky_hieu") == so_ky_hieu), {})
    text = " ".join(" ".join((e.get("text") or "") for e in x.get("extracted", [])).split())
    files = dict(m.get("files") or {})
    if not include_drafts:
        files.pop("du_thao", None)
    return {
        "so_ky_hieu": so_ky_hieu, "trich_yeu": x.get("trich_yeu"),
        "vai_tro": x.get("nhan_xu_ly"), "do_khan": x.get("do_khan"),
        "han_xu_ly": x.get("han_xu_ly"), "ngay_den": x.get("ngay_den"), "noi_gui": x.get("noi_gui"),
        "de_xuat": m.get("de_xuat"), "trang_thai": m.get("trang_thai"),
        "con_thieu": m.get("con_thieu"), "files": files,
        "tom_tat_noi_dung": text[:1500] if text else "(chưa trích được text — cần OCR/đọc .doc)",
    }


@mcp.tool()
def get_latest_document(role: str = "Xử lý chính", include_drafts: bool = False) -> dict:
    """Lấy đúng 1 văn bản mới nhất theo ngày đến/doc_id, không phải văn bản ưu tiên."""
    docs = list_documents(role=role, limit=1, only_need_draft=False, order="latest")
    if not docs:
        return {"error": f"Không thấy văn bản role={role}"}
    return get_document(docs[0]["so_ky_hieu"], include_drafts=include_drafts)


@mcp.tool()
def search_documents(keyword: str, limit: int = 15) -> list:
    """Tìm văn bản theo từ khoá trong trích yếu hoặc nội dung đã trích."""
    kw = (keyword or "").lower()
    res = []
    for x in sorted(_inbox(), key=lambda d: (d.get("thu_tu_uu_tien") or 99999)):
        hay = (x.get("trich_yeu", "") + " " +
               " ".join((e.get("text") or "") for e in x.get("extracted", []))).lower()
        if kw in hay:
            res.append({"thu_tu": x.get("thu_tu_uu_tien"), "so_ky_hieu": x.get("so_ky_hieu"),
                        "trich_yeu": x.get("trich_yeu"), "vai_tro": x.get("nhan_xu_ly")})
        if len(res) >= limit:
            break
    return res


# ---------------- TOOL CẬP NHẬT (an toàn, không browser) ----------------
@mcp.tool()
def rebuild_index() -> str:
    """Dựng lại index.json/INDEX.md từ inbox + cây thư mục (không mở browser)."""
    import build_index
    with redirect_stdout(io.StringIO()):       # KHÔNG để in ra stdout (hỏng giao thức MCP)
        build_index.build()
    s = _load("index.json", {"summary": {}}).get("summary", {})
    return f"OK. Tổng {s.get('tong')}, cần dự thảo {len(s.get('can_du_thao_chua_lam', []))}."


@mcp.tool()
def rebuild_knowledge() -> str:
    """Sinh lại file tri thức tri_thuc/<số>.md (không mở browser)."""
    import build_knowledge
    with redirect_stdout(io.StringIO()):
        build_knowledge.build()
    return "OK. Đã sinh lại tri_thuc/."


@mcp.tool()
def queue_close(so_ky_hieu_list: list) -> dict:
    """XẾP các văn bản vào hàng đợi ĐÓNG (close_queue.json). KHÔNG đóng ngay — chỉ xếp hàng;
    việc đóng thật chạy bằng run_close_queue khi đã đăng nhập (không hoàn tác)."""
    queue = _load("close_queue.json", [])
    have = {q.get("so_ky_hieu") for q in queue}
    by_so = {x.get("so_ky_hieu"): x for x in _inbox()}
    added = []
    for so in so_ky_hieu_list:
        if so in by_so and so not in have:
            queue.append({"doc_id": by_so[so].get("doc_id"), "so_ky_hieu": so})
            added.append(so)
    (WORKDIR / "close_queue.json").write_text(json.dumps(queue, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"da_xep_them": added, "tong_hang_doi": len(queue)}


@mcp.tool()
def list_close_queue() -> list:
    """Xem hàng đợi văn bản chờ đóng."""
    return _load("close_queue.json", [])


# ---------------- TOOL MỞ BROWSER / ĐỔI TRẠNG THÁI (cảnh báo) ----------------
@mcp.tool()
def fetch_inbox(headless: bool = False) -> str:
    """Lấy & ưu tiên văn bản đến (mở Chrome; nếu captcha thì CẦN người dùng đăng nhập tay).
    Sau khi xong tự dựng index + tri thức. Tôn trọng khoá đa phiên (browser)."""
    import iolock
    ok, holder = iolock.acquire("browser", session="mcp.fetch")
    if not ok:
        return f"Phiên khác đang giữ browser: {holder}. Thử lại sau."
    try:
        cmd = [sys.executable, str(SCRIPTS / "fetch_vanban.py")] + (["--headless"] if headless else [])
        p = subprocess.run(cmd, cwd=str(WORKDIR), capture_output=True, text=True, timeout=1800)
        return (p.stdout or "")[-1500:] + (("\n[stderr]\n" + p.stderr[-500:]) if p.returncode else "")
    finally:
        iolock.release("browser")


@mcp.tool()
def run_close_queue() -> str:
    """⚠️ ĐÓNG THẬT trên iOffice các văn bản trong close_queue.json (KHÔNG hoàn tác). Mở Chrome;
    cần đăng nhập. Chỉ đóng đúng những gì đã được xác nhận xếp hàng trước đó."""
    import iolock
    if not _load("close_queue.json", []):
        return "Hàng đợi đóng rỗng — không có gì để đóng."
    ok, holder = iolock.acquire("browser", session="mcp.close")
    if not ok:
        return f"Phiên khác đang giữ browser: {holder}. Thử lại sau."
    try:
        p = subprocess.run([sys.executable, str(WORKDIR / "bulk_ketthuc.py"), "--queue"],
                           cwd=str(WORKDIR), capture_output=True, text=True, timeout=1800)
        return (p.stdout or "")[-1500:]
    finally:
        iolock.release("browser")


@mcp.tool()
def ask(question: str) -> str:
    """HỎI-ĐÁP trên kho văn bản: LLM trả lời câu hỏi (vd 'văn bản nào về NQ57?',
    'còn dự thảo nào chưa phát hành?') dựa trên chỉ mục + nội dung, có trích dẫn số ký hiệu."""
    import ask as _ask
    return _ask.answer(question)


@mcp.tool()
def overdue() -> list:
    """Liệt kê văn bản QUÁ HẠN (hạn xử lý < hôm nay), sắp theo hạn cũ nhất trước."""
    import fetch_vanban as F
    from datetime import date
    today = (date.today().year, date.today().month, date.today().day)
    out = []
    for x in _inbox():
        h = x.get("han_xu_ly")
        if h and F.parse_dmy(h) != (9999, 99, 99) and F.parse_dmy(h) < today:
            out.append({"thu_tu": x.get("thu_tu_uu_tien"), "so_ky_hieu": x.get("so_ky_hieu"),
                        "han_xu_ly": h, "vai_tro": x.get("nhan_xu_ly"), "trich_yeu": x.get("trich_yeu")})
    return sorted(out, key=lambda d: F.parse_dmy(d["han_xu_ly"]))


@mcp.tool()
def make_briefing(top: int = 10, role: str = "") -> str:
    """LLM cục bộ soạn BẢN TỔNG HỢP nhiệm vụ cho `top` văn bản ưu tiên cao nhất (role: PH|XLC|'').
    Lưu vào references/briefings/<ngày>.md. Không mở browser."""
    cmd = [sys.executable, str(SCRIPTS / "make_briefing.py"), "--top", str(top)]
    if role:
        cmd += ["--role", role]
    p = subprocess.run(cmd, cwd=str(WORKDIR), capture_output=True, text=True, timeout=600)
    return (p.stdout or "")[-1000:] + (("\n[stderr]\n" + p.stderr[-400:]) if p.returncode else "")


@mcp.tool()
def make_duthao(so_ky_hieu: str, send: bool = False) -> str:
    """LLM soạn DỰ THẢO công văn/báo cáo trả lời 1 văn bản, xuất .docx (thể thức NĐ30) vào thư mục
    văn bản; send=True thì gửi lên Telegram. Dự thảo là NHÁP để người dùng hoàn thiện."""
    cmd = [sys.executable, str(SCRIPTS / "make_duthao.py"), so_ky_hieu] + (["--send"] if send else [])
    p = subprocess.run(cmd, cwd=str(WORKDIR), capture_output=True, text=True, timeout=600)
    return (p.stdout or "")[-1000:] + (("\n[stderr]\n" + p.stderr[-400:]) if p.returncode else "")


@mcp.tool()
def enrich_ocr(limit: int = 5, max_pages: int = 5) -> str:
    """Bổ sung TEXT cho văn bản 'needs_ocr' (PDF scan qua LLM-vision, .doc qua Word COM), ưu tiên
    văn bản hạng cao. limit = số văn bản xử lý lần này. Không mở browser (nhưng có thể chậm)."""
    p = subprocess.run([sys.executable, str(SCRIPTS / "enrich_text.py"),
                        "--limit", str(limit), "--max-pages", str(max_pages)],
                       cwd=str(WORKDIR), capture_output=True, text=True, timeout=3600)
    return (p.stdout or "")[-1500:]


if __name__ == "__main__":
    mcp.run()
