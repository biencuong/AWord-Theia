// Môi trường kiểm thử cổng truy cập: máy chủ node:http thật trên cổng ngẫu nhiên, CSDL trong bộ nhớ, đồng hồ giả,
// điều phối/Cổng AI giả (ghi lại lời gọi), trình duyệt giả có kho cookie. Không gọi mạng ra ngoài.
import { createServer, request } from 'node:http';
import type { IncomingHttpHeaders, IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { CauHinh } from '../../../src/cau-hinh.ts';
import { moCsdl } from '../../../src/csdl/csdl.ts';
import { chuyenDenDangNhap, taoCongTruyCap } from '../../../src/cong-truy-cap/cong-truy-cap.ts';
import { bamMatKhau } from '../../../src/xac-thuc/ma-hoa.ts';

export const BI_MAT = 'bi-mat-kiem-thu-'.repeat(3);
export const MAT_KHAU = 'Hoa-Sen-2026-xanh';
export const TEN_MIEN = 'aword.test';

export function cauHinhThu(them: Partial<CauHinh> = {}): CauHinh {
    return {
        cong: 0, diaChiNghe: '127.0.0.1', tenMien: TEN_MIEN, tenMienUngDung: `app.${TEN_MIEN}`, https: false, thuMucDuLieu: '.', thuMucHeThong: '.',
        trinhDieuPhoi: 'tien-trinh', anhDocker: 'aword-web:latest', phutNguKhiRanh: 30, giuNhatKyNgay: 0, diaChiCongAiChoPhien: 'http://127.0.0.1/ai',
        khoaAi: {}, diaChiAi: { anthropic: 'http://127.0.0.1', deepseek: 'http://127.0.0.1', openai: 'http://127.0.0.1' },
        biMat: BI_MAT, ...them,
    };
}

export interface PhanHoi { trangThai: number; header: IncomingHttpHeaders; than: string; setCookie: string[]; viTri: string | undefined }

export async function dungMoiTruong(them: Partial<CauHinh> = {}) {
    const cauHinh = cauHinhThu(them);
    const db = moCsdl(':memory:');
    const dong = { gio: Date.UTC(2026, 8, 15, 2, 0, 0) }; // 15/9/2026 9:00 giờ Việt Nam
    const dieuPhoi = { daDung: [] as number[], async dungPhien(id: number) { this.daDung.push(id); } };
    const congAi = {
        daThuHoi: [] as number[],
        thuHoiToken(id: number) { this.daThuHoi.push(id); },
        daDungThang: (_id: number, _thang?: string) => 123456,
    };
    const cong = taoCongTruyCap({ db, cauHinh, dieuPhoi, congAi, bayGio: () => dong.gio });
    const mayChu = createServer(async (req, res) => {
        if (await cong.xuLy(req, res)) { return; }
        // Giả lập main.ts: đường dẫn khác thuộc phiên AWord của người đã đăng nhập
        const tk = cong.xacThucYeuCau(req);
        if (!tk) { return chuyenDenDangNhap(res, req.url ?? '/'); }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ phienAword: true, tk }));
    });
    await new Promise<void>(ok => mayChu.listen(0, '127.0.0.1', ok));
    const cong_ = (mayChu.address() as AddressInfo).port;
    const nguon = `${cauHinh.https ? 'https' : 'http'}://${TEN_MIEN}:${cong_}`;

    return {
        db, cauHinh, dieuPhoi, congAi, cong, cong_, dong, nguon,
        host: `${TEN_MIEN}:${cong_}`,
        troi(ms: number) { dong.gio += ms; },
        tat: () => new Promise<void>(ok => { mayChu.closeAllConnections(); mayChu.close(() => ok()); }),
        trinhDuyet(tuy: { ip?: string } = {}) { return taoTrinhDuyet(cong_, `${TEN_MIEN}:${cong_}`, nguon, tuy.ip); },
        /** Tạo tài khoản trực tiếp trong CSDL (mặc định đã đổi mật khẩu). ten_dang_nhap = email ?? số như ứng dụng. */
        async taoTaiKhoan(t: { email?: string; so?: string; vaiTro?: string; donViId?: number | null; phaiDoi?: boolean; hoTen?: string; matKhau?: string }) {
            const bam = await bamMatKhau(t.matKhau ?? MAT_KHAU);
            return Number(db.prepare(`INSERT INTO tai_khoan (ten_dang_nhap, ho_ten, email, so_dien_thoai, vai_tro, don_vi_id, mat_khau_bam,
                phai_doi_mat_khau, tao_luc, cap_nhat_luc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                .run(t.email ?? t.so ?? 'x', t.hoTen ?? `Người ${t.email ?? t.so}`, t.email ?? null, t.so ?? null, t.vaiTro ?? 'nguoi_dung',
                    t.donViId ?? null, bam, t.phaiDoi ? 1 : 0, dong.gio, dong.gio).lastInsertRowid);
        },
        taoDonVi(ma: string, ten: string): number {
            return Number(db.prepare('INSERT INTO don_vi (ma, ten, tao_luc) VALUES (?, ?, ?)').run(ma, ten, dong.gio).lastInsertRowid);
        },
    };
}
export type MoiTruong = Awaited<ReturnType<typeof dungMoiTruong>>;

export function layCsrf(html: string): string {
    const m = /name="csrf" value="([^"]+)"/.exec(html) ?? /<meta name="aword-csrf" content="([^"]+)">/.exec(html);
    if (!m) { throw new Error('Không thấy token CSRF trong trang'); }
    return m[1];
}

export function taoTrinhDuyet(cong: number, host: string, nguon: string, ip?: string) {
    const cookie = new Map<string, string>();
    const td = {
        cookie,
        async goi(phuongThuc: string, duongDan: string, tuy: {
            form?: Record<string, string>; json?: unknown; than?: Buffer; header?: Record<string, string>; nguon?: string | null; host?: string;
        } = {}): Promise<PhanHoi> {
            const header: Record<string, string> = { host: tuy.host ?? host, ...(tuy.header ?? {}) };
            if (ip) { header['x-forwarded-for'] = ip; }
            if (cookie.size) { header.cookie = [...cookie].map(([k, v]) => `${k}=${v}`).join('; '); }
            const guiNguon = tuy.nguon === undefined ? (phuongThuc !== 'GET' ? nguon : null) : tuy.nguon;
            if (guiNguon) { header.origin = guiNguon; }
            let than: Buffer | undefined;
            if (tuy.form) { than = Buffer.from(new URLSearchParams(tuy.form).toString()); header['content-type'] = 'application/x-www-form-urlencoded'; }
            if (tuy.json !== undefined) { than = Buffer.from(JSON.stringify(tuy.json)); header['content-type'] = 'application/json'; }
            if (tuy.than) { than = tuy.than; header['content-type'] ??= 'application/octet-stream'; }
            if (than) { header['content-length'] = String(than.length); }
            const ph = await new Promise<IncomingMessage>((ok, loi) => {
                const r = request({ host: '127.0.0.1', port: cong, method: phuongThuc, path: duongDan, headers: header }, ok);
                r.on('error', loi);
                r.end(than);
            });
            const manh: Buffer[] = [];
            for await (const m of ph) { manh.push(m as Buffer); }
            const setCookie = ph.headers['set-cookie'] ?? [];
            for (const c of setCookie) {
                const [cap] = c.split(';');
                const i = cap.indexOf('=');
                const ten = cap.slice(0, i), giaTri = cap.slice(i + 1);
                if (/max-age=0(;|$)/i.test(c) || giaTri === '') { cookie.delete(ten); } else { cookie.set(ten, giaTri); }
            }
            return { trangThai: ph.statusCode ?? 0, header: ph.headers, than: Buffer.concat(manh).toString('utf8'), setCookie, viTri: ph.headers.location };
        },
        /** Mở trang đăng nhập rồi gửi biểu mẫu (email hoặc số điện thoại + mật khẩu). */
        async dangNhap(dinhDanh: string, matKhau: string, tiep?: string): Promise<PhanHoi> {
            const trang = await td.goi('GET', `/dang-nhap${tiep ? `?tiep=${encodeURIComponent(tiep)}` : ''}`);
            return td.goi('POST', '/dang-nhap', { form: { csrf: layCsrf(trang.than), dinh_danh: dinhDanh, mat_khau: matKhau, tiep: tiep ?? '' } });
        },
        /** Gọi API quản trị kèm token CSRF lấy từ trang /quan-tri. */
        async api(phuongThuc: string, duongDan: string, tuy: { json?: unknown; than?: Buffer; header?: Record<string, string> } = {}) {
            const header = { ...(tuy.header ?? {}) };
            if (phuongThuc !== 'GET') { header['x-aword-csrf'] = layCsrf((await td.goi('GET', '/quan-tri')).than); }
            const ph = await td.goi(phuongThuc, `/api/quan-tri${duongDan}`, { ...tuy, header });
            return { ...ph, duLieu: JSON.parse(ph.than || 'null') };
        },
    };
    return td;
}

/** Tạo tài khoản quản trị và đăng nhập. */
export async function dangNhapQuanTri(mt: MoiTruong, email: string, vaiTro: 'quan_tri_he_thong' | 'quan_tri_don_vi', donViId: number | null = null) {
    const id = await mt.taoTaiKhoan({ email, vaiTro, donViId });
    const td = mt.trinhDuyet();
    const dn = await td.dangNhap(email, MAT_KHAU);
    if (dn.trangThai !== 303) { throw new Error(`Đăng nhập quản trị lỗi: ${dn.trangThai} ${dn.viTri}`); }
    return { id, td };
}
