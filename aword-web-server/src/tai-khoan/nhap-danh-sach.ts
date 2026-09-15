// Nhập danh sách tài khoản từ Excel (.xlsx) hoặc CSV: đọc bảng → nhận diện cột theo tiêu đề → kiểm tra từng dòng
// (xem trước, báo lỗi từng dòng) → chỉ ghi các dòng hợp lệ sau khi người quản trị xác nhận.
import type { DatabaseSync } from 'node:sqlite';
import { docCsv } from './csv.ts';
import { chuanHoaKhoa, docEmail, docSoDienThoai, kiemTaiKhoanMoi } from './tai-khoan.ts';
import type { NguoiThucHien, TaiKhoanMoi } from './tai-khoan.ts';
import { docXlsx, seriSangNgay } from './xlsx.ts';
import type { GiaTriO } from './xlsx.ts';

export const TOI_DA_DONG_NHAP = 2000;

export const COT_NHAP = ['Họ tên', 'Email', 'Số điện thoại', 'Mã đơn vị', 'Vai trò', 'Hạn dùng', 'Hạn mức tháng (đồng)'] as const;

/** Một dòng đọc từ tệp — mọi ô đã quy về chuỗi (gửi lại nguyên vẹn ở bước ghi). */
export interface DongNhap {
    soDong: number;
    hoTen: string; email: string; soDienThoai: string; maDonVi: string; vaiTro: string; hanDung: string; hanMucThangDong: string;
}
type TruongNhap = Exclude<keyof DongNhap, 'soDong'>;
const CAC_TRUONG: TruongNhap[] = ['hoTen', 'email', 'soDienThoai', 'maDonVi', 'vaiTro', 'hanDung', 'hanMucThangDong'];

function nhanDienCot(tieuDe: string): TruongNhap | undefined {
    const k = chuanHoaKhoa(tieuDe);
    if (['hoten', 'hovaten'].includes(k)) { return 'hoTen'; }
    if (['email', 'thudientu', 'diachiemail'].includes(k)) { return 'email'; }
    if (['sodienthoai', 'dienthoai', 'sdt', 'sodt', 'didong'].includes(k)) { return 'soDienThoai'; }
    if (k === 'madonvi') { return 'maDonVi'; }
    if (k === 'vaitro') { return 'vaiTro'; }
    if (['handung', 'hansudung'].includes(k)) { return 'hanDung'; }
    if (k.startsWith('hanmuc')) { return 'hanMucThangDong'; }
    return undefined;
}

function sangChuoi(gt: GiaTriO | string, truong: TruongNhap): string {
    if (gt === null) { return ''; }
    if (typeof gt === 'boolean') { return gt ? 'TRUE' : 'FALSE'; }
    // Ngày nhập trong ô số không định dạng ngày: coi là số seri Excel
    let s = typeof gt === 'number' ? (truong === 'hanDung' && gt > 20000 && gt < 100000 ? seriSangNgay(gt) : String(gt)) : gt.trim();
    if (truong === 'hanDung') {
        // Ô ngày của Excel → "dd/mm/yyyy" cho quen mắt ở bước xem trước
        const m = /^(\d{4})-(\d{2})-(\d{2})(T00:00:00)?$/.exec(s);
        if (m) { s = `${m[3]}/${m[2]}/${m[1]}`; }
    }
    return s;
}

/** Đọc tệp .xlsx/.csv thành các dòng nhập. Lỗi cấu trúc (thiếu cột, sai định dạng tệp) → ném Error tiếng Việt. */
export function docBangNhap(tenTep: string, noiDung: Buffer): DongNhap[] {
    const laXlsx = /\.xlsx$/i.test(tenTep) || (noiDung.length > 4 && noiDung.readUInt32LE(0) === 0x04034b50);
    if (!laXlsx && !/\.(csv|txt)$/i.test(tenTep)) {
        throw new Error('Chỉ nhận tệp Excel (.xlsx) hoặc CSV (.csv). Tệp .xls đời cũ: mở bằng Excel rồi lưu lại dạng .xlsx.');
    }
    const bang: Array<Array<GiaTriO | string>> = laXlsx ? docXlsx(noiDung) : docCsv(noiDung);

    const viTriTieuDe = bang.findIndex(h => h.some(o => o !== null && String(o).trim() !== ''));
    if (viTriTieuDe < 0) { throw new Error('Tệp không có dữ liệu.'); }
    const cot = new Map<TruongNhap, number>();
    bang[viTriTieuDe].forEach((o, i) => {
        const truong = nhanDienCot(o === null ? '' : String(o));
        if (truong && !cot.has(truong)) { cot.set(truong, i); }
    });
    if (!cot.has('hoTen') || (!cot.has('email') && !cot.has('soDienThoai'))) {
        throw new Error(`Dòng tiêu đề cần có cột "Họ tên" và ít nhất một trong hai cột "Email", "Số điện thoại". Các cột dùng được: ${COT_NHAP.join(', ')}.`);
    }

    const ketQua: DongNhap[] = [];
    for (let i = viTriTieuDe + 1; i < bang.length; i++) {
        const h = bang[i];
        if (h.every(o => o === null || String(o).trim() === '')) { continue; }
        const dong = { soDong: i + 1 } as DongNhap;
        for (const t of CAC_TRUONG) {
            const c = cot.get(t);
            dong[t] = c === undefined ? '' : sangChuoi(h[c] ?? null, t);
        }
        ketQua.push(dong);
        if (ketQua.length > TOI_DA_DONG_NHAP) { throw new Error(`Mỗi lần nhập tối đa ${TOI_DA_DONG_NHAP} tài khoản — hãy chia nhỏ tệp.`); }
    }
    if (ketQua.length === 0) { throw new Error('Tệp chỉ có dòng tiêu đề, chưa có tài khoản nào.'); }
    return ketQua;
}

export interface KetQuaDong { soDong: number; dong: DongNhap; duLieu?: TaiKhoanMoi; loi: string[] }

/** Kiểm tra từng dòng (quyền của người nhập, trùng email/số trong CSDL và trùng ngay trong tệp). */
export function kiemDanhSachNhap(db: DatabaseSync, nguoi: NguoiThucHien, dsDong: DongNhap[], bayGio: number): KetQuaDong[] {
    const emailDaGap = new Map<string, number>();
    const soDaGap = new Map<string, number>();
    return dsDong.map(dong => {
        const { duLieu, loi } = kiemTaiKhoanMoi(db, nguoi, dong, bayGio);
        const email = docEmail(dong.email);
        if (email) {
            const truoc = emailDaGap.get(email);
            if (truoc !== undefined) { loi.push(`Trùng email với dòng ${truoc} trong tệp.`); } else { emailDaGap.set(email, dong.soDong); }
        }
        const so = docSoDienThoai(dong.soDienThoai);
        if (so) {
            const truoc = soDaGap.get(so);
            if (truoc !== undefined) { loi.push(`Trùng số điện thoại với dòng ${truoc} trong tệp.`); } else { soDaGap.set(so, dong.soDong); }
        }
        return loi.length > 0 ? { soDong: dong.soDong, dong, loi } : { soDong: dong.soDong, dong, duLieu, loi };
    });
}

/** Kiểm tra dữ liệu dòng gửi lại từ trình duyệt ở bước ghi (không tin dữ liệu phía máy khách). */
export function docDongGuiLai(vao: unknown): DongNhap[] {
    if (!Array.isArray(vao) || vao.length === 0 || vao.length > TOI_DA_DONG_NHAP) { throw new Error('Danh sách gửi lên không hợp lệ.'); }
    return vao.map((d: Record<string, unknown>, i) => {
        if (typeof d !== 'object' || d === null) { throw new Error('Danh sách gửi lên không hợp lệ.'); }
        const soDong = Number(d.soDong);
        const dong = { soDong: Number.isSafeInteger(soDong) ? soDong : i + 2 } as DongNhap;
        for (const t of CAC_TRUONG) { dong[t] = (typeof d[t] === 'string' ? (d[t] as string) : '').slice(0, 300); }
        return dong;
    });
}
