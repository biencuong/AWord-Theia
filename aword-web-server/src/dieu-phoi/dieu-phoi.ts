// Bộ điều phối phiên làm việc: mỗi tài khoản một phiên AWord Web riêng (container | tiến trình phát triển), trạng thái
// lưu ở bảng phien_lam_viec: dang_khoi_dong → chay → ngu (rảnh lâu / dừng) | loi (khởi động hỏng).
//   - Khởi động: tạo ổ riêng <thuMucDuLieu>/tai-khoan/<id>/, cấp token Cổng AI mới (thu hồi token cũ), chạy phiên, chờ
//     GET / trả 200. Nhiều yêu cầu cùng lúc chỉ khởi động MỘT lần.
//   - Máy chủ khởi động lại: đối chiếu bảng với thực tế (trình.conChay) trước mọi thao tác.
//   - Phiên chết giữa chừng (trình báo, proxy không kết nối được, quét định kỳ) → đánh dấu `ngu`, yêu cầu kế tiếp tự
//     khởi động lại.
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DatabaseSync, StatementSync } from 'node:sqlite';
import type { Duplex } from 'node:stream';
import type { CauHinh } from '../cau-hinh.ts';
import { ghiNhatKy } from '../csdl/csdl.ts';
import { LoiPhien, moTaLoi } from './loi-phien.ts';
import { proxyHttp, proxyWebSocket as proxyWebSocketToi, tachDiaChi } from './proxy.ts';
import { guiTrangCho, guiTrangLoi, laYeuCauTrang } from './trang.ts';
import { taoTrinhDocker } from './trinh-docker.ts';
import { taoTrinhTienTrinh } from './trinh-tien-trinh.ts';

export { LoiPhien } from './loi-phien.ts';

/**
 * Chạy `viec` cho từng phần tử, tối đa `tran` việc cùng lúc, và LUÔN chờ hết rồi mới trả về.
 *
 * Dùng cho các vòng quét định kỳ phải hỏi một tài nguyên bên ngoài (Docker, tiến trình con): chạy tuần tự
 * thì N phần tử tốn N vòng nối đuôi; chạy `Promise.all` trần trụi thì N lớn sẽ dội cả N tiến trình cùng
 * lúc. Trần giữ cả hai đầu. Lỗi của một phần tử không làm hỏng các phần tử còn lại — hàm gọi tự bắt lỗi
 * trong thân `viec`, đúng như vòng lặp tuần tự trước đây vẫn làm.
 */
async function chaySongSong<T>(ds: readonly T[], tran: number, viec: (p: T) => Promise<void>): Promise<void> {
    let ke = 0;
    const nguoiLam = Array.from({ length: Math.max(1, Math.min(tran, ds.length)) }, async () => {
        for (let i = ke++; i < ds.length; i = ke++) {
            await viec(ds[i] as T);
        }
    });
    await Promise.all(nguoiLam);
}

export interface CongAiChoDieuPhoi {
    capToken(taiKhoanId: number, soGio: number): string;
    thuHoiToken(taiKhoanId: number): void;
}

export interface TrinhPhien { // một cài đặt: docker | tien-trinh
    khoiDong(p: { taiKhoanId: number; thuMucRieng: string; env: Record<string, string> }): Promise<{ maTrinh: string; diaChi: string }>;
    dung(maTrinh: string): Promise<void>;
    conChay(maTrinh: string): Promise<boolean>;
    /** (tùy chọn) Thư mục home của người dùng NHÌN TỪ TRONG phiên (docker: /home/aword). Mặc định: thuMucRieng. */
    homeTrongPhien?(thuMucRieng: string): string;
    /** (tùy chọn) Nhận tin phiên dừng ngoài ý muốn (tiến trình thoát...). */
    khiDungNgoaiY?(nghe: (maTrinh: string) => void): void;
    /** (tùy chọn) Các dòng nhật ký cuối của phiên — ghi vào nhat_ky khi khởi động lỗi (phiên lỗi bị dọn ngay sau đó). */
    nhatKyGanNhat?(maTrinh: string, soDong: number): Promise<string>;
}

export type TrangThaiPhien = 'dang_khoi_dong' | 'chay' | 'ngu' | 'loi';

interface DongPhien {
    tai_khoan_id: number;
    trinh: string;
    ma_trinh: string | null;
    dia_chi: string | null;
    trang_thai: TrangThaiPhien;
    bat_dau: number | null;
    hoat_dong_cuoi: number | null;
}

export interface TuyChonDieuPhoi {
    db: DatabaseSync;
    cauHinh: CauHinh;
    congAi: CongAiChoDieuPhoi;
    trinh?: TrinhPhien;
    bayGio?: () => number;
    /** Hạn chờ phiên sẵn sàng (ms) — mặc định 90 giây. */
    hanChoSanSangMs?: number;
    /** Nhịp hỏi GET / khi chờ sẵn sàng (ms). */
    nhipKiemMs?: number;
    /** Sau khi khởi động lỗi, chờ bấy nhiêu giây mới cho thử lại (tránh vòng lặp khởi động hỏng liên tục). */
    giayChoThuLai?: number;
}

/** Thư mục con tạo sẵn trong home của tài khoản. */
export const THU_MUC_CON_HOME = [path.join('Documents', 'AWord'), '.claude', '.aword', '.theia'];

// Dữ liệu WebSocket trình duyệt gửi lên nhỏ hơn ngưỡng này (ping/pong của Socket.IO) không tính là người dùng hoạt động
// — nếu không, một thẻ trình duyệt bỏ quên sẽ giữ phiên thức mãi.
const NGUONG_BYTE_HOAT_DONG = 64;
const MS_GHI_HOAT_DONG = 60_000;

const cho = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

function hoiTrangChu(diaChi: string, hanMs: number): Promise<number> {
    return new Promise(ok => {
        let dich: { host: string; port: number };
        try { dich = tachDiaChi(diaChi); } catch { ok(0); return; }
        const req = http.get({ host: dich.host, port: dich.port, path: '/', agent: false, timeout: hanMs }, res => {
            res.resume();
            ok(res.statusCode ?? 0);
        });
        req.on('timeout', () => req.destroy());
        req.on('error', () => ok(0));
    });
}

function noiDuongDan(goc: string, ...phan: string[]): string {
    return goc.startsWith('/') ? path.posix.join(goc, ...phan.map(p => p.replace(/\\/g, '/'))) : path.join(goc, ...phan);
}

export function taoDieuPhoi(tuy: TuyChonDieuPhoi) {
    const { db, cauHinh, congAi } = tuy;
    const bayGio = tuy.bayGio ?? Date.now;
    const hanChoSanSangMs = tuy.hanChoSanSangMs ?? 90_000;
    const nhipKiemMs = tuy.nhipKiemMs ?? 1000;
    const giayChoThuLai = tuy.giayChoThuLai ?? 30;
    const trinh: TrinhPhien = tuy.trinh ?? (cauHinh.trinhDieuPhoi === 'docker'
        ? taoTrinhDocker({ cauHinh })
        : taoTrinhTienTrinh());

    const dangKhoiDong = new Map<number, Promise<{ diaChi: string }>>();
    const loiGanNhat = new Map<number, { thongBao: string; luc: number }>();
    const hoatDongCuoi = new Map<number, number>();
    const daGhiHoatDong = new Map<number, number>();
    const dangDung = new Map<number, Promise<void>>();
    const dangKiemSong = new Set<number>();
    let dangTat = false;

    // Câu lệnh biên dịch MỘT LẦN lúc dựng điều phối, không phải mỗi lần gọi: docDong() nằm trên đường
    // proxy từng yêu cầu và trên mỗi lần nâng cấp WebSocket, nên bản cũ biên dịch lại SQL cho từng tệp
    // tĩnh của mỗi trang Theia, cho mọi người dùng, suốt vòng đời tiến trình. Cùng quy ước với `lenh`
    // trong cong-ai/cong-ai.ts.
    const lenhPhien = {
        docDong: db.prepare('SELECT * FROM phien_lam_viec WHERE tai_khoan_id = ?'),
        tatCaDong: db.prepare('SELECT * FROM phien_lam_viec'),
        datKhongChay: db.prepare('UPDATE phien_lam_viec SET trang_thai = ?, dia_chi = NULL, ma_trinh = NULL WHERE tai_khoan_id = ?'),
    } satisfies Record<string, StatementSync>;

    const docDong = (id: number): DongPhien | undefined => lenhPhien.docDong.get(id) as DongPhien | undefined;
    const tatCaDong = (): DongPhien[] => lenhPhien.tatCaDong.all() as unknown as DongPhien[];
    // Phiên không còn chạy (ngủ/lỗi) → xóa địa chỉ và mã trình để không ai proxy tới địa chỉ cũ.
    const datKhongChay = (id: number, trangThai: 'ngu' | 'loi'): void => {
        lenhPhien.datKhongChay.run(trangThai, id);
    };
    const nhatKy = (id: number, hanhDong: string, chiTiet?: unknown): void => {
        try { ghiNhatKy(db, { hanhDong, doiTuong: `tai_khoan:${id}`, chiTiet }); } catch { /* nhật ký không được làm hỏng điều phối */ }
    };
    const thuHoi = (id: number): void => {
        try { congAi.thuHoiToken(id); } catch { /* bỏ qua */ }
    };

    // Phiên dừng ngoài ý muốn → `ngu`; yêu cầu kế tiếp khởi động lại.
    function danhDauChet(id: number, lyDo: string): void {
        const r = docDong(id);
        if (!r || r.trang_thai !== 'chay' || dangKhoiDong.has(id)) { return; }
        datKhongChay(id, 'ngu');
        thuHoi(id);
        nhatKy(id, 'phien_chet', { lyDo, maTrinh: r.ma_trinh });
    }

    trinh.khiDungNgoaiY?.(maTrinh => {
        const r = db.prepare("SELECT tai_khoan_id FROM phien_lam_viec WHERE ma_trinh = ? AND trang_thai = 'chay'").get(maTrinh) as
            { tai_khoan_id: number } | undefined;
        if (r) { danhDauChet(r.tai_khoan_id, 'trinh_bao_dung'); }
    });

    // Đối chiếu bảng với thực tế khi máy chủ (khởi động lại) — mọi thao tác công khai chờ bước này xong.
    const doiChieu: Promise<void> = (async () => {
        for (const r of tatCaDong()) {
            const id = r.tai_khoan_id;
            if (r.trang_thai === 'chay') {
                let song = false;
                if (r.ma_trinh && r.dia_chi) {
                    try { song = await trinh.conChay(r.ma_trinh); } catch { song = false; }
                }
                if (song) {
                    // Người dùng có thể đang mở trình duyệt chờ kết nối lại — chưa tính là rảnh.
                    hoatDongCuoi.set(id, bayGio());
                } else {
                    datKhongChay(id, 'ngu');
                    thuHoi(id);
                    nhatKy(id, 'phien_doi_chieu', { truoc: 'chay', sau: 'ngu' });
                }
            } else if (r.trang_thai === 'dang_khoi_dong') {
                // Máy chủ dừng giữa lúc khởi động: dọn phần đã chạy dở.
                if (r.ma_trinh) { await trinh.dung(r.ma_trinh).catch(() => undefined); }
                datKhongChay(id, 'ngu');
                thuHoi(id);
                nhatKy(id, 'phien_doi_chieu', { truoc: 'dang_khoi_dong', sau: 'ngu' });
            }
        }
    })().catch(e => { console.error('[AWord Web] Lỗi đối chiếu phiên làm việc:', e); });

    /**
     * CHẾ ĐỘ CÁ NHÂN (máy một người dùng, trình "tiến trình"): biến `AWORD_WEB_HOME_TAI_KHOAN_<id>` trỏ tài khoản đó vào
     * THƯ MỤC NHÀ THẬT của máy, nên phiên kế thừa nguyên vẹn lịch sử phiên Claude Code, skill, cấu hình và thư mục làm
     * việc đã có — lịch sử Claude Code lưu theo ĐƯỜNG DẪN thư mục làm việc nên phải dùng đúng đường dẫn thật, không
     * thể thay bằng liên kết. KHÔNG dùng khi nhiều người chung máy chủ: các tài khoản sẽ thấy dữ liệu của nhau.
     */
    function homeChiDinh(id: number): string | undefined {
        const duongDan = (process.env[`AWORD_WEB_HOME_TAI_KHOAN_${id}`] ?? '').trim();
        if (!duongDan) { return undefined; }
        if (!fs.existsSync(duongDan)) {
            console.error(`[AWord Web] Bỏ qua AWORD_WEB_HOME_TAI_KHOAN_${id}: không thấy thư mục "${duongDan}".`);
            return undefined;
        }
        return duongDan;
    }

    /**
     * Cấu hình Theia của phiên LUÔN nằm trong du-lieu, kể cả chế độ cá nhân: bố cục, thư mục gần đây, thiết lập của bản
     * web phải tách khỏi ~/.theia mà AWord bản cài đang dùng, không thì hai bên ghi đè nhau.
     */
    const thuMucTheia = (id: number): string => path.join(cauHinh.thuMucDuLieu, 'tai-khoan', String(id), '.theia');

    function taoThuMucRieng(id: number): string {
        const thuMucRieng = homeChiDinh(id) ?? path.join(cauHinh.thuMucDuLieu, 'tai-khoan', String(id));
        for (const con of THU_MUC_CON_HOME) { fs.mkdirSync(path.join(thuMucRieng, con), { recursive: true }); }
        const theia = thuMucTheia(id);
        fs.mkdirSync(theia, { recursive: true });
        datThietLapPhien(path.join(theia, 'settings.json'));
        return thuMucRieng;
    }

    /**
     * Thiết lập Theia bắt buộc cho phiên web (bổ sung vào settings.json của tài khoản, không ghi đè thiết lập khác):
     * - thư mục làm việc là của chính người dùng → không hỏi "tin tưởng tác giả";
     * - AI đi qua Cổng AI bằng token phiên → Claude Code không hiện màn hình đăng nhập tài khoản Claude khi gặp lỗi.
     */
    function datThietLapPhien(tep: string): void {
        const batBuoc: Record<string, unknown> = { 'security.workspace.trust.enabled': false, 'claudeCode.disableLoginPrompt': true };
        let hienCo: Record<string, unknown> = {};
        try {
            if (fs.existsSync(tep)) {
                const v: unknown = JSON.parse(fs.readFileSync(tep, 'utf8'));
                if (!v || typeof v !== 'object' || Array.isArray(v)) { return; }
                hienCo = v as Record<string, unknown>;
            }
        } catch { return; } // có chú thích/lỗi cú pháp: không đụng vào tệp người dùng đã sửa
        if (Object.entries(batBuoc).every(([k, v]) => hienCo[k] === v)) { return; }
        fs.writeFileSync(tep, JSON.stringify({ ...hienCo, ...batBuoc }, null, 4));
    }

    async function choSanSang(diaChi: string, maTrinh: string): Promise<void> {
        const hetHan = Date.now() + hanChoSanSangMs;
        for (;;) {
            if (await hoiTrangChu(diaChi, Math.min(5000, Math.max(500, hanChoSanSangMs))) === 200) { return; }
            if (Date.now() >= hetHan) {
                throw new LoiPhien(`Phiên làm việc không sẵn sàng sau ${Math.round(hanChoSanSangMs / 1000)} giây.`);
            }
            let conChay = true;
            try { conChay = await trinh.conChay(maTrinh); } catch { /* chưa rõ → chờ tiếp */ }
            if (!conChay) { throw new LoiPhien('Phiên làm việc dừng ngay khi đang khởi động.'); }
            await cho(nhipKiemMs);
        }
    }

    async function khoiDongPhien(id: number): Promise<{ diaChi: string }> {
        if (!db.prepare('SELECT 1 AS co FROM tai_khoan WHERE id = ?').get(id)) {
            throw new LoiPhien('Tài khoản không tồn tại.');
        }
        const batDau = bayGio();
        db.prepare(`INSERT INTO phien_lam_viec (tai_khoan_id, trinh, ma_trinh, dia_chi, trang_thai, bat_dau, hoat_dong_cuoi)
            VALUES (?, ?, NULL, NULL, 'dang_khoi_dong', ?, ?)
            ON CONFLICT(tai_khoan_id) DO UPDATE SET trinh = excluded.trinh, ma_trinh = NULL, dia_chi = NULL,
                trang_thai = 'dang_khoi_dong', bat_dau = excluded.bat_dau, hoat_dong_cuoi = excluded.hoat_dong_cuoi`)
            .run(id, cauHinh.trinhDieuPhoi, batDau, batDau);
        hoatDongCuoi.set(id, batDau);
        loiGanNhat.delete(id);
        let maTrinh: string | undefined;
        const moc = Date.now();
        try {
            const thuMucRieng = taoThuMucRieng(id);
            const home = trinh.homeTrongPhien?.(thuMucRieng) ?? thuMucRieng;
            thuHoi(id);
            const token = congAi.capToken(id, 24);
            const env: Record<string, string> = {
                ANTHROPIC_BASE_URL: cauHinh.diaChiCongAiChoPhien,
                ANTHROPIC_AUTH_TOKEN: token,
                AWORD_HOME: home,
                CLAUDE_CONFIG_DIR: noiDuongDan(home, '.claude'),
                THEIA_CONFIG_DIR: home === thuMucRieng ? thuMucTheia(id) : noiDuongDan(home, '.theia'),
                HOME: home,
                // Cho aword-chat biết đang chạy trong AWord Web đa người dùng (ẩn cập nhật Claude Code, đăng nhập...).
                AWORD_CHE_DO: 'web-da-nguoi-dung',
                // Claude Code không tự cập nhật, không gửi telemetry/báo lỗi ra ngoài (mạng phiên chỉ tới Cổng AI/MCP).
                DISABLE_AUTOUPDATER: '1',
                CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
            };
            const kq = await trinh.khoiDong({ taiKhoanId: id, thuMucRieng, env });
            maTrinh = kq.maTrinh;
            db.prepare('UPDATE phien_lam_viec SET ma_trinh = ?, dia_chi = ? WHERE tai_khoan_id = ?').run(kq.maTrinh, kq.diaChi, id);
            await choSanSang(kq.diaChi, kq.maTrinh);
            if (dangTat) { throw new LoiPhien('Máy chủ đang tắt.'); }
            const luc = bayGio();
            db.prepare("UPDATE phien_lam_viec SET trang_thai = 'chay', hoat_dong_cuoi = ? WHERE tai_khoan_id = ?").run(luc, id);
            hoatDongCuoi.set(id, luc);
            daGhiHoatDong.set(id, luc);
            nhatKy(id, 'phien_khoi_dong', { trinh: cauHinh.trinhDieuPhoi, maTrinh: kq.maTrinh, diaChi: kq.diaChi, ms: Date.now() - moc });
            return { diaChi: kq.diaChi };
        } catch (e) {
            const thongBao = e instanceof LoiPhien ? e.message : 'Không khởi động được phiên làm việc.';
            let nhatKyPhien: string | undefined;
            if (maTrinh) {
                nhatKyPhien = (await trinh.nhatKyGanNhat?.(maTrinh, 40).catch(() => undefined))?.slice(-4000) || undefined;
                await trinh.dung(maTrinh).catch(() => undefined);
            }
            thuHoi(id);
            datKhongChay(id, 'loi');
            loiGanNhat.set(id, { thongBao, luc: bayGio() });
            nhatKy(id, 'phien_loi', { loi: moTaLoi(e), maTrinh, nhatKyPhien });
            throw e instanceof LoiPhien ? e : new LoiPhien(thongBao, moTaLoi(e));
        }
    }

    async function damBaoPhien(taiKhoanId: number): Promise<{ diaChi: string }> {
        await doiChieu;
        // Đang dừng phiên này (ngủ) → chờ dừng xong rồi mới khởi động lại, tránh hai thao tác ghi đè trạng thái nhau.
        for (let dd = dangDung.get(taiKhoanId); dd; dd = dangDung.get(taiKhoanId)) {
            await dd.catch(() => undefined);
        }
        const dang = dangKhoiDong.get(taiKhoanId);
        if (dang) { return dang; }
        // Từ đây tới khi đặt vào dangKhoiDong không có await → hai yêu cầu đồng thời không thể cùng khởi động.
        const r = docDong(taiKhoanId);
        if (r?.trang_thai === 'chay' && r.dia_chi) { return { diaChi: r.dia_chi }; }
        if (r?.trang_thai === 'loi') {
            const loi = loiGanNhat.get(taiKhoanId);
            if (loi && bayGio() - loi.luc < giayChoThuLai * 1000) { throw new LoiPhien(loi.thongBao); }
        }
        if (dangTat) { throw new LoiPhien('Máy chủ đang tắt, vui lòng thử lại sau.'); }
        const p = khoiDongPhien(taiKhoanId).finally(() => dangKhoiDong.delete(taiKhoanId));
        dangKhoiDong.set(taiKhoanId, p);
        return p;
    }

    // Dừng hẳn một phiên (ngủ). Lỗi khi dừng → giữ nguyên trạng thái và ném lỗi (không để container mồ côi).
    function dungNoiBo(id: number, lyDo: string): Promise<void> {
        const dang = dangDung.get(id);
        if (dang) { return dang; }
        const p = (async () => {
            const r = docDong(id);
            if (!r || r.trang_thai === 'ngu') { return; }
            if (r.ma_trinh) { await trinh.dung(r.ma_trinh); }
            datKhongChay(id, 'ngu');
            thuHoi(id);
            hoatDongCuoi.delete(id);
            daGhiHoatDong.delete(id);
            nhatKy(id, 'phien_ngu', { lyDo });
        })().finally(() => dangDung.delete(id));
        dangDung.set(id, p);
        return p;
    }

    function ghiNhanHoatDong(taiKhoanId: number): void {
        const luc = bayGio();
        hoatDongCuoi.set(taiKhoanId, luc);
        // Ghi CSDL thưa (mỗi phút một lần/tài khoản) — không ghi mỗi yêu cầu.
        if (luc - (daGhiHoatDong.get(taiKhoanId) ?? 0) >= MS_GHI_HOAT_DONG) {
            daGhiHoatDong.set(taiKhoanId, luc);
            try {
                db.prepare("UPDATE phien_lam_viec SET hoat_dong_cuoi = ? WHERE tai_khoan_id = ? AND trang_thai = 'chay'").run(luc, taiKhoanId);
            } catch { /* bỏ qua */ }
        }
    }

    // Proxy không kết nối được tới địa chỉ phiên → kiểm tra phiên còn sống không (mỗi tài khoản một lần kiểm cùng lúc).
    function kiemTraSauLoiKetNoi(diaChi: string): void {
        const r = db.prepare("SELECT tai_khoan_id, ma_trinh FROM phien_lam_viec WHERE dia_chi = ? AND trang_thai = 'chay'").get(diaChi) as
            { tai_khoan_id: number; ma_trinh: string | null } | undefined;
        if (!r || dangKiemSong.has(r.tai_khoan_id)) { return; }
        const id = r.tai_khoan_id;
        dangKiemSong.add(id);
        (async () => {
            const song = r.ma_trinh ? await trinh.conChay(r.ma_trinh).catch(() => true) : false;
            if (!song) { danhDauChet(id, 'proxy_khong_ket_noi'); }
        })().finally(() => dangKiemSong.delete(id));
    }

    const taiKhoanTheoDiaChi = (diaChi: string): number | undefined =>
        (db.prepare("SELECT tai_khoan_id FROM phien_lam_viec WHERE dia_chi = ? AND trang_thai = 'chay'").get(diaChi) as
            { tai_khoan_id: number } | undefined)?.tai_khoan_id;

    function proxy(req: IncomingMessage, res: ServerResponse, diaChi: string): void {
        proxyHttp(req, res, diaChi, { https: cauHinh.https, khiLoiKetNoi: () => kiemTraSauLoiKetNoi(diaChi) });
    }

    function proxyWebSocket(req: IncomingMessage, socket: Duplex, head: Buffer, diaChi: string): void {
        const id = taiKhoanTheoDiaChi(diaChi);
        proxyWebSocketToi(req, socket, head, diaChi, {
            https: cauHinh.https,
            khiLoiKetNoi: () => kiemTraSauLoiKetNoi(diaChi),
            khiDuLieuTuTrinhDuyet: soByte => {
                if (id !== undefined && soByte >= NGUONG_BYTE_HOAT_DONG) { ghiNhanHoatDong(id); }
            },
        });
    }

    return {
        damBaoPhien,

        async dungPhien(taiKhoanId: number): Promise<void> {
            await doiChieu;
            await dangKhoiDong.get(taiKhoanId)?.catch(() => undefined);
            await dungNoiBo(taiKhoanId, 'yeu_cau');
        },

        ghiNhanHoatDong,

        async quetNgu(): Promise<void> {
            await doiChieu;
            const nguongMs = cauHinh.phutNguKhiRanh * 60_000;
            const canQuet = tatCaDong().filter(r => r.trang_thai === 'chay' && !dangKhoiDong.has(r.tai_khoan_id));
            // Quét SONG SONG có trần, không tuần tự: mỗi phiên là một vòng hỏi Docker, và ở chế độ tiến
            // trình thì mỗi vòng spawn một powershell.exe. Bản cũ chạy tuần tự nên N phiên tốn N vòng
            // nối đuôi nhau mỗi phút — N tiến trình đẻ lần lượt, vừa chậm vừa giành CPU với chính vòng
            // lặp đang phát câu trả lời cho người dùng. Trần 8 để không dội cả trăm tiến trình cùng lúc.
            await chaySongSong(canQuet, 8, async r => {
                const id = r.tai_khoan_id;
                const cuoi = Math.max(hoatDongCuoi.get(id) ?? 0, r.hoat_dong_cuoi ?? 0, r.bat_dau ?? 0);
                try {
                    if (nguongMs > 0 && bayGio() - cuoi >= nguongMs) {
                        await dungNoiBo(id, 'ranh');
                        return;
                    }
                    if (r.ma_trinh && !(await trinh.conChay(r.ma_trinh).catch(() => true))) {
                        danhDauChet(id, 'quet_dinh_ky');
                    }
                } catch (e) {
                    nhatKy(id, 'phien_loi_dung', { loi: moTaLoi(e) });
                }
            });
        },

        proxy,
        proxyWebSocket,

        async dungTatCa(): Promise<void> {
            dangTat = true;
            await doiChieu;
            await Promise.all([...dangKhoiDong.values()].map(p => p.catch(() => undefined)));
            await Promise.all(tatCaDong()
                .filter(r => r.trang_thai === 'chay' || r.trang_thai === 'dang_khoi_dong')
                .map(r => dungNoiBo(r.tai_khoan_id, 'tat_may_chu').catch(e => nhatKy(r.tai_khoan_id, 'phien_loi_dung', { loi: moTaLoi(e) }))));
        },

        // ---- tiện ích cho cổng truy cập (ngoài hợp đồng tối thiểu) ----

        /** Trạng thái hiện tại của phiên (trang tài khoản / quản trị). */
        async trangThai(taiKhoanId: number): Promise<{ trangThai: TrangThaiPhien | 'chua_co'; loi?: string; batDau?: number; hoatDongCuoi?: number }> {
            await doiChieu;
            const r = docDong(taiKhoanId);
            if (!r) { return { trangThai: 'chua_co' }; }
            return {
                trangThai: dangKhoiDong.has(taiKhoanId) ? 'dang_khoi_dong' : r.trang_thai,
                loi: r.trang_thai === 'loi' ? (loiGanNhat.get(taiKhoanId)?.thongBao ?? 'Phiên làm việc gặp lỗi khi khởi động.') : undefined,
                batDau: r.bat_dau ?? undefined,
                hoatDongCuoi: Math.max(hoatDongCuoi.get(taiKhoanId) ?? 0, r.hoat_dong_cuoi ?? 0) || undefined,
            };
        },

        /**
         * Xử lý trọn một yêu cầu HTTP của người đã đăng nhập: phiên chạy → proxy; chưa chạy → mở trang (GET text/html)
         * thì khởi động NỀN và trả trang chờ tự tải lại, yêu cầu khác thì chờ khởi động xong rồi proxy; lỗi → trang lỗi.
         */
        async xuLy(req: IncomingMessage, res: ServerResponse, taiKhoanId: number): Promise<void> {
            await doiChieu;
            ghiNhanHoatDong(taiKhoanId);
            const r = docDong(taiKhoanId);
            if (r?.trang_thai === 'chay' && r.dia_chi && !dangKhoiDong.has(taiKhoanId)) {
                proxy(req, res, r.dia_chi);
                return;
            }
            const p = damBaoPhien(taiKhoanId);
            if (laYeuCauTrang(req)) {
                const loi = r?.trang_thai === 'loi' ? loiGanNhat.get(taiKhoanId) : undefined;
                p.catch(() => undefined);
                if (loi && bayGio() - loi.luc < giayChoThuLai * 1000) {
                    guiTrangLoi(req, res, loi.thongBao);
                } else {
                    guiTrangCho(req, res);
                }
                return;
            }
            try {
                const { diaChi } = await p;
                proxy(req, res, diaChi);
            } catch (e) {
                guiTrangLoi(req, res, e instanceof LoiPhien ? e.message : 'Không khởi động được phiên làm việc.', 503);
            }
        },

        /**
         * WebSocket của người đã đăng nhập: CHỈ nối khi phiên đang chạy — không đánh thức phiên đang ngủ (thẻ trình duyệt
         * bỏ quên tự kết nối lại sẽ không giữ phiên thức); người dùng tải lại trang thì `xuLy` đánh thức.
         */
        async xuLyWebSocket(req: IncomingMessage, socket: Duplex, head: Buffer, taiKhoanId: number): Promise<void> {
            await doiChieu;
            const r = docDong(taiKhoanId);
            if (r?.trang_thai === 'chay' && r.dia_chi && !dangKhoiDong.has(taiKhoanId)) {
                proxyWebSocket(req, socket, head, r.dia_chi);
                return;
            }
            if (!socket.destroyed) { socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'); }
        },
    };
}

export type DieuPhoi = ReturnType<typeof taoDieuPhoi>;
