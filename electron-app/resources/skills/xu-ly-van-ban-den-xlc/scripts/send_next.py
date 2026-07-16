#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""send_next.py — Gửi DẦN từng văn bản (theo ưu tiên) qua Telegram và hỏi cách xử lý;
ghi nhận quyết định của người dùng (kể cả "kết thúc luôn").

Trạng thái mỗi văn bản trong processing_state.json:
  chua_gui -> da_gui (đã gửi, chờ trả lời) -> da_xu_ly | ket_thuc | bo_qua

Dùng:
  python scripts/send_next.py --send 3      # gửi 3 văn bản ưu tiên cao nhất chưa gửi
  python scripts/send_next.py --poll        # đọc trả lời Telegram, ghi nhận quyết định
  python scripts/send_next.py --status      # tóm tắt tiến độ
Người dùng trả lời bằng cách REPLY vào tin của bot, nội dung gồm:
  'kết thúc' (đóng, không xử lý) | 'soạn' | 'giao <ai>' | 'bỏ qua' | hoặc ghi chú tự do.
"""
import argparse, json, os, sys, time, urllib.request, mimetypes, uuid, re
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import telegram_send as T
import fetch_vanban as F

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

STATE = F.WORKDIR / "processing_state.json"
INBOX = F.WORKDIR / "inbox.json"
INDEX = F.WORKDIR / "index.json"
LLM_CFG = F.WORKDIR / "llm.local.json"          # {base_url, model, api_key}
CLOSE_QUEUE = F.WORKDIR / "close_queue.json"     # văn bản chờ ĐÓNG THẬT trên iOffice
MAX_FILE = 45 * 1024 * 1024     # giới hạn gửi file qua bot (~50MB)
API = "https://api.telegram.org/bot{token}/{method}"


def llm_chat(messages, max_tokens=500):
    cfg = json.loads(LLM_CFG.read_text(encoding="utf-8"))
    body = {"model": cfg["model"], "messages": messages, "max_tokens": max_tokens, "temperature": 0}
    req = urllib.request.Request(cfg["base_url"].rstrip("/") + "/chat/completions",
                                 data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json",
                                          "Authorization": "Bearer " + cfg["api_key"]})
    with urllib.request.urlopen(req, timeout=150) as r:
        return json.load(r)["choices"][0]["message"]["content"]


LLM_SYSTEM = (
    "Bạn là bộ điều phối lệnh xử lý văn bản hành chính qua Telegram (tiếng Việt). "
    "Người dùng nhắn lệnh tự nhiên. Trả về DUY NHẤT 1 JSON (không kèm giải thích, không markdown) schema:\n"
    '{"intent":"send|close_ioffice|mark|status|unknown","count":<int|null>,'
    '"role":"PH|XLC|null","action":"ket_thuc|du_thao|giao|bo_qua|null",'
    '"targets":[<số ký hiệu>],"reply":"<câu ngắn nếu unknown>"}\n'
    "Quy ước: 'kết thúc'/'đóng' văn bản = close_ioffice (đóng thật trên hệ thống). "
    "'gửi/gửi tiếp' = send. 'ghi nhận/đánh dấu' = mark. 'tiến độ/trạng thái' = status.\n"
    "'vừa gửi'/'gần đây' = các văn bản trong danh sách được cung cấp. "
    "Nếu lệnh kiểu 'N/M văn bản vừa gửi' (vd '3/5') -> chọn N văn bản ưu tiên cao nhất (thu_tu nhỏ nhất) "
    "trong M cái mới nhất, điền 'targets' bằng đúng số ký hiệu của chúng. Luôn điền targets là số ký hiệu có thật."
)


def llm_interpret(text, st):
    recent = sorted([v for v in st["docs"].values() if v.get("thu_tu") is not None],
                    key=lambda v: v.get("thu_tu") or 99999)
    sent_list = [{"thu_tu": v["thu_tu"], "so_ky_hieu": v["so_ky_hieu"], "status": v.get("status")}
                 for v in recent][-15:]
    user = (f"Văn bản đã gửi gần đây (mới nhất ở cuối): {json.dumps(sent_list, ensure_ascii=False)}\n\n"
            f"Lệnh của người dùng: {text}")
    raw = llm_chat([{"role": "system", "content": LLM_SYSTEM}, {"role": "user", "content": user}])
    m = re.search(r"\{.*\}", raw, re.S)
    return json.loads(m.group(0)) if m else {"intent": "unknown", "reply": raw[:200]}


def resolve_targets(targets, st):
    """Map số ký hiệu (LLM trả) -> bản ghi trong state."""
    out, want = [], {str(t).strip() for t in (targets or [])}
    for did, v in st["docs"].items():
        if v.get("so_ky_hieu") in want:
            out.append({"doc_id": did, "so_ky_hieu": v["so_ky_hieu"], "thu_tu": v.get("thu_tu")})
    return out
# QUAN TRỌNG: phải khai báo 'callback_query' nếu không Telegram KHÔNG gửi sự kiện nút bấm.
ALLOWED_UPDATES = ["message", "edited_message", "callback_query"]

KW_KETTHUC = ("kết thúc", "ket thuc", "đóng", "dong", "xong", "không xử lý", "khong xu ly", "bỏ")
KW_BOQUA = ("bỏ qua", "bo qua", "skip", "để sau", "de sau")


# Nút bấm inline cho mỗi văn bản. callback_data = "a|<status>|<doc_id>" (<=64 byte).
BTN = [("✅ Kết thúc", "ket_thuc"), ("✍️ Soạn", "du_thao"),
       ("👤 Giao", "giao"), ("⏭️ Bỏ qua", "bo_qua")]
ACTION_LABEL = {"ket_thuc": "Kết thúc", "du_thao": "Soạn dự thảo", "giao": "Giao xử lý", "bo_qua": "Bỏ qua"}


def kb(doc_id) -> dict:
    rows, row = [], []
    for text, act in BTN:
        row.append({"text": text, "callback_data": f"a|{act}|{doc_id}"})
        if len(row) == 2:
            rows.append(row); row = []
    if row:
        rows.append(row)
    return {"inline_keyboard": rows}


def load_state() -> dict:
    return json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {"docs": {}, "offset": 0}


def save_state(s: dict):
    STATE.write_text(json.dumps(s, ensure_ascii=False, indent=2), encoding="utf-8")


def api(token, method, data=None):
    req = urllib.request.Request(API.format(token=token, method=method),
                                 data=json.dumps(data).encode() if data else None,
                                 headers={"Content-Type": "application/json"} if data else {})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def send_doc_msg(cfg, it, meta) -> dict:
    """Gửi 1 văn bản: thông tin + (nếu được) file chính + NÚT BẤM. Trả message_id."""
    so = it.get("so_ky_hieu") or it.get("doc_id")
    cap = (f"[VB #{it.get('thu_tu_uu_tien','?')}] {so}\n"
           f"📌 {it.get('trich_yeu','')}\n"
           f"• Vai trò: {it.get('nhan_xu_ly','')} | Khẩn: {it.get('do_khan','')} | "
           f"Hạn: {it.get('han_xu_ly') or '—'}\n"
           f"• Nơi gửi: {it.get('noi_gui','')}\n"
           f"• Đề xuất: {meta.get('de_xuat','')}\n"
           f"❓ Bấm nút bên dưới để chọn cách xử lý:")
    markup = json.dumps(kb(it.get("doc_id")))
    # chọn file chính: file không phải dự thảo, ưu tiên pdf/doc, <= MAX_FILE
    main = None
    for a in it.get("attachments", []):
        p = Path(a)
        if p.exists() and "duthao" not in p.name.lower() and p.stat().st_size <= MAX_FILE:
            main = p
            if p.suffix.lower() in (".pdf", ".doc", ".docx"):
                break
            main = main or p
    token = cfg["bot_token"]
    if main:
        boundary = "----io" + uuid.uuid4().hex
        nl = b"\r\n"; body = b""
        for k, v in {"chat_id": cfg["chat_id"], "caption": cap[:1000], "reply_markup": markup}.items():
            body += b"--"+boundary.encode()+nl
            body += f'Content-Disposition: form-data; name="{k}"'.encode()+nl+nl+str(v).encode()+nl
        ctype = mimetypes.guess_type(main.name)[0] or "application/octet-stream"
        body += b"--"+boundary.encode()+nl
        body += f'Content-Disposition: form-data; name="document"; filename="{main.name}"'.encode()+nl
        body += f"Content-Type: {ctype}".encode()+nl+nl+main.read_bytes()+nl
        body += b"--"+boundary.encode()+b"--"+nl
        req = urllib.request.Request(API.format(token=token, method="sendDocument"), data=body,
                                     headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.load(r)
    return api(token, "sendMessage", {"chat_id": cfg["chat_id"], "text": cap,
                                      "reply_markup": kb(it.get("doc_id"))})


def send_batch(cfg, st, n, role=None) -> list:
    """Gửi n văn bản CHƯA gửi (lọc theo vai trò nếu có) kèm nút. Cập nhật st. Trả list (thu_tu, so)."""
    inbox = json.loads(INBOX.read_text(encoding="utf-8"))
    idx = json.loads(INDEX.read_text(encoding="utf-8")) if INDEX.exists() else {"documents": []}
    meta_by_so = {d["so_ky_hieu"]: d for d in idx.get("documents", [])}
    order = sorted(inbox, key=lambda x: (x.get("thu_tu_uu_tien") or 99999))
    out = []
    for it in order:
        if len(out) >= n:
            break
        did = str(it.get("doc_id"))
        if did in st["docs"]:
            continue
        if role and it.get("nhan_xu_ly") != role:
            continue
        res = send_doc_msg(cfg, it, meta_by_so.get(it.get("so_ky_hieu"), {}))
        mid = (res.get("result") or {}).get("message_id")
        st["docs"][did] = {"so_ky_hieu": it.get("so_ky_hieu"), "thu_tu": it.get("thu_tu_uu_tien"),
                           "status": "da_gui", "msg_id": mid, "decision": ""}
        out.append((it.get("thu_tu_uu_tien"), it.get("so_ky_hieu")))
        print(f"Đã gửi #{it.get('thu_tu_uu_tien')} {it.get('so_ky_hieu')} (msg {mid})")
    return out


def cmd_send(cfg, n):
    st = load_state()
    out = send_batch(cfg, st, n)
    save_state(st)
    print(f">>> Gửi {len(out)} văn bản.")


def classify_reply(text: str) -> str:
    low = text.lower()
    if any(k in low for k in KW_KETTHUC):
        return "ket_thuc"
    if any(k in low for k in KW_BOQUA):
        return "bo_qua"
    return "da_xu_ly"


def handle_command(token, cfg, st, text, chat_id) -> bool:
    """Hiểu LỆNH TEXT tự do từ người dùng và thực thi + phản hồi Telegram.
    Hỗ trợ: 'gửi tiếp N [PH/phối hợp]', 'trạng thái'. Khác -> gợi ý."""
    low = text.lower().strip()
    def reply(t):
        try: api(token, "sendMessage", {"chat_id": chat_id, "text": t})
        except Exception as e: print(f"  [tg reply] {e}")
    try: api(token, "sendChatAction", {"chat_id": chat_id, "action": "typing"})
    except Exception: pass
    # gửi tiếp N
    m = re.search(r"(?:gửi|gui|send|tiếp|tiep)\D*(\d+)", low)
    if m and any(k in low for k in ("gửi", "gui", "send", "tiếp", "tiep")):
        n = max(1, min(int(m.group(1)), 30))
        role = "Phối hợp" if any(k in low for k in ("phối hợp", "phoi hop", " ph", "ph ")) or low.endswith("ph") else None
        sent = send_batch(cfg, st, n, role)
        tag = " PH" if role else ""
        if sent:
            ds = ", ".join(f"#{t} {s}" for t, s in sent)
            reply(f"📨 Đã gửi {len(sent)} văn bản{tag} (có nút bấm):\n{ds}")
            print(f"  ✓ [lệnh] gửi {len(sent)}{tag}")
        else:
            reply(f"⚠️ Không còn văn bản{tag} chưa gửi để gửi tiếp.")
        return True
    # healthcheck — "còn sống?"
    if low in ("ping", "?", "còn sống", "con song", "alive", "healthcheck", "/ping") \
            or low.startswith(("còn sống", "con song")):
        reply(f"✅ Watcher còn sống (pid {os.getpid()}).")
        return True
    # trạng thái
    if any(k in low for k in ("trạng thái", "trang thai", "tiến độ", "tien do", "status")):
        import collections
        c = collections.Counter(v["status"] for v in st["docs"].values())
        reply("📊 Tiến độ: " + (", ".join(f"{k}={v}" for k, v in c.items()) or "(chưa có)"))
        return True
    # --- LLM hiểu lệnh tự nhiên ---
    try:
        r = llm_interpret(text, st)
    except Exception as e:
        reply(f"⚠️ Không gọi được LLM: {e}"); return False
    intent = r.get("intent")
    print(f"  [LLM] intent={intent} {r}")
    if intent == "send":
        n = max(1, min(int(r.get("count") or 5), 30))
        role = "Phối hợp" if r.get("role") == "PH" else ("Xử lý chính" if r.get("role") == "XLC" else None)
        sent = send_batch(cfg, st, n, role)
        reply(f"📨 Đã gửi {len(sent)} văn bản (có nút bấm):\n" +
              ", ".join(f"#{t} {s}" for t, s in sent) if sent else "⚠️ Không còn văn bản chưa gửi.")
        return True
    if intent == "status":
        import collections
        c = collections.Counter(v["status"] for v in st["docs"].values())
        reply("📊 Tiến độ: " + ", ".join(f"{k}={v}" for k, v in c.items()))
        return True
    if intent == "mark":
        tgs = resolve_targets(r.get("targets"), st)
        act = r.get("action") or "da_xu_ly"
        for t in tgs:
            st["docs"][t["doc_id"]]["status"] = act
            st["docs"][t["doc_id"]]["decision"] = ACTION_LABEL.get(act, act)
        reply(f"✍️ Đã ghi nhận '{ACTION_LABEL.get(act, act)}' cho {len(tgs)} văn bản: " +
              ", ".join(t["so_ky_hieu"] for t in tgs))
        return True
    if intent == "close_ioffice":
        tgs = resolve_targets(r.get("targets"), st)
        if not tgs:
            reply("⚠️ Chưa xác định được văn bản cần đóng. Nói rõ số ký hiệu giúp tôi."); return True
        st["pending_close"] = [t["doc_id"] for t in tgs]
        ds = "\n".join(f"• #{t['thu_tu']} {t['so_ky_hieu']}" for t in tgs)
        confirm_kb = {"inline_keyboard": [[
            {"text": f"✅ Đồng ý ĐÓNG {len(tgs)}", "callback_data": "cfm|close"},
            {"text": "❌ Hủy", "callback_data": "cfm|cancel"}]]}
        try:
            api(token, "sendMessage", {"chat_id": chat_id, "reply_markup": confirm_kb,
                "text": f"⚠️ Sẽ ĐÓNG THẬT {len(tgs)} văn bản trên iOffice (KHÔNG hoàn tác):\n{ds}\n"
                        f"Xác nhận? (Đóng sẽ chạy khi bạn đăng nhập iOffice.)"})
        except Exception as e:
            print(f"  [tg] {e}")
        return True
    reply(r.get("reply") or "🤖 Chưa rõ lệnh. Thử: \"gửi tiếp 5 PH\", \"kết thúc 3 văn bản vừa gửi\", \"trạng thái\".")
    return False


def process_update(token, st, u, cfg=None, verbose=True) -> bool:
    """Xử lý 1 update (nút bấm / text decision / LỆNH). Cập nhật st tại chỗ. Trả True nếu ghi nhận."""
    cq = u.get("callback_query")
    if verbose:
        kind = "callback" if cq else "message"
        extra = repr(cq.get("data")) if cq else repr(((u.get("message") or {}).get("text") or "")[:40])
        print(f"[update {u['update_id']}] {kind} {extra}")
    if cq:
        parts = (cq.get("data") or "").split("|")
        msg = cq.get("message", {})
        chat_id = msg.get("chat", {}).get("id")
        mid = msg.get("message_id")
        try:    # hiện "đang gõ..." cho người dùng biết bot đang xử lý
            api(token, "sendChatAction", {"chat_id": chat_id, "action": "typing"})
        except Exception:
            pass
        # --- Xác nhận ĐÓNG iOffice ---
        if parts and parts[0] == "cfm":
            try: api(token, "answerCallbackQuery", {"callback_query_id": cq["id"]})
            except Exception: pass
            pend = st.get("pending_close", [])
            if parts[1] == "close" and pend:
                queue = json.loads(CLOSE_QUEUE.read_text(encoding="utf-8")) if CLOSE_QUEUE.exists() else []
                qids = {q["doc_id"] for q in queue}
                for did in pend:
                    if did not in qids:
                        queue.append({"doc_id": did, "so_ky_hieu": st["docs"].get(did, {}).get("so_ky_hieu", "")})
                    st["docs"].get(did, {})["status"] = "cho_dong"
                CLOSE_QUEUE.write_text(json.dumps(queue, ensure_ascii=False, indent=2), encoding="utf-8")
                st["pending_close"] = []
                try: api(token, "editMessageReplyMarkup", {"chat_id": chat_id, "message_id": mid,
                         "reply_markup": {"inline_keyboard": [[{"text": "☑ Đã xếp hàng đóng", "callback_data": "done"}]]}})
                except Exception: pass
                try: api(token, "sendMessage", {"chat_id": chat_id,
                         "text": f"✅ Đã xếp {len(pend)} văn bản vào hàng đợi đóng (tổng hàng đợi: {len(queue)}). "
                                 f"Sẽ đóng thật khi bạn đăng nhập iOffice (chạy: python bulk_ketthuc.py --queue)."})
                except Exception: pass
                print(f"  ✓ [xác nhận] xếp {len(pend)} VB vào hàng đợi đóng")
            else:
                st["pending_close"] = []
                try: api(token, "sendMessage", {"chat_id": chat_id, "text": "❌ Đã hủy lệnh đóng."})
                except Exception: pass
            return True
        if len(parts) == 3 and parts[0] == "a":
            action, did = parts[1], parts[2]
            key = did if did in st["docs"] else (str(did) if str(did) in st["docs"] else None)
            lbl = ACTION_LABEL.get(action, action)
            if key:
                def tg(method, data):           # gọi an toàn, lỗi không chặn các bước sau
                    try:
                        return api(token, method, data)
                    except Exception as e:
                        print(f"  [tg {method}] {e}")
                old = st["docs"][key].get("status")
                changed = old != action
                st["docs"][key]["status"] = action
                st["docs"][key]["decision"] = lbl
                so = st["docs"][key].get("so_ky_hieu", "")
                tt = st["docs"][key].get("thu_tu", "")
                print(f"  ✓ [nút] {so} -> {lbl}{'' if changed else ' (giữ nguyên)'}")
                tg("answerCallbackQuery", {"callback_query_id": cq["id"], "text": f"✅ Đã ghi: {lbl}"})
                if changed:                     # chỉ đổi nút + gửi tin khi LỰA CHỌN thay đổi (tránh spam/400)
                    tg("editMessageReplyMarkup",
                       {"chat_id": chat_id, "message_id": mid,
                        "reply_markup": {"inline_keyboard": [[{"text": "☑ " + lbl, "callback_data": "done"}]]}})
                    tg("sendMessage",
                       {"chat_id": chat_id, "reply_to_message_id": mid,
                        "text": f"✅ Đã ghi nhận: VB #{tt} {so} → {lbl}"})
                return True
            else:
                print(f"  [!] doc_id {did!r} không có trong state ({len(st['docs'])} docs).")
                try:
                    api(token, "answerCallbackQuery",
                        {"callback_query_id": cq["id"], "text": "⚠️ Văn bản test/không có trong danh sách"})
                except Exception:
                    pass
        else:
            try:
                api(token, "answerCallbackQuery", {"callback_query_id": cq["id"]})
            except Exception:
                pass
        return False
    m = u.get("message") or {}
    text = m.get("text") or m.get("caption") or ""
    if not text:
        return False
    mid2did = {v.get("msg_id"): d for d, v in st["docs"].items() if v.get("msg_id")}
    did = mid2did.get((m.get("reply_to_message") or {}).get("message_id"))
    if not did:
        for d, v in st["docs"].items():
            if v.get("so_ky_hieu") and v["so_ky_hieu"] in text:
                did = d; break
    if did and did in st["docs"]:
        st["docs"][did]["status"] = classify_reply(text)
        st["docs"][did]["decision"] = text.strip()[:300]
        print(f"  ✓ [text] {st['docs'][did]['so_ky_hieu']}: {st['docs'][did]['status']}")
        return True
    # Không gắn với văn bản nào -> coi là LỆNH tự do
    if cfg:
        chat_id = (m.get("chat") or {}).get("id") or cfg.get("chat_id")
        return handle_command(token, cfg, st, text, chat_id)
    return False


def cmd_poll(cfg):
    st = load_state()
    token = cfg["bot_token"]
    data = api(token, "getUpdates", {"offset": st.get("offset", 0), "allowed_updates": ALLOWED_UPDATES})
    n = 0
    for u in data.get("result", []):
        st["offset"] = u["update_id"] + 1
        if process_update(token, st, u, cfg):
            n += 1
    save_state(st)
    print(f">>> Ghi nhận {n} phản hồi.")


def cmd_watch(cfg):
    """Long-poll LIÊN TỤC: bấm nút trên Telegram là ghi nhận ngay. Ctrl+C / kill để dừng."""
    import iolock
    ok, holder = iolock.acquire("watcher", session="send_next.watch")
    if not ok:
        print(f"[KHOÁ] Đã có watcher khác đang chạy: {holder}. Dừng để tránh 409 (xem AGENTS.md).")
        return
    token = cfg["bot_token"]
    print(">>> WATCH online — bấm nút trên Telegram sẽ ghi ngay. (đang chờ...)")
    while True:
        iolock.heartbeat("watcher", session="send_next.watch")
        st = load_state()
        try:
            req = urllib.request.Request(
                API.format(token=token, method="getUpdates"),
                data=json.dumps({"offset": st.get("offset", 0), "timeout": 25,
                                 "allowed_updates": ALLOWED_UPDATES}).encode(),
                headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=35) as r:
                data = json.load(r)
        except Exception as e:
            print(f"[lỗi getUpdates] {e}"); time.sleep(3); continue
        got = False
        for u in data.get("result", []):
            st["offset"] = u["update_id"] + 1
            process_update(token, st, u, cfg)
            got = True
        if got:
            save_state(st)


def cmd_addbuttons(cfg):
    """Gắn NÚT BẤM vào các tin đã gửi trước đó (chưa có nút) qua editMessageReplyMarkup."""
    st = load_state()
    token = cfg["bot_token"]
    n = 0
    for did, v in st["docs"].items():
        if v.get("msg_id") and v.get("status") == "da_gui":
            try:
                api(token, "editMessageReplyMarkup",
                    {"chat_id": cfg["chat_id"], "message_id": v["msg_id"], "reply_markup": kb(did)})
                n += 1
            except Exception as e:
                print(f"  [bỏ qua] {v.get('so_ky_hieu')}: {e}")
    print(f">>> Đã gắn nút cho {n} tin đã gửi.")


def cmd_status():
    st = load_state()
    import collections
    c = collections.Counter(v["status"] for v in st["docs"].values())
    print("Tiến độ gửi/xử lý:", dict(c) or "(chưa gửi gì)")
    cho = [v for v in st["docs"].values() if v["status"] == "da_gui"]
    if cho:
        print("Đang chờ trả lời:", ", ".join(f"#{v['thu_tu']} {v['so_ky_hieu']}" for v in cho[:20]))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--send", type=int, metavar="N", help="Gửi N văn bản ưu tiên cao nhất chưa gửi")
    ap.add_argument("--poll", action="store_true", help="Đọc nút bấm/trả lời Telegram, ghi nhận quyết định")
    ap.add_argument("--watch", action="store_true", help="Long-poll LIÊN TỤC (real-time) ghi nhận nút bấm")
    ap.add_argument("--addbuttons", action="store_true", help="Gắn nút bấm vào các tin đã gửi trước đó")
    ap.add_argument("--status", action="store_true", help="Tóm tắt tiến độ")
    a = ap.parse_args()
    cfg = T.load_cfg()
    if not cfg.get("chat_id"):
        sys.exit("Thiếu chat_id trong telegram.local.json.")
    if a.send:
        cmd_send(cfg, a.send)
    elif a.poll:
        cmd_poll(cfg)
    elif a.watch:
        cmd_watch(cfg)
    elif a.addbuttons:
        cmd_addbuttons(cfg)
    elif a.status:
        cmd_status()
    else:
        ap.print_help()
