#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""iolock.py — Khoá tài nguyên ĐỘC QUYỀN cho nhiều phiên/AI chạy cùng lúc.

Tài nguyên chỉ-1-phiên: `browser` (.browser_profile / iOffice) và `watcher` (Telegram getUpdates).
Lock file ở `.locks/<name>.lock` chứa {pid, session, ts}. Coi là CÒN GIỮ nếu PID còn sống VÀ
heartbeat chưa quá hạn (ttl). Dùng:

    import iolock
    ok, holder = iolock.acquire("browser", session="fetch")
    if not ok:
        print("Phiên khác đang giữ browser:", holder); sys.exit(1)
    try:
        ... mở browser ...
        iolock.heartbeat("browser")     # gọi định kỳ nếu chạy lâu
    finally:
        iolock.release("browser")
"""
import json, os, sys, time
from pathlib import Path

WORKDIR = Path(__file__).resolve().parent.parent
LOCK_DIR = WORKDIR / ".locks"
DEFAULT_TTL = 3600          # giây: heartbeat cũ hơn -> coi như bỏ rơi


def _alive(pid) -> bool:
    if not pid:
        return False
    pid = int(pid)
    if sys.platform == "win32":
        import ctypes
        PROCESS_QUERY_LIMITED = 0x1000
        h = ctypes.windll.kernel32.OpenProcess(PROCESS_QUERY_LIMITED, False, pid)
        if h:
            ctypes.windll.kernel32.CloseHandle(h)
            return True
        return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def _path(name):
    return LOCK_DIR / f"{name}.lock"


def _read(name):
    f = _path(name)
    if not f.exists():
        return None
    try:
        return json.loads(f.read_text(encoding="utf-8"))
    except Exception:
        return None


def held_by(name, ttl=DEFAULT_TTL):
    """Trả về dict holder nếu đang bị giữ HỢP LỆ (pid sống + heartbeat còn hạn), ngược lại None."""
    d = _read(name)
    if not d:
        return None
    if _alive(d.get("pid")) and (time.time() - d.get("ts", 0) < ttl):
        return d
    return None


def acquire(name, session="?", ttl=DEFAULT_TTL):
    """Chiếm khoá. Trả (True, None) nếu chiếm được; (False, holder) nếu phiên khác đang giữ."""
    LOCK_DIR.mkdir(exist_ok=True)
    holder = held_by(name, ttl)
    if holder and holder.get("pid") != os.getpid():
        return False, holder
    _path(name).write_text(json.dumps(
        {"pid": os.getpid(), "session": session, "ts": time.time()}, ensure_ascii=False), encoding="utf-8")
    return True, None


def heartbeat(name, session="?"):
    if _path(name).exists():
        _path(name).write_text(json.dumps(
            {"pid": os.getpid(), "session": session, "ts": time.time()}, ensure_ascii=False), encoding="utf-8")


def release(name):
    try:
        _path(name).unlink()
    except FileNotFoundError:
        pass


if __name__ == "__main__":
    # CLI nhỏ: xem trạng thái khoá. `python scripts/iolock.py status`
    for nm in ("browser", "watcher"):
        h = held_by(nm)
        print(f"{nm:8}: {'ĐANG GIỮ bởi ' + str(h) if h else 'rảnh'}")
