#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""extract_ocr.py — Lấp 'needs_ocr': đọc PDF scan bằng LLM-VISION cục bộ (render trang -> ảnh ->
LLM đọc), và đọc .doc cũ bằng MS Word COM (nếu có) / báo cần LibreOffice.

KHÔNG cần Tesseract/poppler. Cần: `pip install pymupdf`; LLM cục bộ hỗ trợ ảnh (đã kiểm chứng).
"""
import base64, json, sys, urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import fetch_vanban as F

LLM_CFG = F.WORKDIR / "llm.local.json"
OCR_PROMPT = ("Đây là ảnh MỘT trang văn bản hành chính tiếng Việt (PDF scan). Hãy ĐỌC (OCR) và chép "
              "lại TOÀN BỘ phần chữ, giữ nguyên nội dung & xuống dòng hợp lý. CHỈ trả về text.")


def _llm_vision(png_bytes: bytes, prompt: str = OCR_PROMPT, max_tokens: int = 1600) -> str:
    cfg = json.loads(LLM_CFG.read_text(encoding="utf-8"))
    b64 = base64.b64encode(png_bytes).decode()
    body = {"model": cfg["model"], "max_tokens": max_tokens, "messages": [
        {"role": "user", "content": [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": "data:image/png;base64," + b64}}]}]}
    req = urllib.request.Request(cfg["base_url"].rstrip("/") + "/chat/completions",
                                 data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json",
                                          "Authorization": "Bearer " + cfg["api_key"]})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.load(r)["choices"][0]["message"]["content"]


def ocr_pdf(path, max_pages: int = 5, dpi: int = 120) -> str:
    import fitz
    doc = fitz.open(str(path))
    parts = []
    for i, page in enumerate(doc):
        if i >= max_pages:
            parts.append(f"[... còn {doc.page_count - max_pages} trang chưa OCR ...]")
            break
        png = page.get_pixmap(dpi=dpi).tobytes("png")
        try:
            parts.append(_llm_vision(png))
        except Exception as e:
            parts.append(f"[lỗi OCR trang {i+1}: {e}]")
    return "\n\n".join(parts).strip()


def read_doc(path) -> str:
    """Đọc .doc cũ bằng MS Word COM (Windows). Thiếu Word/pywin32 -> trả ghi chú để cài LibreOffice."""
    try:
        import win32com.client as win32
        word = win32.Dispatch("Word.Application")
        word.Visible = False
        d = word.Documents.Open(str(Path(path).resolve()), ReadOnly=True)
        txt = d.Content.Text
        d.Close(False)
        word.Quit()
        return (txt or "").strip()
    except Exception as e:
        return f"[chưa đọc được .doc — cần MS Word(pywin32) hoặc LibreOffice headless: {e}]"


def extract(path, max_pages: int = 5) -> str:
    s = Path(path).suffix.lower()
    if s == ".pdf":
        return ocr_pdf(path, max_pages)
    if s in (".doc",):
        return read_doc(path)
    if s in (".png", ".jpg", ".jpeg", ".tif", ".tiff"):
        return _llm_vision(Path(path).read_bytes())
    return ""


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("file")
    ap.add_argument("--max-pages", type=int, default=5)
    a = ap.parse_args()
    print(extract(a.file, a.max_pages))
