#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build_index.py — Sinh CHỈ MỤC (index) cho kho văn bản: thư mục nào có gì, trạng thái
vòng đời (đến -> dự thảo -> đi đã phát hành), và CÒN THIẾU gì.

Nguồn:
  - inbox.json (metadata + vai trò + đường dẫn đính kèm của văn bản ĐẾN).
  - Cây thư mục thực tế: với mỗi văn bản, quét thư mục chứa file để nhận diện:
      * Dự thảo            : tên file chứa '_DuThao'      (quy ước SKILL).
      * Đi đã phát hành    : tên file chứa '_PhatHanh'     (tải về cùng thư mục dự thảo).
      * Còn lại            : file gốc/đính kèm văn bản đến.
  - Thư mục cha (chủ đề: CSDL/CĐS/CKS/...) suy từ ĐƯỜNG DẪN nếu đã sắp xếp, nếu chưa thì
    'Chưa phân loại'.

Xuất:
  - index.json  : máy đọc (đầy đủ trạng thái, thiếu gì).
  - INDEX.md    : người + AI đọc nhanh (bảng theo thư mục cha, tổng hợp còn thiếu).

Quy ước trạng thái:
  moi          -> chỉ có văn bản đến, chưa dự thảo.
  da_du_thao   -> đã có dự thảo, CHƯA thấy văn bản đi đã phát hành.
  da_phat_hanh -> đã có văn bản đi đã phát hành.
Còn thiếu (missing) tính theo vai trò:
  XLC (xử lý chính): cần 'du_thao' rồi 'phat_hanh'. PH (phối hợp): chỉ cảnh báo thiếu bản gốc.

Chạy: python scripts/build_index.py
"""
import json, sys
from datetime import datetime
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

WORKDIR = Path(__file__).resolve().parent.parent
INBOX = WORKDIR / "inbox.json"
ATTACH_DIR = WORKDIR / "attachments"
OUT_JSON = WORKDIR / "index.json"
OUT_MD = WORKDIR / "INDEX.md"

DRAFT_MARK = "duthao"         # khớp lower(): '..._DuThao...' hoặc 'DuThao_...'
PUBLISH_MARK = "phathanh"     # khớp 'PhatHanh_...' (bản đi tải về) hoặc '..._PhatHanh'
ARCHIVE_EXT = {".rar", ".zip"}


def classify_files(folder: Path) -> dict:
    """Phân loại file trong 1 thư mục văn bản thành đến / dự thảo / đi đã phát hành."""
    den, draft, di = [], [], []
    if not folder or not folder.exists():
        return {"den": den, "du_thao": draft, "di_phat_hanh": di}
    for f in sorted(folder.rglob("*")):
        if not f.is_file() or f.suffix.lower() in ARCHIVE_EXT:
            continue
        low = f.name.lower()
        if PUBLISH_MARK in low:
            di.append(f.name)
        elif DRAFT_MARK in low:
            draft.append(f.name)
        else:
            den.append(f.name)
    return {"den": den, "du_thao": draft, "di_phat_hanh": di}


def doc_folder(item: dict) -> Path:
    """Thư mục chứa văn bản: lấy từ đính kèm đầu tiên, nếu không có thì đoán theo số ký hiệu."""
    for a in item.get("attachments", []):
        p = Path(a)
        if p.parent.exists():
            return p.parent
    return None


def parent_category(folder: Path) -> str:
    """Thư mục cha (chủ đề) = phần đầu đường dẫn TƯƠNG ĐỐI so với attachments/.
    Nếu văn bản vẫn nằm thẳng trong attachments/<số> thì coi là 'Chưa phân loại'."""
    if not folder:
        return "Chưa phân loại"
    try:
        rel = folder.resolve().relative_to(ATTACH_DIR.resolve())
    except Exception:
        return "Chưa phân loại"
    parts = rel.parts
    return parts[0] if len(parts) > 1 else "Chưa phân loại"


# Gợi ý hành động dựa trên trích yếu — KHÔNG phải văn bản nào cũng cần dự thảo.
# (Heuristic để LỌC; quyết định cuối cùng vẫn do người xử lý.)
KW_GOPY   = ("góp ý", "xin ý kiến", "cho ý kiến", "tham gia ý kiến", "tham vấn", "lấy ý kiến")
KW_BAOCAO = ("báo cáo", "tổng kết", "kiểm điểm", "sơ kết", "rà soát", "thống kê", "tổng hợp")
KW_THAMMUU = ("tham mưu", "đề xuất", "xây dựng dự thảo", "xây dựng kế hoạch", "xây dựng đề án")
KW_THEODOI = ("thông báo", "kết luận", "sao y", "để biết", "gửi kèm", "đăng tải", "công khai",
              "giấy mời", "mời họp", "lịch công tác", "chương trình công tác")
KW_TRIENKHAI = ("triển khai", "thực hiện", "chỉ đạo", "quán triệt", "phổ biến", "tuyên truyền")


def classify_action(trich_yeu: str, files: dict) -> dict:
    """Trả {de_xuat, can_du_thao}. can_du_thao=True chỉ khi cần TẠO văn bản (góp ý/báo cáo/tham mưu)."""
    if files["di_phat_hanh"]:
        return {"de_xuat": "Đã phát hành", "can_du_thao": False}
    ty = (trich_yeu or "").lower()
    if any(k in ty for k in KW_GOPY):
        return {"de_xuat": "Góp ý — dự thảo phiếu/văn bản ý kiến", "can_du_thao": True}
    if any(k in ty for k in KW_BAOCAO):
        return {"de_xuat": "Dự thảo báo cáo", "can_du_thao": True}
    if any(k in ty for k in KW_THAMMUU):
        return {"de_xuat": "Tham mưu / dự thảo văn bản", "can_du_thao": True}
    if any(k in ty for k in KW_THEODOI):
        return {"de_xuat": "Theo dõi / để biết — KHÔNG cần dự thảo", "can_du_thao": False}
    if any(k in ty for k in KW_TRIENKHAI):
        return {"de_xuat": "Triển khai trong ngành (cân nhắc cần văn bản nội bộ?)", "can_du_thao": False}
    return {"de_xuat": "Cần xem xét", "can_du_thao": False}


def compute_missing(role: str, files: dict, can_du_thao: bool) -> list:
    miss = []
    if not files["den"]:
        miss.append("ban_goc")
    if can_du_thao:                              # chỉ tính thiếu khi văn bản THỰC SỰ cần dự thảo
        if not files["du_thao"]:
            miss.append("du_thao")
        elif (role or "").upper() == "XLC" and not files["di_phat_hanh"]:
            miss.append("phat_hanh")
    return miss


def status_of(files: dict) -> str:
    if files["di_phat_hanh"]:
        return "da_phat_hanh"
    if files["du_thao"]:
        return "da_du_thao"
    return "moi"


def build():
    if not INBOX.exists():
        sys.exit("Chưa có inbox.json — chạy fetch_vanban.py trước.")
    inbox = json.loads(INBOX.read_text(encoding="utf-8"))

    docs, cats = [], {}
    for it in inbox:
        folder = doc_folder(it)
        files = classify_files(folder)
        role = it.get("role_attr_raw") or ("XLC" if it.get("nhan_xu_ly") == "Xử lý chính" else "PH")
        act = classify_action(it.get("trich_yeu", ""), files)
        rec = {
            "so_ky_hieu": it.get("so_ky_hieu", ""),
            "trich_yeu": it.get("trich_yeu", ""),
            "vai_tro": it.get("nhan_xu_ly", ""),
            "han_xu_ly": it.get("han_xu_ly", ""),
            "thu_tu_uu_tien": it.get("thu_tu_uu_tien"),
            "thu_muc_cha": parent_category(folder),
            "thu_muc": str(folder.relative_to(WORKDIR)) if folder else "",
            "files": files,
            "trang_thai": status_of(files),
            "de_xuat": act["de_xuat"],
            "can_du_thao": act["can_du_thao"],
            "con_thieu": compute_missing(role, files, act["can_du_thao"]),
        }
        docs.append(rec)
        cats.setdefault(rec["thu_muc_cha"], []).append(rec)

    summary = {
        "tong": len(docs),
        "theo_trang_thai": {s: sum(1 for d in docs if d["trang_thai"] == s)
                            for s in ("moi", "da_du_thao", "da_phat_hanh")},
        "can_du_thao_chua_lam": [d["so_ky_hieu"] for d in docs
                                 if d["can_du_thao"] and "du_thao" in d["con_thieu"]],
        "khong_can_du_thao": sum(1 for d in docs if not d["can_du_thao"]),
        "theo_de_xuat": {},
        "thieu_du_thao": [d["so_ky_hieu"] for d in docs if "du_thao" in d["con_thieu"]],
        "thieu_phat_hanh": [d["so_ky_hieu"] for d in docs if "phat_hanh" in d["con_thieu"]],
        "thieu_ban_goc": [d["so_ky_hieu"] for d in docs if "ban_goc" in d["con_thieu"]],
    }
    import collections as _c
    summary["theo_de_xuat"] = dict(_c.Counter(d["de_xuat"] for d in docs))
    index = {"cap_nhat_luc": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
             "summary": summary, "documents": docs}
    OUT_JSON.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")

    # --- INDEX.md cho người/AI đọc nhanh ---
    L = [f"# CHỈ MỤC KHO VĂN BẢN — cập nhật {index['cap_nhat_luc']}", ""]
    L.append(f"Tổng: **{summary['tong']}** văn bản · "
             f"mới {summary['theo_trang_thai']['moi']} · "
             f"đã dự thảo {summary['theo_trang_thai']['da_du_thao']} · "
             f"đã phát hành {summary['theo_trang_thai']['da_phat_hanh']}")
    L.append(f"**Cần dự thảo (chưa làm): {len(summary['can_du_thao_chua_lam'])}** · "
             f"không cần dự thảo (theo dõi/để biết...): {summary['khong_can_du_thao']} · "
             f"thiếu bản gốc {len(summary['thieu_ban_goc'])}")
    L.append("")
    L.append("**Phân bố đề xuất hành động:** " +
             " · ".join(f"{k}: {v}" for k, v in sorted(summary["theo_de_xuat"].items(),
                                                        key=lambda kv: -kv[1])))
    L.append("")
    icon = {"moi": "🆕", "da_du_thao": "✍️", "da_phat_hanh": "✅"}
    for cat in sorted(cats):
        recs = sorted(cats[cat], key=lambda d: (d["thu_tu_uu_tien"] or 9999))
        L.append(f"## {cat}  ({len(recs)} văn bản)")
        L.append("| TT-ưu tiên | Số ký hiệu | Trích yếu | Vai trò | Trạng thái | Đề xuất hành động | Còn thiếu |")
        L.append("|-----------|-----------|-----------|---------|-----------|-------------------|-----------|")
        for d in recs:
            st = f"{icon.get(d['trang_thai'],'')} {d['trang_thai']}"
            miss = ", ".join(d["con_thieu"]) or "—"
            ty = (d["trich_yeu"][:50] + "…") if len(d["trich_yeu"]) > 51 else d["trich_yeu"]
            L.append(f"| {d['thu_tu_uu_tien'] or ''} | {d['so_ky_hieu']} | {ty} | "
                     f"{d['vai_tro']} | {st} | {d['de_xuat']} | {miss} |")
        L.append("")
    OUT_MD.write_text("\n".join(L), encoding="utf-8")
    print(f"Đã ghi {OUT_JSON.name} và {OUT_MD.name}: {summary['tong']} văn bản, "
          f"thiếu dự thảo {len(summary['thieu_du_thao'])}, thiếu phát hành {len(summary['thieu_phat_hanh'])}.")


if __name__ == "__main__":
    build()
