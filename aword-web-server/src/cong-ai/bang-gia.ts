// Bảng giá mô hình và cách quy token ra đồng. Giá lưu theo đồng / 1 triệu token (bảng bang_gia).
import type { DatabaseSync } from 'node:sqlite';
import { giaoDich } from '../csdl/csdl.ts';

export type NhaCungCap = 'anthropic' | 'deepseek' | 'openai';

export interface DongBangGia {
    ma: string;
    nha_cung_cap: NhaCungCap;
    mo_hinh_goc: string;
    ten_hien_thi: string;
    gia_vao: number;
    gia_ra: number;
    gia_cache_doc: number;
    gia_cache_ghi: number;
    bat: number;
}

/** Số token của một lượt gọi (vào = không tính phần đọc/ghi bộ nhớ đệm). */
export interface SoToken {
    vao: number;
    ra: number;
    cacheDoc: number;
    cacheGhi: number;
}

export const soTokenRong = (): SoToken => ({ vao: 0, ra: 0, cacheDoc: 0, cacheGhi: 0 });

/** chi_phi_dong = ⌈(vào×giá vào + ra×giá ra + đọc cache×giá đọc cache + ghi cache×giá ghi cache) / 1.000.000⌉. */
export function tinhChiPhi(t: SoToken, g: Pick<DongBangGia, 'gia_vao' | 'gia_ra' | 'gia_cache_doc' | 'gia_cache_ghi'>): number {
    return Math.ceil((t.vao * g.gia_vao + t.ra * g.gia_ra + t.cacheDoc * g.gia_cache_doc + t.cacheGhi * g.gia_cache_ghi) / 1_000_000);
}

// Danh sách mô hình MẪU nạp khi bảng giá còn trống. Tất cả để bat = 0 và giá 0: quản trị hệ thống PHẢI nhập giá thật
// (đồng / 1 triệu token, quy đổi từ bảng giá hiện hành của nhà cung cấp) rồi mới bật — mã nguồn không tự đặt giá.
// - Claude (anthropic): ma trùng tên mô hình Claude Code gửi lên.
// - DeepSeek: tên lấy theo aword-chat (common/cau-hinh-deepseek-protocol.ts). Hậu tố "[1m]" chỉ là đánh dấu phía Claude
//   Code, không gửi lên API (Cổng AI vẫn tra được nếu có).
// - Codex (openai): "gpt-5-codex" là tên GIẢ ĐỊNH lúc viết — quản trị cập nhật ma / mo_hinh_goc theo mô hình Codex mà
//   khóa OpenAI của tổ chức được dùng. Phiên chọn mô hình này bằng ANTHROPIC_MODEL=<ma> hoặc lệnh /model.
const BANG_GIA_MAU: Array<{ ma: string; nha_cung_cap: NhaCungCap; mo_hinh_goc: string; ten_hien_thi: string }> = [
    { ma: 'claude-sonnet-5', nha_cung_cap: 'anthropic', mo_hinh_goc: 'claude-sonnet-5', ten_hien_thi: 'Claude Sonnet 5' },
    { ma: 'claude-opus-5', nha_cung_cap: 'anthropic', mo_hinh_goc: 'claude-opus-5', ten_hien_thi: 'Claude Opus 5' },
    { ma: 'claude-fable-5-1', nha_cung_cap: 'anthropic', mo_hinh_goc: 'claude-fable-5-1', ten_hien_thi: 'Claude Fable 5.1' },
    { ma: 'claude-haiku-4-5-20251001', nha_cung_cap: 'anthropic', mo_hinh_goc: 'claude-haiku-4-5-20251001', ten_hien_thi: 'Claude Haiku 4.5' },
    { ma: 'deepseek-flash', nha_cung_cap: 'deepseek', mo_hinh_goc: 'deepseek-flash', ten_hien_thi: 'DeepSeek Flash' },
    { ma: 'deepseek-v4-pro', nha_cung_cap: 'deepseek', mo_hinh_goc: 'deepseek-v4-pro', ten_hien_thi: 'DeepSeek V4 Pro' },
    { ma: 'gpt-5-codex', nha_cung_cap: 'openai', mo_hinh_goc: 'gpt-5-codex', ten_hien_thi: 'OpenAI GPT-5 Codex' },
];

/** Chèn các dòng mẫu (tắt, giá 0) nếu bảng giá trống; đã có dữ liệu thì không đụng tới. */
export function napBangGiaMacDinh(db: DatabaseSync): void {
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM bang_gia').get() as { n: number };
    if (n > 0) { return; }
    const chen = db.prepare(`INSERT INTO bang_gia (ma, nha_cung_cap, mo_hinh_goc, ten_hien_thi, gia_vao, gia_ra, gia_cache_doc,
        gia_cache_ghi, bat, cap_nhat_luc) VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, ?)`);
    const luc = Date.now();
    giaoDich(db, () => {
        for (const m of BANG_GIA_MAU) { chen.run(m.ma, m.nha_cung_cap, m.mo_hinh_goc, m.ten_hien_thi, luc); }
    });
}
