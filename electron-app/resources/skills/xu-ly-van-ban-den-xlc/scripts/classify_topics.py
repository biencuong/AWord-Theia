#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""classify_topics.py — LLM gán CHỦ ĐỀ (CSDL/CĐS/CKS/Thi cử/Tài chính/...) cho từng văn bản và sinh
cây hồ sơ `HO_SO.md` (gom nhóm theo chủ đề). KHÔNG di chuyển file vật lý (an toàn). Lưu `topics.json`.

Dùng: python scripts/classify_topics.py [--limit N] [--batch 60]
"""
import argparse, json, re, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import fetch_vanban as F
import send_next as S

WORKDIR = F.WORKDIR
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

SYSTEM = (
    "Gán cho MỖI văn bản hành chính một CHỦ ĐỀ ngắn gọn. Ưu tiên dùng các chủ đề: "
    "CSDL (cơ sở dữ liệu), CĐS (chuyển đổi số), CKS (chữ ký số), Thi cử, Tài chính, "
    "Nhân sự-Tổ chức, Pháp chế, Học sinh-Sinh viên, Cơ sở vật chất. Được TẠO chủ đề mới nếu phù hợp "
    "hơn; không thuộc nhóm nào rõ -> 'Khác'. Trả về DUY NHẤT JSON: {\"<số ký hiệu>\":\"<chủ đề>\", ...}."
)


def classify(batch):
    items = [{"so_ky_hieu": x.get("so_ky_hieu"), "trich_yeu": x.get("trich_yeu")} for x in batch]
    raw = S.llm_chat([{"role": "system", "content": SYSTEM},
                      {"role": "user", "content": json.dumps(items, ensure_ascii=False)}], max_tokens=1500)
    m = re.search(r"\{.*\}", raw, re.S)
    return json.loads(m.group(0)) if m else {}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="Số văn bản phân loại (0 = tất cả)")
    ap.add_argument("--batch", type=int, default=60)
    a = ap.parse_args()
    inbox = sorted(json.loads((WORKDIR / "inbox.json").read_text(encoding="utf-8")),
                   key=lambda x: (x.get("thu_tu_uu_tien") or 99999))
    if a.limit:
        inbox = inbox[:a.limit]
    topics = json.loads((WORKDIR / "topics.json").read_text(encoding="utf-8")) \
        if (WORKDIR / "topics.json").exists() else {}
    for i in range(0, len(inbox), a.batch):
        chunk = inbox[i:i + a.batch]
        print(f">>> Phân loại {i+1}-{i+len(chunk)}/{len(inbox)}...")
        try:
            topics.update(classify(chunk))
        except Exception as e:
            print(f"   lỗi batch: {e}")
    (WORKDIR / "topics.json").write_text(json.dumps(topics, ensure_ascii=False, indent=2), encoding="utf-8")

    # Cây hồ sơ gom theo chủ đề
    by_so = {x.get("so_ky_hieu"): x for x in inbox}
    groups = {}
    for so, cat in topics.items():
        groups.setdefault(cat or "Khác", []).append(so)
    L = [f"# CÂY HỒ SƠ THEO CHỦ ĐỀ — {len(topics)} văn bản đã phân loại", ""]
    for cat in sorted(groups, key=lambda c: -len(groups[c])):
        L.append(f"## {cat} ({len(groups[cat])})")
        for so in groups[cat]:
            x = by_so.get(so, {})
            L.append(f"- **{so}** — {(x.get('trich_yeu') or '')[:70]} "
                     f"({x.get('nhan_xu_ly','')}, {x.get('do_khan','')})")
        L.append("")
    (WORKDIR / "HO_SO.md").write_text("\n".join(L), encoding="utf-8")
    print(f">>> Đã lưu topics.json ({len(topics)}) + HO_SO.md ({len(groups)} chủ đề).")


if __name__ == "__main__":
    main()
