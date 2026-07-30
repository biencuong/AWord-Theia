#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""run_daily.py — Quy trình HẰNG NGÀY trong 1 lệnh:
   lấy văn bản đến (tự build chỉ mục + tri thức) → soạn TÓM TẮT → đẩy lên Telegram.

Mở cửa sổ để đăng nhập (captcha) khi cần. Tôn trọng khoá đa phiên (fetch giữ khoá `browser`).
Dùng:
   python run_daily.py                 # fetch + đẩy tóm tắt
   python run_daily.py --no-fetch      # chỉ đẩy tóm tắt từ dữ liệu hiện có
   python run_daily.py --digest        # kèm "điểm tin" do LLM cục bộ soạn
   python run_daily.py --headless       # fetch ẩn (chỉ khi còn phiên hợp lệ)
"""
import argparse, collections, json, sys
from datetime import date
from pathlib import Path

WORKDIR = Path(__file__).resolve().parent
SCRIPTS = WORKDIR / "scripts"
sys.path.insert(0, str(SCRIPTS))
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def _load(name, default):
    f = WORKDIR / name
    if f.exists():
        try:
            return json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            return default
    return default


def compose_summary():
    import fetch_vanban as F
    inbox = sorted(_load("inbox.json", []), key=lambda x: (x.get("thu_tu_uu_tien") or 99999))
    s = _load("index.json", {"summary": {}}).get("summary", {})
    roles = collections.Counter(x.get("nhan_xu_ly") for x in inbox)
    today = (date.today().year, date.today().month, date.today().day)
    overdue = [x for x in inbox if x.get("han_xu_ly")
               and F.parse_dmy(x["han_xu_ly"]) != (9999, 99, 99) and F.parse_dmy(x["han_xu_ly"]) < today]
    lines = [f"📅 TÓM TẮT VĂN BẢN ĐẾN — {date.today().isoformat()}",
             f"Tổng: {len(inbox)} · XLC {roles.get('Xử lý chính', 0)} · PH {roles.get('Phối hợp', 0)}",
             f"Cần dự thảo: {len(s.get('can_du_thao_chua_lam', []))} · ⚠️ Quá hạn: {len(overdue)}",
             "", "🔝 Ưu tiên cao nhất:"]
    for x in inbox[:8]:
        lines.append(f"#{x.get('thu_tu_uu_tien')} [{(x.get('nhan_xu_ly') or '')[:3]}] "
                     f"{x.get('do_khan')} | {x.get('so_ky_hieu')} — {(x.get('trich_yeu') or '')[:48]}")
    return "\n".join(lines), inbox


def llm_digest(inbox):
    try:
        import send_next as S
        top = [{"so": x.get("so_ky_hieu"), "trich_yeu": x.get("trich_yeu"),
                "do_khan": x.get("do_khan"), "vai_tro": x.get("nhan_xu_ly")} for x in inbox[:8]]
        msg = [{"role": "system", "content":
                "Viết 'điểm tin' NGẮN GỌN (tiếng Việt, tối đa 8 dòng) cho công chức về các văn bản ưu "
                "tiên cao nhất hôm nay: nêu việc GẤP cần làm trước. KHÔNG bịa nội dung."},
               {"role": "user", "content": json.dumps(top, ensure_ascii=False)}]
        return S.llm_chat(msg, max_tokens=400)
    except Exception as e:
        return f"(không tạo được điểm tin LLM: {e})"


def push(text):
    import telegram_send as T
    cfg = T.load_cfg()
    if not cfg.get("chat_id"):
        print("[lưu ý] thiếu chat_id — bỏ qua đẩy Telegram."); return
    T.send_text(cfg, text[:4000])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-fetch", action="store_true", help="Không lấy mới, chỉ đẩy tóm tắt")
    ap.add_argument("--headless", action="store_true")
    ap.add_argument("--digest", action="store_true", help="Kèm điểm tin do LLM cục bộ soạn")
    a = ap.parse_args()

    if not a.no_fetch:
        import fetch_vanban as F
        print(">>> Lấy văn bản đến (mở cửa sổ, đăng nhập nếu cần)...")
        F.run(a.headless)        # tự chạy build_index + build_knowledge sau khi fetch

    summary, inbox = compose_summary()
    print("\n" + summary)
    text = summary
    if a.digest:
        text += "\n\n📝 Điểm tin:\n" + llm_digest(inbox)
    push(text)
    print(">>> Đã đẩy tóm tắt lên Telegram.")


if __name__ == "__main__":
    main()
