// Dịch Anthropic Messages ↔ OpenAI Responses API để Claude Code (chỉ nói giao thức Anthropic) gọi được mô hình Codex.
// Chỉ dịch phần Claude Code thực sự dùng: văn bản, ảnh, tệp PDF, công cụ (function), system, max_tokens, streaming.
// Khối thinking của Anthropic không có tương đương (cần chữ ký) nên bị bỏ; công cụ máy chủ của Anthropic (web search…)
// không có input_schema nên cũng bị bỏ.
import { randomUUID } from 'node:crypto';
import { soTokenRong, type SoToken } from './bang-gia.ts';
import { dongSse } from './sse.ts';
import { laDoiTuong, loaiLoiTheoMaHttp, soKhongAm, type DoiTuong } from './tien-ich.ts';

// ───────────────────────────── Yêu cầu: Anthropic → Responses ─────────────────────────────

export function dichYeuCauSangResponses(yc: DoiTuong, moHinhGoc: string): DoiTuong {
    const kq: DoiTuong = { model: moHinhGoc };
    const huongDan = noiVanBan(yc.system, '\n\n');
    if (huongDan) { kq.instructions = huongDan; }
    kq.input = dichCacTinNhan(yc.messages);
    const congCu = dichCongCu(yc.tools);
    if (congCu.length > 0) {
        kq.tools = congCu;
        const chon = dichToolChoice(yc.tool_choice);
        if (chon !== undefined) { kq.tool_choice = chon; }
        if (laDoiTuong(yc.tool_choice) && yc.tool_choice.disable_parallel_tool_use === true) { kq.parallel_tool_calls = false; }
    }
    const toiDa = soKhongAm(yc.max_tokens);
    if (toiDa !== undefined) { kq.max_output_tokens = toiDa; }
    // Chỉ gửi khi khác giá trị mặc định 1: các mô hình suy luận của OpenAI từ chối temperature/top_p khác mặc định,
    // trong khi Claude Code hay gửi temperature = 1.
    if (typeof yc.temperature === 'number' && yc.temperature !== 1) { kq.temperature = yc.temperature; }
    if (typeof yc.top_p === 'number' && yc.top_p !== 1) { kq.top_p = yc.top_p; }
    if (yc.stream === true) { kq.stream = true; }
    // Không để OpenAI lưu hội thoại: mỗi lượt gửi đủ lịch sử (đúng mô hình không trạng thái của Anthropic Messages).
    kq.store = false;
    return kq;
}

/** system / nội dung tool_result: chuỗi, hoặc mảng khối → nối các khối văn bản. */
function noiVanBan(v: unknown, ngan: string): string {
    if (typeof v === 'string') { return v; }
    if (!Array.isArray(v)) { return ''; }
    return v.filter((k): k is DoiTuong => laDoiTuong(k) && k.type === 'text' && typeof k.text === 'string')
        .map(k => k.text as string).join(ngan);
}

function dichCacTinNhan(messages: unknown): DoiTuong[] {
    const dauVao: DoiTuong[] = [];
    if (!Array.isArray(messages)) { return dauVao; }
    for (const m of messages) {
        if (!laDoiTuong(m)) { continue; }
        const cacKhoi: unknown[] = typeof m.content === 'string' ? [{ type: 'text', text: m.content }]
            : Array.isArray(m.content) ? m.content : [];
        if (m.role === 'assistant') { dichTinAssistant(cacKhoi, dauVao); } else { dichTinUser(cacKhoi, dauVao); }
    }
    return dauVao;
}

function dichTinUser(cacKhoi: unknown[], dauVao: DoiTuong[]): void {
    let noiDung: DoiTuong[] = [];
    // Ảnh nằm trong tool_result: function_call_output chỉ nhận văn bản → gửi kèm ở tin user ngay sau các kết quả.
    const anhTuCongCu: DoiTuong[] = [];
    const xa = () => {
        if (noiDung.length > 0) { dauVao.push({ type: 'message', role: 'user', content: noiDung }); }
        noiDung = [];
    };
    for (const k of cacKhoi) {
        if (!laDoiTuong(k)) { continue; }
        if (k.type === 'tool_result') {
            xa(); // giữ đúng thứ tự: function_call_output phải liền sau function_call tương ứng
            const anh = Array.isArray(k.content) ? k.content.map(dichKhoiDauVao)
                .filter((p): p is DoiTuong => p !== undefined && p.type === 'input_image') : [];
            let vanBan = noiVanBan(k.content, '\n');
            if (!vanBan && anh.length > 0) { vanBan = '[Kết quả công cụ là hình ảnh — đính kèm ở tin nhắn kế tiếp.]'; }
            dauVao.push({ type: 'function_call_output', call_id: String(k.tool_use_id ?? ''), output: vanBan });
            anhTuCongCu.push(...anh);
            continue;
        }
        const phan = dichKhoiDauVao(k);
        if (phan) { noiDung.push(phan); }
    }
    noiDung.push(...anhTuCongCu);
    xa();
}

function dichKhoiDauVao(k: unknown): DoiTuong | undefined {
    if (!laDoiTuong(k)) { return undefined; }
    const nguon = laDoiTuong(k.source) ? k.source : undefined;
    switch (k.type) {
        case 'text':
            return typeof k.text === 'string' && k.text !== '' ? { type: 'input_text', text: k.text } : undefined;
        case 'image':
            if (nguon?.type === 'base64' && typeof nguon.data === 'string') {
                return { type: 'input_image', image_url: `data:${String(nguon.media_type ?? 'image/png')};base64,${nguon.data}`, detail: 'auto' };
            }
            if (nguon?.type === 'url' && typeof nguon.url === 'string') {
                return { type: 'input_image', image_url: nguon.url, detail: 'auto' };
            }
            return undefined;
        case 'document':
            if (nguon?.type === 'base64' && typeof nguon.data === 'string') {
                const loai = String(nguon.media_type ?? 'application/pdf');
                const ten = typeof k.title === 'string' && k.title ? k.title : 'tai-lieu.pdf';
                return { type: 'input_file', filename: ten, file_data: `data:${loai};base64,${nguon.data}` };
            }
            if (nguon?.type === 'text' && typeof nguon.data === 'string') { return { type: 'input_text', text: nguon.data }; }
            return undefined;
        default:
            return undefined; // thinking, redacted_thinking và các khối không dịch được
    }
}

function dichTinAssistant(cacKhoi: unknown[], dauVao: DoiTuong[]): void {
    let noiDung: DoiTuong[] = [];
    const xa = () => {
        if (noiDung.length > 0) { dauVao.push({ type: 'message', role: 'assistant', content: noiDung }); }
        noiDung = [];
    };
    for (const k of cacKhoi) {
        if (!laDoiTuong(k)) { continue; }
        if (k.type === 'text' && typeof k.text === 'string' && k.text !== '') {
            noiDung.push({ type: 'output_text', text: k.text });
        } else if (k.type === 'tool_use') {
            xa();
            dauVao.push({ type: 'function_call', call_id: String(k.id ?? ''), name: String(k.name ?? ''), arguments: JSON.stringify(k.input ?? {}) });
        }
    }
    xa();
}

function dichCongCu(tools: unknown): DoiTuong[] {
    if (!Array.isArray(tools)) { return []; }
    const kq: DoiTuong[] = [];
    for (const t of tools) {
        if (!laDoiTuong(t) || typeof t.name !== 'string' || !laDoiTuong(t.input_schema)) { continue; }
        const cc: DoiTuong = { type: 'function', name: t.name };
        if (typeof t.description === 'string') { cc.description = t.description; }
        cc.parameters = t.input_schema;
        // Responses API mặc định strict = true, đòi lược đồ "đóng" — lược đồ công cụ của Claude Code không đáp ứng.
        cc.strict = false;
        kq.push(cc);
    }
    return kq;
}

function dichToolChoice(tc: unknown): unknown {
    if (!laDoiTuong(tc)) { return undefined; }
    switch (tc.type) {
        case 'auto': return 'auto';
        case 'any': return 'required';
        case 'none': return 'none';
        case 'tool': return typeof tc.name === 'string' ? { type: 'function', name: tc.name } : undefined;
        default: return undefined;
    }
}

// ───────────────────────────── Phản hồi: Responses → Anthropic ─────────────────────────────

/** usage Responses → số token: input_tokens của OpenAI đã GỒM phần cache → trừ ra để không tính giá hai lần. */
export function napUsageResponses(t: SoToken, u: unknown): void {
    if (!laDoiTuong(u)) { return; }
    const vao = soKhongAm(u.input_tokens);
    const cache = laDoiTuong(u.input_tokens_details) ? soKhongAm(u.input_tokens_details.cached_tokens) ?? 0 : 0;
    const ra = soKhongAm(u.output_tokens);
    if (vao !== undefined) { t.vao = Math.max(0, vao - cache); t.cacheDoc = cache; }
    if (ra !== undefined) { t.ra = ra; }
}

export const usageAnthropic = (t: SoToken): DoiTuong => ({
    input_tokens: t.vao, output_tokens: t.ra, cache_creation_input_tokens: t.cacheGhi, cache_read_input_tokens: t.cacheDoc,
});

/**
 * stop_reason: bị cắt vì max_output_tokens → max_tokens (ưu tiên trước tool_use, vì lời gọi công cụ bị cắt dở thì
 * tham số JSON không trọn); có function_call → tool_use; bị lọc nội dung → refusal; còn lại end_turn.
 */
function lyDoDung(trangThai: unknown, chiTietDo: unknown, coGoiCongCu: boolean): string {
    const lyDo = laDoiTuong(chiTietDo) ? chiTietDo.reason : undefined;
    if (trangThai === 'incomplete' && lyDo === 'max_output_tokens') { return 'max_tokens'; }
    if (coGoiCongCu) { return 'tool_use'; }
    if (trangThai === 'incomplete' && lyDo === 'content_filter') { return 'refusal'; }
    return 'end_turn';
}

function phanTichThamSo(chuoi: unknown): DoiTuong {
    if (typeof chuoi !== 'string' || chuoi.trim() === '') { return {}; }
    try {
        const v: unknown = JSON.parse(chuoi);
        return laDoiTuong(v) ? v : {};
    } catch {
        return {};
    }
}

/** Loại lỗi Anthropic cho mã lỗi trong luồng Responses (response.failed / error). */
function loaiLoiTheoMaOpenAi(ma: unknown): string {
    const s = typeof ma === 'string' ? ma : '';
    if (s === 'rate_limit_exceeded') { return 'rate_limit_error'; }
    if (s === 'server_is_overloaded' || s === 'slow_down') { return 'overloaded_error'; }
    if (s.startsWith('invalid') || s === 'context_length_exceeded') { return 'invalid_request_error'; }
    return 'api_error';
}

/** Che khóa API nếu thông báo lỗi của OpenAI trích lại một phần khóa (vd "Incorrect API key provided: sk-…"). */
const cheKhoa = (s: string): string => s.replace(/\bsk-[A-Za-z0-9_*.-]+/g, 'sk-***');

/** Thân lỗi HTTP của OpenAI → lỗi dạng Anthropic (giữ nguyên mã HTTP ở phía gọi). */
export function dichLoiOpenAi(status: number, than: string): { type: string; message: string; ma: string } {
    let thongDiep = '';
    let ma = '';
    try {
        const v: unknown = JSON.parse(than);
        const e = laDoiTuong(v) && laDoiTuong(v.error) ? v.error : undefined;
        if (e) {
            thongDiep = typeof e.message === 'string' ? e.message : '';
            ma = typeof e.code === 'string' ? e.code : typeof e.type === 'string' ? e.type : '';
        }
    } catch { /* không phải JSON */ }
    if (!thongDiep) { thongDiep = than.slice(0, 500); }
    return {
        type: loaiLoiTheoMaHttp(status),
        message: cheKhoa(`OpenAI trả lỗi HTTP ${status}${thongDiep ? `: ${thongDiep}` : ''}`),
        ma,
    };
}

const taoIdTin = (): string => `msg_${randomUUID().replace(/-/g, '')}`;

export interface KetQuaDichPhanHoi {
    tinNhan?: DoiTuong;
    loi?: { type: string; message: string; ma: string };
    soToken: SoToken;
}

/** Phản hồi Responses (không stream) → message Anthropic. maMoHinh = tên mô hình Claude Code đã gửi. */
export function dichPhanHoiResponses(r: unknown, maMoHinh: string): KetQuaDichPhanHoi {
    const soToken = soTokenRong();
    if (!laDoiTuong(r)) {
        return { soToken, loi: { type: 'api_error', message: 'Phản hồi của OpenAI không đúng định dạng Responses API.', ma: 'dinh_dang' } };
    }
    napUsageResponses(soToken, r.usage);
    if (r.status === 'failed' || laDoiTuong(r.error)) {
        const e = laDoiTuong(r.error) ? r.error : {};
        return {
            soToken,
            loi: {
                type: loaiLoiTheoMaOpenAi(e.code),
                message: cheKhoa(`OpenAI báo lỗi: ${typeof e.message === 'string' ? e.message : 'không rõ nguyên nhân'}`),
                ma: typeof e.code === 'string' ? e.code : 'failed',
            },
        };
    }
    const noiDung: DoiTuong[] = [];
    let coGoiCongCu = false;
    for (const muc of Array.isArray(r.output) ? r.output : []) {
        if (!laDoiTuong(muc)) { continue; }
        if (muc.type === 'message' && Array.isArray(muc.content)) {
            for (const phan of muc.content) {
                if (!laDoiTuong(phan)) { continue; }
                const vanBan = phan.type === 'output_text' ? phan.text : phan.type === 'refusal' ? phan.refusal : undefined;
                if (typeof vanBan === 'string' && vanBan !== '') { noiDung.push({ type: 'text', text: vanBan }); }
            }
        } else if (muc.type === 'function_call') {
            coGoiCongCu = true;
            noiDung.push({ type: 'tool_use', id: String(muc.call_id ?? muc.id ?? ''), name: String(muc.name ?? ''), input: phanTichThamSo(muc.arguments) });
        }
    }
    return {
        soToken,
        tinNhan: {
            id: taoIdTin(),
            type: 'message',
            role: 'assistant',
            model: maMoHinh,
            content: noiDung,
            stop_reason: lyDoDung(r.status, r.incomplete_details, coGoiCongCu),
            stop_sequence: null,
            usage: usageAnthropic(soToken),
        },
    };
}

// ───────────────────────────── Luồng: sự kiện Responses → SSE Anthropic ─────────────────────────────

export interface BoDichLuongResponses {
    /** Nạp một sự kiện Responses (đã JSON.parse), trả về văn bản SSE Anthropic cần phát (có thể rỗng). */
    nap(suKien: unknown): string;
    /** Luồng từ OpenAI đã hết: nếu chưa có response.completed thì phát sự kiện lỗi. */
    ketThuc(): string;
    readonly trangThai: 'dang_chay' | 'xong' | 'loi';
    readonly maLoi: string | undefined;
}

interface KhoiNoiDung { index: number; daDong: boolean; coDuLieu: boolean }

/**
 * Phát lại đúng trình tự Anthropic: message_start → (content_block_start → content_block_delta* → content_block_stop)*
 * → message_delta (stop_reason, usage) → message_stop. Mỗi thời điểm chỉ mở một khối; soToken được cập nhật tại chỗ
 * để phía gọi ghi được phần token đã biết cả khi luồng bị hủy giữa chừng.
 */
export function taoBoDichLuongResponses(maMoHinh: string, soToken: SoToken, idTin: string = taoIdTin()): BoDichLuongResponses {
    let daBatDau = false;
    let chiSoKe = 0;
    let khoaDangMo: string | undefined;
    const cacKhoi = new Map<string, KhoiNoiDung>();
    let coGoiCongCu = false;
    let trangThai: 'dang_chay' | 'xong' | 'loi' = 'dang_chay';
    let maLoi: string | undefined;

    const batDau = (): string => {
        if (daBatDau) { return ''; }
        daBatDau = true;
        return dongSse('message_start', {
            type: 'message_start',
            message: {
                id: idTin, type: 'message', role: 'assistant', model: maMoHinh, content: [],
                stop_reason: null, stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 },
            },
        });
    };
    const dong = (): string => {
        if (khoaDangMo === undefined) { return ''; }
        const k = cacKhoi.get(khoaDangMo) as KhoiNoiDung;
        k.daDong = true;
        khoaDangMo = undefined;
        return dongSse('content_block_stop', { type: 'content_block_stop', index: k.index });
    };
    const dongNeuDangMo = (khoa: string): string => (khoaDangMo === khoa ? dong() : '');
    const mo = (khoa: string, khoiDau: DoiTuong): string => {
        if (khoaDangMo === khoa) { return ''; }
        const s = batDau() + dong();
        const index = chiSoKe++;
        cacKhoi.set(khoa, { index, daDong: false, coDuLieu: false });
        khoaDangMo = khoa;
        return s + dongSse('content_block_start', { type: 'content_block_start', index, content_block: khoiDau });
    };
    const delta = (khoa: string, d: DoiTuong): string => {
        const k = cacKhoi.get(khoa) as KhoiNoiDung;
        k.coDuLieu = true;
        return dongSse('content_block_delta', { type: 'content_block_delta', index: k.index, delta: d });
    };
    const vanBan = (khoa: string, text: string): string =>
        mo(khoa, { type: 'text', text: '' }) + delta(khoa, { type: 'text_delta', text });
    const khoiCongCu = (item: DoiTuong): DoiTuong =>
        ({ type: 'tool_use', id: String(item.call_id ?? item.id ?? ''), name: String(item.name ?? ''), input: {} });
    const phatLoi = (loai: string, thongDiep: string, ma: string): string => {
        trangThai = 'loi';
        maLoi = ma;
        return dong() + dongSse('error', { type: 'error', error: { type: loai, message: cheKhoa(thongDiep) } });
    };

    return {
        get trangThai() { return trangThai; },
        get maLoi() { return maLoi; },

        nap(sk: unknown): string {
            if (!laDoiTuong(sk) || trangThai !== 'dang_chay') { return ''; }
            const oi = String(sk.output_index ?? 0);
            const ci = String(sk.content_index ?? 0);
            switch (sk.type) {
                case 'response.created':
                case 'response.in_progress':
                    return batDau();

                case 'response.output_item.added': {
                    const item = laDoiTuong(sk.item) ? sk.item : undefined;
                    if (item?.type !== 'function_call') { return batDau(); }
                    coGoiCongCu = true;
                    const khoa = `f${oi}`;
                    let s = mo(khoa, khoiCongCu(item));
                    if (typeof item.arguments === 'string' && item.arguments !== '') {
                        s += delta(khoa, { type: 'input_json_delta', partial_json: item.arguments });
                    }
                    return s;
                }

                case 'response.output_text.delta':
                case 'response.refusal.delta':
                    return typeof sk.delta === 'string' && sk.delta !== '' ? vanBan(`t${oi}:${ci}`, sk.delta) : '';

                case 'response.output_text.done':
                case 'response.refusal.done': {
                    const khoa = `t${oi}:${ci}`;
                    const text = sk.type === 'response.output_text.done' ? sk.text : sk.refusal;
                    if (!cacKhoi.has(khoa) && typeof text === 'string' && text !== '') { return vanBan(khoa, text) + dong(); }
                    return dongNeuDangMo(khoa);
                }

                case 'response.function_call_arguments.delta': {
                    const khoa = `f${oi}`;
                    const k = cacKhoi.get(khoa);
                    if (!k || k.daDong || typeof sk.delta !== 'string' || sk.delta === '') { return ''; }
                    return delta(khoa, { type: 'input_json_delta', partial_json: sk.delta });
                }

                case 'response.output_item.done': {
                    const item = laDoiTuong(sk.item) ? sk.item : undefined;
                    if (item?.type === 'function_call') {
                        coGoiCongCu = true;
                        const khoa = `f${oi}`;
                        let s = '';
                        if (!cacKhoi.has(khoa)) { s += mo(khoa, khoiCongCu(item)); }
                        const k = cacKhoi.get(khoa) as KhoiNoiDung;
                        // Chưa nhận delta tham số nào (nhà cung cấp chỉ gửi bản trọn) → phát trọn một lần.
                        if (!k.coDuLieu && !k.daDong && typeof item.arguments === 'string' && item.arguments !== '') {
                            s += delta(khoa, { type: 'input_json_delta', partial_json: item.arguments });
                        }
                        return s + dongNeuDangMo(khoa);
                    }
                    if (item?.type === 'message' && Array.isArray(item.content)) {
                        let s = '';
                        item.content.forEach((phan, i) => {
                            const khoa = `t${oi}:${i}`;
                            const text = laDoiTuong(phan) ? (phan.type === 'output_text' ? phan.text : phan.refusal) : undefined;
                            if (!cacKhoi.has(khoa) && typeof text === 'string' && text !== '') { s += vanBan(khoa, text) + dong(); } else { s += dongNeuDangMo(khoa); }
                        });
                        return s;
                    }
                    return '';
                }

                case 'response.completed':
                case 'response.incomplete': {
                    const r = laDoiTuong(sk.response) ? sk.response : {};
                    napUsageResponses(soToken, r.usage);
                    const trangThaiR = r.status ?? (sk.type === 'response.incomplete' ? 'incomplete' : 'completed');
                    trangThai = 'xong';
                    return batDau() + dong()
                        + dongSse('message_delta', {
                            type: 'message_delta',
                            delta: { stop_reason: lyDoDung(trangThaiR, r.incomplete_details, coGoiCongCu), stop_sequence: null },
                            usage: usageAnthropic(soToken),
                        })
                        + dongSse('message_stop', { type: 'message_stop' });
                }

                case 'response.failed': {
                    const r = laDoiTuong(sk.response) ? sk.response : {};
                    napUsageResponses(soToken, r.usage);
                    const e = laDoiTuong(r.error) ? r.error : {};
                    return phatLoi(loaiLoiTheoMaOpenAi(e.code),
                        `OpenAI báo lỗi: ${typeof e.message === 'string' ? e.message : 'không rõ nguyên nhân'}`,
                        typeof e.code === 'string' ? e.code : 'response.failed');
                }

                case 'error':
                    return phatLoi(loaiLoiTheoMaOpenAi(sk.code),
                        `OpenAI báo lỗi: ${typeof sk.message === 'string' ? sk.message : 'không rõ nguyên nhân'}`,
                        typeof sk.code === 'string' ? sk.code : 'error');

                default:
                    return ''; // reasoning, content_part.*, function_call_arguments.done… không cần phát
            }
        },

        ketThuc(): string {
            if (trangThai !== 'dang_chay') { return ''; }
            return phatLoi('api_error', 'Kết nối tới OpenAI kết thúc khi phản hồi chưa hoàn tất — hãy thử lại.', 'luong_ket_thuc_som');
        },
    };
}
