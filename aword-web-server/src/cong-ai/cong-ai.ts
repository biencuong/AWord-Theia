// Cổng AI: điểm duy nhất phiên AWord Web (Claude Code trong container) gọi mô hình AI. Cổng giữ khóa API của tổ chức,
// xác thực token ngắn hạn của phiên, kiểm tra tài khoản / mô hình / hạn mức tháng, chuyển tiếp tới nhà cung cấp
// (Anthropic, DeepSeek — cùng giao thức; OpenAI — dịch sang Responses API) rồi ghi số token và chi phí vào su_dung_ai.
// Không bao giờ chuyển token phiên, cookie hay header khác của máy khách ra ngoài; không ghi log khóa/token.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DatabaseSync, StatementSync } from 'node:sqlite';
import type { CauHinh } from '../cau-hinh.ts';
import { thangViet } from '../csdl/csdl.ts';
import { bamToken, taoToken } from '../xac-thuc/ma-hoa.ts';
import { soTokenRong, tinhChiPhi, type DongBangGia, type NhaCungCap, type SoToken } from './bang-gia.ts';
import { dichLoiOpenAi, dichPhanHoiResponses, dichYeuCauSangResponses, taoBoDichLuongResponses } from './dich-openai.ts';
import { dongSse, taoBoTachSse, type SuKienSse } from './sse.ts';
import {
    dinhDangTien, docHetPhanHoi, docThanYeuCau, ghiDoan, guiJson, guiLoi, laDoiTuong, LoiThanQuaLon, ngayViet, noiDuongDan,
    soKhongAm, thangHienThi, type DoiTuong,
} from './tien-ich.ts';

export { napBangGiaMacDinh } from './bang-gia.ts';

export interface TuyChonCongAi {
    db: DatabaseSync;
    cauHinh: CauHinh;
    /** Thay fetch toàn cục (kiểm thử, proxy ra ngoài). */
    fetchFn?: typeof fetch;
    bayGio?: () => number;
    /** Giới hạn thân yêu cầu (byte), mặc định 32 MB. */
    gioiHanThanByte?: number;
    /** Yêu cầu streaming: chờ nhà cung cấp trả phản hồi đầu tiên tối đa bấy nhiêu ms, mặc định 120 giây. */
    hanGioByteDauMs?: number;
    /** Hạn giờ tổng của một lượt gọi (cả thời gian stream), mặc định 15 phút. */
    hanGioTongMs?: number;
}

export interface CongAi {
    /** true nếu đường dẫn thuộc /ai/* (đã trả lời). */
    xuLy(req: IncomingMessage, res: ServerResponse): Promise<boolean>;
    /** Cấp token Cổng AI cho phiên (chỉ lưu băm), trả token rõ để đưa vào môi trường phiên. */
    capToken(taiKhoanId: number, soGio: number): string;
    /** Thu hồi mọi token của tài khoản (đăng xuất, đổi mật khẩu, khóa tài khoản). */
    thuHoiToken(taiKhoanId: number): void;
    /** Tổng chi_phi_dong của tài khoản trong tháng ('YYYY-MM' theo giờ Việt Nam, mặc định tháng hiện tại). */
    daDungThang(taiKhoanId: number, thang?: string): number;
}

interface DongTaiKhoan {
    id: number;
    don_vi_id: number | null;
    trang_thai: string;
    han_dung: number | null;
    han_muc_thang_dong: number | null;
}

interface LuotGoi {
    taiKhoanId: number;
    donViId: number | null;
    luc: number;
    gia: DongBangGia;
    soToken: SoToken;
    daGhi: boolean;
}

type LyDoDung = 'huy' | 'het_gio_byte_dau' | 'het_gio_tong';

interface DieuKhienLuot {
    tinHieu: AbortSignal;
    lyDo(): LyDoDung | undefined;
    daCoPhanHoi(): void;
    donDep(): void;
}

const MB = 1024 * 1024;
const GIOI_HAN_THAN_LOI = 1 * MB;
const GIOI_HAN_THAN_JSON = 32 * MB;
const KHOA_API_BIEN: Record<NhaCungCap, string> = {
    anthropic: 'AWORD_KHOA_ANTHROPIC', deepseek: 'AWORD_KHOA_DEEPSEEK', openai: 'AWORD_KHOA_OPENAI',
};
const TEN_NHA_CUNG_CAP: Record<NhaCungCap, string> = { anthropic: 'Anthropic', deepseek: 'DeepSeek', openai: 'OpenAI' };
// Header phản hồi của nhà cung cấp được phép chuyển về máy khách (không set-cookie, không hop-by-hop, không
// content-length/content-encoding vì fetch đã giải nén và Cổng ghi lại theo từng đoạn).
const HEADER_TRA_VE = ['content-type', 'request-id', 'retry-after', 'x-should-retry'];

export function taoCongAi(tuy: TuyChonCongAi): CongAi {
    const { db, cauHinh } = tuy;
    const fetchFn = tuy.fetchFn ?? fetch;
    const bayGio = tuy.bayGio ?? Date.now;
    const gioiHanThan = tuy.gioiHanThanByte ?? 32 * MB;
    const hanGioByteDau = tuy.hanGioByteDauMs ?? 120_000;
    const hanGioTong = tuy.hanGioTongMs ?? 15 * 60_000;

    const lenh = {
        chenToken: db.prepare('INSERT INTO token_ai (token_bam, tai_khoan_id, tao_luc, het_han) VALUES (?, ?, ?, ?)'),
        donTokenCu: db.prepare('DELETE FROM token_ai WHERE tai_khoan_id = ? AND het_han < ?'),
        thuHoi: db.prepare('UPDATE token_ai SET thu_hoi = 1 WHERE tai_khoan_id = ?'),
        timToken: db.prepare('SELECT tai_khoan_id, het_han, thu_hoi FROM token_ai WHERE token_bam = ?'),
        taiKhoan: db.prepare('SELECT id, don_vi_id, trang_thai, han_dung, han_muc_thang_dong FROM tai_khoan WHERE id = ?'),
        moHinh: db.prepare(`SELECT ma, nha_cung_cap, mo_hinh_goc, ten_hien_thi, gia_vao, gia_ra, gia_cache_doc, gia_cache_ghi, bat
            FROM bang_gia WHERE ma = ?`),
        moHinhDangBat: db.prepare('SELECT ma FROM bang_gia WHERE bat = 1 ORDER BY ma'),
        daDung: db.prepare('SELECT COALESCE(SUM(chi_phi_dong), 0) AS tong FROM su_dung_ai WHERE tai_khoan_id = ? AND thang = ?'),
        ghiSuDung: db.prepare(`INSERT INTO su_dung_ai (tai_khoan_id, don_vi_id, luc, thang, mo_hinh, nha_cung_cap, token_vao, token_ra,
            token_cache_doc, token_cache_ghi, chi_phi_dong, trang_thai, ma_loi) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    } satisfies Record<string, StatementSync>;

    // ───────── Quản lý token và hạn mức ─────────

    function capToken(taiKhoanId: number, soGio: number): string {
        if (!Number.isFinite(soGio) || soGio <= 0) { throw new Error('Số giờ hiệu lực của token Cổng AI phải lớn hơn 0.'); }
        const token = taoToken();
        const luc = bayGio();
        // Dọn token đã hết hạn quá 1 ngày của tài khoản này để bảng không phình dần.
        lenh.donTokenCu.run(taiKhoanId, luc - 24 * 3600_000);
        lenh.chenToken.run(bamToken(token), taiKhoanId, luc, luc + Math.round(soGio * 3600_000));
        return token;
    }

    function thuHoiToken(taiKhoanId: number): void {
        lenh.thuHoi.run(taiKhoanId);
    }

    function daDungThang(taiKhoanId: number, thang: string = thangViet(bayGio())): number {
        return Number((lenh.daDung.get(taiKhoanId, thang) as { tong: number }).tong);
    }

    // ───────── Kiểm tra theo thứ tự: token → tài khoản → (thân) → mô hình → hạn mức ─────────

    /** Các token máy khách gửi: x-api-key và/hoặc Authorization: Bearer. */
    function cacTokenGuiLen(req: IncomingMessage): string[] {
        const kq: string[] = [];
        const khoa = req.headers['x-api-key'];
        if (typeof khoa === 'string' && khoa.trim()) { kq.push(khoa.trim()); }
        const auth = req.headers.authorization;
        const m = typeof auth === 'string' ? /^Bearer\s+(\S+)\s*$/i.exec(auth) : null;
        if (m && !kq.includes(m[1])) { kq.push(m[1]); }
        return kq;
    }

    function kiemToken(req: IncomingMessage, luc: number): { taiKhoanId: number } | { loi: string } {
        const cacToken = cacTokenGuiLen(req);
        if (cacToken.length === 0) {
            return { loi: 'Thiếu token Cổng AI (header Authorization: Bearer hoặc x-api-key). Tải lại trang AWord Web để phiên được cấp token mới.' };
        }
        let loi = 'Token Cổng AI không hợp lệ. Đăng xuất rồi đăng nhập lại AWord Web để phiên được cấp token mới.';
        for (const token of cacToken) {
            const dong = lenh.timToken.get(bamToken(token)) as { tai_khoan_id: number; het_han: number; thu_hoi: number } | undefined;
            if (!dong) { continue; }
            if (dong.thu_hoi) {
                loi = 'Token Cổng AI đã bị thu hồi (đã đăng xuất, đổi mật khẩu hoặc quản trị thu hồi). Đăng nhập lại AWord Web để tiếp tục.';
                continue;
            }
            if (dong.het_han <= luc) {
                loi = 'Token Cổng AI đã hết hạn. Tải lại trang hoặc đăng nhập lại AWord Web để được cấp token mới.';
                continue;
            }
            return { taiKhoanId: dong.tai_khoan_id };
        }
        return { loi };
    }

    function loiTaiKhoan(tk: DongTaiKhoan, luc: number): string | undefined {
        switch (tk.trang_thai) {
            case 'hoat_dong': break;
            case 'khoa': return 'Tài khoản đang bị khóa nên không dùng được AI. Liên hệ quản trị đơn vị để mở khóa.';
            case 'chi_doc': return 'Tài khoản đang ở chế độ chỉ đọc (thuê bao đã hết hạn) nên không dùng được AI. Liên hệ quản trị đơn vị để gia hạn.';
            case 'luu_tru': return 'Tài khoản đã chuyển lưu trữ nên không dùng được AI. Liên hệ quản trị đơn vị nếu cần khôi phục.';
            default: return 'Tài khoản không ở trạng thái hoạt động nên không dùng được AI. Liên hệ quản trị đơn vị.';
        }
        if (tk.han_dung !== null && tk.han_dung <= luc) {
            return `Thuê bao của tài khoản đã hết hạn từ ngày ${ngayViet(tk.han_dung)} nên không dùng được AI. Liên hệ quản trị đơn vị để gia hạn.`;
        }
        return undefined;
    }

    function timMoHinh(ma: string): DongBangGia | undefined {
        const dong = lenh.moHinh.get(ma) as DongBangGia | undefined;
        if (dong) { return dong; }
        // Phòng khi máy khách giữ nguyên hậu tố đánh dấu ngữ cảnh 1 triệu token.
        const boHauTo = ma.replace(/\[1m\]$/i, '');
        return boHauTo !== ma ? lenh.moHinh.get(boHauTo) as DongBangGia | undefined : undefined;
    }

    function loiMoHinh(ma: string, gia: DongBangGia | undefined): string {
        const ten = ma.length > 100 ? `${ma.slice(0, 100)}…` : ma;
        const dauCau = gia
            ? `Mô hình "${ten}" (${gia.ten_hien_thi}) đang tắt trên Cổng AI nên không được phép dùng.`
            : `Mô hình "${ten}" không được phép dùng qua Cổng AI (chưa có trong bảng giá của hệ thống).`;
        const dsBat = (lenh.moHinhDangBat.all() as Array<{ ma: string }>).map(r => r.ma);
        return dsBat.length > 0
            ? `${dauCau} Các mô hình đang được phép: ${dsBat.join(', ')} — chọn lại bằng lệnh /model, hoặc liên hệ quản trị hệ thống.`
            : `${dauCau} Hiện chưa có mô hình nào được bật — liên hệ quản trị hệ thống.`;
    }

    /**
     * Nhà cung cấp từ chối KHÓA CỦA TỔ CHỨC (401/403): lỗi phía hệ thống, không phải của người dùng. Chuyển nguyên trạng thì
     * Claude Code hiểu nhầm là token của phiên hỏng và gợi ý /login — nên trả 503 với thông điệp tiếng Việt cho quản trị.
     */
    function loiKhoaToChuc(res: ServerResponse, status: number, ncc: NhaCungCap): boolean {
        if (status !== 401 && status !== 403) { return false; }
        guiLoi(res, 503, 'api_error', `Khóa AI của tổ chức cho ${TEN_NHA_CUNG_CAP[ncc]} không hợp lệ hoặc không đủ quyền (mã ${status}). `
            + 'Đây là lỗi cấu hình máy chủ, không phải do tài khoản của bạn — hãy báo quản trị hệ thống kiểm tra khóa AI.');
        return true;
    }

    // ───────── Ghi sử dụng ─────────

    function ghiSuDung(luot: LuotGoi, trangThai: 'xong' | 'loi' | 'huy', maLoi?: string): void {
        if (luot.daGhi) { return; }
        luot.daGhi = true;
        const t = luot.soToken;
        lenh.ghiSuDung.run(luot.taiKhoanId, luot.donViId, luot.luc, thangViet(luot.luc), luot.gia.ma, luot.gia.nha_cung_cap,
            t.vao, t.ra, t.cacheDoc, t.cacheGhi, tinhChiPhi(t, luot.gia), trangThai, maLoi ?? null);
    }

    // ───────── Hủy / hạn giờ ─────────

    /** AbortController dùng chung cho một lượt: máy khách ngắt kết nối, quá hạn chờ byte đầu, quá hạn tổng. */
    function taoDieuKhien(res: ServerResponse, choByteDau: number | undefined, tong: number): DieuKhienLuot {
        const boHuy = new AbortController();
        let lyDo: LyDoDung | undefined;
        const dung = (l: LyDoDung) => {
            if (lyDo) { return; }
            lyDo = l;
            boHuy.abort();
        };
        const khiDong = () => { if (!res.writableFinished) { dung('huy'); } };
        res.on('close', khiDong);
        const henTong = setTimeout(() => dung('het_gio_tong'), tong);
        henTong.unref();
        let henDau: NodeJS.Timeout | undefined;
        if (choByteDau !== undefined) {
            henDau = setTimeout(() => dung('het_gio_byte_dau'), choByteDau);
            henDau.unref();
        }
        return {
            tinHieu: boHuy.signal,
            lyDo: () => lyDo,
            daCoPhanHoi: () => clearTimeout(henDau),
            donDep: () => {
                clearTimeout(henTong);
                clearTimeout(henDau);
                res.off('close', khiDong);
            },
        };
    }

    /** Lượt gọi bị gián đoạn (hủy, hết giờ, lỗi mạng): ghi sử dụng với phần token đã biết và báo máy khách nếu còn kịp. */
    function xuLyGianDoan(res: ServerResponse, luot: LuotGoi, dk: DieuKhienLuot, e: unknown, laLuongSse: boolean): void {
        const lyDo = dk.lyDo();
        const ncc = TEN_NHA_CUNG_CAP[luot.gia.nha_cung_cap];
        if (lyDo === 'huy') {
            ghiSuDung(luot, 'huy', 'may_khach_ngat');
            if (!res.writableEnded) { res.destroy(); }
            return;
        }
        let thongDiep: string;
        let maLoi: string;
        if (lyDo === 'het_gio_byte_dau') {
            thongDiep = `${ncc} không phản hồi sau ${Math.round(hanGioByteDau / 1000)} giây — nhà cung cấp có thể đang quá tải, hãy thử lại sau.`;
            maLoi = lyDo;
        } else if (lyDo === 'het_gio_tong') {
            thongDiep = `Lượt gọi AI vượt quá ${Math.round(hanGioTong / 60_000)} phút nên Cổng AI đã dừng — hãy chia nhỏ yêu cầu rồi thử lại.`;
            maLoi = lyDo;
        } else {
            const nguyenNhan = laDoiTuong((e as { cause?: unknown })?.cause) ? (e as { cause: DoiTuong }).cause.code : undefined;
            thongDiep = `Cổng AI mất kết nối tới ${ncc} — kiểm tra mạng của máy chủ hoặc thử lại sau.`;
            maLoi = typeof nguyenNhan === 'string' ? `ket_noi:${nguyenNhan}` : 'ket_noi';
        }
        ghiSuDung(luot, 'loi', maLoi);
        if (!res.headersSent) {
            guiLoi(res, lyDo ? 504 : 502, 'api_error', thongDiep, { choThuLai: true });
        } else if (laLuongSse && !res.writableEnded) {
            res.end(dongSse('error', { type: 'error', error: { type: 'api_error', message: thongDiep } }));
        } else if (!res.writableEnded) {
            res.destroy();
        }
    }

    // ───────── Anthropic / DeepSeek: chuyển tiếp nguyên giao thức ─────────

    function headerLenKieuAnthropic(req: IncomingMessage, ncc: NhaCungCap, khoa: string): Record<string, string> {
        const lay = (ten: string): string | undefined => {
            const v = req.headers[ten];
            return Array.isArray(v) ? v.join(', ') : v;
        };
        const h: Record<string, string> = {
            'content-type': 'application/json',
            'anthropic-version': lay('anthropic-version') ?? '2023-06-01',
            'user-agent': 'AWord-CongAi',
            'x-api-key': khoa,
        };
        const beta = lay('anthropic-beta');
        if (beta) { h['anthropic-beta'] = beta; }
        const accept = lay('accept');
        if (accept) { h.accept = accept; }
        // Cổng tương thích Anthropic của DeepSeek nhận khóa ở cả hai header (AWord bản máy dùng Authorization) — đây là
        // khóa của tổ chức, không phải token phiên.
        if (ncc === 'deepseek') { h.authorization = `Bearer ${khoa}`; }
        return h;
    }

    function headerTraVe(nguon: Headers, laSse: boolean): Record<string, string> {
        const h: Record<string, string> = {};
        for (const ten of HEADER_TRA_VE) {
            const v = nguon.get(ten);
            if (v) { h[ten] = v; }
        }
        if (laSse) {
            h['cache-control'] = 'no-cache';
            h['x-accel-buffering'] = 'no'; // proxy phía trước (nginx) không được đệm luồng
        }
        return h;
    }

    /** Lấy usage từ sự kiện SSE Anthropic. Số token trong message_delta là cộng dồn → giữ giá trị lớn nhất (= cuối). */
    function napUsageAnthropic(t: SoToken, u: unknown): void {
        if (!laDoiTuong(u)) { return; }
        const vao = soKhongAm(u.input_tokens);
        const ra = soKhongAm(u.output_tokens);
        const doc = soKhongAm(u.cache_read_input_tokens);
        const ghi = soKhongAm(u.cache_creation_input_tokens);
        if (vao !== undefined) { t.vao = Math.max(t.vao, vao); }
        if (ra !== undefined) { t.ra = Math.max(t.ra, ra); }
        if (doc !== undefined) { t.cacheDoc = Math.max(t.cacheDoc, doc); }
        if (ghi !== undefined) { t.cacheGhi = Math.max(t.cacheGhi, ghi); }
    }

    async function chuyenTiepKieuAnthropic(req: IncomingMessage, res: ServerResponse, timKiem: string, yc: DoiTuong,
        luot: LuotGoi, khoa: string): Promise<void> {
        const ncc = luot.gia.nha_cung_cap;
        const laStream = yc.stream === true;
        const dk = taoDieuKhien(res, laStream ? hanGioByteDau : undefined, hanGioTong);
        let laLuongSse = false;
        try {
            const phanHoi = await fetchFn(noiDuongDan(cauHinh.diaChiAi[ncc], '/v1/messages') + timKiem, {
                method: 'POST',
                headers: headerLenKieuAnthropic(req, ncc, khoa),
                body: JSON.stringify({ ...yc, model: luot.gia.mo_hinh_goc }),
                signal: dk.tinHieu,
            });
            dk.daCoPhanHoi();

            if (!phanHoi.ok) {
                // Lỗi của nhà cung cấp: chuyển về nguyên trạng (mã HTTP + thân) — trừ lỗi khóa tổ chức (xem loiKhoaToChuc).
                const than = await docHetPhanHoi(phanHoi, GIOI_HAN_THAN_LOI);
                let loaiLoi = '';
                try {
                    const v: unknown = JSON.parse(than.toString('utf8'));
                    if (laDoiTuong(v) && laDoiTuong(v.error) && typeof v.error.type === 'string') { loaiLoi = `:${v.error.type}`; }
                } catch { /* thân không phải JSON */ }
                if (loiKhoaToChuc(res, phanHoi.status, ncc)) {
                    ghiSuDung(luot, 'loi', `khoa_to_chuc_${phanHoi.status}${loaiLoi}`);
                    return;
                }
                res.writeHead(phanHoi.status, headerTraVe(phanHoi.headers, false));
                res.end(than);
                ghiSuDung(luot, 'loi', `http_${phanHoi.status}${loaiLoi}`);
                return;
            }

            laLuongSse = (phanHoi.headers.get('content-type') ?? '').includes('text/event-stream');
            res.writeHead(phanHoi.status, headerTraVe(phanHoi.headers, laLuongSse));
            res.flushHeaders();

            let coMessageStop = false;
            let loiTrongLuong: string | undefined;
            const giaiMa = new TextDecoder();
            const boTach = taoBoTachSse((sk: SuKienSse) => {
                if (sk.event !== 'message' && sk.event !== 'message_start' && sk.event !== 'message_delta'
                    && sk.event !== 'message_stop' && sk.event !== 'error') { return; } // bỏ qua content_block_* cho nhẹ
                let d: unknown;
                try { d = JSON.parse(sk.data); } catch { return; }
                if (!laDoiTuong(d)) { return; }
                if (d.type === 'message_start' && laDoiTuong(d.message)) { napUsageAnthropic(luot.soToken, d.message.usage); }
                if (d.type === 'message_delta') { napUsageAnthropic(luot.soToken, d.usage); }
                if (d.type === 'message_stop') { coMessageStop = true; }
                if (d.type === 'error') { loiTrongLuong = laDoiTuong(d.error) && typeof d.error.type === 'string' ? d.error.type : 'error'; }
            });
            const cacDoanJson: Uint8Array[] = [];
            let coJson = 0;
            // Thân phản hồi vượt trần thì ta vẫn chuyển tiếp cho máy khách nhưng KHÔNG còn đọc được usage.
            // Đánh dấu để lát nữa ghi nhận là lượt lỗi — bản cũ rơi vào JSON.parse hỏng, catch nuốt im lặng,
            // rồi ghi 'xong' với 0 token: lượt đó biến mất khỏi mọi báo cáo chi phí và không bao giờ tính
            // vào hạn mức tháng, dù tiền đã chi thật.
            let thanBiCat = false;

            if (phanHoi.body) {
                const docGia = phanHoi.body.getReader();
                for (;;) {
                    const { done, value } = await docGia.read();
                    if (done) { break; }
                    if (laLuongSse) {
                        boTach.nap(giaiMa.decode(value, { stream: true }));
                    } else if (coJson < GIOI_HAN_THAN_JSON) {
                        cacDoanJson.push(value);
                        coJson += value.length;
                    } else {
                        thanBiCat = true;
                    }
                    await ghiDoan(res, value, dk.tinHieu); // chuyển nguyên từng đoạn, không đệm cả phản hồi
                }
            }
            if (dk.lyDo() === 'huy') { throw new Error('Máy khách đã ngắt kết nối.'); }
            res.end();

            if (laLuongSse) {
                boTach.nap(giaiMa.decode());
                boTach.ketThuc();
                if (loiTrongLuong) {
                    ghiSuDung(luot, 'loi', `luong:${loiTrongLuong}`);
                } else {
                    ghiSuDung(luot, coMessageStop ? 'xong' : 'loi', coMessageStop ? undefined : 'luong_ket_thuc_som');
                }
            } else {
                try {
                    const v: unknown = JSON.parse(Buffer.concat(cacDoanJson).toString('utf8'));
                    if (laDoiTuong(v)) { napUsageAnthropic(luot.soToken, v.usage); }
                } catch { /* không đọc được usage: ghi 0 token */ }
                // Không đọc được usage vì thân quá lớn thì ghi 'loi' kèm mã lý do, để lượt đó còn dấu vết
                // trong sổ chi phí thay vì hiện ra như một lượt thành công tốn 0 đồng.
                ghiSuDung(luot, thanBiCat ? 'loi' : 'xong', thanBiCat ? 'than_qua_lon_khong_doc_duoc_usage' : undefined);
            }
        } catch (e) {
            xuLyGianDoan(res, luot, dk, e, laLuongSse);
        } finally {
            dk.donDep();
        }
    }

    // ───────── OpenAI: dịch sang Responses API ─────────

    async function chuyenTiepOpenAi(res: ServerResponse, yc: DoiTuong, luot: LuotGoi, khoa: string): Promise<void> {
        const laStream = yc.stream === true;
        const maMoHinh = String(yc.model);
        const dk = taoDieuKhien(res, laStream ? hanGioByteDau : undefined, hanGioTong);
        let daMoLuong = false;
        try {
            const phanHoi = await fetchFn(noiDuongDan(cauHinh.diaChiAi.openai, '/v1/responses'), {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    accept: laStream ? 'text/event-stream' : 'application/json',
                    authorization: `Bearer ${khoa}`,
                    'user-agent': 'AWord-CongAi',
                },
                body: JSON.stringify(dichYeuCauSangResponses(yc, luot.gia.mo_hinh_goc)),
                signal: dk.tinHieu,
            });
            dk.daCoPhanHoi();

            if (!phanHoi.ok) {
                const loi = dichLoiOpenAi(phanHoi.status, (await docHetPhanHoi(phanHoi, GIOI_HAN_THAN_LOI)).toString('utf8'));
                if (loiKhoaToChuc(res, phanHoi.status, 'openai')) {
                    ghiSuDung(luot, 'loi', `khoa_to_chuc_${phanHoi.status}${loi.ma ? `:${loi.ma}` : ''}`);
                    return;
                }
                const header: Record<string, string> = {};
                const thuLaiSau = phanHoi.headers.get('retry-after');
                if (thuLaiSau) { header['retry-after'] = thuLaiSau; }
                guiJson(res, phanHoi.status, { type: 'error', error: { type: loi.type, message: loi.message } }, header);
                ghiSuDung(luot, 'loi', `http_${phanHoi.status}${loi.ma ? `:${loi.ma}` : ''}`);
                return;
            }

            if (!laStream) {
                let v: unknown;
                try {
                    v = JSON.parse((await docHetPhanHoi(phanHoi, GIOI_HAN_THAN_JSON)).toString('utf8'));
                } catch (e) {
                    if (dk.lyDo()) { throw e; }
                    guiLoi(res, 502, 'api_error', 'Phản hồi của OpenAI không đọc được (không phải JSON) — hãy thử lại.', { choThuLai: true });
                    ghiSuDung(luot, 'loi', 'dinh_dang');
                    return;
                }
                const kq = dichPhanHoiResponses(v, maMoHinh);
                Object.assign(luot.soToken, kq.soToken);
                if (kq.loi) {
                    guiLoi(res, 502, kq.loi.type, kq.loi.message, { choThuLai: true });
                    ghiSuDung(luot, 'loi', kq.loi.ma);
                } else {
                    guiJson(res, 200, kq.tinNhan);
                    ghiSuDung(luot, 'xong');
                }
                return;
            }

            res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', 'x-accel-buffering': 'no' });
            res.flushHeaders();
            daMoLuong = true;
            const boDich = taoBoDichLuongResponses(maMoHinh, luot.soToken);
            let cho = '';
            const boTach = taoBoTachSse((sk: SuKienSse) => {
                try { cho += boDich.nap(JSON.parse(sk.data)); } catch { /* dòng data không phải JSON: bỏ qua */ }
            });
            const giaiMa = new TextDecoder();
            if (phanHoi.body) {
                const docGia = phanHoi.body.getReader();
                for (;;) {
                    const { done, value } = await docGia.read();
                    if (done) { break; }
                    boTach.nap(giaiMa.decode(value, { stream: true }));
                    if (cho) {
                        const doan = cho;
                        cho = '';
                        await ghiDoan(res, doan, dk.tinHieu);
                    }
                }
            }
            if (dk.lyDo() === 'huy') { throw new Error('Máy khách đã ngắt kết nối.'); }
            boTach.nap(giaiMa.decode());
            boTach.ketThuc();
            cho += boDich.ketThuc();
            res.end(cho);
            ghiSuDung(luot, boDich.trangThai === 'xong' ? 'xong' : 'loi', boDich.maLoi);
        } catch (e) {
            xuLyGianDoan(res, luot, dk, e, daMoLuong);
        } finally {
            dk.donDep();
        }
    }

    // ───────── count_tokens ─────────

    /** Ước lượng thô cho nhà cung cấp không có API đếm token: ⌈số ký tự (system + messages + tools, dạng JSON, bỏ dữ liệu base64) / 3⌉. */
    function uocLuongTokenVao(yc: DoiTuong): number {
        const chuoi = JSON.stringify({ system: yc.system, messages: yc.messages, tools: yc.tools },
            (_k, v: unknown) => (laDoiTuong(v) && v.type === 'base64' && typeof v.data === 'string' ? { ...v, data: '' } : v));
        return Math.ceil(chuoi.length / 3);
    }

    async function demToken(req: IncomingMessage, res: ServerResponse, timKiem: string, yc: DoiTuong, gia: DongBangGia): Promise<void> {
        if (gia.nha_cung_cap !== 'anthropic') {
            guiJson(res, 200, { input_tokens: uocLuongTokenVao(yc) });
            return;
        }
        const khoa = cauHinh.khoaAi.anthropic;
        if (!khoa) { guiLoiThieuKhoa(res, gia); return; }
        // Đếm token là lượt gọi KHÔNG stream, cùng loại với hai đường messages: tổng hạn là hanGioTong
        // (15 phút), không phải hạn chờ byte đầu (120 giây). Bản cũ truyền nhầm hanGioByteDau vào ô hạn
        // tổng, nên đếm token cho một hội thoại lớn bị cắt ở 120 giây và trả 504 — đúng những lượt lớn
        // nhất, là những lượt cần đếm nhất.
        const dk = taoDieuKhien(res, undefined, hanGioTong);
        try {
            const phanHoi = await fetchFn(noiDuongDan(cauHinh.diaChiAi.anthropic, '/v1/messages/count_tokens') + timKiem, {
                method: 'POST',
                headers: headerLenKieuAnthropic(req, 'anthropic', khoa),
                body: JSON.stringify({ ...yc, model: gia.mo_hinh_goc }),
                signal: dk.tinHieu,
            });
            const than = await docHetPhanHoi(phanHoi, GIOI_HAN_THAN_LOI);
            res.writeHead(phanHoi.status, headerTraVe(phanHoi.headers, false));
            res.end(than);
        } catch {
            if (dk.lyDo() === 'huy') { if (!res.writableEnded) { res.destroy(); } return; }
            guiLoi(res, dk.lyDo() ? 504 : 502, 'api_error', 'Cổng AI không đếm được token qua Anthropic (mất kết nối hoặc quá hạn giờ) — hãy thử lại sau.', { choThuLai: true });
        } finally {
            dk.donDep();
        }
    }

    function guiLoiThieuKhoa(res: ServerResponse, gia: DongBangGia): void {
        const ncc = gia.nha_cung_cap;
        guiLoi(res, 503, 'api_error', `Cổng AI chưa được cấu hình khóa API ${TEN_NHA_CUNG_CAP[ncc]} (biến môi trường ${KHOA_API_BIEN[ncc]}) `
            + `nên chưa gọi được mô hình ${gia.ma}. Báo quản trị hệ thống bổ sung khóa, hoặc chọn mô hình của nhà cung cấp khác.`);
    }

    // ───────── Bộ xử lý HTTP ─────────

    async function xuLyYeuCau(req: IncomingMessage, res: ServerResponse, duongDan: string, timKiem: string): Promise<void> {
        const tuyen = duongDan === '/ai/v1/messages' ? 'messages' : duongDan === '/ai/v1/messages/count_tokens' ? 'count_tokens' : undefined;
        if (!tuyen) {
            guiLoi(res, 404, 'not_found_error', `Cổng AI không có đường dẫn ${duongDan.slice(0, 200)} — chỉ hỗ trợ POST /ai/v1/messages và POST /ai/v1/messages/count_tokens.`);
            return;
        }
        if (req.method !== 'POST') {
            guiLoi(res, 405, 'invalid_request_error', `Đường dẫn ${duongDan} chỉ nhận phương thức POST.`, { header: { allow: 'POST' } });
            return;
        }

        const luc = bayGio();
        const xacThuc = kiemToken(req, luc);
        if ('loi' in xacThuc) { guiLoi(res, 401, 'authentication_error', xacThuc.loi); return; }
        const tk = lenh.taiKhoan.get(xacThuc.taiKhoanId) as DongTaiKhoan | undefined;
        if (!tk) { guiLoi(res, 401, 'authentication_error', 'Tài khoản gắn với token Cổng AI không còn tồn tại. Liên hệ quản trị đơn vị.'); return; }
        // Từ chối theo CHÍNH SÁCH (tài khoản, mô hình, hạn mức) trả 400: Claude Code coi 401/403 là lỗi đăng nhập ("Failed to
        // authenticate" + màn hình đăng nhập tài khoản Claude — kiểm chứng 15/9/2026), còn 429/5xx thì tự thử lại vô ích.
        const loiTk = loiTaiKhoan(tk, luc);
        if (loiTk) { guiLoi(res, 400, 'invalid_request_error', loiTk); return; }

        let than: Buffer;
        try {
            than = await docThanYeuCau(req, gioiHanThan);
        } catch (e) {
            if (e instanceof LoiThanQuaLon) {
                guiLoi(res, 413, 'invalid_request_error', `Yêu cầu quá lớn (vượt ${Math.round(e.gioiHan / MB)} MB) — bớt tệp/ảnh đính kèm hoặc dùng /compact để thu gọn hội thoại.`,
                    { header: { connection: 'close' } });
            }
            return; // máy khách đã ngắt khi đang gửi: không còn ai để trả lời
        }
        let yc: unknown;
        try {
            yc = JSON.parse(than.toString('utf8'));
        } catch {
            guiLoi(res, 400, 'invalid_request_error', 'Thân yêu cầu không phải JSON hợp lệ.');
            return;
        }
        if (!laDoiTuong(yc)) { guiLoi(res, 400, 'invalid_request_error', 'Thân yêu cầu phải là một đối tượng JSON.'); return; }
        if (typeof yc.model !== 'string' || yc.model === '') { guiLoi(res, 400, 'invalid_request_error', 'Thiếu trường "model" trong yêu cầu.'); return; }
        if (!Array.isArray(yc.messages)) { guiLoi(res, 400, 'invalid_request_error', 'Thiếu trường "messages" (mảng tin nhắn) trong yêu cầu.'); return; }

        const gia = timMoHinh(yc.model);
        if (!gia || gia.bat !== 1) { guiLoi(res, 400, 'invalid_request_error', loiMoHinh(yc.model, gia)); return; }

        // Đếm token miễn phí → không chặn theo hạn mức, không ghi sử dụng.
        if (tuyen === 'count_tokens') { await demToken(req, res, timKiem, yc, gia); return; }

        if (tk.han_muc_thang_dong !== null) {
            const thang = thangViet(luc);
            const daDung = daDungThang(tk.id, thang);
            if (daDung >= tk.han_muc_thang_dong) {
                // Không dùng 429: Claude Code tự thử lại 429 nhiều lần, trong khi hết hạn mức thì thử lại vô ích.
                guiLoi(res, 400, 'invalid_request_error', `Đã dùng hết hạn mức AI tháng ${thangHienThi(thang)} (${dinhDangTien(daDung)} đồng / `
                    + `${dinhDangTien(tk.han_muc_thang_dong)} đồng). Liên hệ quản trị đơn vị để nâng hạn mức.`);
                return;
            }
        }

        const khoa = cauHinh.khoaAi[gia.nha_cung_cap];
        if (!khoa) { guiLoiThieuKhoa(res, gia); return; }
        if (res.destroyed) { return; }

        const luot: LuotGoi = { taiKhoanId: tk.id, donViId: tk.don_vi_id, luc, gia, soToken: soTokenRong(), daGhi: false };
        if (gia.nha_cung_cap === 'openai') {
            await chuyenTiepOpenAi(res, yc, luot, khoa);
        } else {
            await chuyenTiepKieuAnthropic(req, res, timKiem, yc, luot, khoa);
        }
    }

    async function xuLy(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
        let url: URL;
        try {
            url = new URL(req.url ?? '/', 'http://cong-ai.invalid');
        } catch {
            return false;
        }
        const duongDan = url.pathname.replace(/\/{2,}/g, '/').replace(/(.)\/$/, '$1');
        if (duongDan !== '/ai' && !duongDan.startsWith('/ai/')) { return false; }
        try {
            await xuLyYeuCau(req, res, duongDan, url.search);
        } catch (e) {
            // Lỗi ngoài dự kiến (vd CSDL): không để lộ chi tiết nội bộ cho máy khách.
            if (!res.headersSent) {
                guiLoi(res, 500, 'api_error', 'Cổng AI gặp lỗi nội bộ ngoài dự kiến — hãy thử lại; nếu lặp lại, báo quản trị hệ thống.', { choThuLai: true });
            } else if (!res.writableEnded) {
                res.destroy();
            }
            console.error('[cong-ai] Lỗi ngoài dự kiến:', e instanceof Error ? e.message : String(e));
        }
        return true;
    }

    return { xuLy, capToken, thuHoiToken, daDungThang };
}
