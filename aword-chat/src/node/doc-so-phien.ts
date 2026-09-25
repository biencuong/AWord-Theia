// Đọc sổ phiên của Claude Code (~/.claude/projects/**/*.jsonl) để biết đã dùng bao nhiêu token.
//
// Ba sự thật ĐO ĐƯỢC trên máy thật (1.057 tệp, 1.350,9 MB, 211.988 dòng) quyết định toàn bộ thiết kế này:
//
//   1. MỘT lượt gọi API sinh ra NHIỀU dòng `assistant` — mỗi khối nội dung (thinking, text, tool_use) là một
//      dòng, và mọi dòng của cùng một lượt mang `message.usage` GIỐNG HỆT nhau. Cộng ngây thơ theo dòng cho
//      ra số sai 3,58 lần ở token vào và 4,03 lần ở token ra. Khoá khử trùng là `message.id`.
//   2. `message.id` duy nhất trên toàn bộ sổ (24.063 id đầu tiên, 0 id nằm ở quá một tệp), nên không cần
//      khoá ghép (tệp + id).
//   3. Tệp `agent-*.jsonl` trong thư mục con `subagents/` KHÔNG trùng với tệp phiên mẹ, và chiếm ~26% tổng
//      token. Phải quét ĐỆ QUY; quét `*.jsonl` ở mỗi thư mục gốc là mất sạch token của subagent.
//
// `input_tokens` KHÔNG bao gồm cache, nên nó khớp thẳng `SoToken.vao` của Cổng AI bên AWord Web
// (aword-web-server/src/cong-ai/bang-gia.ts) — hai bên cộng ra cùng một con số.
//
// Tệp này chỉ chứa hàm THUẦN: không đọc đĩa, không giữ trạng thái, không phụ thuộc thời gian hệ thống.
// Nhờ vậy kiểm thử được bằng dữ liệu dựng sẵn và không cần chạm vào sổ phiên thật.

import type { SoToken } from '../common/so-token';

/** Một lượt gọi API đã tách ra từ sổ phiên. */
export interface LuotGoi extends SoToken {
    /** `message.id` — khoá khử trùng, mỗi lượt gọi xuất hiện đúng một lần. */
    id: string;
    /** Mốc thời gian, ms kể từ epoch. */
    luc: number;
    /** `message.model`. */
    model: string;
    /** true = lượt gọi của subagent (`isSidechain`). */
    phu: boolean;
}

/** Vì sao một dòng bị bỏ qua — đếm riêng để con số bất thường hiện ra thay vì biến mất im lặng. */
export interface DemBoQua {
    /** JSON hỏng (dòng bị cắt, ghi dở). */
    hong: number;
    /** Không phải bản ghi `assistant`, hoặc là bản ghi tổng hợp của Claude Code. */
    khongPhaiLuot: number;
}

export interface KetQuaQuet {
    luot: LuotGoi[];
    /**
     * Số BYTE đã tiêu thụ — chỉ tính tới dòng cuối cùng KẾT THÚC BẰNG `\n`.
     *
     * Đây là điểm mấu chốt chống đếm trùng: dòng cuối đang ghi dở KHÔNG được tính, nên lần đọc sau bắt đầu
     * lại từ trước dòng đó và đọc nó khi đã trọn vẹn. Nhờ vậy không bao giờ đọc lại một byte nào.
     */
    daDoc: number;
    boQua: DemBoQua;
}

/** Một mẫu số theo ngày × model, để hiện báo cáo mà không phải quét lại sổ. */
export interface MauTheoNgay {
    [ngay: string]: { [model: string]: SoToken & { luot: number } };
}

/** Dấu hiệu có số token trong một dòng JSONL — lọc nhanh trước khi giải mã. */
const DAU_USAGE = Buffer.from('"usage"');

const laKhoangTrang = (b: number): boolean => b === 0x20 || b === 0x09 || b === 0x0d;

/**
 * Phân loại dòng bị bỏ qua mà KHÔNG giải mã (dòng có thể dài hàng MB): 'trong' | 'hong' | 'khac'.
 * Dòng JSON đối tượng hợp lệ luôn mở bằng '{' và đóng bằng '}' — thiếu một trong hai là dòng hỏng/ghi dở,
 * giữ đúng cách đếm `boQua.hong` như khi còn JSON.parse mọi dòng.
 */
function phanLoaiDongBoQua(buf: Buffer, tu: number, den: number): 'trong' | 'hong' | 'khac' {
    let a = tu;
    let b = den - 1;
    while (a <= b && laKhoangTrang(buf[a])) { a++; }
    if (a > b) { return 'trong'; }
    while (b > a && laKhoangTrang(buf[b])) { b--; }
    return buf[a] === 0x7b && buf[b] === 0x7d ? 'khac' : 'hong';
}

const NGAY_TRONG = 24 * 3600 * 1000;
/** Việt Nam là UTC+7 quanh năm, không có giờ mùa hè. */
const LECH_VN_MS = 7 * 3600 * 1000;

const soDuong = (v: unknown): number =>
    typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;

const laDoiTuong = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Tách một dòng JSONL thành lượt gọi. Trả `null` nếu dòng không phải một lượt gọi tính tiền được.
 *
 * Bỏ qua: không phải `type: 'assistant'`, thiếu `message.id`, thiếu `message.usage`, model `<synthetic>`
 * (bản ghi do Claude Code tự sinh, không phải lượt gọi thật), hoặc thiếu mốc thời gian.
 */
export function docLuot(dong: unknown): LuotGoi | null {
    if (!laDoiTuong(dong) || dong.type !== 'assistant') { return null; }
    const msg = dong.message;
    if (!laDoiTuong(msg)) { return null; }

    const id = typeof msg.id === 'string' ? msg.id : '';
    const model = typeof msg.model === 'string' ? msg.model : '';
    if (!id || !model || model === '<synthetic>') { return null; }

    const u = msg.usage;
    if (!laDoiTuong(u)) { return null; }

    const luc = typeof dong.timestamp === 'string' ? Date.parse(dong.timestamp) : NaN;
    if (!Number.isFinite(luc)) { return null; }

    return {
        id,
        luc,
        model,
        vao: soDuong(u.input_tokens),
        ra: soDuong(u.output_tokens),
        cacheDoc: soDuong(u.cache_read_input_tokens),
        cacheGhi: soDuong(u.cache_creation_input_tokens),
        phu: dong.isSidechain === true,
    };
}

/**
 * Quét một khối byte đọc từ tệp jsonl.
 *
 * Cắt theo BYTE chứ không theo ký tự: `0x0A` không bao giờ xuất hiện bên trong một ký tự UTF-8 nhiều byte
 * (các byte tiếp nối đều ≥ 0x80), nên ranh giới dòng luôn trùng ranh giới ký tự. Chỉ giải mã những dòng đã
 * trọn vẹn, nhờ đó dòng ghi dở không bao giờ tạo ra ký tự lỗi hay JSON hỏng giả.
 */
export function quetKhoi(buf: Buffer): KetQuaQuet {
    const luot: LuotGoi[] = [];
    const boQua: DemBoQua = { hong: 0, khongPhaiLuot: 0 };
    let daDoc = 0;
    let tu = 0;

    for (;;) {
        const xuong = buf.indexOf(0x0a, tu);
        if (xuong < 0) { break; }
        const dauDong = tu;
        daDoc = xuong + 1;
        tu = xuong + 1;
        // Lượt tính tiền nào cũng có `"usage"`. Dòng không có (tin nhắn người dùng, kết quả công cụ, ảnh base64 dài
        // hàng MB) bỏ qua NGAY — không giải mã, không JSON.parse. Tìm trong đúng khung dòng (subarray là khung nhìn,
        // không chép), nếu tìm trên cả buf thì mỗi dòng quét tới cuối khối → O(n²).
        if (buf.subarray(dauDong, xuong).indexOf(DAU_USAGE) < 0) {
            const loai = phanLoaiDongBoQua(buf, dauDong, xuong);
            if (loai === 'hong') { boQua.hong++; } else if (loai === 'khac') { boQua.khongPhaiLuot++; }
            continue;
        }
        const dong = buf.toString('utf8', dauDong, xuong);
        if (dong.trim() === '') { continue; }

        let tho: unknown;
        try {
            tho = JSON.parse(dong);
        } catch {
            boQua.hong++;
            continue;
        }
        const l = docLuot(tho);
        if (l) { luot.push(l); } else { boQua.khongPhaiLuot++; }
    }

    return { luot, daDoc, boQua };
}

/** Ngày theo giờ Việt Nam, dạng `YYYY-MM-DD`. */
export function ngayViet(luc: number): string {
    const d = new Date(luc + LECH_VN_MS);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Ngày đầu của tháng theo giờ Việt Nam, dạng `YYYY-MM-DD`. */
export function dauThangViet(luc: number): string {
    return `${ngayViet(luc).slice(0, 7)}-01`;
}

/** Mốc ms của nửa đêm giờ Việt Nam của một ngày `YYYY-MM-DD`; trả NaN nếu chuỗi sai dạng. */
export function mocNgayViet(ngay: string): number {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay)) { return NaN; }
    const [y, m, d] = ngay.split('-').map(Number);
    return Date.UTC(y as number, (m as number) - 1, d as number) - LECH_VN_MS;
}

/**
 * Lọc bỏ những lượt đã gặp. `daThay` bị sửa tại chỗ (thêm id mới) để hàm gọi giữ được một vòng id gần đây.
 *
 * Vì sao cần: một lượt gọi nằm ở nhiều dòng trong cùng tệp, và khi đọc tăng dần ta có thể gặp lại cùng một
 * lượt nếu tệp bị ghi lại — chưa quan sát được ca nào trên 1.057 tệp thật, nhưng đây là chốt chặn rẻ tiền.
 */
export function khuyenTrung(luot: readonly LuotGoi[], daThay: Set<string>): LuotGoi[] {
    const moi: LuotGoi[] = [];
    for (const l of luot) {
        if (daThay.has(l.id)) { continue; }
        daThay.add(l.id);
        moi.push(l);
    }
    return moi;
}

/** Cộng dồn số token của nhiều lượt. */
export function congDon(luot: readonly LuotGoi[]): SoToken & { luot: number } {
    const t = { vao: 0, ra: 0, cacheDoc: 0, cacheGhi: 0, luot: 0 };
    for (const l of luot) {
        t.vao += l.vao;
        t.ra += l.ra;
        t.cacheDoc += l.cacheDoc;
        t.cacheGhi += l.cacheGhi;
        t.luot++;
    }
    return t;
}

/** Gộp lượt vào mẫu theo ngày × model. Mẫu bị sửa tại chỗ và trả về chính nó. */
export function gopTheoNgay(luot: readonly LuotGoi[], mau: MauTheoNgay): MauTheoNgay {
    for (const l of luot) {
        const ngay = mau[ngayViet(l.luc)] ?? (mau[ngayViet(l.luc)] = {});
        const o = ngay[l.model] ?? (ngay[l.model] = { vao: 0, ra: 0, cacheDoc: 0, cacheGhi: 0, luot: 0 });
        o.vao += l.vao;
        o.ra += l.ra;
        o.cacheDoc += l.cacheDoc;
        o.cacheGhi += l.cacheGhi;
        o.luot++;
    }
    return mau;
}

/** Cộng dồn mọi model trong mẫu, có thể giới hạn từ một ngày trở đi (`YYYY-MM-DD`). */
export function tongTheoNgay(mau: MauTheoNgay, tuNgay?: string): SoToken & { luot: number } {
    const t = { vao: 0, ra: 0, cacheDoc: 0, cacheGhi: 0, luot: 0 };
    for (const [ngay, theoModel] of Object.entries(mau)) {
        if (tuNgay !== undefined && ngay < tuNgay) { continue; }
        for (const o of Object.values(theoModel)) {
            t.vao += o.vao;
            t.ra += o.ra;
            t.cacheDoc += o.cacheDoc;
            t.cacheGhi += o.cacheGhi;
            t.luot += o.luot;
        }
    }
    return t;
}

/** Số ngày kể từ `tuNgay` (bao gồm) tính đến hôm nay — dùng cho các thẻ "7 ngày", "tháng này". */
export function ngayBatDauCachDay(luc: number, soNgay: number): string {
    return ngayViet(luc - (soNgay - 1) * NGAY_TRONG);
}
