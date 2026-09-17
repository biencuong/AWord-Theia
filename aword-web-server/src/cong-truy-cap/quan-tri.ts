// API JSON của trang quản trị: /api/quan-tri/*. Cổng truy cập đã kiểm tra phiên đủ bước, vai trò quản trị, nguồn gốc
// và token CSRF trước khi gọi vào đây. Phân quyền theo đơn vị được thực thi tại từng thao tác (không tin giao diện).
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import type { CauHinh } from '../cau-hinh.ts';
import { giaoDich, thangViet } from '../csdl/csdl.ts';
import { ghiCsv } from '../tai-khoan/csv.ts';
import { COT_NHAP, docBangNhap, docDongGuiLai, kiemDanhSachNhap } from '../tai-khoan/nhap-danh-sach.ts';
import {
    TEN_TRANG_THAI, TEN_VAI_TRO, docNgay, docTien, duocQuanLy, ghiNhatKyLuc, hanDungSangNgay, khoaNoiBo, kiemLienHe,
    kiemTaiKhoanMoi, laTrangThai, laVaiTro, loiPhanQuyenGan, sinhMatKhauTam, taoCacTaiKhoan,
} from '../tai-khoan/tai-khoan.ts';
import type { DongTaiKhoan, NguoiThucHien, TrangThai, VaiTro } from '../tai-khoan/tai-khoan.ts';
import { bamMatKhau } from '../xac-thuc/ma-hoa.ts';
import type { CongAiToiThieu, DieuPhoiToiThieu } from './cong-truy-cap.ts';
import { LoiHttp, docJson, docThan, guiJson } from './http.ts';
import type { KhoPhien, PhienHienTai } from './phien.ts';

const SO_MOI_TRANG = 50;
const NHA_CUNG_CAP = ['anthropic', 'deepseek', 'openai'];

interface DongTaiKhoanDonVi extends DongTaiKhoan { ten_don_vi: string | null; ma_don_vi: string | null }
interface DongBangGia {
    ma: string; nha_cung_cap: string; mo_hinh_goc: string; ten_hien_thi: string; gia_vao: number; gia_ra: number;
    gia_cache_doc: number; gia_cache_ghi: number; bat: number; cap_nhat_luc: number;
}

/** Chuẩn hóa để tìm kiếm tiếng Việt không phân biệt dấu/hoa thường ("nguyen van a" khớp "Nguyễn Văn A"). */
export function chuanHoaTim(s: string): string {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
}

export function taoApiQuanTri(ctx: {
    db: DatabaseSync; cauHinh: CauHinh; dieuPhoi: DieuPhoiToiThieu; congAi: CongAiToiThieu; bayGio: () => number; kho: KhoPhien;
}) {
    const { db, congAi, dieuPhoi, kho } = ctx;
    db.function('aword_chuan_hoa', { deterministic: true }, (s: unknown) => chuanHoaTim(s === null || s === undefined ? '' : String(s)));

    const docTaiKhoan = (id: number): DongTaiKhoanDonVi | undefined => db.prepare(
        'SELECT tk.*, dv.ten AS ten_don_vi, dv.ma AS ma_don_vi FROM tai_khoan tk LEFT JOIN don_vi dv ON dv.id = tk.don_vi_id WHERE tk.id = ?',
    ).get(id) as DongTaiKhoanDonVi | undefined;

    function sangJson(tk: DongTaiKhoanDonVi, luc: number) {
        return {
            id: tk.id, hoTen: tk.ho_ten, email: tk.email, soDienThoai: tk.so_dien_thoai,
            donViId: tk.don_vi_id, tenDonVi: tk.ten_don_vi, maDonVi: tk.ma_don_vi,
            vaiTro: tk.vai_tro, trangThai: tk.trang_thai,
            hetHan: tk.han_dung !== null && tk.han_dung <= luc,
            tamKhoaDen: tk.khoa_den !== null && tk.khoa_den > luc ? tk.khoa_den : null,
            hanDung: hanDungSangNgay(tk.han_dung), hanMucThangDong: tk.han_muc_thang_dong,
            daDungThang: congAi.daDungThang(tk.id, thangViet(luc)),
            phaiDoiMatKhau: tk.phai_doi_mat_khau === 1,
            taoLuc: tk.tao_luc, dangNhapCuoi: tk.dang_nhap_cuoi,
        };
    }

    const dungDuoc = (tk: { trang_thai: TrangThai; han_dung: number | null }, luc: number): boolean =>
        tk.trang_thai === 'hoat_dong' && (tk.han_dung === null || tk.han_dung > luc);

    /** Tài khoản không còn dùng được: hủy phiên đăng nhập, thu hồi token Cổng AI, dừng phiên làm việc. */
    async function ngatTaiKhoan(taiKhoanId: number, nguoiLamId: number, ip: string): Promise<void> {
        kho.huyTatCa(taiKhoanId);
        congAi.thuHoiToken(taiKhoanId);
        try {
            await dieuPhoi.dungPhien(taiKhoanId);
        } catch (e) {
            console.error('[quan-tri] dừng phiên làm việc lỗi', e);
            ghiNhatKyLuc(db, ctx.bayGio(), { taiKhoanId: nguoiLamId, hanhDong: 'loi_dung_phien', doiTuong: `tai_khoan:${taiKhoanId}`, ip, chiTiet: { loi: String((e as Error).message ?? e) } });
        }
    }

    function taiKhoanTrongPhamVi(nguoi: NguoiThucHien, idChuoi: string): DongTaiKhoanDonVi {
        const tk = docTaiKhoan(Number(idChuoi));
        // Ngoài phạm vi → báo "không tìm thấy" (không để lộ tài khoản đơn vị khác có tồn tại)
        if (!tk || !duocQuanLy(nguoi, tk)) { throw new LoiHttp(404, 'Không tìm thấy tài khoản.'); }
        return tk;
    }

    const canHeThong = (nguoi: NguoiThucHien): void => {
        if (nguoi.vaiTro !== 'quan_tri_he_thong') { throw new LoiHttp(403, 'Chỉ quản trị hệ thống được thực hiện thao tác này.'); }
    };

    const conQuanTriHeThongKhac = (tru: number): boolean => !!db.prepare(
        "SELECT 1 FROM tai_khoan WHERE vai_tro = 'quan_tri_he_thong' AND trang_thai = 'hoat_dong' AND id <> ? LIMIT 1",
    ).get(tru);

    // ---------------- Tài khoản ----------------

    function dsTaiKhoan(nguoi: NguoiThucHien, q: URLSearchParams, luc: number) {
        const dieuKien: string[] = [];
        const thamSo: Array<string | number> = [];
        if (nguoi.vaiTro === 'quan_tri_don_vi') {
            dieuKien.push("tk.don_vi_id = ? AND tk.vai_tro <> 'quan_tri_he_thong'");
            thamSo.push(nguoi.donViId as number);
        }
        const donVi = q.get('don_vi') ?? '';
        if (donVi === 'khong') { dieuKien.push('tk.don_vi_id IS NULL'); } else if (/^\d+$/.test(donVi)) { dieuKien.push('tk.don_vi_id = ?'); thamSo.push(Number(donVi)); }
        const trangThai = q.get('trang_thai') ?? '';
        if (trangThai === 'hoat_dong') {
            dieuKien.push("tk.trang_thai = 'hoat_dong' AND (tk.han_dung IS NULL OR tk.han_dung > ?)");
            thamSo.push(luc);
        } else if (trangThai === 'het_han') {
            dieuKien.push('tk.han_dung IS NOT NULL AND tk.han_dung <= ?');
            thamSo.push(luc);
        } else if (trangThai === 'tam_khoa') {
            dieuKien.push('tk.khoa_den IS NOT NULL AND tk.khoa_den > ?');
            thamSo.push(luc);
        } else if (laTrangThai(trangThai)) {
            dieuKien.push('tk.trang_thai = ?');
            thamSo.push(trangThai);
        }
        const vaiTro = q.get('vai_tro') ?? '';
        if (laVaiTro(vaiTro)) { dieuKien.push('tk.vai_tro = ?'); thamSo.push(vaiTro); }
        let tim = chuanHoaTim((q.get('tim') ?? '').trim()).slice(0, 100);
        if (/^[\d\s.+()-]+$/.test(tim) && /\d{3}/.test(tim.replace(/\D/g, ''))) {
            // Tìm theo số điện thoại: bỏ dấu cách/chấm, "+84"/"84" đầu → "0"
            tim = tim.replace(/\D/g, '').replace(/^84(?=[35789])/, '0');
        }
        if (tim !== '') {
            dieuKien.push("aword_chuan_hoa(tk.ho_ten || ' ' || coalesce(tk.email, '') || ' ' || coalesce(tk.so_dien_thoai, '')) LIKE ? ESCAPE '\\'");
            thamSo.push(`%${tim.replace(/[\\%_]/g, c => `\\${c}`)}%`);
        }
        const where = dieuKien.length ? `WHERE ${dieuKien.map(d => `(${d})`).join(' AND ')}` : '';
        const tong = Number((db.prepare(`SELECT COUNT(*) AS n FROM tai_khoan tk ${where}`).get(...thamSo) as { n: number }).n);
        const trang = Math.max(1, Math.min(10_000, Number(q.get('trang')) || 1));
        const ds = db.prepare(`SELECT tk.*, dv.ten AS ten_don_vi, dv.ma AS ma_don_vi FROM tai_khoan tk LEFT JOIN don_vi dv ON dv.id = tk.don_vi_id
            ${where} ORDER BY tk.ho_ten COLLATE NOCASE, tk.id LIMIT ? OFFSET ?`)
            .all(...thamSo, SO_MOI_TRANG, (trang - 1) * SO_MOI_TRANG) as unknown as DongTaiKhoanDonVi[];
        return { tong, trang, soMoiTrang: SO_MOI_TRANG, ds: ds.map(tk => sangJson(tk, luc)) };
    }

    async function suaTaiKhoan(nguoi: NguoiThucHien, tk: DongTaiKhoanDonVi, than: Record<string, unknown>, ip: string) {
        const luc = ctx.bayGio();
        const moi = {
            ho_ten: tk.ho_ten, email: tk.email, so_dien_thoai: tk.so_dien_thoai, vai_tro: tk.vai_tro as VaiTro, don_vi_id: tk.don_vi_id,
            han_dung: tk.han_dung, han_muc_thang_dong: tk.han_muc_thang_dong, trang_thai: tk.trang_thai as TrangThai,
        };
        const loi: string[] = [];
        if ('hoTen' in than) {
            const v = String(than.hoTen ?? '').trim().replace(/\s+/g, ' ');
            if (v === '' || v.length > 120) { loi.push('Họ tên không được để trống (tối đa 120 ký tự).'); } else { moi.ho_ten = v; }
        }
        if ('email' in than || 'soDienThoai' in than) {
            const lh = kiemLienHe(db, {
                email: 'email' in than ? than.email : tk.email,
                soDienThoai: 'soDienThoai' in than ? than.soDienThoai : tk.so_dien_thoai,
            }, tk.id);
            loi.push(...lh.loi);
            moi.email = lh.email;
            moi.so_dien_thoai = lh.soDienThoai;
        }
        if ('vaiTro' in than) {
            if (!laVaiTro(than.vaiTro)) { loi.push('Vai trò không hợp lệ.'); } else { moi.vai_tro = than.vaiTro; }
        }
        if ('donViId' in than) {
            if (than.donViId === null || than.donViId === '') { moi.don_vi_id = null; } else {
                const id = Number(than.donViId);
                if (!Number.isSafeInteger(id) || !db.prepare('SELECT 1 FROM don_vi WHERE id = ?').get(id)) { loi.push('Đơn vị không tồn tại.'); } else { moi.don_vi_id = id; }
            }
        }
        if ('hanDung' in than) {
            const v = docNgay(than.hanDung === null ? '' : String(than.hanDung));
            if (v === undefined) { loi.push('Hạn dùng không đúng dạng ngày.'); } else { moi.han_dung = v; }
        }
        if ('hanMucThangDong' in than) {
            const v = than.hanMucThangDong === null ? null : docTien(typeof than.hanMucThangDong === 'number' ? than.hanMucThangDong : String(than.hanMucThangDong));
            if (v === undefined) { loi.push('Hạn mức tháng phải là số đồng không âm (để trống nếu không giới hạn).'); } else { moi.han_muc_thang_dong = v; }
        }
        if ('trangThai' in than) {
            if (!laTrangThai(than.trangThai)) { loi.push('Trạng thái không hợp lệ.'); } else { moi.trang_thai = than.trangThai; }
        }
        if (loi.length) { throw new LoiHttp(400, loi.join(' ')); }

        const doiQuyen = moi.vai_tro !== tk.vai_tro || moi.don_vi_id !== tk.don_vi_id;
        if (tk.id === nguoi.id && (doiQuyen || moi.trang_thai !== tk.trang_thai)) {
            throw new LoiHttp(400, 'Bạn không thể tự đổi vai trò, đơn vị hay trạng thái của chính mình.');
        }
        if (doiQuyen) {
            const l = loiPhanQuyenGan(nguoi, moi.vai_tro, moi.don_vi_id);
            if (l) { throw new LoiHttp(403, l); }
        }
        if (tk.vai_tro === 'quan_tri_he_thong' && (moi.vai_tro !== 'quan_tri_he_thong' || moi.trang_thai !== 'hoat_dong') && !conQuanTriHeThongKhac(tk.id)) {
            throw new LoiHttp(400, 'Đây là quản trị hệ thống duy nhất đang hoạt động — không thể khóa hoặc đổi vai trò.');
        }

        const truoc: Record<string, unknown> = {}, sau: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(moi)) {
            if ((tk as unknown as Record<string, unknown>)[k] !== v) { truoc[k] = (tk as unknown as Record<string, unknown>)[k]; sau[k] = v; }
        }
        if (Object.keys(sau).length === 0) { return sangJson(tk, luc); }
        giaoDich(db, () => {
            try {
                db.prepare(`UPDATE tai_khoan SET ho_ten = ?, email = ?, so_dien_thoai = ?, ten_dang_nhap = ?, vai_tro = ?, don_vi_id = ?, han_dung = ?,
                    han_muc_thang_dong = ?, trang_thai = ?, cap_nhat_luc = ? ${moi.trang_thai === 'hoat_dong' && tk.trang_thai !== 'hoat_dong' ? ', so_lan_sai = 0, khoa_den = NULL' : ''} WHERE id = ?`)
                    .run(moi.ho_ten, moi.email, moi.so_dien_thoai, khoaNoiBo(moi.email, moi.so_dien_thoai), moi.vai_tro, moi.don_vi_id, moi.han_dung,
                        moi.han_muc_thang_dong, moi.trang_thai, luc, tk.id);
            } catch (e) {
                if (/UNIQUE/i.test(String((e as Error).message))) { throw new LoiHttp(400, 'Email hoặc số điện thoại vừa được dùng cho tài khoản khác.'); }
                throw e;
            }
            const hanhDong = 'trang_thai' in sau ? (moi.trang_thai === 'khoa' ? 'khoa_tai_khoan' : moi.trang_thai === 'hoat_dong' ? 'mo_khoa_tai_khoan' : 'doi_trang_thai') : 'sua_tai_khoan';
            ghiNhatKyLuc(db, luc, { taiKhoanId: nguoi.id, hanhDong, doiTuong: `tai_khoan:${tk.id}`, ip, chiTiet: { truoc, sau } });
        });
        if (dungDuoc(tk, luc) && !dungDuoc(moi, luc)) { await ngatTaiKhoan(tk.id, nguoi.id, ip); }
        return sangJson(docTaiKhoan(tk.id) as DongTaiKhoanDonVi, luc);
    }

    // ---------------- Đơn vị & bảng giá ----------------

    function kiemDonVi(than: Record<string, unknown>, id?: number): { ma: string; ten: string } {
        const ma = String(than.ma ?? '').trim();
        const ten = String(than.ten ?? '').trim().replace(/\s+/g, ' ');
        if (!/^[A-Za-z0-9._-]{1,32}$/.test(ma)) { throw new LoiHttp(400, 'Mã đơn vị gồm 1–32 ký tự: chữ không dấu, số, dấu . _ - (vd THCS01).'); }
        if (ten === '' || ten.length > 200) { throw new LoiHttp(400, 'Tên đơn vị không được để trống (tối đa 200 ký tự).'); }
        if (db.prepare('SELECT 1 FROM don_vi WHERE ma = ? COLLATE NOCASE AND id <> ?').get(ma, id ?? -1)) {
            throw new LoiHttp(400, `Mã đơn vị "${ma}" đã có.`);
        }
        return { ma, ten };
    }

    const giaJson = (g: DongBangGia) => ({
        ma: g.ma, nhaCungCap: g.nha_cung_cap, moHinhGoc: g.mo_hinh_goc, tenHienThi: g.ten_hien_thi,
        giaVao: g.gia_vao, giaRa: g.gia_ra, giaCacheDoc: g.gia_cache_doc, giaCacheGhi: g.gia_cache_ghi, bat: g.bat === 1, capNhatLuc: g.cap_nhat_luc,
    });

    function soGia(v: unknown, ten: string): number {
        const n = typeof v === 'number' ? v : docTien(String(v ?? ''));
        if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0) { throw new LoiHttp(400, `${ten} phải là số đồng không âm.`); }
        return n;
    }

    /**
     * Ép cờ bật/tắt về 0|1, KHÔNG dùng tính đúng-sai của giá trị.
     *
     * Bản cũ viết `t.bat ? 1 : 0`, mà `"false"` và `"0"` đều là chuỗi khác rỗng nên đều là "đúng" — khách
     * gửi JSON `{"bat":"false"}` để TẮT mô hình lại bật nó lên. Với mô hình để giá 0 thì hậu quả không
     * chỉ là hiển thị sai: mô hình được phục vụ bằng khóa thật của cơ quan, ghi nhận 0 đồng, nên hạn mức
     * tháng không bao giờ chặn trong khi tiền vẫn chi. Nhận đúng cả dạng chuỗi/số mà biểu mẫu và script
     * hay gửi, còn lại thì từ chối chứ không đoán.
     */
    function coKhong(v: unknown, ten: string, macDinh: number): number {
        if (v === undefined || v === null) { return macDinh; }
        if (v === true || v === 1) { return 1; }
        if (v === false || v === 0) { return 0; }
        if (typeof v === 'string') {
            const s = v.trim().toLowerCase();
            if (['true', '1', 'on', 'bat', 'bật', 'co', 'có'].includes(s)) { return 1; }
            if (['false', '0', 'off', 'tat', 'tắt', 'khong', 'không', ''].includes(s)) { return 0; }
        }
        throw new LoiHttp(400, `${ten} chỉ nhận đúng/sai (true|false).`);
    }

    // ---------------- Định tuyến ----------------

    return async function xuLyApi(req: IncomingMessage, res: ServerResponse, url: URL, p: PhienHienTai, ip: string): Promise<void> {
        const nguoi: NguoiThucHien = { id: p.tk.id, vaiTro: p.tk.vai_tro, donViId: p.tk.don_vi_id };
        const duong = url.pathname.slice('/api/quan-tri'.length) || '/';
        const pt = req.method === 'HEAD' ? 'GET' : (req.method ?? 'GET');
        const luc = ctx.bayGio();
        let m: RegExpExecArray | null;
        const canDonVi = (): void => {
            if (nguoi.vaiTro === 'quan_tri_don_vi' && nguoi.donViId === null) {
                throw new LoiHttp(403, 'Tài khoản quản trị đơn vị của bạn chưa được gắn đơn vị. Liên hệ quản trị hệ thống.');
            }
        };

        if (duong === '/thong-tin' && pt === 'GET') {
            const donVi = nguoi.vaiTro === 'quan_tri_he_thong'
                ? db.prepare('SELECT id, ma, ten FROM don_vi ORDER BY ten COLLATE NOCASE').all()
                : db.prepare('SELECT id, ma, ten FROM don_vi WHERE id = ?').all(nguoi.donViId ?? -1);
            return guiJson(res, 200, {
                toi: { id: p.tk.id, hoTen: p.tk.ho_ten, email: p.tk.email, soDienThoai: p.tk.so_dien_thoai, vaiTro: p.tk.vai_tro, donViId: p.tk.don_vi_id },
                donVi, vaiTro: TEN_VAI_TRO, trangThai: TEN_TRANG_THAI, thang: thangViet(luc), cotNhap: COT_NHAP,
            });
        }

        if (duong === '/tai-khoan' && pt === 'GET') { canDonVi(); return guiJson(res, 200, dsTaiKhoan(nguoi, url.searchParams, luc)); }

        if (duong === '/tai-khoan' && pt === 'POST') {
            canDonVi();
            const than = await docJson(req);
            const { duLieu, loi } = kiemTaiKhoanMoi(db, nguoi, than, luc);
            if (!duLieu) { return guiJson(res, 400, { loi: loi.join(' '), chiTiet: loi }); }
            const [tao] = await taoCacTaiKhoan(db, [duLieu], { nguoiLamId: nguoi.id, bayGio: luc, ip });
            return guiJson(res, 201, { taiKhoan: sangJson(docTaiKhoan(tao.id) as DongTaiKhoanDonVi, luc), matKhauTam: tao.matKhauTam });
        }

        if ((m = /^\/tai-khoan\/(\d+)$/.exec(duong))) {
            canDonVi();
            const tk = taiKhoanTrongPhamVi(nguoi, m[1]);
            if (pt === 'GET') { return guiJson(res, 200, sangJson(tk, luc)); }
            if (pt === 'PUT') { return guiJson(res, 200, await suaTaiKhoan(nguoi, tk, await docJson(req), ip)); }
        }

        if ((m = /^\/tai-khoan\/(\d+)\/(khoa|mo-khoa|dat-lai-mat-khau)$/.exec(duong)) && pt === 'POST') {
            canDonVi();
            const tk = taiKhoanTrongPhamVi(nguoi, m[1]);
            if (m[2] === 'khoa') { return guiJson(res, 200, await suaTaiKhoan(nguoi, tk, { trangThai: 'khoa' }, ip)); }
            if (m[2] === 'mo-khoa') {
                if (tk.trang_thai === 'hoat_dong') {
                    // Chỉ gỡ tạm khóa do nhập sai mật khẩu
                    db.prepare('UPDATE tai_khoan SET so_lan_sai = 0, khoa_den = NULL, cap_nhat_luc = ? WHERE id = ?').run(luc, tk.id);
                    ghiNhatKyLuc(db, luc, { taiKhoanId: nguoi.id, hanhDong: 'go_tam_khoa', doiTuong: `tai_khoan:${tk.id}`, ip });
                    return guiJson(res, 200, sangJson(docTaiKhoan(tk.id) as DongTaiKhoanDonVi, luc));
                }
                return guiJson(res, 200, await suaTaiKhoan(nguoi, tk, { trangThai: 'hoat_dong' }, ip));
            }
            // dat-lai-mat-khau
            if (tk.id === nguoi.id) { throw new LoiHttp(400, 'Đổi mật khẩu của chính bạn ở trang Tài khoản của tôi.'); }
            const matKhauTam = sinhMatKhauTam();
            const bam = await bamMatKhau(matKhauTam);
            db.prepare('UPDATE tai_khoan SET mat_khau_bam = ?, phai_doi_mat_khau = 1, so_lan_sai = 0, khoa_den = NULL, cap_nhat_luc = ? WHERE id = ?')
                .run(bam, luc, tk.id);
            const soPhien = kho.huyTatCa(tk.id);
            ghiNhatKyLuc(db, luc, { taiKhoanId: nguoi.id, hanhDong: 'dat_lai_mat_khau', doiTuong: `tai_khoan:${tk.id}`, ip, chiTiet: { so_phien_da_huy: soPhien } });
            return guiJson(res, 200, { taiKhoan: sangJson(docTaiKhoan(tk.id) as DongTaiKhoanDonVi, luc), matKhauTam });
        }

        if (duong === '/nhap/xem-truoc' && pt === 'POST') {
            canDonVi();
            let tenTep = 'danh-sach';
            try { tenTep = decodeURIComponent(String(req.headers['x-aword-ten-tep'] ?? 'danh-sach')); } catch { /* giữ tên mặc định */ }
            const noiDung = await docThan(req, 5 * 1024 * 1024);
            let dong;
            try { dong = docBangNhap(tenTep, noiDung); } catch (e) { throw new LoiHttp(400, (e as Error).message); }
            const kq = kiemDanhSachNhap(db, nguoi, dong, luc);
            return guiJson(res, 200, {
                ds: kq.map(k => ({ soDong: k.soDong, dong: k.dong, loi: k.loi })),
                soHopLe: kq.filter(k => k.loi.length === 0).length, soLoi: kq.filter(k => k.loi.length > 0).length,
            });
        }

        if (duong === '/nhap/ghi' && pt === 'POST') {
            canDonVi();
            const than = await docJson(req);
            let dong;
            try { dong = docDongGuiLai(than.dong); } catch (e) { throw new LoiHttp(400, (e as Error).message); }
            const kq = kiemDanhSachNhap(db, nguoi, dong, luc);
            const hopLe = kq.filter(k => k.duLieu);
            if (hopLe.length === 0) { throw new LoiHttp(400, 'Không có dòng hợp lệ nào để ghi.'); }
            const daTao = await taoCacTaiKhoan(db, hopLe.map(k => k.duLieu!), { nguoiLamId: nguoi.id, bayGio: luc, ip, hanhDong: 'nhap_tai_khoan' });
            ghiNhatKyLuc(db, luc, { taiKhoanId: nguoi.id, hanhDong: 'nhap_danh_sach', ip, chiTiet: { so_tao: daTao.length, so_bo_qua: kq.length - hopLe.length } });
            return guiJson(res, 201, {
                daTao: daTao.map((t, i) => ({ soDong: hopLe[i].soDong, ...t })),
                boQua: kq.filter(k => !k.duLieu).map(k => ({ soDong: k.soDong, hoTen: k.dong.hoTen, loi: k.loi })),
            });
        }

        if (duong === '/nhap/mau.csv' && pt === 'GET') {
            const than = Buffer.from(ghiCsv([
                [...COT_NHAP],
                ['Nguyễn Văn A', 'nguyenvana@truong.edu.vn', '0912345678', 'THCS01', 'Người dùng', '31/12/2026', '200000'],
                ['Trần Thị B', '', '0987654321', 'THCS01', 'Quản trị đơn vị', '', ''],
            ]), 'utf8');
            res.writeHead(200, {
                'Content-Type': 'text/csv; charset=utf-8', 'Content-Length': than.length, 'Cache-Control': 'no-store',
                'Content-Disposition': "attachment; filename=\"mau-nhap-tai-khoan.csv\"",
            });
            res.end(than);
            return;
        }

        if (duong === '/don-vi' && pt === 'GET') {
            const ds = db.prepare(`SELECT dv.id, dv.ma, dv.ten, (SELECT COUNT(*) FROM tai_khoan tk WHERE tk.don_vi_id = dv.id) AS so_tai_khoan
                FROM don_vi dv ${nguoi.vaiTro === 'quan_tri_he_thong' ? '' : 'WHERE dv.id = ?'} ORDER BY dv.ten COLLATE NOCASE`)
                .all(...(nguoi.vaiTro === 'quan_tri_he_thong' ? [] : [nguoi.donViId ?? -1])) as Array<{ id: number; ma: string; ten: string; so_tai_khoan: number }>;
            return guiJson(res, 200, ds.map(d => ({ id: d.id, ma: d.ma, ten: d.ten, soTaiKhoan: d.so_tai_khoan })));
        }
        if (duong === '/don-vi' && pt === 'POST') {
            canHeThong(nguoi);
            const { ma, ten } = kiemDonVi(await docJson(req));
            const id = Number(db.prepare('INSERT INTO don_vi (ma, ten, tao_luc) VALUES (?, ?, ?)').run(ma, ten, luc).lastInsertRowid);
            ghiNhatKyLuc(db, luc, { taiKhoanId: nguoi.id, hanhDong: 'tao_don_vi', doiTuong: `don_vi:${id}`, ip, chiTiet: { ma, ten } });
            return guiJson(res, 201, { id, ma, ten, soTaiKhoan: 0 });
        }
        if ((m = /^\/don-vi\/(\d+)$/.exec(duong)) && (pt === 'PUT' || pt === 'DELETE')) {
            canHeThong(nguoi);
            const id = Number(m[1]);
            const dv = db.prepare('SELECT * FROM don_vi WHERE id = ?').get(id) as { id: number; ma: string; ten: string } | undefined;
            if (!dv) { throw new LoiHttp(404, 'Không tìm thấy đơn vị.'); }
            const soTaiKhoan = Number((db.prepare('SELECT COUNT(*) AS n FROM tai_khoan WHERE don_vi_id = ?').get(id) as { n: number }).n);
            if (pt === 'DELETE') {
                if (soTaiKhoan > 0) { throw new LoiHttp(400, `Đơn vị còn ${soTaiKhoan} tài khoản — chuyển các tài khoản sang đơn vị khác trước khi xóa.`); }
                db.prepare('DELETE FROM don_vi WHERE id = ?').run(id);
                ghiNhatKyLuc(db, luc, { taiKhoanId: nguoi.id, hanhDong: 'xoa_don_vi', doiTuong: `don_vi:${id}`, ip, chiTiet: { ma: dv.ma, ten: dv.ten } });
                return guiJson(res, 200, { daXoa: true });
            }
            const than = await docJson(req);
            const { ma, ten } = kiemDonVi({ ma: than.ma ?? dv.ma, ten: than.ten ?? dv.ten }, id);
            db.prepare('UPDATE don_vi SET ma = ?, ten = ? WHERE id = ?').run(ma, ten, id);
            ghiNhatKyLuc(db, luc, { taiKhoanId: nguoi.id, hanhDong: 'sua_don_vi', doiTuong: `don_vi:${id}`, ip, chiTiet: { truoc: { ma: dv.ma, ten: dv.ten }, sau: { ma, ten } } });
            return guiJson(res, 200, { id, ma, ten, soTaiKhoan });
        }

        if (duong === '/bang-gia' && pt === 'GET') {
            return guiJson(res, 200, (db.prepare('SELECT * FROM bang_gia ORDER BY nha_cung_cap, ten_hien_thi').all() as unknown as DongBangGia[]).map(giaJson));
        }
        if (duong === '/bang-gia' && pt === 'POST') {
            canHeThong(nguoi);
            const t = await docJson(req);
            const ma = String(t.ma ?? '').trim();
            const nhaCungCap = String(t.nhaCungCap ?? '');
            const moHinhGoc = String(t.moHinhGoc ?? '').trim();
            const tenHienThi = String(t.tenHienThi ?? '').trim();
            if (!/^[A-Za-z0-9._:/@[\]-]{1,100}$/.test(ma)) { throw new LoiHttp(400, 'Mã mô hình gồm 1–100 ký tự không dấu, không khoảng trắng (vd claude-sonnet-4-5).'); }
            if (!NHA_CUNG_CAP.includes(nhaCungCap)) { throw new LoiHttp(400, 'Nhà cung cấp chỉ nhận: anthropic, deepseek, openai.'); }
            if (!/^[A-Za-z0-9._:/@[\]-]{1,100}$/.test(moHinhGoc)) { throw new LoiHttp(400, 'Tên mô hình gốc không hợp lệ.'); }
            if (tenHienThi === '' || tenHienThi.length > 100) { throw new LoiHttp(400, 'Tên hiển thị không được để trống.'); }
            if (db.prepare('SELECT 1 FROM bang_gia WHERE ma = ?').get(ma)) { throw new LoiHttp(400, `Mô hình "${ma}" đã có trong bảng giá.`); }
            const g = [soGia(t.giaVao, 'Giá đầu vào'), soGia(t.giaRa, 'Giá đầu ra'), soGia(t.giaCacheDoc ?? 0, 'Giá đọc bộ nhớ đệm'), soGia(t.giaCacheGhi ?? 0, 'Giá ghi bộ nhớ đệm')];
            db.prepare(`INSERT INTO bang_gia (ma, nha_cung_cap, mo_hinh_goc, ten_hien_thi, gia_vao, gia_ra, gia_cache_doc, gia_cache_ghi, bat, cap_nhat_luc)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(ma, nhaCungCap, moHinhGoc, tenHienThi, ...g, coKhong(t.bat, 'Trạng thái bật', 1), luc);
            ghiNhatKyLuc(db, luc, { taiKhoanId: nguoi.id, hanhDong: 'them_bang_gia', doiTuong: `bang_gia:${ma}`, ip, chiTiet: { nhaCungCap, moHinhGoc, gia: g } });
            return guiJson(res, 201, giaJson(db.prepare('SELECT * FROM bang_gia WHERE ma = ?').get(ma) as unknown as DongBangGia));
        }
        if ((m = /^\/bang-gia\/([^/]+)$/.exec(duong)) && pt === 'PUT') {
            canHeThong(nguoi);
            let ma: string;
            try { ma = decodeURIComponent(m[1]); } catch { throw new LoiHttp(400, 'Mã mô hình không hợp lệ.'); }
            const cu = db.prepare('SELECT * FROM bang_gia WHERE ma = ?').get(ma) as unknown as DongBangGia | undefined;
            if (!cu) { throw new LoiHttp(404, 'Không tìm thấy mô hình trong bảng giá.'); }
            const t = await docJson(req);
            const moi = { ...cu };
            if ('tenHienThi' in t) {
                const v = String(t.tenHienThi ?? '').trim();
                if (v === '' || v.length > 100) { throw new LoiHttp(400, 'Tên hiển thị không được để trống.'); }
                moi.ten_hien_thi = v;
            }
            if ('giaVao' in t) { moi.gia_vao = soGia(t.giaVao, 'Giá đầu vào'); }
            if ('giaRa' in t) { moi.gia_ra = soGia(t.giaRa, 'Giá đầu ra'); }
            if ('giaCacheDoc' in t) { moi.gia_cache_doc = soGia(t.giaCacheDoc, 'Giá đọc bộ nhớ đệm'); }
            if ('giaCacheGhi' in t) { moi.gia_cache_ghi = soGia(t.giaCacheGhi, 'Giá ghi bộ nhớ đệm'); }
            if ('bat' in t) { moi.bat = coKhong(t.bat, 'Trạng thái bật', moi.bat); }
            db.prepare(`UPDATE bang_gia SET ten_hien_thi = ?, gia_vao = ?, gia_ra = ?, gia_cache_doc = ?, gia_cache_ghi = ?, bat = ?, cap_nhat_luc = ? WHERE ma = ?`)
                .run(moi.ten_hien_thi, moi.gia_vao, moi.gia_ra, moi.gia_cache_doc, moi.gia_cache_ghi, moi.bat, luc, ma);
            const truoc: Record<string, unknown> = {}, sau: Record<string, unknown> = {};
            for (const k of ['ten_hien_thi', 'gia_vao', 'gia_ra', 'gia_cache_doc', 'gia_cache_ghi', 'bat'] as const) {
                if (cu[k] !== moi[k]) { truoc[k] = cu[k]; sau[k] = moi[k]; }
            }
            ghiNhatKyLuc(db, luc, { taiKhoanId: nguoi.id, hanhDong: 'sua_bang_gia', doiTuong: `bang_gia:${ma}`, ip, chiTiet: { truoc, sau } });
            return guiJson(res, 200, giaJson(db.prepare('SELECT * FROM bang_gia WHERE ma = ?').get(ma) as unknown as DongBangGia));
        }

        if (duong === '/nhat-ky' && pt === 'GET') {
            const dieuKien: string[] = [];
            const thamSo: Array<string | number> = [];
            // Chỉ nhánh quản trị đơn vị mới cần join sang tai_khoan (lọc theo đơn vị của NGƯỜI THỰC HIỆN).
            // Các nhánh còn lại chỉ đụng cột của nk, nên câu ĐẾM bỏ được join — mà đếm là phần đắt nhất:
            // nhat_ky chỉ ghi thêm, không dọn, nên mỗi lần mở trang lại phải quét toàn bộ lịch sử tích lũy.
            let canJoin = false;
            if (nguoi.vaiTro === 'quan_tri_don_vi') {
                canDonVi();
                dieuKien.push(`(nguoi.don_vi_id = ? OR (nk.doi_tuong LIKE 'tai_khoan:%'
                    AND CAST(substr(nk.doi_tuong, 11) AS INTEGER) IN (SELECT id FROM tai_khoan WHERE don_vi_id = ?)))`);
                thamSo.push(nguoi.donViId as number, nguoi.donViId as number);
                canJoin = true;
            }
            const idTk = url.searchParams.get('tai_khoan_id');
            if (idTk && /^\d+$/.test(idTk)) {
                dieuKien.push("(nk.tai_khoan_id = ? OR nk.doi_tuong = 'tai_khoan:' || ?)");
                thamSo.push(Number(idTk), idTk);
            }
            const where = dieuKien.length ? `WHERE ${dieuKien.join(' AND ')}` : '';
            const tu = `FROM nhat_ky nk LEFT JOIN tai_khoan nguoi ON nguoi.id = nk.tai_khoan_id`;
            const tuDem = canJoin ? tu : 'FROM nhat_ky nk';
            const tong = Number((db.prepare(`SELECT COUNT(*) AS n ${tuDem} ${where}`).get(...thamSo) as { n: number }).n);
            const trang = Math.max(1, Math.min(100_000, Number(url.searchParams.get('trang')) || 1));
            const ds = db.prepare(`SELECT nk.*, nguoi.ho_ten AS ho_ten_nguoi_lam,
                    (SELECT ho_ten FROM tai_khoan WHERE nk.doi_tuong = 'tai_khoan:' || id) AS ten_doi_tuong
                ${tu} ${where} ORDER BY nk.id DESC LIMIT ? OFFSET ?`).all(...thamSo, SO_MOI_TRANG, (trang - 1) * SO_MOI_TRANG) as Array<Record<string, unknown>>;
            return guiJson(res, 200, {
                tong, trang, soMoiTrang: SO_MOI_TRANG,
                ds: ds.map(d => {
                    let chiTiet: unknown = null;
                    try { chiTiet = d.chi_tiet ? JSON.parse(String(d.chi_tiet)) : null; } catch { chiTiet = d.chi_tiet; }
                    return {
                        id: d.id, luc: d.luc, hanhDong: d.hanh_dong, doiTuong: d.doi_tuong, tenDoiTuong: d.ten_doi_tuong, chiTiet, ip: d.ip,
                        nguoiLam: d.tai_khoan_id === null ? null : { id: d.tai_khoan_id, hoTen: d.ho_ten_nguoi_lam },
                    };
                }),
            });
        }

        throw new LoiHttp(404, 'Không có chức năng này.');
    };
}
