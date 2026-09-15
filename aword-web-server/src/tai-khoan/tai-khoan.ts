// Nghiệp vụ tài khoản dùng chung cho cổng truy cập, trang quản trị và nhập danh sách. Người dùng đăng nhập bằng email
// hoặc số điện thoại (0xxxxxxxxx); cột ten_dang_nhap chỉ còn là khóa nội bộ = email nếu có, không thì số điện thoại.
import { randomInt } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { giaoDich } from '../csdl/csdl.ts';
import { bamMatKhau, loiMatKhau } from '../xac-thuc/ma-hoa.ts';

export type VaiTro = 'quan_tri_he_thong' | 'quan_tri_don_vi' | 'nguoi_dung';
export type TrangThai = 'hoat_dong' | 'khoa' | 'chi_doc' | 'luu_tru';

export const TEN_VAI_TRO: Record<VaiTro, string> = {
    quan_tri_he_thong: 'Quản trị hệ thống',
    quan_tri_don_vi: 'Quản trị đơn vị',
    nguoi_dung: 'Người dùng',
};
export const TEN_TRANG_THAI: Record<TrangThai, string> = {
    hoat_dong: 'Đang hoạt động',
    khoa: 'Đã khóa',
    chi_doc: 'Chỉ đọc',
    luu_tru: 'Lưu trữ',
};
export const laVaiTro = (v: unknown): v is VaiTro => typeof v === 'string' && Object.hasOwn(TEN_VAI_TRO, v);
export const laTrangThai = (v: unknown): v is TrangThai => typeof v === 'string' && Object.hasOwn(TEN_TRANG_THAI, v);
export const laQuanTri = (v: VaiTro): boolean => v === 'quan_tri_he_thong' || v === 'quan_tri_don_vi';

/** Người đang thao tác quản trị. */
export interface NguoiThucHien { id: number; vaiTro: VaiTro; donViId: number | null }

/** Dòng tài khoản trong CSDL (các cột dùng tới). Các cột totp_* của lược đồ 1 không còn dùng. */
export interface DongTaiKhoan {
    id: number; ten_dang_nhap: string; ho_ten: string; email: string | null; so_dien_thoai: string | null; don_vi_id: number | null;
    vai_tro: VaiTro; mat_khau_bam: string; phai_doi_mat_khau: number; trang_thai: TrangThai; so_lan_sai: number; khoa_den: number | null;
    han_dung: number | null; han_muc_thang_dong: number | null; tao_luc: number; cap_nhat_luc: number; dang_nhap_cuoi: number | null;
}

export interface TaiKhoanMoi {
    hoTen: string; email: string | null; soDienThoai: string | null; donViId: number | null; vaiTro: VaiTro;
    hanDung: number | null; hanMucThangDong: number | null;
}

const LECH_GIO_VIET = 7 * 3600 * 1000;

// ---- Định dạng ----

/** 1234567 → "1.234.567 đ" */
export function dinhDangTien(dong: number): string {
    return `${String(Math.round(dong)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} đ`;
}

/** Thời điểm → "dd/mm/yyyy HH:MM" theo giờ Việt Nam (coGio=false chỉ lấy ngày). */
export function thoiGianViet(luc: number, coGio = true): string {
    const d = new Date(luc + LECH_GIO_VIET);
    const hai = (n: number): string => String(n).padStart(2, '0');
    const ngay = `${hai(d.getUTCDate())}/${hai(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
    return coGio ? `${ngay} ${hai(d.getUTCHours())}:${hai(d.getUTCMinutes())}` : ngay;
}

/** Hạn dùng lưu là thời điểm 0 giờ NGÀY SAU ngày cuối cùng được dùng (giờ Việt Nam). */
export function ngayCuoiSangHanDung(nam: number, thang: number, ngay: number): number {
    return Date.UTC(nam, thang - 1, ngay + 1) - LECH_GIO_VIET;
}

/** Hạn dùng → ngày cuối được dùng dạng "YYYY-MM-DD" (cho ô nhập ngày). */
export function hanDungSangNgay(hanDung: number | null): string | null {
    if (hanDung === null) { return null; }
    return new Date(hanDung + LECH_GIO_VIET - 1).toISOString().slice(0, 10);
}

/** Hạn dùng → "dd/mm/yyyy" (ngày cuối được dùng). */
export function hanDungSangChu(hanDung: number | null): string {
    return hanDung === null ? 'Không giới hạn' : thoiGianViet(hanDung - 1, false);
}

/** "0912345678" → "0912 345 678" */
export function hienSoDienThoai(so: string | null): string {
    return so ? `${so.slice(0, 4)} ${so.slice(4, 7)} ${so.slice(7)}` : '';
}

// ---- Đọc giá trị người dùng nhập ----

export function chuanHoaKhoa(s: string): string {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Email (trim, chữ thường); rỗng → null; sai định dạng → undefined. */
export function docEmail(s: string): string | null | undefined {
    const t = s.trim().toLowerCase();
    if (t === '') { return null; }
    return t.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? t : undefined;
}

/**
 * Số di động Việt Nam → "0xxxxxxxxx" (10 số). Nhận "0912 345 678", "0912.345.678", "+84 912 345 678", "84912345678",
 * và "912345678" (ô số trong Excel mất số 0 đầu). Rỗng → null; sai → undefined.
 */
export function docSoDienThoai(s: string): string | null | undefined {
    const t = s.trim().replace(/[\s.\-()]/g, '');
    if (t === '') { return null; }
    let m = /^(?:\+?84|0)?([35789]\d{8})$/.exec(t);
    if (!m) { m = /^\+?840([35789]\d{8})$/.exec(t); } // "+84 0912..." gõ thừa số 0
    return m ? `0${m[1]}` : undefined;
}

export type DinhDanh = { loai: 'email'; giaTri: string } | { loai: 'so'; giaTri: string };

/** Ô "Email hoặc số điện thoại" khi đăng nhập: có "@" → email, còn lại → số điện thoại. */
export function docDinhDanh(s: string): DinhDanh | undefined {
    if (s.includes('@')) {
        const email = docEmail(s);
        return email ? { loai: 'email', giaTri: email } : undefined;
    }
    const so = docSoDienThoai(s);
    return so ? { loai: 'so', giaTri: so } : undefined;
}

/** Khóa nội bộ ten_dang_nhap: email nếu có, không thì số điện thoại. */
export const khoaNoiBo = (email: string | null, soDienThoai: string | null): string => email ?? (soDienThoai as string);

/** "Người dùng" / "nguoi_dung" / "Quản trị đơn vị"... → mã vai trò; chuỗi rỗng → người dùng. */
export function docVaiTro(s: string): VaiTro | undefined {
    const k = chuanHoaKhoa(s);
    if (k === '' || k === 'nguoidung') { return 'nguoi_dung'; }
    if (k === 'quantridonvi') { return 'quan_tri_don_vi'; }
    if (k === 'quantrihethong') { return 'quan_tri_he_thong'; }
    return undefined;
}

/** "31/12/2026", "31-12-2026", "2026-12-31" → hạn dùng (hết ngày đó); rỗng → null; sai → undefined. */
export function docNgay(s: string): number | null | undefined {
    const t = s.trim();
    if (t === '') { return null; }
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ][\d:.]+Z?)?$/.exec(t);
    let nam: number, thang: number, ngay: number;
    if (m) {
        [nam, thang, ngay] = [Number(m[1]), Number(m[2]), Number(m[3])];
    } else {
        m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
        if (!m) { return undefined; }
        [ngay, thang, nam] = [Number(m[1]), Number(m[2]), Number(m[3])];
    }
    const d = new Date(Date.UTC(nam, thang - 1, ngay));
    if (nam < 2000 || nam > 2200 || d.getUTCMonth() !== thang - 1 || d.getUTCDate() !== ngay) { return undefined; }
    return ngayCuoiSangHanDung(nam, thang, ngay);
}

/** "1.500.000", "1,500,000", "1500000 đ", 200000 → số đồng; rỗng → null; sai → undefined. */
export function docTien(v: string | number): number | null | undefined {
    if (typeof v === 'number') { return Number.isSafeInteger(v) && v >= 0 ? v : undefined; }
    const t = v.trim().replace(/\s+/g, '').replace(/(vnđ|vnd|đồng|đ|dong)$/i, '');
    if (t === '') { return null; }
    let so: string;
    if (/^\d{1,3}([.,]\d{3})+$/.test(t)) { so = t.replace(/[.,]/g, ''); } else if (/^\d+$/.test(t)) { so = t; } else { return undefined; }
    const n = Number(so);
    return Number.isSafeInteger(n) && n <= 1e13 ? n : undefined;
}

/** Chính sách mật khẩu (loiMatKhau) + không chứa số điện thoại / phần tên của email. */
export function loiMatKhauTaiKhoan(matKhau: string, tk: { email: string | null; so_dien_thoai: string | null }): string | undefined {
    const loi = loiMatKhau(matKhau);
    if (loi) { return loi; }
    const thuong = matKhau.toLowerCase();
    if (tk.so_dien_thoai && (thuong.includes(tk.so_dien_thoai) || thuong.includes(tk.so_dien_thoai.slice(1)))) {
        return 'Mật khẩu không được chứa số điện thoại.';
    }
    const tenEmail = tk.email?.split('@')[0] ?? '';
    if (tenEmail.length >= 4 && thuong.includes(tenEmail)) { return 'Mật khẩu không được chứa địa chỉ email.'; }
    return undefined;
}

/** Mật khẩu tạm dễ đọc, không có ký tự dễ nhầm (vd "Kmtr-hapq-4827") — đạt chính sách loiMatKhau. */
export function sinhMatKhauTam(): string {
    const chu = 'abcdefghjkmnpqrstuvwxyz', so = '23456789';
    const lay = (bang: string, n: number): string => Array.from({ length: n }, () => bang[randomInt(bang.length)]).join('');
    for (;;) {
        const mk = `${lay(chu, 4)}-${lay(chu, 4)}-${lay(so, 4)}`;
        const ketQua = mk[0].toUpperCase() + mk.slice(1);
        if (!loiMatKhau(ketQua)) { return ketQua; }
    }
}

// ---- Phân quyền quản trị ----

/** Quản trị đơn vị chỉ chạm tài khoản thuộc đơn vị mình và không chạm quản trị hệ thống. */
export function duocQuanLy(nguoi: NguoiThucHien, tk: { vai_tro: VaiTro; don_vi_id: number | null }): boolean {
    if (nguoi.vaiTro === 'quan_tri_he_thong') { return true; }
    if (nguoi.vaiTro !== 'quan_tri_don_vi' || nguoi.donViId === null) { return false; }
    return tk.don_vi_id === nguoi.donViId && tk.vai_tro !== 'quan_tri_he_thong';
}

/** Kiểm tra đơn vị + vai trò mà người thao tác được phép gán. Trả về thông báo lỗi hoặc undefined. */
export function loiPhanQuyenGan(nguoi: NguoiThucHien, vaiTro: VaiTro, donViId: number | null): string | undefined {
    if (nguoi.vaiTro === 'quan_tri_don_vi') {
        if (vaiTro === 'quan_tri_he_thong') { return 'Bạn không có quyền tạo hoặc gán vai trò Quản trị hệ thống.'; }
        if (donViId !== nguoi.donViId) { return 'Bạn chỉ được quản lý tài khoản trong đơn vị của mình.'; }
    } else if (nguoi.vaiTro !== 'quan_tri_he_thong') {
        return 'Bạn không có quyền quản trị.';
    }
    if (vaiTro === 'quan_tri_don_vi' && donViId === null) { return 'Tài khoản Quản trị đơn vị phải thuộc một đơn vị.'; }
    return undefined;
}

/**
 * Kiểm tra email + số điện thoại (định dạng, ít nhất một, không trùng tài khoản khác).
 * Trả về giá trị đã chuẩn hóa và danh sách lỗi.
 */
export function kiemLienHe(db: DatabaseSync, vao: { email?: unknown; soDienThoai?: unknown }, truId?: number): {
    email: string | null; soDienThoai: string | null; loi: string[];
} {
    const loi: string[] = [];
    const emailVao = chuoi(vao.email), soVao = chuoi(vao.soDienThoai);
    const email = docEmail(emailVao);
    const soDienThoai = docSoDienThoai(soVao);
    if (email === undefined) { loi.push(`Email "${emailVao}" không đúng định dạng.`); }
    if (soDienThoai === undefined) { loi.push(`Số điện thoại "${soVao}" không đúng (cần số di động Việt Nam 10 số, vd 0912345678).`); }
    if (email === null && soDienThoai === null) { loi.push('Cần có email hoặc số điện thoại để đăng nhập.'); }
    if (email && db.prepare('SELECT 1 FROM tai_khoan WHERE email = ? COLLATE NOCASE AND id <> ?').get(email, truId ?? -1)) {
        loi.push(`Email ${email} đã dùng cho tài khoản khác.`);
    }
    if (soDienThoai && db.prepare('SELECT 1 FROM tai_khoan WHERE so_dien_thoai = ? AND id <> ?').get(soDienThoai, truId ?? -1)) {
        loi.push(`Số điện thoại ${soDienThoai} đã dùng cho tài khoản khác.`);
    }
    return { email: email ?? null, soDienThoai: soDienThoai ?? null, loi };
}

// ---- Kiểm tra dữ liệu tài khoản mới ----

export interface DauVaoTaiKhoan {
    hoTen?: unknown; email?: unknown; soDienThoai?: unknown; vaiTro?: unknown; hanDung?: unknown; hanMucThangDong?: unknown;
    /** Chọn đơn vị theo id (giao diện) hoặc theo mã (nhập Excel/CSV). */
    donViId?: unknown; maDonVi?: unknown;
}

const chuoi = (v: unknown): string => (v === null || v === undefined ? '' : String(v)).trim();

export function kiemTaiKhoanMoi(db: DatabaseSync, nguoi: NguoiThucHien, vao: DauVaoTaiKhoan, bayGio: number): { duLieu?: TaiKhoanMoi; loi: string[] } {
    const loi: string[] = [];
    const hoTen = chuoi(vao.hoTen).replace(/\s+/g, ' ');
    if (hoTen === '') { loi.push('Thiếu họ tên.'); } else if (hoTen.length > 120) { loi.push('Họ tên quá dài (tối đa 120 ký tự).'); }
    const lienHe = kiemLienHe(db, vao);
    loi.push(...lienHe.loi);

    const vaiTro = laVaiTro(vao.vaiTro) ? vao.vaiTro : docVaiTro(chuoi(vao.vaiTro));
    if (!vaiTro) { loi.push(`Vai trò "${chuoi(vao.vaiTro)}" không hợp lệ (chỉ nhận: Người dùng, Quản trị đơn vị, Quản trị hệ thống).`); }

    let donViId: number | null = null;
    let donViHopLe = true;
    const maDonVi = chuoi(vao.maDonVi);
    if (vao.donViId !== undefined && vao.donViId !== null && vao.donViId !== '') {
        const id = Number(vao.donViId);
        if (!Number.isSafeInteger(id) || !db.prepare('SELECT 1 FROM don_vi WHERE id = ?').get(id)) {
            loi.push('Đơn vị đã chọn không tồn tại.');
            donViHopLe = false;
        } else { donViId = id; }
    } else if (maDonVi !== '') {
        const dv = db.prepare('SELECT id FROM don_vi WHERE ma = ? COLLATE NOCASE').get(maDonVi) as { id: number } | undefined;
        if (!dv) { loi.push(`Mã đơn vị "${maDonVi}" không có trong hệ thống.`); donViHopLe = false; } else { donViId = dv.id; }
    } else if (nguoi.vaiTro === 'quan_tri_don_vi') {
        donViId = nguoi.donViId; // quản trị đơn vị bỏ trống → đơn vị của mình
    }
    if (vaiTro && donViHopLe) {
        const l = loiPhanQuyenGan(nguoi, vaiTro, donViId);
        if (l) { loi.push(l); }
    }

    const hanDung = docNgay(typeof vao.hanDung === 'string' || vao.hanDung === undefined || vao.hanDung === null ? chuoi(vao.hanDung) : '?');
    if (hanDung === undefined) { loi.push(`Hạn dùng "${chuoi(vao.hanDung)}" không đúng dạng ngày (vd 31/12/2026).`); } else if (hanDung !== null && hanDung <= bayGio) {
        loi.push(`Hạn dùng ${hanDungSangChu(hanDung)} đã qua.`);
    }
    const hanMuc = typeof vao.hanMucThangDong === 'number' ? docTien(vao.hanMucThangDong) : docTien(chuoi(vao.hanMucThangDong));
    if (hanMuc === undefined) { loi.push(`Hạn mức tháng "${chuoi(vao.hanMucThangDong)}" không hợp lệ (nhập số đồng, vd 200000; để trống nếu không giới hạn).`); }

    if (loi.length > 0 || !vaiTro || hanDung === undefined || hanMuc === undefined) { return { loi }; }
    return { loi, duLieu: { hoTen, email: lienHe.email, soDienThoai: lienHe.soDienThoai, donViId, vaiTro, hanDung, hanMucThangDong: hanMuc } };
}

/** Ghi nhật ký với thời điểm do cổng cung cấp (đồng hồ giả lập được khi kiểm thử). Không bao giờ ghi mật khẩu. */
export function ghiNhatKyLuc(db: DatabaseSync, luc: number, muc: {
    taiKhoanId?: number | null; hanhDong: string; doiTuong?: string; chiTiet?: unknown; ip?: string;
}): void {
    db.prepare('INSERT INTO nhat_ky (luc, tai_khoan_id, hanh_dong, doi_tuong, chi_tiet, ip) VALUES (?, ?, ?, ?, ?, ?)')
        .run(luc, muc.taiKhoanId ?? null, muc.hanhDong, muc.doiTuong ?? null,
            muc.chiTiet === undefined ? null : JSON.stringify(muc.chiTiet), muc.ip ?? null);
}

/** Băm song song có giới hạn (scrypt chạy trên luồng nền của libuv). */
async function bamNhieu(matKhau: string[], dongThoi = 4): Promise<string[]> {
    const kq: string[] = new Array(matKhau.length);
    let tiep = 0;
    await Promise.all(Array.from({ length: Math.min(dongThoi, matKhau.length) }, async () => {
        while (tiep < matKhau.length) {
            const i = tiep++;
            kq[i] = await bamMatKhau(matKhau[i]);
        }
    }));
    return kq;
}

export interface TaiKhoanDaTao { id: number; hoTen: string; email: string | null; soDienThoai: string | null; matKhauTam: string }

/** Tạo các tài khoản (đã kiểm tra) trong MỘT giao dịch; mỗi tài khoản có mật khẩu tạm và phải đổi ở lần đầu đăng nhập. */
export async function taoCacTaiKhoan(db: DatabaseSync, danhSach: TaiKhoanMoi[], tuy: {
    nguoiLamId: number | null; bayGio: number; ip?: string; hanhDong?: string;
}): Promise<TaiKhoanDaTao[]> {
    const matKhau = danhSach.map(() => sinhMatKhauTam());
    const bam = await bamNhieu(matKhau);
    return giaoDich(db, () => {
        const them = db.prepare(`INSERT INTO tai_khoan (ten_dang_nhap, ho_ten, email, so_dien_thoai, don_vi_id, vai_tro, mat_khau_bam,
            phai_doi_mat_khau, han_dung, han_muc_thang_dong, tao_luc, cap_nhat_luc) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`);
        return danhSach.map((tk, i) => {
            let id: number;
            try {
                id = Number(them.run(khoaNoiBo(tk.email, tk.soDienThoai), tk.hoTen, tk.email, tk.soDienThoai, tk.donViId, tk.vaiTro, bam[i],
                    tk.hanDung, tk.hanMucThangDong, tuy.bayGio, tuy.bayGio).lastInsertRowid);
            } catch (e) {
                if (/UNIQUE/i.test(String((e as Error).message))) {
                    throw new Error(`Email hoặc số điện thoại của "${tk.hoTen}" đã dùng cho tài khoản khác.`);
                }
                throw e;
            }
            ghiNhatKyLuc(db, tuy.bayGio, {
                taiKhoanId: tuy.nguoiLamId, hanhDong: tuy.hanhDong ?? 'tao_tai_khoan', doiTuong: `tai_khoan:${id}`, ip: tuy.ip,
                chiTiet: { email: tk.email, so_dien_thoai: tk.soDienThoai, vai_tro: tk.vaiTro, don_vi_id: tk.donViId },
            });
            return { id, hoTen: tk.hoTen, email: tk.email, soDienThoai: tk.soDienThoai, matKhauTam: matKhau[i] };
        });
    });
}
