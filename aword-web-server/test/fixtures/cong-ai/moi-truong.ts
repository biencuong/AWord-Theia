// Môi trường kiểm thử Cổng AI: CSDL trong bộ nhớ, máy chủ HTTP giả lập nhà cung cấp AI và máy chủ chạy Cổng AI —
// tất cả trên 127.0.0.1 cổng ngẫu nhiên, không gọi mạng thật.
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { DatabaseSync } from 'node:sqlite';
import type { CauHinh } from '../../../src/cau-hinh.ts';
import { moCsdl } from '../../../src/csdl/csdl.ts';
import { taoCongAi, type CongAi, type TuyChonCongAi } from '../../../src/cong-ai/cong-ai.ts';

export const KHOA = { anthropic: 'khoa-to-chuc-anthropic-BI-MAT', deepseek: 'khoa-to-chuc-deepseek-BI-MAT', openai: 'sk-to-chuc-openai-BI-MAT' };

export interface YeuCauDaNhan {
    method: string;
    url: string;
    headers: http.IncomingHttpHeaders;
    body: string;
    /** true nếu Cổng AI đóng kết nối lên nhà cung cấp trước khi nhà cung cấp trả lời xong. */
    biHuy: boolean;
}

export type XuLyGiaLap = (yc: YeuCauDaNhan, res: http.ServerResponse, req: http.IncomingMessage) => void | Promise<void>;

export interface MoiTruong {
    db: DatabaseSync;
    congAi: CongAi;
    cauHinh: CauHinh;
    /** Đồng hồ giả của Cổng AI (ms) — sửa trực tiếp để mô phỏng thời gian. */
    gio: { hienTai: number };
    diaChi: string;
    diaChiNhaCungCap: string;
    yeuCauLen: YeuCauDaNhan[];
    datXuLy(fn: XuLyGiaLap): void;
    taiKhoanId: number;
    token: string;
    themMoHinh(ma: string, ncc: 'anthropic' | 'deepseek' | 'openai', gia?: Partial<Record<'gia_vao' | 'gia_ra' | 'gia_cache_doc' | 'gia_cache_ghi' | 'bat', number>>, moHinhGoc?: string): void;
    goi(duongDan: string, than: unknown, header?: Record<string, string>): Promise<Response>;
    dong(): Promise<void>;
}

/** 15/9/2026 10:00 giờ Việt Nam. */
export const GIO_MAC_DINH = Date.UTC(2026, 8, 15, 3, 0);

function nghe(mayChu: http.Server): Promise<string> {
    return new Promise(ok => mayChu.listen(0, '127.0.0.1', () => ok(`http://127.0.0.1:${(mayChu.address() as AddressInfo).port}`)));
}

function dongMayChu(mayChu: http.Server): Promise<void> {
    mayChu.closeAllConnections();
    return new Promise(ok => mayChu.close(() => ok()));
}

export async function dungMoiTruong(tuy: Partial<Omit<TuyChonCongAi, 'db' | 'cauHinh'>> & { khoaAi?: CauHinh['khoaAi'] } = {}): Promise<MoiTruong> {
    const yeuCauLen: YeuCauDaNhan[] = [];
    let xuLyHienTai: XuLyGiaLap = (_yc, res) => { res.writeHead(500); res.end('chưa đặt xử lý giả lập'); };
    const nhaCungCap = http.createServer((req, res) => {
        const cacDoan: Buffer[] = [];
        req.on('data', d => cacDoan.push(d));
        req.on('end', () => {
            const yc: YeuCauDaNhan = { method: req.method ?? '', url: req.url ?? '', headers: req.headers, body: Buffer.concat(cacDoan).toString('utf8'), biHuy: false };
            res.on('close', () => { if (!res.writableFinished) { yc.biHuy = true; } });
            yeuCauLen.push(yc);
            void xuLyHienTai(yc, res, req);
        });
    });
    const diaChiNhaCungCap = await nghe(nhaCungCap);

    const db = moCsdl(':memory:');
    const gio = { hienTai: GIO_MAC_DINH };
    const cauHinh: CauHinh = {
        cong: 0, diaChiNghe: '127.0.0.1', tenMien: 'aword.localhost', tenMienUngDung: 'app.aword.localhost', https: false, thuMucDuLieu: '', thuMucHeThong: '',
        trinhDieuPhoi: 'tien-trinh', anhDocker: '', phutNguKhiRanh: 30, giuNhatKyNgay: 0, diaChiCongAiChoPhien: '',
        khoaAi: tuy.khoaAi ?? { ...KHOA },
        diaChiAi: { anthropic: diaChiNhaCungCap, deepseek: `${diaChiNhaCungCap}/anthropic`, openai: `${diaChiNhaCungCap}/` },
        biMat: 'x'.repeat(40),
    };
    const { khoaAi: _bo, ...conLai } = tuy;
    const congAi = taoCongAi({ db, cauHinh, bayGio: () => gio.hienTai, ...conLai });
    const mayChuCong = http.createServer(async (req, res) => {
        if (!(await congAi.xuLy(req, res))) { res.writeHead(404); res.end('ngoai-cong-ai'); }
    });
    const diaChi = await nghe(mayChuCong);

    const bay = Date.now();
    db.prepare("INSERT INTO don_vi (ma, ten, tao_luc) VALUES ('THCS-A', 'Trường THCS A', ?)").run(bay);
    const { lastInsertRowid } = db.prepare(`INSERT INTO tai_khoan (ten_dang_nhap, ho_ten, don_vi_id, mat_khau_bam, tao_luc, cap_nhat_luc)
        VALUES ('gv.a', 'Giáo viên A', 1, 'scrypt$x', ?, ?)`).run(bay, bay);
    const taiKhoanId = Number(lastInsertRowid);
    const token = congAi.capToken(taiKhoanId, 8);

    return {
        db, congAi, cauHinh, gio, diaChi, diaChiNhaCungCap, yeuCauLen, taiKhoanId, token,
        datXuLy(fn) { xuLyHienTai = fn; },
        themMoHinh(ma, ncc, gia = {}, moHinhGoc = `${ma}-goc`) {
            db.prepare(`INSERT INTO bang_gia (ma, nha_cung_cap, mo_hinh_goc, ten_hien_thi, gia_vao, gia_ra, gia_cache_doc, gia_cache_ghi, bat, cap_nhat_luc)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(ma, ncc, moHinhGoc, `Mô hình ${ma}`, gia.gia_vao ?? 0, gia.gia_ra ?? 0,
                gia.gia_cache_doc ?? 0, gia.gia_cache_ghi ?? 0, gia.bat ?? 1, bay);
        },
        goi(duongDan, than, header = {}) {
            return fetch(diaChi + duongDan, {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'anthropic-version': '2023-06-01', authorization: `Bearer ${token}`, ...header },
                body: typeof than === 'string' ? than : JSON.stringify(than),
            });
        },
        async dong() {
            await Promise.all([dongMayChu(mayChuCong), dongMayChu(nhaCungCap)]);
            db.close();
        },
    };
}

/** Chờ điều kiện đúng (tối đa ~3 giây) — dùng khi Cổng AI ghi CSDL sau khi máy khách đã nhận xong/ngắt. */
export async function choDen<T>(lay: () => T | undefined, moTa: string, toiDaMs = 3000): Promise<T> {
    const han = Date.now() + toiDaMs;
    for (;;) {
        const v = lay();
        if (v !== undefined && v !== null && v !== false) { return v; }
        if (Date.now() > han) { throw new Error(`Hết giờ chờ: ${moTa}`); }
        await new Promise(ok => setTimeout(ok, 15));
    }
}

/** Tách văn bản SSE thành mảng { event, data(JSON) }. */
export function tachSse(vanBan: string): Array<{ event: string; data: any }> {
    return vanBan.split(/\r?\n\r?\n/).filter(k => k.trim() !== '').map(khoi => {
        let event = '';
        const data: string[] = [];
        for (const dong of khoi.split(/\r?\n/)) {
            if (dong.startsWith('event:')) { event = dong.slice(6).trim(); }
            if (dong.startsWith('data:')) { data.push(dong.slice(5).trim()); }
        }
        return { event, data: data.length ? JSON.parse(data.join('\n')) : undefined };
    });
}

export interface DongSuDung {
    tai_khoan_id: number; don_vi_id: number | null; luc: number; thang: string; mo_hinh: string; nha_cung_cap: string;
    token_vao: number; token_ra: number; token_cache_doc: number; token_cache_ghi: number; chi_phi_dong: number;
    trang_thai: string; ma_loi: string | null;
}

export const cacDongSuDung = (db: DatabaseSync): DongSuDung[] => db.prepare('SELECT * FROM su_dung_ai ORDER BY id').all() as unknown as DongSuDung[];
