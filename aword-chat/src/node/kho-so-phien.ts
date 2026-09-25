// Kho số liệu token: giữ trạng thái đọc sổ phiên giữa các lần chạy, đọc TĂNG DẦN, và theo dõi tệp mới.
//
// Vì sao phải tăng dần: sổ phiên thật đo được 1.057 tệp / 1.352 MB. Quét lại từ đầu mất 6,3 giây — chấp
// nhận được MỘT lần khi cài, nhưng không thể làm mỗi lần người dùng nhìn lên thanh tiêu đề.
//
// Cách chống đếm trùng (ba lớp, lớp sau bịt lỗ của lớp trước):
//   1. Nhớ `vitri` (byte) cho từng tệp và chỉ đọc phần vượt quá nó — không bao giờ đọc lại một byte nào.
//   2. Lõi `quetKhoi` chỉ tiêu thụ tới dòng cuối ĐÃ TRỌN VẸN, nên dòng đang ghi dở tự động hoãn sang lần sau.
//   3. Nếu tệp NGẮN ĐI hoặc phần đầu tệp ĐỔI KHÁC (bị ghi lại), con số đã cộng cho tệp đó không còn đúng nữa
//      và không thể trừ ra chính xác — nên quét lại TOÀN BỘ. Đây là lý do ghi thêm `dauBam` (băm 4 KB đầu):
//      chỉ so kích thước thì bỏ sót trường hợp ghi lại mà tệp dài hơn.
//
// CHI PHÍ MỖI LƯỢT QUÉT (sửa 25/9/2026 — nguyên nhân AWord "chạy lâu thì treo"): bản trước `readFileSync` TOÀN BỘ
// mọi tệp rồi mới so kích thước, nên một lượt quét "không có gì mới" vẫn đọc lại 1,73 GB (828 tệp, tệp lớn nhất
// 338 MB): ~2 giây và chặn event loop tới 444 ms — chạy mỗi 5 giây, và liên tục trong lúc Claude đang trả lời
// (fs.watch bắn theo từng dòng ghi thêm). Tiến trình này là backend Theia, nơi trung chuyển MỌI thông điệp giữa
// giao diện và Claude Code, nên nó bận là cả ứng dụng đứng theo. Nay:
//   - tệp không đổi kích thước thì KHÔNG mở (lượt quét thường chỉ tốn một `stat` mỗi tệp);
//   - chỉ đọc phần mới từ `vitri`, theo lô ≤ LO_DOC byte, nhường luồng giữa các lô; băm đầu chỉ đọc ≤ 4 KB;
//   - sự kiện fs.watch mang tên tệp → chỉ đọc đúng tệp vừa đổi; quét toàn thư mục chỉ là lưới an toàn thưa;
//   - dòng không chứa `"usage"` (tin nhắn người dùng, ảnh base64 hàng MB) bỏ qua ngay, không giải mã JSON;
//   - chỉ ghi tệp trạng thái khi số liệu thật sự đổi.
//
// Ghi trạng thái bằng tệp tạm rồi đổi tên (atomic) và đặt quyền 0600 — trạng thái này chứa đường dẫn và số
// liệu sử dụng của người dùng, không cần cho người khác trên máy đọc.

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
    dauThangViet, gopTheoNgay, ngayBatDauCachDay, ngayViet, quetKhoi, tongTheoNgay,
    type KetQuaQuet, type LuotGoi, type MauTheoNgay,
} from './doc-so-phien';
import type { BaoCaoToken, ChiSoToken } from '../common/chi-so-token-protocol';
import type { SoToken } from '../common/so-token';

/** Số byte đầu dùng để nhận ra tệp bị ghi lại. */
const DAI_BAM_DAU = 4096;

/** Mỗi lần đọc tối đa từng này byte rồi nhường luồng — tránh một tệp 300 MB chặn backend nửa giây. */
const LO_DOC = 8 * 1024 * 1024;

/** Đọc `dai` byte từ vị trí `tu` của tệp đang mở (đọc đủ, kể cả khi hệ điều hành trả thiếu). */
function docDoan(fd: number, tu: number, dai: number): Buffer {
    const buf = Buffer.allocUnsafe(dai);
    let da = 0;
    while (da < dai) {
        const n = fs.readSync(fd, buf, da, dai - da, tu + da);
        if (n <= 0) { break; }
        da += n;
    }
    return da === dai ? buf : buf.subarray(0, da);
}

/** Nhường event loop cho việc khác (RPC giữa giao diện và Claude Code) rồi làm tiếp. Môi trường kiểm thử jsdom
 *  không có setImmediate thì dùng setTimeout. */
const nhuongLuong = (): Promise<void> => new Promise<void>(r => {
    if (typeof setImmediate === 'function') { setImmediate(r); } else { setTimeout(r, 0); }
});

const NGAY_MS = 24 * 3600 * 1000;

/**
 * Cửa sổ nhớ `message.id` đã tính, ms.
 *
 * Vì sao cần: một lượt gọi sinh ra NHIỀU dòng (thinking, text, tool_use), mỗi khối là một lần ghi riêng.
 * Nếu ta đọc đúng lúc Claude Code vừa ghi xong dòng thứ nhất của một lượt, dòng đó được tính; các dòng còn
 * lại của CÙNG lượt rơi vào lần đọc sau và bị tính thêm. Offset theo byte KHÔNG bịt được lỗ hổng này vì nó
 * chỉ ngăn đọc lại byte cũ, không biết gì về `message.id`.
 *
 * Vì sao có trần thời gian chứ không nhớ vĩnh viễn: nhớ mãi thì tập id phình theo năm tháng (35 nghìn id
 * hôm nay, sẽ là hàng trăm nghìn). Các dòng của một lượt được ghi trong vài giây, nên cửa sổ 15 phút là
 * thừa sức bao trùm; quá khoảng đó mà còn dòng cùng id thì đó là bất thường, không phải luồng bình thường.
 */
const CUA_SO_ID_MS = 15 * 60 * 1000;

/** Trạng thái một tệp đã đọc. */
interface TrangThaiTep {
    /** Số byte đã tiêu thụ (chỉ tính tới dòng trọn vẹn cuối cùng). */
    vitri: number;
    /** Băm phần đầu tệp — phát hiện ghi lại khi tệp vẫn dài ra. */
    dauBam: string;
}

interface TrangThaiLuu {
    phienBan: 1;
    tep: Record<string, TrangThaiTep>;
    /** Tổng dồn theo ngày × model, khoá ngày `YYYY-MM-DD` giờ Việt Nam. */
    mau: MauTheoNgay;
    lanQuetCuoi?: number;
}

export interface TuyChonKho {
    /** Thư mục gốc sổ phiên (mặc định `~/.claude/projects`, tôn trọng `CLAUDE_CONFIG_DIR`). */
    goc: string;
    /** Tệp lưu trạng thái đọc. */
    tepTrangThai: string;
    /** Bảng giá để tính tiền — đọc lại mỗi lần tính, để bảng giá đổi là số đổi theo. */
    traGia: (model: string) => SoToken | undefined;
    /** Gọi sau mỗi lần số liệu đổi, để tầng trên đẩy lên giao diện. */
    khiDoi?: () => void;
    /** Nhịp quét dự phòng TOÀN thư mục, ms (mặc định 60 giây). `fs.watch` đệ quy trên Windows hay sót sự kiện nên luôn
     *  cần nhịp này; tệp nào đổi thì đã được đọc ngay theo sự kiện, nhịp này chỉ là lưới an toàn. */
    nhipPollMs?: number;
    /** Gộp các sự kiện tệp rộ lên trong khoảng này, ms. */
    debounceMs?: number;
    /** Số byte tối đa mỗi lần đọc một tệp (mặc định 8 MB) — chỉ đổi trong kiểm thử. */
    loDocByte?: number;
    /** Số tệp xử lý mỗi lượt trước khi nhường luồng, khi quét lần đầu. */
    soTepMoiLo?: number;
}

export interface KhoSoPhien {
    /** Nạp trạng thái đã lưu rồi quét phần mới. Trả về khi trạng thái đã nạp xong (quét lần đầu chạy nền). */
    batDau(): Promise<void>;
    docChiSo(): ChiSoToken;
    docBaoCao(soNgay: number): BaoCaoToken;
    /** Đọc phần mới ngay bây giờ, không chờ nhịp theo dõi. */
    quetNgay(): Promise<void>;
    /** Quét lại từ đầu — dùng khi người dùng bấm "Tính lại từ đầu". */
    quetLai(): Promise<void>;
    /** Chờ lượt quét đang chạy xong (dùng cho kiểm thử và cho lúc tắt ứng dụng). */
    choQuetXong(): Promise<void>;
    dung(): void;
}

/**
 * Băm `n` byte ĐẦU của tệp — dùng để nhận ra tệp đã bị ghi lại.
 *
 * `n` phải là số byte ta ĐÃ TIÊU THỤ, không phải hằng số 4096. Nếu băm một đoạn dài hơn phần đã đọc thì mọi
 * lần ghi thêm vào tệp nhỏ hơn 4 KB đều làm đổi băm, và ta sẽ tưởng nhầm là tệp bị ghi lại → quét lại toàn
 * bộ (6,3 giây cho 1,35 GB) sau mỗi dòng Claude Code ghi thêm. Chỉ so những byte đã đọc thì phép so mới
 * đúng nghĩa "phần ta đã dùng có còn nguyên không".
 */
function bamDau(buf: Buffer, n: number): string {
    return createHash('sha1').update(buf.subarray(0, Math.min(n, DAI_BAM_DAU))).digest('hex');
}

function docTrangThai(tep: string): TrangThaiLuu {
    try {
        const t = JSON.parse(fs.readFileSync(tep, 'utf8')) as TrangThaiLuu;
        if (t && t.phienBan === 1 && t.tep && t.mau) { return t; }
    } catch {
        // Chưa có, hỏng, hoặc phiên bản khác → bắt đầu lại từ đầu. Không phải lỗi chặn.
    }
    return { phienBan: 1, tep: {}, mau: {} };
}

function ghiTrangThai(tep: string, tt: TrangThaiLuu): void {
    fs.mkdirSync(path.dirname(tep), { recursive: true });
    const tam = `${tep}.tam`;
    fs.writeFileSync(tam, JSON.stringify(tt), { mode: 0o600 });
    fs.renameSync(tam, tep);
}

/** Liệt kê ĐỆ QUY mọi tệp `.jsonl`. Bỏ sót thư mục con `subagents/` là mất ~26% tổng token. */
export function lietKeJsonl(goc: string): string[] {
    const ra: string[] = [];
    const di = (t: string): void => {
        let muc: fs.Dirent[];
        try {
            muc = fs.readdirSync(t, { withFileTypes: true });
        } catch {
            return;
        }
        for (const m of muc) {
            const d = path.join(t, m.name);
            if (m.isDirectory()) { di(d); } else if (m.isFile() && m.name.endsWith('.jsonl')) { ra.push(d); }
        }
    };
    di(goc);
    return ra;
}

export function taoKhoSoPhien(tuy: TuyChonKho): KhoSoPhien {
    const nhipPoll = tuy.nhipPollMs ?? 60_000;
    const debounce = tuy.debounceMs ?? 500;
    const moiLo = Math.max(1, tuy.soTepMoiLo ?? 20);
    const loDoc = Math.max(1, tuy.loDocByte ?? LO_DOC);

    let tt = docTrangThai(tuy.tepTrangThai);
    let dangQuet = false;
    let soTepGhiLai = 0;
    let henPoll: NodeJS.Timeout | undefined;
    let henDebounce: NodeJS.Timeout | undefined;
    let theoDoi: fs.FSWatcher | undefined;
    let dangChay: Promise<void> | undefined;
    /** Số liệu đã đổi kể từ lần ghi trạng thái trước — không đổi thì không ghi tệp, không báo giao diện. */
    let coDoi = false;
    /** Tệp vừa đổi theo sự kiện fs.watch, chờ đọc ở lượt kế tiếp. `null` = có sự kiện không rõ tệp → quét cả thư mục. */
    let tepChoDoc: Set<string> | null = new Set<string>();

    // ---- tính toán ----

    function tongCua(mau: MauTheoNgay): { token: SoToken & { luot: number }; tien: number; chuaCoGia: Set<string> } {
        const token = tongTheoNgay(mau);
        let tien = 0;
        // Đếm MODEL chưa có giá, không đếm ô ngày×model: cùng một model thiếu giá ở 49 ngày vẫn là MỘT
        // model cần bổ sung giá. Đếm ô cho ra con số vô nghĩa (49 ngày × 7 model = 343) và làm người dùng
        // tưởng có hàng trăm model phải khai báo.
        const chuaCoGia = new Set<string>();
        for (const theoModel of Object.values(mau)) {
            for (const [model, t] of Object.entries(theoModel)) {
                const gia = tuy.traGia(model);
                if (!gia) { chuaCoGia.add(model); continue; }
                tien += Math.ceil((t.vao * gia.vao + t.ra * gia.ra + t.cacheDoc * gia.cacheDoc + t.cacheGhi * gia.cacheGhi) / 1_000_000);
            }
        }
        return { token, tien, chuaCoGia };
    }

    /** Mẫu chỉ gồm các ngày từ `tuNgay` trở đi. */
    function catTuNgay(mau: MauTheoNgay, tuNgay: string): MauTheoNgay {
        const ra: MauTheoNgay = {};
        for (const [ngay, v] of Object.entries(mau)) {
            if (ngay >= tuNgay) { ra[ngay] = v; }
        }
        return ra;
    }

    function chiSo(): ChiSoToken {
        const luc = Date.now();
        const thang = tongCua(catTuNgay(tt.mau, dauThangViet(luc)));
        const homNay = tongCua(catTuNgay(tt.mau, ngayViet(luc)));
        return {
            tienThang: thang.tien,
            tokenThang: thang.token,
            tienHomNay: homNay.tien,
            tokenHomNay: homNay.token,
            soModelChuaCoGia: thang.chuaCoGia.size,
            dangQuet,
            lanQuetCuoi: tt.lanQuetCuoi,
            soTepGhiLai,
        };
    }

    // ---- khử trùng theo message.id ----

    /** id → mốc thời gian tính lần đầu. Có trần thời gian, xem `CUA_SO_ID_MS`. */
    const idDaTinh = new Map<string, number>();

    /**
     * Bỏ những lượt có `message.id` đã tính. Đây là chốt chặn cho lỗi đắt nhất của bài toán: đo trên sổ
     * thật, cộng theo dòng cho ra 79.364 lượt trong khi chỉ có 34.754 lượt thật — sai 2,27 lần.
     */
    function locLuotMoi(luot: readonly LuotGoi[]): LuotGoi[] {
        const luc = Date.now();
        for (const [id, t] of idDaTinh) {
            if (luc - t > CUA_SO_ID_MS) { idDaTinh.delete(id); }
        }
        const ra: LuotGoi[] = [];
        for (const l of luot) {
            if (idDaTinh.has(l.id)) { continue; }
            idDaTinh.set(l.id, luc);
            ra.push(l);
        }
        return ra;
    }

    // ---- đọc ----

    /**
     * Đọc phần mới của một tệp. Trả `true` nếu tệp bị ghi lại (cần quét lại toàn bộ).
     *
     * Chỉ mở tệp khi kích thước khác lần trước; chỉ đọc ≤ 4 KB đầu để so băm và phần từ `vitri` trở đi, theo lô.
     */
    async function docTep(duong: string, quetLaiToanBo: boolean): Promise<boolean> {
        let st: fs.Stats;
        try {
            st = fs.statSync(duong);
        } catch {
            return false;
        }
        if (!st.isFile()) { return false; }

        const khoa = duong;
        const cu = quetLaiToanBo ? undefined : tt.tep[khoa];
        const tu = cu?.vitri ?? 0;
        if (cu && st.size === tu) { return false; }      // không có gì mới — trường hợp của hầu hết tệp
        if (cu && st.size < tu) { return true; }          // tệp ngắn đi = bị ghi lại

        let fd: number;
        try {
            fd = fs.openSync(duong, 'r');
        } catch {
            return false;
        }
        try {
            // So ĐÚNG đoạn đã tiêu thụ: ghi thêm vào cuối tệp không được coi là ghi lại.
            if (cu && cu.dauBam !== bamDau(docDoan(fd, 0, Math.min(tu, DAI_BAM_DAU)), tu)) { return true; }

            let vitri = tu;
            let lo = loDoc;
            while (vitri < st.size) {
                const doan = docDoan(fd, vitri, Math.min(lo, st.size - vitri));
                if (doan.length === 0) { break; }
                const kq: KetQuaQuet = quetKhoi(doan);
                if (kq.daDoc === 0) {
                    // Không có dòng trọn vẹn nào trong lô: hoặc dòng cuối đang ghi dở, hoặc một dòng dài hơn lô
                    // (ảnh base64) → nới lô và đọc lại; tới cuối tệp mà vẫn chưa trọn thì để lần sau.
                    if (vitri + doan.length >= st.size) { break; }
                    lo *= 2;
                    continue;
                }
                const moi = locLuotMoi(kq.luot);
                if (moi.length > 0) { gopTheoNgay(moi, tt.mau); }
                vitri += kq.daDoc;
                lo = loDoc;
                if (vitri < st.size) { await nhuongLuong(); }
            }
            if (vitri !== tu || !cu) {
                // Băm đầu chỉ đổi khi phần đã tiêu thụ còn ngắn hơn 4 KB; dài hơn thì giữ băm cũ.
                const dauBam = cu && tu >= DAI_BAM_DAU ? cu.dauBam : bamDau(docDoan(fd, 0, Math.min(vitri, DAI_BAM_DAU)), vitri);
                tt.tep[khoa] = { vitri, dauBam };
                coDoi = true;
            }
            return false;
        } finally {
            fs.closeSync(fd);
        }
    }

    /** Quét toàn bộ, chia lô để không chặn luồng của tiến trình nền. */
    async function quetToanBo(): Promise<void> {
        // Xoá cửa sổ id: số liệu đang được dựng lại từ số 0, nên id cũ không còn nghĩa "đã tính rồi".
        // Quên bước này thì quét lại ra 0 — mọi lượt đều bị coi là đã gặp.
        idDaTinh.clear();
        tt.mau = {};
        tt.tep = {};
        coDoi = true;
        const teps = lietKeJsonl(tuy.goc);
        let ghiLai = 0;
        let dem = 0;
        for (const t of teps) {
            if (await docTep(t, true)) { ghiLai++; }
            if (++dem % moiLo === 0) { await nhuongLuong(); }
        }
        // Tệp đã biến mất thì bỏ khỏi trạng thái, kẻo phình mãi.
        const con = new Set(teps);
        for (const k of Object.keys(tt.tep)) {
            if (!con.has(k)) { delete tt.tep[k]; }
        }
        soTepGhiLai = ghiLai;
        tt.lanQuetCuoi = Date.now();
    }

    /** Đọc phần mới của các tệp cho trước; tệp nào bị ghi lại thì tính lại từ đầu. */
    async function docCacTep(teps: Iterable<string>): Promise<void> {
        let ghiLai = 0;
        let dem = 0;
        for (const t of teps) {
            if (await docTep(t, false)) { ghiLai++; }
            if (++dem % moiLo === 0) { await nhuongLuong(); }
        }
        if (ghiLai > 0) {
            // Có tệp bị ghi lại: cộng dồn hiện tại không còn tin được → tính lại từ đầu.
            await quetToanBo();
            soTepGhiLai = ghiLai;
        }
        tt.lanQuetCuoi = Date.now();
    }

    /** Duyệt cả thư mục (lưới an toàn) — rẻ vì tệp không đổi chỉ tốn một `stat`. */
    async function quetTangDan(): Promise<void> {
        tepChoDoc = new Set<string>();
        const teps = lietKeJsonl(tuy.goc);
        await docCacTep(teps);
        // Tệp đã biến mất thì bỏ khỏi trạng thái, kẻo phình mãi.
        const con = new Set(teps);
        for (const k of Object.keys(tt.tep)) {
            if (!con.has(k)) { delete tt.tep[k]; coDoi = true; }
        }
    }

    /** Chỉ đọc những tệp mà fs.watch báo vừa đổi; sự kiện không rõ tệp thì duyệt cả thư mục. */
    async function quetTepVuaDoi(): Promise<void> {
        const cho = tepChoDoc;
        if (cho === null) { await quetTangDan(); return; }
        tepChoDoc = new Set<string>();
        if (cho.size > 0) { await docCacTep(cho); }
    }

    function chay(viec: () => Promise<void>): Promise<void> {
        if (dangChay) { return dangChay; }
        dangQuet = true;
        dangChay = viec()
            .catch(e => { console.error('[aword] đọc sổ phiên', e); })
            .finally(() => {
                dangQuet = false;
                dangChay = undefined;
                if (!coDoi) { return; }
                coDoi = false;
                try {
                    ghiTrangThai(tuy.tepTrangThai, tt);
                } catch (e) {
                    console.error('[aword] lưu trạng thái sổ phiên', e);
                }
                tuy.khiDoi?.();
            });
        return dangChay;
    }

    /** Hẹn một lượt đọc. `tep` = tệp vừa đổi (theo fs.watch); không có = duyệt cả thư mục. */
    function henQuetLai(tep?: string): void {
        if (tep === undefined) {
            tepChoDoc = null;
        } else if (tepChoDoc !== null) {
            tepChoDoc.add(tep);
        }
        if (henDebounce) { clearTimeout(henDebounce); }
        henDebounce = setTimeout(() => {
            henDebounce = undefined;
            // Đang có lượt chạy: chờ nó xong rồi đọc tiếp những tệp dồn lại trong lúc chờ.
            void (dangChay ?? Promise.resolve()).then(() => chay(quetTepVuaDoi));
        }, debounce);
    }

    return {
        async batDau(): Promise<void> {
            // Đọc phần mới ngay (rẻ), rồi quét bù những tệp chưa từng thấy ở nền.
            await chay(quetTangDan);
            if (fs.existsSync(tuy.goc)) {
                try {
                    theoDoi = fs.watch(tuy.goc, { recursive: true }, (_loai, ten) => {
                        const t = ten ? String(ten) : '';
                        if (!t) { henQuetLai(); return; }                 // không rõ tệp → duyệt cả thư mục
                        if (t.endsWith('.jsonl')) { henQuetLai(path.join(tuy.goc, t)); }
                    });
                    theoDoi.on('error', () => { /* theo dõi hỏng thì nhịp poll vẫn còn */ });
                } catch {
                    // Nền tảng không hỗ trợ watch đệ quy → chỉ dùng nhịp poll.
                }
            }
            henPoll = setInterval(() => henQuetLai(), nhipPoll);
            henPoll.unref?.();
        },

        quetNgay(): Promise<void> {
            return chay(quetTangDan);
        },

        docChiSo: chiSo,

        docBaoCao(soNgay: number): BaoCaoToken {
            const luc = Date.now();
            const tu = ngayBatDauCachDay(luc, soNgay);
            const theoNgay: BaoCaoToken['theoNgay'] = [];
            for (const [ngay, mauNgay] of Object.entries(tt.mau).sort()) {
                if (ngay < tu) { continue; }
                const t = tongCua({ [ngay]: mauNgay });
                theoNgay.push({ ngay, tien: t.tien, token: t.token });
            }
            const theoModel: BaoCaoToken['theoModel'] = [];
            const gop: Record<string, SoToken & { luot: number }> = {};
            for (const mauNgay of Object.values(tt.mau)) {
                for (const [model, o] of Object.entries(mauNgay)) {
                    const g = gop[model] ?? (gop[model] = { vao: 0, ra: 0, cacheDoc: 0, cacheGhi: 0, luot: 0 });
                    g.vao += o.vao; g.ra += o.ra; g.cacheDoc += o.cacheDoc; g.cacheGhi += o.cacheGhi; g.luot += o.luot;
                }
            }
            for (const [model, token] of Object.entries(gop).sort((a, b) => b[1].luot - a[1].luot)) {
                const gia = tuy.traGia(model);
                const tien = gia
                    ? Math.ceil((token.vao * gia.vao + token.ra * gia.ra + token.cacheDoc * gia.cacheDoc + token.cacheGhi * gia.cacheGhi) / 1_000_000)
                    : 0;
                theoModel.push({ model, token, tien, chuaCoGia: !gia });
            }
            return { chiSo: chiSo(), theoNgay, theoModel };
        },

        async quetLai(): Promise<void> {
            // Chờ lượt đang chạy xong rồi mới tính lại — trước đây xoá số liệu GIỮA lượt đang chạy rồi trả về
            // chính lượt đó (chay() gặp dangChay), kết quả chỉ còn phần tệp chưa duyệt tới.
            while (dangChay) { await dangChay; }
            return chay(quetToanBo);
        },

        choQuetXong(): Promise<void> {
            return dangChay ?? Promise.resolve();
        },

        dung(): void {
            if (henPoll) { clearInterval(henPoll); }
            if (henDebounce) { clearTimeout(henDebounce); }
            theoDoi?.close();
            try {
                ghiTrangThai(tuy.tepTrangThai, tt);
            } catch { /* tắt ứng dụng thì không cần báo lỗi ghi trạng thái */ }
        },
    };
}

export { NGAY_MS };
