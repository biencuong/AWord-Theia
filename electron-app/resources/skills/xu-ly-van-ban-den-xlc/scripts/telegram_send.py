#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""telegram_send.py — Gửi file dự thảo qua bot Telegram @Ioffice_Auto_bot.

Token + chat_id đọc từ telegram.local.json (KHÔNG commit) hoặc ENV TELEGRAM_BOT_TOKEN /
TELEGRAM_CHAT_ID. Bot KHÔNG tự gửi cho chính nó — phải có chat_id của người/nhóm đã /start bot.

Dùng:
    # 1) Người dùng nhắn 1 tin cho @Ioffice_Auto_bot, rồi lấy & lưu chat_id:
    python scripts/telegram_send.py --discover
    # 2) Gửi 1 file (dự thảo):
    python scripts/telegram_send.py --file path/to/1893_..._DuThao.docx --caption "Dự thảo 1893/VP-KH&CĐS"
    # 3) Gửi tin nhắn text:
    python scripts/telegram_send.py --text "Đã xong dự thảo XYZ"
"""
import argparse, json, os, sys, urllib.request, mimetypes, uuid
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

WORKDIR = Path(__file__).resolve().parent.parent
CONFIG = WORKDIR / "telegram.local.json"
API = "https://api.telegram.org/bot{token}/{method}"


def load_cfg() -> dict:
    cfg = {}
    if CONFIG.exists():
        cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    cfg["bot_token"] = os.environ.get("TELEGRAM_BOT_TOKEN", cfg.get("bot_token"))
    if os.environ.get("TELEGRAM_CHAT_ID"):
        cfg["chat_id"] = os.environ["TELEGRAM_CHAT_ID"]
    try:
        import secret                          # token có thể là "dpapi:..." (mã hoá DPAPI)
        cfg["bot_token"] = secret.reveal(cfg.get("bot_token"))
    except Exception:
        pass
    if not cfg.get("bot_token"):
        sys.exit("Thiếu bot_token (telegram.local.json hoặc ENV TELEGRAM_BOT_TOKEN).")
    return cfg


def save_cfg(cfg: dict) -> None:
    CONFIG.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")


def api_get(token: str, method: str) -> dict:
    with urllib.request.urlopen(API.format(token=token, method=method), timeout=20) as r:
        return json.load(r)


def discover_chat(cfg: dict) -> None:
    """Đọc getUpdates, hiển thị các chat_id và lưu chat_id mới nhất vào config."""
    data = api_get(cfg["bot_token"], "getUpdates")
    chats = {}
    for u in data.get("result", []):
        msg = u.get("message") or u.get("channel_post") or {}
        ch = msg.get("chat", {})
        if ch.get("id") is not None:
            name = ch.get("title") or f"{ch.get('first_name','')} {ch.get('last_name','') or ''}".strip()
            chats[ch["id"]] = (ch.get("type"), name, ch.get("username"))
    if not chats:
        print("Chưa có ai nhắn cho bot. Hãy mở @{} và gửi 1 tin (vd /start) rồi chạy lại."
              .format(cfg.get("bot_username", "Ioffice_Auto_bot")))
        return
    for cid, info in chats.items():
        print(f"chat_id={cid} | type={info[0]} | name={info[1]} | @{info[2]}")
    cfg["chat_id"] = list(chats)[-1]
    save_cfg(cfg)
    print(f">>> Đã lưu chat_id={cfg['chat_id']} vào {CONFIG.name}")


def _multipart(fields: dict, file_field: str, file_path: Path) -> tuple:
    """Tạo body multipart/form-data (stdlib, không cần requests)."""
    boundary = "----iooffice" + uuid.uuid4().hex
    nl = b"\r\n"
    body = b""
    for k, v in fields.items():
        body += b"--" + boundary.encode() + nl
        body += f'Content-Disposition: form-data; name="{k}"'.encode() + nl + nl
        body += str(v).encode() + nl
    fname = file_path.name
    ctype = mimetypes.guess_type(fname)[0] or "application/octet-stream"
    body += b"--" + boundary.encode() + nl
    body += f'Content-Disposition: form-data; name="{file_field}"; filename="{fname}"'.encode() + nl
    body += f"Content-Type: {ctype}".encode() + nl + nl
    body += file_path.read_bytes() + nl
    body += b"--" + boundary.encode() + b"--" + nl
    return body, f"multipart/form-data; boundary={boundary}"


def send_document(cfg: dict, file_path: Path, caption: str = "") -> dict:
    if not cfg.get("chat_id"):
        sys.exit("Thiếu chat_id — chạy '--discover' sau khi nhắn cho bot.")
    if not file_path.exists():
        sys.exit(f"Không thấy file: {file_path}")
    body, ctype = _multipart({"chat_id": cfg["chat_id"], "caption": caption or file_path.name},
                             "document", file_path)
    req = urllib.request.Request(API.format(token=cfg["bot_token"], method="sendDocument"),
                                 data=body, headers={"Content-Type": ctype})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def send_text(cfg: dict, text: str) -> dict:
    if not cfg.get("chat_id"):
        sys.exit("Thiếu chat_id — chạy '--discover' sau khi nhắn cho bot.")
    body, ctype = json.dumps({"chat_id": cfg["chat_id"], "text": text}).encode(), "application/json"
    req = urllib.request.Request(API.format(token=cfg["bot_token"], method="sendMessage"),
                                 data=body, headers={"Content-Type": ctype})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--discover", action="store_true", help="Tìm & lưu chat_id từ getUpdates")
    ap.add_argument("--file", help="Đường dẫn file cần gửi (vd dự thảo)")
    ap.add_argument("--caption", default="", help="Chú thích kèm file")
    ap.add_argument("--text", help="Gửi tin nhắn text")
    a = ap.parse_args()
    cfg = load_cfg()
    if a.discover:
        discover_chat(cfg)
    elif a.file:
        print(json.dumps(send_document(cfg, Path(a.file), a.caption), ensure_ascii=False))
    elif a.text:
        print(json.dumps(send_text(cfg, a.text), ensure_ascii=False))
    else:
        ap.print_help()
