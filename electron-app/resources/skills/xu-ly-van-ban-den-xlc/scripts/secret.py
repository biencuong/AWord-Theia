#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""secret.py — Mã hoá/giải mã bí mật bằng Windows DPAPI (gắn với tài khoản Windows hiện tại;
chỉ user đó trên máy đó mới giải mã được). Dùng để bảo vệ mật khẩu/token trong `*.local.json`.

CLI:
   python scripts/secret.py enc "Mat_khau"        -> in chuỗi "dpapi:<base64>"
   python scripts/secret.py dec "dpapi:<base64>"  -> in lại mật khẩu

Tích hợp (tuỳ chọn): trong config có thể để giá trị "dpapi:..." rồi gọi secret.reveal(value) khi đọc.
"""
import base64, ctypes, ctypes.wintypes, sys

PREFIX = "dpapi:"


class _BLOB(ctypes.Structure):
    _fields_ = [("cbData", ctypes.wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]


def _mk(data: bytes) -> _BLOB:
    buf = ctypes.create_string_buffer(data, len(data))
    return _BLOB(len(data), ctypes.cast(buf, ctypes.POINTER(ctypes.c_char)))


def _take(blob: _BLOB) -> bytes:
    out = ctypes.string_at(blob.pbData, blob.cbData)
    ctypes.windll.kernel32.LocalFree(blob.pbData)
    return out


def encrypt(text: str) -> str:
    din, dout = _mk(text.encode("utf-8")), _BLOB()
    if not ctypes.windll.crypt32.CryptProtectData(ctypes.byref(din), None, None, None, None, 0,
                                                  ctypes.byref(dout)):
        raise OSError("CryptProtectData thất bại")
    return PREFIX + base64.b64encode(_take(dout)).decode()


def decrypt(blob: str) -> str:
    raw = base64.b64decode(blob[len(PREFIX):] if blob.startswith(PREFIX) else blob)
    din, dout = _mk(raw), _BLOB()
    if not ctypes.windll.crypt32.CryptUnprotectData(ctypes.byref(din), None, None, None, None, 0,
                                                    ctypes.byref(dout)):
        raise OSError("CryptUnprotectData thất bại")
    return _take(dout).decode("utf-8")


def reveal(value):
    """Trả giá trị thật: nếu là blob 'dpapi:...' thì giải mã, ngược lại giữ nguyên."""
    if isinstance(value, str) and value.startswith(PREFIX):
        try:
            return decrypt(value)
        except Exception:
            return value
    return value


if __name__ == "__main__":
    if len(sys.argv) < 3 or sys.argv[1] not in ("enc", "dec"):
        sys.exit('Dùng: python scripts/secret.py enc "text" | dec "dpapi:..."')
    print(encrypt(sys.argv[2]) if sys.argv[1] == "enc" else decrypt(sys.argv[2]))
