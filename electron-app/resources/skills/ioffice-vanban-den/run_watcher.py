#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""run_watcher.py — GIÁM SÁT watcher Telegram: chạy `send_next.py --watch`, tự khởi động lại khi
thoát/crash, ghi log ra `watcher.log`. Dùng cho chạy nền bền (vd Windows Task Scheduler / NSSM).

Tôn trọng khoá đa phiên: nếu đã có watcher khác giữ khoá → đợi rồi thử lại (không spin).
Dùng: python run_watcher.py
"""
import os, subprocess, sys, time
from pathlib import Path

WORKDIR = Path(__file__).resolve().parent
LOG = WORKDIR / "watcher.log"
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def log(msg):
    line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line, flush=True)
    try:
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


def main():
    backoff = 3
    env = dict(os.environ, PYTHONUTF8="1", PYTHONIOENCODING="utf-8")
    log("=== run_watcher: bắt đầu giám sát ===")
    while True:
        started = time.time()
        locked = False
        log("Khởi động watcher (send_next.py --watch)...")
        p = subprocess.Popen([sys.executable, "-u", str(WORKDIR / "scripts" / "send_next.py"), "--watch"],
                             cwd=str(WORKDIR), env=env, stdout=subprocess.PIPE,
                             stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace")
        for line in p.stdout:                 # stream log thời gian thực tới khi watcher thoát
            line = line.rstrip()
            if line:
                log("  " + line)
            if "[KHOÁ]" in line:
                locked = True
        p.wait()
        ran = time.time() - started
        if locked:
            log("Có watcher khác đang giữ khoá — đợi 60s rồi thử lại."); time.sleep(60); continue
        if ran > 60:                          # chạy ổn định lâu -> reset backoff
            backoff = 3
        log(f"Watcher thoát (mã {p.returncode}) sau {int(ran)}s. Khởi động lại sau {backoff}s.")
        time.sleep(backoff)
        backoff = min(backoff * 2, 60)


if __name__ == "__main__":
    main()
