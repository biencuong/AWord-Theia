#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build_knowledge.py — Sinh FILE TRI THỨC cho mỗi văn bản, liên kết với nhau.

Mỗi văn bản → tri_thuc/<số ký hiệu>.md gồm: metadata, tóm tắt nội dung, đường dẫn file gốc,
và LIÊN KẾT [[...]] tới: dự thảo, bản đi đã phát hành, văn bản trả lời, và các văn bản khác
được nhắc tới trong nội dung (tham chiếu nội bộ). Hub: tri_thuc/_INDEX.md.

Idempotent: chạy lại cập nhật toàn bộ. Gọi sau mỗi lần fetch để "có văn bản mới là có tri thức".
Chạy: python scripts/build_knowledge.py
"""
import json, re, sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import fetch_vanban as F

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

KN_DIR = F.WORKDIR / "tri_thuc"
INBOX = F.WORKDIR / "inbox.json"
OUTBOX = F.WORKDIR / "outbox.json"
INDEX = F.WORKDIR / "index.json"

# Token kiểu số/ký hiệu văn bản: "2439/BCA-QLHC", "131/QĐ-TTg", "57-NQ/TW"
REF_RE = re.compile(r"\d{1,5}\s*[/-]\s*[0-9A-Za-zĐđ.&/\-]{2,}")


def norm(s: str) -> str:
    return re.sub(r"\s+", "", (s or "")).upper()


def summary_text(it: dict, n=700) -> str:
    t = " ".join(" ".join((e.get("text") or "") for e in it.get("extracted", [])).split())
    return t[:n] if t else "(chưa trích được text — cần đọc file gốc)"


def build():
    if not INBOX.exists():
        sys.exit("Chưa có inbox.json.")
    inbox = json.loads(INBOX.read_text(encoding="utf-8"))
    outbox = json.loads(OUTBOX.read_text(encoding="utf-8")) if OUTBOX.exists() else []
    idx = json.loads(INDEX.read_text(encoding="utf-8")) if INDEX.exists() else {"documents": []}
    idx_by_so = {d["so_ky_hieu"]: d for d in idx.get("documents", [])}

    KN_DIR.mkdir(exist_ok=True)
    # bản đồ tra cứu
    by_so = {x["so_ky_hieu"]: x for x in inbox if x.get("so_ky_hieu")}
    norm_so = {norm(x["so_ky_hieu"]): x["so_ky_hieu"] for x in inbox if x.get("so_ky_hieu")}
    fname = lambda so: F.safe_name(so) + ".md"
    # văn bản đi trả lời theo doc_id đến
    reply_by_docid = {}
    for o in outbox:
        tl = (o.get("congvan_traloi_id") or "").strip()
        if tl and tl != "0":
            reply_by_docid.setdefault(tl, []).append(o)

    made = 0
    for it in inbox:
        so = it.get("so_ky_hieu") or it.get("doc_id")
        if not so:
            continue
        folder = None
        for a in it.get("attachments", []):
            p = Path(a)
            if p.parent.exists():
                folder = p.parent
                break
        files = sorted([p for p in folder.glob("*")] if folder else [], key=lambda p: p.name)
        meta = idx_by_so.get(it.get("so_ky_hieu"), {})

        # --- liên kết ---
        drafts = [p.name for p in files if "duthao" in p.name.lower()]
        published = [p.name for p in files if "phathanh" in p.name.lower()]
        # tham chiếu nội bộ: số ký hiệu văn bản khác xuất hiện trong text
        text = " ".join((e.get("text") or "") for e in it.get("extracted", []))
        refs = set()
        for m in REF_RE.findall(text + " " + it.get("trich_yeu", "")):
            key = norm(m)
            if key in norm_so and norm_so[key] != it.get("so_ky_hieu"):
                refs.add(norm_so[key])
        # văn bản đi trả lời chính văn bản này
        replies = reply_by_docid.get(str(it.get("doc_id")), [])

        L = [f"# {so}", ""]
        L.append(f"- **Trích yếu:** {it.get('trich_yeu','')}")
        L.append(f"- **Vai trò:** {it.get('nhan_xu_ly','')} · **Độ khẩn:** {it.get('do_khan','')} · "
                 f"**Hạn:** {it.get('han_xu_ly') or '—'} · **Ngày đến:** {it.get('ngay_den','')}")
        L.append(f"- **Nơi gửi:** {it.get('noi_gui','')}")
        L.append(f"- **Ưu tiên:** #{it.get('thu_tu_uu_tien','—')} · "
                 f"**Đề xuất:** {meta.get('de_xuat','(chạy build_index để có)')} · "
                 f"**Trạng thái:** {meta.get('trang_thai','')}")
        L.append(f"- **Thư mục file:** `{folder.relative_to(F.WORKDIR) if folder else '(không có)'}`")
        L.append("")
        L.append("## Tóm tắt nội dung")
        L.append(summary_text(it))
        L.append("")
        L.append("## File đính kèm")
        if files:
            for p in files:
                tag = " _(dự thảo)_" if "duthao" in p.name.lower() else \
                      " _(đã phát hành)_" if "phathanh" in p.name.lower() else ""
                L.append(f"- `{p.name}`{tag}")
        else:
            L.append("- (không có file)")
        L.append("")
        L.append("## Liên kết")
        if drafts:
            L.append("- **Dự thảo:** " + ", ".join(f"`{d}`" for d in drafts))
        if published:
            L.append("- **Bản đã phát hành:** " + ", ".join(f"`{d}`" for d in published))
        if replies:
            L.append("- **Văn bản đi trả lời:** " + ", ".join(
                f"{r.get('so_ky_hieu','?')} (đi)" for r in replies))
        if refs:
            L.append("- **Tham chiếu / liên quan:** " +
                     ", ".join(f"[[{F.safe_name(r)}]] ({r})" for r in sorted(refs)))
        if not (drafts or published or replies or refs):
            L.append("- (chưa có liên kết)")
        L.append("")
        L.append(f"<sub>Tạo/cập nhật: {datetime.now().strftime('%Y-%m-%d %H:%M')} · "
                 f"doc_id {it.get('doc_id','')}</sub>")
        (KN_DIR / fname(so)).write_text("\n".join(L), encoding="utf-8")
        made += 1

    # --- HUB _INDEX.md ---
    H = [f"# TRI THỨC VĂN BẢN — {made} văn bản (cập nhật {datetime.now().strftime('%Y-%m-%d %H:%M')})",
         "", "Mỗi mục liên kết tới file tri thức riêng. Sắp theo thứ tự ưu tiên.", ""]
    H.append("| # | Số ký hiệu | Trích yếu | Vai trò | Đề xuất |")
    H.append("|---|-----------|-----------|---------|---------|")
    order = sorted(inbox, key=lambda x: (x.get("thu_tu_uu_tien") or 99999))
    for it in order:
        so = it.get("so_ky_hieu") or it.get("doc_id")
        ty = (it.get("trich_yeu", "")[:55] + "…") if len(it.get("trich_yeu", "")) > 56 else it.get("trich_yeu", "")
        de = idx_by_so.get(it.get("so_ky_hieu"), {}).get("de_xuat", "")
        H.append(f"| {it.get('thu_tu_uu_tien','')} | [{so}]({F.safe_name(so)}.md) | {ty} | "
                 f"{it.get('nhan_xu_ly','')} | {de} |")
    (KN_DIR / "_INDEX.md").write_text("\n".join(H), encoding="utf-8")
    print(f"Đã sinh {made} file tri thức + _INDEX.md trong {KN_DIR.relative_to(F.WORKDIR)}/")


if __name__ == "__main__":
    build()
