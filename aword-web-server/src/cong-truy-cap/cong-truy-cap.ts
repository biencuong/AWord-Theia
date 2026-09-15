// Cổng truy cập AWord Web: đăng nhập bằng email hoặc số điện thoại + mật khẩu, phiên cookie, đổi mật khẩu lần đầu,
// trang tài khoản, trang quản trị + API. Mọi đường dẫn khác thuộc phiên AWord của người đang đăng nhập (main.ts ghép).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import type { CauHinh } from '../cau-hinh.ts';
import { thangViet } from '../csdl/csdl.ts';
import {
    docDinhDanh, ghiNhatKyLuc, khoaNoiBo, kiemLienHe, laQuanTri, loiMatKhauTaiKhoan, taoCacTaiKhoan,
} from '../tai-khoan/tai-khoan.ts';
import type { DongTaiKhoan, VaiTro } from '../tai-khoan/tai-khoan.ts';
import { bamMatKhau, kiemMatKhau, taoToken } from '../xac-thuc/ma-hoa.ts';
import { trangDangNhap, trangDangXuat, trangDoiMatKhau, trangLoi, trangQuanTri, trangTaiKhoan } from './giao-dien.ts';
import { soPhutConLai, taoGioiHan } from './gioi-han.ts';
import {
    LoiHttp, chuyenHuong, cungNguonGoc, datHeaderBaoMat, docForm, guiHtml, guiJson, laMayCon, layIp, tiepAnToan,
} from './http.ts';
import { buocConThieu, lyDoKhongDung, taoKhoPhien } from './phien.ts';
import type { PhienHienTai } from './phien.ts';
import { taoApiQuanTri } from './quan-tri.ts';

export interface TaiKhoanDangNhap {
    id: number; hoTen: string; email: string | null; soDienThoai: string | null;
    vaiTro: VaiTro; donViId: number | null;
}
export interface DieuPhoiToiThieu { dungPhien(taiKhoanId: number): Promise<void> }
export interface CongAiToiThieu { thuHoiToken(taiKhoanId: number): void; daDungThang(taiKhoanId: number, thang?: string): number }

export const SO_LAN_SAI_TOI_DA = 5;
export const THOI_GIAN_KHOA = 15 * 60 * 1000;

const GOC_CONG = ['/dang-nhap', '/dang-xuat', '/doi-mat-khau', '/tai-khoan', '/quan-tri', '/api', '/_aword'];
const TRANG_QUAN_TRI = new Set(['tai-khoan', 'nhap', 'don-vi', 'bang-gia', 'nhat-ky']);
const LOI_DANG_NHAP = 'Email/số điện thoại hoặc mật khẩu không đúng.';

const THONG_BAO: Record<string, string> = {
    'da-dang-xuat': 'Bạn đã đăng xuất.',
    'doi-mat-khau': 'Đã đổi mật khẩu. Các thiết bị khác đã được đăng xuất.',
    'dang-xuat-khac': 'Đã đăng xuất các thiết bị khác.',
    'lien-he': 'Đã lưu email và số điện thoại đăng nhập.',
};

export function laDuongDanCong(duongDan: string): boolean {
    return GOC_CONG.some(g => duongDan === g || duongDan.startsWith(`${g}/`));
}

/** Người chưa đăng nhập vào trang của phiên AWord → chuyển tới trang đăng nhập, nhớ đường dẫn để quay lại. */
export function chuyenDenDangNhap(res: ServerResponse, url: string): void {
    const tiep = tiepAnToan(url, '');
    chuyenHuong(res, tiep && tiep !== '/' ? `/dang-nhap?tiep=${encodeURIComponent(tiep)}` : '/dang-nhap', 302);
}

/** Tạo quản trị hệ thống đầu tiên (chạy từ dòng lệnh khi cài máy chủ). Trả về mật khẩu tạm để in ra màn hình. */
export async function taoQuanTriDauTien(db: DatabaseSync, emailHoacSoDienThoai: string, hoTen: string): Promise<string> {
    const dd = docDinhDanh(emailHoacSoDienThoai);
    if (!dd) { throw new Error('Cần email hoặc số điện thoại di động hợp lệ (vd quantri@so.gov.vn hoặc 0912345678).'); }
    const ho = hoTen.trim().replace(/\s+/g, ' ');
    if (ho === '') { throw new Error('Thiếu họ tên.'); }
    const lienHe = kiemLienHe(db, dd.loai === 'email' ? { email: dd.giaTri } : { soDienThoai: dd.giaTri });
    if (lienHe.loi.length) { throw new Error(lienHe.loi.join(' ')); }
    const [tk] = await taoCacTaiKhoan(db, [{
        hoTen: ho, email: lienHe.email, soDienThoai: lienHe.soDienThoai, donViId: null, vaiTro: 'quan_tri_he_thong', hanDung: null, hanMucThangDong: null,
    }], { nguoiLamId: null, bayGio: Date.now(), hanhDong: 'tao_quan_tri_dau_tien' });
    return tk.matKhauTam;
}

interface TaiNguyen { noiDung: Buffer; loai: string; etag: string }

function napTaiNguyen(): Map<string, TaiNguyen> {
    const bang = new Map<string, TaiNguyen>();
    for (const [ten, loai] of [['giao-dien.css', 'text/css; charset=utf-8'], ['trang.js', 'text/javascript; charset=utf-8'], ['quan-tri.js', 'text/javascript; charset=utf-8']]) {
        const noiDung = readFileSync(new URL(`./tai-nguyen/${ten}`, import.meta.url));
        bang.set(`/_aword/${ten}`, { noiDung, loai, etag: `"${createHash('sha256').update(noiDung).digest('base64url').slice(0, 16)}"` });
    }
    return bang;
}

export function taoCongTruyCap(tuy: { db: DatabaseSync; cauHinh: CauHinh; dieuPhoi: DieuPhoiToiThieu; congAi: CongAiToiThieu; bayGio?: () => number }) {
    const { db, cauHinh, congAi } = tuy;
    const bayGio = tuy.bayGio ?? Date.now;
    const kho = taoKhoPhien(db, cauHinh, bayGio);
    const taiNguyen = napTaiNguyen();
    const apiQuanTri = taoApiQuanTri({ db, cauHinh, dieuPhoi: tuy.dieuPhoi, congAi, bayGio, kho });
    // Chặn dò mật khẩu theo IP: 30 lần sai/15 phút; tối đa 60 lượt gửi biểu mẫu có mật khẩu/phút
    const saiTheoIp = taoGioiHan({ soLan: 30, cuaSoMs: 15 * 60_000, bayGio });
    const guiTheoIp = taoGioiHan({ soLan: 60, cuaSoMs: 60_000, bayGio });
    // Email/số không có tài khoản cũng "bị khóa" y như thật để không lộ tài khoản nào tồn tại
    const saiKhongCo = new Map<string, { soLan: number; khoaDen: number }>();
    let bamGia: Promise<string> | undefined;

    const cauDocTaiKhoan = db.prepare('SELECT * FROM tai_khoan WHERE id = ?');
    const docTk = (id: number): DongTaiKhoan => cauDocTaiKhoan.get(id) as unknown as DongTaiKhoan;
    const nk = (muc: Parameters<typeof ghiNhatKyLuc>[2]): void => ghiNhatKyLuc(db, bayGio(), muc);

    const duongDanDoiMatKhau = (tiep: string): string => `/doi-mat-khau${tiep !== '/' ? `?tiep=${encodeURIComponent(tiep)}` : ''}`;

    /** Sau khi xong một bước: còn mật khẩu tạm thì tới trang đổi, không thì về đích (kèm thông báo nếu đích là trang tài khoản). */
    function diTiep(res: ServerResponse, tk: DongTaiKhoan, tiep: string, thongBao?: string): void {
        if (buocConThieu(tk)) { return chuyenHuong(res, duongDanDoiMatKhau(tiep)); }
        if (thongBao && (tiep === '/tai-khoan' || tiep.startsWith('/tai-khoan?'))) { return chuyenHuong(res, `/tai-khoan?thong_bao=${thongBao}`); }
        chuyenHuong(res, tiep);
    }

    function xacThucYeuCau(req: IncomingMessage): TaiKhoanDangNhap | null {
        const p = kho.doc(req);
        if (!p || lyDoKhongDung(p.tk, bayGio()) !== null || buocConThieu(p.tk) !== null) { return null; }
        return { id: p.tk.id, hoTen: p.tk.ho_ten, email: p.tk.email, soDienThoai: p.tk.so_dien_thoai, vaiTro: p.tk.vai_tro, donViId: p.tk.don_vi_id };
    }

    /** Trang cần phiên đủ bước: thiếu thì chuyển hướng và trả về null. */
    function canPhienDu(req: IncomingMessage, res: ServerResponse, url: URL): PhienHienTai | null {
        const p = kho.doc(req);
        const tiep = tiepAnToan(url.pathname + url.search);
        if (!p) { chuyenDenDangNhap(res, tiep); return null; }
        if (lyDoKhongDung(p.tk, bayGio())) { chuyenHuong(res, '/dang-nhap', 302); return null; }
        if (buocConThieu(p.tk)) { chuyenHuong(res, duongDanDoiMatKhau(tiep), 302); return null; }
        return p;
    }

    function kiemBieuMau(req: IncomingMessage, p: PhienHienTai, form: URLSearchParams): void {
        if (!cungNguonGoc(req, cauHinh.https) || !kho.kiemCsrf(p.tokenBam, form.get('csrf'))) {
            throw new LoiHttp(403, 'Yêu cầu bị từ chối vì biểu mẫu không hợp lệ hoặc đã cũ. Vui lòng tải lại trang rồi thử lại.');
        }
    }

    function chanTanSuat(ip: string): string | null {
        const cho = Math.max(saiTheoIp.conCho(ip), guiTheoIp.conCho(ip));
        return cho > 0 ? `Có quá nhiều lần thử từ mạng của bạn. Vui lòng thử lại sau ${soPhutConLai(cho)}.` : null;
    }

    // ---------------- Đăng nhập ----------------

    function hienDangNhap(req: IncomingMessage, res: ServerResponse, trangThai: number, t: { tiep: string; loi?: string; tin?: string; dinhDanh?: string }): void {
        guiHtml(res, trangThai, trangDangNhap({ ...t, csrf: kho.csrfTruocDangNhap(req, res) }));
    }

    function dangNhapGet(req: IncomingMessage, res: ServerResponse, url: URL): void {
        const tiep = tiepAnToan(url.searchParams.get('tiep'));
        const p = kho.doc(req);
        if (p) {
            const lyDo = lyDoKhongDung(p.tk, bayGio());
            if (lyDo) {
                kho.huy(p.tokenBam);
                kho.xoaCookie(res);
                return hienDangNhap(req, res, 200, { tiep, loi: lyDo });
            }
            return chuyenHuong(res, buocConThieu(p.tk) ? duongDanDoiMatKhau(tiep) : tiep, 302);
        }
        hienDangNhap(req, res, 200, { tiep, tin: THONG_BAO[url.searchParams.get('thong_bao') ?? ''] });
    }

    async function dangNhapPost(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const form = await docForm(req);
        const tiep = tiepAnToan(form.get('tiep'));
        const dinhDanhVao = (form.get('dinh_danh') ?? '').trim().slice(0, 254);
        const matKhau = (form.get('mat_khau') ?? '').slice(0, 200);
        if (!cungNguonGoc(req, cauHinh.https) || !kho.kiemCsrfTruocDangNhap(req, form.get('csrf'))) {
            return hienDangNhap(req, res, 403, { tiep, dinhDanh: dinhDanhVao, loi: 'Trang đăng nhập đã cũ hoặc không hợp lệ. Vui lòng nhập lại.' });
        }
        const ip = layIp(req);
        const chan = chanTanSuat(ip);
        if (chan) { return hienDangNhap(req, res, 429, { tiep, dinhDanh: dinhDanhVao, loi: chan }); }
        guiTheoIp.ghi(ip);
        if (dinhDanhVao === '' || matKhau === '') {
            return hienDangNhap(req, res, 400, { tiep, dinhDanh: dinhDanhVao, loi: 'Vui lòng nhập email (hoặc số điện thoại) và mật khẩu.' });
        }
        const dd = docDinhDanh(dinhDanhVao);
        if (!dd) {
            // Chỉ là lỗi định dạng — không liên quan tới việc tài khoản có tồn tại hay không
            return hienDangNhap(req, res, 400, { tiep, dinhDanh: dinhDanhVao, loi: 'Hãy nhập đúng email hoặc số điện thoại di động (vd 0912345678).' });
        }

        const luc = bayGio();
        const tk = (dd.loai === 'email'
            ? db.prepare('SELECT * FROM tai_khoan WHERE email = ? COLLATE NOCASE').get(dd.giaTri)
            : db.prepare('SELECT * FROM tai_khoan WHERE so_dien_thoai = ?').get(dd.giaTri)) as DongTaiKhoan | undefined;
        const khoaAo = `${dd.loai}:${dd.giaTri}`;
        const khoaDen = tk ? tk.khoa_den : saiKhongCo.get(khoaAo)?.khoaDen;
        const thongBaoKhoa = (den: number): string =>
            `Tài khoản đang tạm khóa vì nhập sai mật khẩu ${SO_LAN_SAI_TOI_DA} lần liên tiếp. Vui lòng thử lại sau ${soPhutConLai(den - luc)}.`;
        if (khoaDen && khoaDen > luc) {
            return hienDangNhap(req, res, 429, { tiep, dinhDanh: dinhDanhVao, loi: thongBaoKhoa(khoaDen) });
        }

        bamGia ??= bamMatKhau(taoToken());
        const dung = await kiemMatKhau(matKhau, tk ? tk.mat_khau_bam : await bamGia);
        if (!tk || !dung) {
            saiTheoIp.ghi(ip);
            let khoaMoi: number | null = null;
            if (tk) {
                const soLan = (tk.khoa_den && tk.khoa_den <= luc ? 0 : tk.so_lan_sai) + 1;
                if (soLan >= SO_LAN_SAI_TOI_DA) {
                    khoaMoi = luc + THOI_GIAN_KHOA;
                    db.prepare('UPDATE tai_khoan SET so_lan_sai = 0, khoa_den = ? WHERE id = ?').run(khoaMoi, tk.id);
                    nk({ taiKhoanId: null, hanhDong: 'tam_khoa_dang_nhap', doiTuong: `tai_khoan:${tk.id}`, ip, chiTiet: { phut: THOI_GIAN_KHOA / 60_000 } });
                } else {
                    db.prepare('UPDATE tai_khoan SET so_lan_sai = ?, khoa_den = NULL WHERE id = ?').run(soLan, tk.id);
                    nk({ taiKhoanId: null, hanhDong: 'dang_nhap_sai', doiTuong: `tai_khoan:${tk.id}`, ip, chiTiet: { lan: soLan } });
                }
            } else {
                const cu = saiKhongCo.get(khoaAo);
                const soLan = (cu && cu.khoaDen > 0 && cu.khoaDen <= luc ? 0 : cu?.soLan ?? 0) + 1;
                if (soLan >= SO_LAN_SAI_TOI_DA) { khoaMoi = luc + THOI_GIAN_KHOA; }
                saiKhongCo.set(khoaAo, { soLan: khoaMoi ? 0 : soLan, khoaDen: khoaMoi ?? 0 });
                if (saiKhongCo.size > 20_000) { saiKhongCo.delete(saiKhongCo.keys().next().value as string); }
            }
            return hienDangNhap(req, res, khoaMoi ? 429 : 401, { tiep, dinhDanh: dinhDanhVao, loi: khoaMoi ? thongBaoKhoa(khoaMoi) : LOI_DANG_NHAP });
        }

        // Đúng mật khẩu: lúc này mới được báo tình trạng tài khoản
        db.prepare('UPDATE tai_khoan SET so_lan_sai = 0, khoa_den = NULL WHERE id = ?').run(tk.id);
        const lyDo = lyDoKhongDung(tk, luc);
        if (lyDo) {
            nk({ taiKhoanId: tk.id, hanhDong: 'dang_nhap_bi_tu_choi', doiTuong: `tai_khoan:${tk.id}`, ip, chiTiet: { trang_thai: tk.trang_thai } });
            return hienDangNhap(req, res, 403, { tiep, dinhDanh: dinhDanhVao, loi: lyDo });
        }
        saiTheoIp.xoa(ip);
        kho.tao(res, tk.id, ip, String(req.headers['user-agent'] ?? ''));
        db.prepare('UPDATE tai_khoan SET dang_nhap_cuoi = ? WHERE id = ?').run(luc, tk.id);
        nk({ taiKhoanId: tk.id, hanhDong: 'dang_nhap', doiTuong: `tai_khoan:${tk.id}`, ip, chiTiet: { bang: dd.loai === 'email' ? 'email' : 'so_dien_thoai' } });
        diTiep(res, tk, tiep);
    }

    // ---------------- Đăng xuất ----------------

    async function dangXuat(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const p = kho.doc(req);
        if (req.method !== 'POST') {
            if (!p) { return chuyenHuong(res, '/dang-nhap', 302); }
            return guiHtml(res, 200, trangDangXuat({ csrf: kho.csrf(p.tokenBam), nguoi: p.tk }));
        }
        const form = await docForm(req);
        if (p) {
            kiemBieuMau(req, p, form);
            const phamVi = form.get('pham_vi');
            const ip = layIp(req);
            if (phamVi === 'thiet-bi-khac') {
                const so = kho.huyTatCa(p.tk.id, p.tokenBam);
                nk({ taiKhoanId: p.tk.id, hanhDong: 'dang_xuat_thiet_bi_khac', doiTuong: `tai_khoan:${p.tk.id}`, ip, chiTiet: { so_phien: so } });
                return chuyenHuong(res, '/tai-khoan?thong_bao=dang-xuat-khac');
            }
            if (phamVi === 'tat-ca') {
                const so = kho.huyTatCa(p.tk.id);
                nk({ taiKhoanId: p.tk.id, hanhDong: 'dang_xuat_moi_thiet_bi', doiTuong: `tai_khoan:${p.tk.id}`, ip, chiTiet: { so_phien: so } });
            } else {
                kho.huy(p.tokenBam);
                nk({ taiKhoanId: p.tk.id, hanhDong: 'dang_xuat', doiTuong: `tai_khoan:${p.tk.id}`, ip });
            }
        }
        kho.xoaCookie(res);
        chuyenHuong(res, '/dang-nhap?thong_bao=da-dang-xuat');
    }

    // ---------------- Đổi mật khẩu ----------------

    async function doiMatKhau(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
        const p = kho.doc(req);
        const tiepGet = tiepAnToan(url.searchParams.get('tiep'));
        if (!p || lyDoKhongDung(p.tk, bayGio())) { return chuyenDenDangNhap(res, url.pathname + url.search); }
        const lanDau = p.tk.phai_doi_mat_khau === 1;
        const hien = (trangThai: number, tiep: string, loi?: string): void =>
            guiHtml(res, trangThai, trangDoiMatKhau({ csrf: kho.csrf(p.tokenBam), tiep, loi, lanDau, nguoi: p.tk }));
        if (req.method !== 'POST') { return hien(200, tiepGet); }

        const form = await docForm(req);
        kiemBieuMau(req, p, form);
        const tiep = tiepAnToan(form.get('tiep'));
        const ip = layIp(req);
        const chan = chanTanSuat(ip);
        if (chan) { return hien(429, tiep, chan); }
        guiTheoIp.ghi(ip);
        const cu = form.get('mat_khau_cu') ?? '', moi = form.get('mat_khau_moi') ?? '', nhapLai = form.get('nhap_lai') ?? '';
        if (moi.length > 200) { return hien(400, tiep, 'Mật khẩu quá dài (tối đa 200 ký tự).'); }
        if (!(await kiemMatKhau(cu, p.tk.mat_khau_bam))) {
            saiTheoIp.ghi(ip);
            nk({ taiKhoanId: p.tk.id, hanhDong: 'doi_mat_khau_sai', doiTuong: `tai_khoan:${p.tk.id}`, ip });
            return hien(400, tiep, 'Mật khẩu hiện tại không đúng.');
        }
        if (moi !== nhapLai) { return hien(400, tiep, 'Hai lần nhập mật khẩu mới không khớp nhau.'); }
        const loi = loiMatKhauTaiKhoan(moi, p.tk);
        if (loi) { return hien(400, tiep, loi); }
        if (moi === cu) { return hien(400, tiep, 'Mật khẩu mới phải khác mật khẩu hiện tại.'); }

        const bam = await bamMatKhau(moi);
        db.prepare('UPDATE tai_khoan SET mat_khau_bam = ?, phai_doi_mat_khau = 0, cap_nhat_luc = ? WHERE id = ?').run(bam, bayGio(), p.tk.id);
        const soPhien = kho.huyTatCa(p.tk.id, p.tokenBam);
        kho.doiToken(res, p);
        nk({ taiKhoanId: p.tk.id, hanhDong: lanDau ? 'doi_mat_khau_lan_dau' : 'doi_mat_khau', doiTuong: `tai_khoan:${p.tk.id}`, ip, chiTiet: { so_phien_da_huy: soPhien } });
        diTiep(res, docTk(p.tk.id), tiep, 'doi-mat-khau');
    }

    // ---------------- Trang tài khoản ----------------

    function hienTaiKhoan(res: ServerResponse, p: PhienHienTai, trangThai: number, them: { loi?: string; tin?: string; lienHe?: { email: string; soDienThoai: string } } = {}): void {
        const luc = bayGio();
        const donVi = p.tk.don_vi_id === null ? undefined : db.prepare('SELECT ten FROM don_vi WHERE id = ?').get(p.tk.don_vi_id) as { ten: string } | undefined;
        const thang = thangViet(luc);
        guiHtml(res, trangThai, trangTaiKhoan({
            nguoi: p.tk, csrf: kho.csrf(p.tokenBam), tenDonVi: donVi?.ten ?? null, daDung: congAi.daDungThang(p.tk.id, thang), thang,
            phien: kho.dsPhien(p.tk.id), tokenBamHienTai: p.tokenBam, ...them,
        }));
    }

    /** Người dùng tự sửa email/số điện thoại đăng nhập: phải nhập lại mật khẩu hiện tại, kiểm trùng. */
    async function suaLienHe(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
        const p = canPhienDu(req, res, url);
        if (!p) { return; }
        const form = await docForm(req);
        kiemBieuMau(req, p, form);
        const vao = { email: (form.get('email') ?? '').slice(0, 254), soDienThoai: (form.get('so_dien_thoai') ?? '').slice(0, 20) };
        const ip = layIp(req);
        const chan = chanTanSuat(ip);
        if (chan) { return hienTaiKhoan(res, p, 429, { loi: chan, lienHe: vao }); }
        guiTheoIp.ghi(ip);
        if (!(await kiemMatKhau(form.get('mat_khau') ?? '', p.tk.mat_khau_bam))) {
            saiTheoIp.ghi(ip);
            return hienTaiKhoan(res, p, 400, { loi: 'Mật khẩu hiện tại không đúng — chưa lưu thay đổi email/số điện thoại.', lienHe: vao });
        }
        const lh = kiemLienHe(db, vao, p.tk.id);
        if (lh.loi.length) { return hienTaiKhoan(res, p, 400, { loi: lh.loi.join(' '), lienHe: vao }); }
        if (lh.email === p.tk.email && lh.soDienThoai === p.tk.so_dien_thoai) { return chuyenHuong(res, '/tai-khoan'); }
        try {
            db.prepare('UPDATE tai_khoan SET email = ?, so_dien_thoai = ?, ten_dang_nhap = ?, cap_nhat_luc = ? WHERE id = ?')
                .run(lh.email, lh.soDienThoai, khoaNoiBo(lh.email, lh.soDienThoai), bayGio(), p.tk.id);
        } catch (e) {
            if (!/UNIQUE/i.test(String((e as Error).message))) { throw e; }
            return hienTaiKhoan(res, p, 400, { loi: 'Email hoặc số điện thoại vừa được dùng cho tài khoản khác.', lienHe: vao });
        }
        nk({
            taiKhoanId: p.tk.id, hanhDong: 'tu_sua_lien_he', doiTuong: `tai_khoan:${p.tk.id}`, ip,
            chiTiet: { truoc: { email: p.tk.email, so_dien_thoai: p.tk.so_dien_thoai }, sau: { email: lh.email, so_dien_thoai: lh.soDienThoai } },
        });
        chuyenHuong(res, '/tai-khoan?thong_bao=lien-he');
    }

    function quanTri(req: IncomingMessage, res: ServerResponse, url: URL): void {
        const p = canPhienDu(req, res, url);
        if (!p) { return; }
        const trang = url.pathname === '/quan-tri' ? 'tai-khoan' : url.pathname.slice('/quan-tri/'.length);
        const csrf = kho.csrf(p.tokenBam);
        if (!laQuanTri(p.tk.vai_tro)) {
            return guiHtml(res, 403, trangLoi({ trangThai: 403, tieuDe: 'Không có quyền truy cập', noiDung: 'Trang quản trị chỉ dành cho quản trị hệ thống và quản trị đơn vị.', nguoi: p.tk, csrf }));
        }
        if (!TRANG_QUAN_TRI.has(trang)) {
            return guiHtml(res, 404, trangLoi({ trangThai: 404, tieuDe: 'Không tìm thấy trang', noiDung: 'Đường dẫn này không có trong trang quản trị.', nguoi: p.tk, csrf }));
        }
        if ((trang === 'don-vi' || trang === 'bang-gia') && p.tk.vai_tro !== 'quan_tri_he_thong') {
            return guiHtml(res, 403, trangLoi({ trangThai: 403, tieuDe: 'Không có quyền truy cập', noiDung: 'Mục này chỉ dành cho quản trị hệ thống.', nguoi: p.tk, csrf }));
        }
        guiHtml(res, 200, trangQuanTri({ nguoi: p.tk, csrf, trang }));
    }

    async function api(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
        if (!url.pathname.startsWith('/api/quan-tri/')) { throw new LoiHttp(404, 'Không có chức năng này.'); }
        const p = kho.doc(req);
        if (!p || lyDoKhongDung(p.tk, bayGio()) || buocConThieu(p.tk)) {
            throw new LoiHttp(401, 'Phiên đăng nhập đã hết hạn. Vui lòng tải lại trang để đăng nhập lại.');
        }
        if (!laQuanTri(p.tk.vai_tro)) { throw new LoiHttp(403, 'Bạn không có quyền quản trị.'); }
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            if (!cungNguonGoc(req, cauHinh.https) || !kho.kiemCsrf(p.tokenBam, req.headers['x-aword-csrf'])) {
                throw new LoiHttp(403, 'Yêu cầu bị từ chối vì không hợp lệ. Vui lòng tải lại trang rồi thử lại.');
            }
        }
        await apiQuanTri(req, res, url, p, layIp(req));
    }

    function taiNguyenTinh(req: IncomingMessage, res: ServerResponse, url: URL): void {
        const tn = taiNguyen.get(url.pathname);
        if (!tn || (req.method !== 'GET' && req.method !== 'HEAD')) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Không tìm thấy.');
            return;
        }
        if (req.headers['if-none-match'] === tn.etag) {
            res.writeHead(304, { ETag: tn.etag, 'Cache-Control': 'no-cache' });
            res.end();
            return;
        }
        res.writeHead(200, { 'Content-Type': tn.loai, 'Content-Length': tn.noiDung.length, ETag: tn.etag, 'Cache-Control': 'no-cache' });
        res.end(req.method === 'HEAD' ? undefined : tn.noiDung);
    }

    async function dinhTuyen(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
        const d = url.pathname;
        const pt = req.method ?? 'GET';
        if (d.startsWith('/_aword/')) { return taiNguyenTinh(req, res, url); }
        if (d === '/api' || d.startsWith('/api/')) { return api(req, res, url); }
        const laGet = pt === 'GET' || pt === 'HEAD';
        if (!laGet && pt !== 'POST') { throw new LoiHttp(405, 'Phương thức không được hỗ trợ.'); }
        if (d === '/dang-nhap') { return laGet ? dangNhapGet(req, res, url) : dangNhapPost(req, res); }
        if (d === '/dang-xuat') { return dangXuat(req, res); }
        if (d === '/doi-mat-khau') { return doiMatKhau(req, res, url); }
        if (d === '/tai-khoan' && laGet) {
            const p = canPhienDu(req, res, url);
            return p ? hienTaiKhoan(res, p, 200, { tin: THONG_BAO[url.searchParams.get('thong_bao') ?? ''] }) : undefined;
        }
        if (d === '/tai-khoan/lien-he' && pt === 'POST') { return suaLienHe(req, res, url); }
        if ((d === '/quan-tri' || d.startsWith('/quan-tri/')) && laGet) { return quanTri(req, res, url); }
        throw new LoiHttp(404, 'Không tìm thấy trang bạn cần.');
    }

    async function xuLy(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
        let url: URL;
        try {
            url = new URL(req.url ?? '/', 'http://may-chu.invalid');
        } catch {
            return false;
        }
        if (!laDuongDanCong(url.pathname) || laMayCon(req, cauHinh.tenMien)) { return false; }
        datHeaderBaoMat(res, cauHinh.https);
        try {
            await dinhTuyen(req, res, url);
        } catch (e) {
            const trangThai = e instanceof LoiHttp ? e.trangThai : 500;
            const thongBao = e instanceof LoiHttp ? e.message : 'Máy chủ gặp lỗi khi xử lý yêu cầu. Vui lòng thử lại sau ít phút.';
            if (!(e instanceof LoiHttp)) { console.error('[cong-truy-cap]', e); }
            if (res.headersSent) {
                res.destroy();
            } else if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
                guiJson(res, trangThai, { loi: thongBao });
            } else {
                guiHtml(res, trangThai, trangLoi({ trangThai, tieuDe: trangThai === 404 ? 'Không tìm thấy trang' : 'Không thực hiện được', noiDung: thongBao }));
            }
        }
        return true;
    }

    return { xuLy, xacThucYeuCau };
}
