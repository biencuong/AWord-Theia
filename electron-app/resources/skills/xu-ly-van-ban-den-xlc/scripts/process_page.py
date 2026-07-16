#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""process_page.py — ĐIỀU PHỐI xử lý "Văn bản đến chờ xử lý" theo TỪNG TRANG (10 dòng).

Quy trình (mỗi lần chạy chỉ chọn 1 văn bản của 1 trang):
  1. Đọc inbox.json (do scripts/fetch_vanban.py của chính skill này sinh ra).
  2. Lọc vai trò XỬ LÝ CHÍNH (mặc định) trên TRANG chỉ định.
  3. Bỏ các văn bản đã có ID trong processed_ids.json (chống xử lý lại).
  4. Nếu trang có văn bản KHẨN/HOẢ TỐC -> ưu tiên chọn cái khẩn nhất chưa xử lý.
     Nếu không -> chọn văn bản ĐẦU TIÊN trên trang (dòng trên cùng) chưa xử lý.
  5. In ra JSON mô tả văn bản được chọn (cho LLM xử lý tiếp: đối chiếu tri thức,
     dựng thư mục, soạn dự thảo NĐ30, viết tóm tắt).

KHÔNG bấm bất kỳ nút đổi trạng thái nào trên iOffice. KHÔNG kết thúc văn bản.
Chỉ ĐÁNH DẤU ID vào processed_ids.json khi đã xử lý xong (qua --mark).

Dùng:
  python process_page.py --page 1                 # xem văn bản cần xử lý tiếp ở trang 1
  python process_page.py --page 1 --only-xlc      # (mặc định) chỉ Xử lý chính
  python process_page.py --mark <doc_id> --note "đã soạn dự thảo"   # đánh dấu đã xử lý
  python process_page.py --list-page 1            # xem cả 10 dòng của trang + trạng thái
"""
import argparse, json, sys
from datetime import datetime
from pathlib import Path

# Skill ĐỘC LẬP: mọi dữ liệu nằm trong chính thư mục skill này.
SKILL_DIR = Path(__file__).resolve().parent.parent          # xu-ly-van-ban-den-xlc/
INBOX = SKILL_DIR / "inbox.json"                             # do fetch_vanban.py (bản nội bộ) sinh
PROCESSED = SKILL_DIR / "processed_ids.json"

# Thứ tự ưu tiên độ khẩn: số nhỏ = khẩn hơn.
KHAN_RANK = {"hoả tốc": 0, "hỏa tốc": 0, "thượng khẩn": 1, "khẩn": 2, "thường": 9, "": 9, "none": 9}

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def load_inbox():
    if not INBOX.exists():
        sys.exit(f"[LỖI] Chưa thấy {INBOX}. Hãy chạy: python scripts/fetch_vanban.py --max-pages 1")
    return json.loads(INBOX.read_text(encoding="utf-8"))


def load_processed() -> dict:
    if PROCESSED.exists():
        return json.loads(PROCESSED.read_text(encoding="utf-8"))
    return {}


def save_processed(d: dict):
    PROCESSED.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")


def khan_rank(vb) -> int:
    return KHAN_RANK.get(str(vb.get("do_khan") or "").strip().lower(), 9)


def page_rows(inbox, page: int, only_xlc: bool):
    """Lấy các văn bản thuộc đúng TRANG iOffice (trang_danh_sach == page),
    sắp theo dòng trên trang (dong_tren_trang) tăng dần = thứ tự hiển thị thật."""
    rows = [x for x in inbox if (x.get("trang_danh_sach") == page)]
    if only_xlc:
        rows = [x for x in rows if str(x.get("nhan_xu_ly") or "") == "Xử lý chính"]
    rows.sort(key=lambda x: (x.get("dong_tren_trang") or 999))
    return rows


def pick(rows, processed: dict):
    """Chọn 1 văn bản cần xử lý tiếp.
    - Bỏ văn bản đã có ID trong processed.
    - Nếu trang có VB khẩn (rank < 9) -> chọn khẩn nhất (rồi theo thứ tự dòng).
    - Nếu không -> chọn dòng đầu tiên chưa xử lý."""
    pending = [x for x in rows if str(x.get("doc_id")) not in processed]
    if not pending:
        return None, "Tất cả văn bản trên trang đã xử lý (hoặc trang rỗng)."
    has_khan = any(khan_rank(x) < 9 for x in pending)
    if has_khan:
        pending.sort(key=lambda x: (khan_rank(x), x.get("dong_tren_trang") or 999))
        return pending[0], "Ưu tiên KHẨN/HOẢ TỐC."
    # không khẩn -> dòng đầu tiên (đã sort theo dong_tren_trang ở page_rows)
    return pending[0], "Không có VB khẩn -> lấy văn bản đầu trang."


def brief(vb) -> dict:
    return {k: vb.get(k) for k in (
        "doc_id", "so_ky_hieu", "trich_yeu", "do_khan", "nhan_xu_ly", "noi_gui",
        "han_xu_ly", "ngay_den", "hinh_thuc", "has_attachment", "attachments",
        "trang_danh_sach", "dong_tren_trang")}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--page", type=int, help="Chọn 1 văn bản cần xử lý tiếp ở trang này.")
    ap.add_argument("--list-page", type=int, help="Liệt kê cả 10 dòng của trang + trạng thái đã/chưa xử lý.")
    ap.add_argument("--only-xlc", action="store_true", default=True, help="Chỉ Xử lý chính (mặc định bật).")
    ap.add_argument("--include-ph", action="store_true", help="Bao gồm cả Phối hợp (tắt only-xlc).")
    ap.add_argument("--mark", help="doc_id của văn bản ĐÃ xử lý xong -> ghi vào sổ chống trùng.")
    ap.add_argument("--note", default="", help="Ghi chú khi --mark.")
    a = ap.parse_args()

    only_xlc = not a.include_ph
    processed = load_processed()

    if a.mark:
        vb = next((x for x in load_inbox() if str(x.get("doc_id")) == str(a.mark)), {})
        processed[str(a.mark)] = {
            "so_ky_hieu": vb.get("so_ky_hieu"),
            "trich_yeu": vb.get("trich_yeu"),
            "processed_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "note": a.note,
            "ket_thuc_ioffice": False,   # CHƯA kết thúc trên hệ thống — chờ lệnh.
        }
        save_processed(processed)
        print(json.dumps({"marked": a.mark, "total_processed": len(processed)}, ensure_ascii=False))
        return

    inbox = load_inbox()

    if a.list_page is not None:
        rows = page_rows(inbox, a.list_page, only_xlc)
        out = []
        for x in rows:
            out.append({
                "dong": x.get("dong_tren_trang"), "doc_id": x.get("doc_id"),
                "so_ky_hieu": x.get("so_ky_hieu"), "do_khan": x.get("do_khan"),
                "nhan_xu_ly": x.get("nhan_xu_ly"),
                "da_xu_ly": str(x.get("doc_id")) in processed,
                "trich_yeu": (x.get("trich_yeu") or "")[:80],
            })
        print(json.dumps({"page": a.list_page, "so_dong": len(rows), "rows": out},
                         ensure_ascii=False, indent=1))
        return

    if a.page is not None:
        rows = page_rows(inbox, a.page, only_xlc)
        vb, reason = pick(rows, processed)
        if not vb:
            print(json.dumps({"page": a.page, "selected": None, "reason": reason},
                             ensure_ascii=False, indent=1))
            return
        print(json.dumps({"page": a.page, "reason": reason, "selected": brief(vb)},
                         ensure_ascii=False, indent=1))
        return

    ap.print_help()


if __name__ == "__main__":
    main()
