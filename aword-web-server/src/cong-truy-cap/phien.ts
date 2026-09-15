// Phiên đăng nhập trình duyệt: cookie "aword_phien" chứa token ngẫu nhiên, CSDL chỉ lưu băm SHA-256 của token.
// Hết hạn khi không hoạt động 12 giờ (trượt) và tối đa 7 ngày.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import type { CauHinh } from '../cau-hinh.ts';
import type { DongTaiKhoan } from '../tai-khoan/tai-khoan.ts';
import { bamToken, taoToken } from '../xac-thuc/ma-hoa.ts';
import { bangNhauHangThoiGian, docCookie, hmac, taoCookie, tenMayYeuCau, tenMienCookie, themSetCookie } from './http.ts';

export const TEN_COOKIE = 'aword_phien';
export const TEN_COOKIE_TRUOC = 'aword_truoc_dang_nhap';
export const PHIEN_RANH_TOI_DA = 12 * 3600 * 1000;
export const PHIEN_TOI_DA = 7 * 24 * 3600 * 1000;
/** Chỉ ghi lại "hoạt động cuối" khi đã quá khoảng này — tránh ghi CSDL ở mọi yêu cầu. */
const GHI_HOAT_DONG_SAU = 60 * 1000;

export interface DongPhien {
    token_bam: string; tai_khoan_id: number; tao_luc: number; het_han: number; hoat_dong_cuoi: number;
    da_xac_thuc_du: number; ip: string | null; trinh_duyet: string | null;
}

export interface PhienHienTai { tokenBam: string; phien: DongPhien; tk: DongTaiKhoan }

/** Bước còn thiếu trước khi được dùng AWord (null = đã đủ): đang dùng mật khẩu tạm thì phải đổi. */
export type BuocConThieu = 'doi-mat-khau' | null;

export function buocConThieu(tk: DongTaiKhoan): BuocConThieu {
    return tk.phai_doi_mat_khau ? 'doi-mat-khau' : null;
}

/** Lý do tài khoản không dùng được (thông báo cho người dùng), hoặc null nếu dùng được. */
export function lyDoKhongDung(tk: DongTaiKhoan, bayGio: number): string | null {
    switch (tk.trang_thai) {
        case 'khoa': return 'Tài khoản của bạn đang bị khóa. Vui lòng liên hệ quản trị đơn vị.';
        case 'luu_tru': return 'Tài khoản đã chuyển vào lưu trữ. Vui lòng liên hệ quản trị đơn vị.';
        case 'chi_doc': return 'Tài khoản đang tạm ngừng do hết thời hạn thuê bao. Vui lòng liên hệ quản trị đơn vị để gia hạn.';
    }
    if (tk.han_dung !== null && tk.han_dung <= bayGio) {
        const d = new Date(tk.han_dung + 7 * 3600 * 1000 - 1);
        const ngay = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
        return `Tài khoản đã hết hạn dùng (ngày cuối: ${ngay}). Vui lòng liên hệ quản trị đơn vị để gia hạn.`;
    }
    return null;
}

export function taoKhoPhien(db: DatabaseSync, cauHinh: CauHinh, bayGio: () => number) {
    const tenMien = tenMienCookie(cauHinh.tenMien);
    /** Chỉ gắn Domain khi yêu cầu đến đúng tên miền (hoặc máy con của nó) — mở bằng tên máy khác thì cookie riêng máy,
     *  tránh trình duyệt từ chối cookie rồi quay vòng trang đăng nhập. */
    const domainCho = (res: ServerResponse): string | undefined => {
        if (!tenMien || !res.req) { return undefined; }
        const may = tenMayYeuCau(res.req);
        return may === tenMien || may.endsWith(`.${tenMien}`) ? tenMien : undefined;
    };
    const cau = {
        docPhien: db.prepare('SELECT * FROM phien_dang_nhap WHERE token_bam = ?'),
        docTaiKhoan: db.prepare('SELECT * FROM tai_khoan WHERE id = ?'),
        xoa: db.prepare('DELETE FROM phien_dang_nhap WHERE token_bam = ?'),
        chamHoatDong: db.prepare('UPDATE phien_dang_nhap SET hoat_dong_cuoi = ? WHERE token_bam = ?'),
        them: db.prepare(`INSERT INTO phien_dang_nhap (token_bam, tai_khoan_id, tao_luc, het_han, hoat_dong_cuoi, da_xac_thuc_du, ip, trinh_duyet)
            VALUES (?, ?, ?, ?, ?, 1, ?, ?)`),
        donHetHan: db.prepare('DELETE FROM phien_dang_nhap WHERE het_han <= ? OR hoat_dong_cuoi <= ? OR da_xac_thuc_du = 0'),
    };
    let lanDonCuoi = 0;

    /** Còn hạn: chưa quá 7 ngày, chưa quá 12 giờ không hoạt động. (da_xac_thuc_du = 0 là trạng thái cũ, không còn dùng.) */
    function conHan(p: DongPhien, luc: number): boolean {
        return p.da_xac_thuc_du === 1 && p.het_han > luc && luc - p.hoat_dong_cuoi < PHIEN_RANH_TOI_DA;
    }

    const kho = {
        /** Phiên còn hạn của yêu cầu (chưa xét bước còn thiếu hay trạng thái tài khoản). */
        doc(req: IncomingMessage): PhienHienTai | null {
            const luc = bayGio();
            for (const token of docCookie(req).get(TEN_COOKIE) ?? []) {
                if (!/^[A-Za-z0-9_-]{43}$/.test(token)) { continue; }
                const tokenBam = bamToken(token);
                const phien = cau.docPhien.get(tokenBam) as DongPhien | undefined;
                if (!phien) { continue; }
                if (!conHan(phien, luc)) { cau.xoa.run(tokenBam); continue; }
                const tk = cau.docTaiKhoan.get(phien.tai_khoan_id) as DongTaiKhoan | undefined;
                if (!tk) { continue; }
                if (luc - phien.hoat_dong_cuoi >= GHI_HOAT_DONG_SAU) {
                    cau.chamHoatDong.run(luc, tokenBam);
                    phien.hoat_dong_cuoi = luc;
                }
                return { tokenBam, phien, tk };
            }
            return null;
        },

        /** Tạo phiên mới (luôn token mới — chống cố định phiên); trả về token gốc để đặt cookie. */
        tao(res: ServerResponse, taiKhoanId: number, ip: string, trinhDuyet: string): string {
            const luc = bayGio();
            if (luc - lanDonCuoi > 10 * 60 * 1000) {
                cau.donHetHan.run(luc, luc - PHIEN_RANH_TOI_DA);
                lanDonCuoi = luc;
            }
            const token = taoToken();
            const tokenBam = bamToken(token);
            cau.them.run(tokenBam, taiKhoanId, luc, luc + PHIEN_TOI_DA, luc, ip, trinhDuyet.slice(0, 300));
            kho.datCookie(res, token, PHIEN_TOI_DA);
            return tokenBam;
        },

        /** Đổi token của phiên (sau khi đổi mật khẩu/thông tin đăng nhập); trả về băm mới. */
        doiToken(res: ServerResponse, p: PhienHienTai): string {
            const token = taoToken();
            const tokenBam = bamToken(token);
            db.prepare('UPDATE phien_dang_nhap SET token_bam = ? WHERE token_bam = ?').run(tokenBam, p.tokenBam);
            kho.datCookie(res, token, p.phien.het_han - bayGio());
            return tokenBam;
        },

        datCookie(res: ServerResponse, token: string, conLaiMs: number): void {
            themSetCookie(res, taoCookie(TEN_COOKIE, token, { domain: domainCho(res), secure: cauHinh.https, maxAgeGiay: conLaiMs / 1000 }));
        },

        xoaCookie(res: ServerResponse): void {
            const domain = domainCho(res);
            themSetCookie(res, taoCookie(TEN_COOKIE, '', { domain, secure: cauHinh.https, maxAgeGiay: 0 }));
            if (domain) { themSetCookie(res, taoCookie(TEN_COOKIE, '', { secure: cauHinh.https, maxAgeGiay: 0 })); }
        },

        huy(tokenBam: string): void { cau.xoa.run(tokenBam); },

        /** Hủy mọi phiên của tài khoản (trừ một phiên nếu chỉ định). Trả về số phiên đã hủy. */
        huyTatCa(taiKhoanId: number, giuTokenBam?: string): number {
            return Number(db.prepare('DELETE FROM phien_dang_nhap WHERE tai_khoan_id = ? AND token_bam <> ?')
                .run(taiKhoanId, giuTokenBam ?? '').changes);
        },

        dsPhien(taiKhoanId: number): DongPhien[] {
            const luc = bayGio();
            return (db.prepare('SELECT * FROM phien_dang_nhap WHERE tai_khoan_id = ? ORDER BY hoat_dong_cuoi DESC').all(taiKhoanId) as unknown as DongPhien[])
                .filter(p => conHan(p, luc));
        },

        /** Token CSRF gắn với phiên: HMAC(bí mật máy chủ, băm token phiên). */
        csrf(tokenBam: string): string { return hmac(cauHinh.biMat, `csrf|${tokenBam}`); },
        kiemCsrf(tokenBam: string, giaTri: unknown): boolean {
            return typeof giaTri === 'string' && bangNhauHangThoiGian(giaTri, kho.csrf(tokenBam));
        },

        /** CSRF cho biểu mẫu đăng nhập (chưa có phiên): gắn với cookie ngẫu nhiên riêng của trang đăng nhập. */
        csrfTruocDangNhap(req: IncomingMessage, res: ServerResponse): string {
            let giaTri = (docCookie(req).get(TEN_COOKIE_TRUOC) ?? []).find(v => /^[A-Za-z0-9_-]{43}$/.test(v));
            if (!giaTri) {
                giaTri = taoToken();
                themSetCookie(res, taoCookie(TEN_COOKIE_TRUOC, giaTri, { secure: cauHinh.https, path: '/dang-nhap' }));
            }
            return hmac(cauHinh.biMat, `csrf-truoc|${giaTri}`);
        },
        kiemCsrfTruocDangNhap(req: IncomingMessage, giaTri: unknown): boolean {
            if (typeof giaTri !== 'string') { return false; }
            return (docCookie(req).get(TEN_COOKIE_TRUOC) ?? [])
                .some(v => bangNhauHangThoiGian(giaTri, hmac(cauHinh.biMat, `csrf-truoc|${v}`)));
        },
    };
    return kho;
}

export type KhoPhien = ReturnType<typeof taoKhoPhien>;
