// Tiện ích dùng chung của Cổng AI: kiểm kiểu dữ liệu JSON, định dạng tiền/ngày kiểu Việt Nam, trả lỗi dạng Anthropic,
// đọc thân yêu cầu có giới hạn và ghi luồng có tôn trọng áp lực ngược (backpressure).
import type { IncomingMessage, ServerResponse } from 'node:http';

export type DoiTuong = Record<string, unknown>;

export const laDoiTuong = (v: unknown): v is DoiTuong => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Số token hợp lệ (nguyên, không âm); còn lại trả undefined. */
export function soKhongAm(v: unknown): number | undefined {
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : undefined;
}

/** 1234567 → "1.234.567". */
export function dinhDangTien(n: number): string {
    const am = n < 0;
    const chuoi = String(Math.abs(Math.trunc(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return am ? `-${chuoi}` : chuoi;
}

const LECH_GIO_VIET = 7 * 3600 * 1000;

/** Ngày dd/mm/yyyy theo giờ Việt Nam. */
export function ngayViet(luc: number): string {
    const d = new Date(luc + LECH_GIO_VIET);
    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

/** 'YYYY-MM' (dạng lưu CSDL) → 'MM/YYYY' (dạng hiển thị). */
export const thangHienThi = (thang: string): string => thang.split('-').reverse().join('/');

export const thanLoi = (loai: string, thongDiep: string): string =>
    JSON.stringify({ type: 'error', error: { type: loai, message: thongDiep } });

/** Loại lỗi Anthropic tương ứng mã HTTP (dùng khi dịch lỗi của nhà cung cấp không theo định dạng Anthropic). */
export function loaiLoiTheoMaHttp(status: number): string {
    switch (status) {
        case 400: case 422: return 'invalid_request_error';
        case 401: return 'authentication_error';
        case 402: case 403: return 'permission_error';
        case 404: return 'not_found_error';
        case 413: return 'request_too_large';
        case 429: return 'rate_limit_error';
        case 503: case 529: return 'overloaded_error';
        default: return status >= 400 && status < 500 ? 'invalid_request_error' : 'api_error';
    }
}

export function guiJson(res: ServerResponse, status: number, duLieu: unknown, header: Record<string, string> = {}): void {
    const than = JSON.stringify(duLieu);
    res.writeHead(status, {
        ...header,
        'content-type': 'application/json; charset=utf-8',
        'content-length': String(Buffer.byteLength(than)),
        'cache-control': 'no-store',
    });
    res.end(than);
}

/**
 * Lỗi do chính Cổng AI sinh ra, dạng Anthropic. Mặc định kèm `x-should-retry: false` để SDK của Claude Code không tự
 * thử lại những lỗi mà thử lại cũng vô ích (hết hạn mức, token sai, thiếu khóa…); lỗi tạm thời thì đặt choThuLai.
 */
export function guiLoi(res: ServerResponse, status: number, loai: string, thongDiep: string,
    tuy: { choThuLai?: boolean; header?: Record<string, string> } = {}): void {
    if (res.headersSent) {
        if (!res.writableEnded) { res.destroy(); }
        return;
    }
    const header: Record<string, string> = { ...tuy.header };
    if (!tuy.choThuLai) { header['x-should-retry'] = 'false'; }
    const than = thanLoi(loai, thongDiep);
    res.writeHead(status, {
        ...header,
        'content-type': 'application/json; charset=utf-8',
        'content-length': String(Buffer.byteLength(than)),
        'cache-control': 'no-store',
    });
    res.end(than);
}

export class LoiThanQuaLon extends Error {
    gioiHan: number;
    constructor(gioiHan: number) {
        super('Thân yêu cầu vượt giới hạn.');
        this.gioiHan = gioiHan;
    }
}

/** Đọc toàn bộ thân yêu cầu, dừng ngay khi vượt giới hạn (kể cả khi content-length khai báo đã vượt). */
export function docThanYeuCau(req: IncomingMessage, gioiHan: number): Promise<Buffer> {
    return new Promise((ok, loi) => {
        const khaiBao = Number(req.headers['content-length']);
        if (Number.isFinite(khaiBao) && khaiBao > gioiHan) { loi(new LoiThanQuaLon(gioiHan)); return; }
        const cacDoan: Buffer[] = [];
        let tong = 0;
        let xong = false;
        const ketThuc = (e: Error | undefined) => {
            if (xong) { return; }
            xong = true;
            if (e) { cacDoan.length = 0; loi(e); } else { ok(Buffer.concat(cacDoan)); }
        };
        req.on('data', (doan: Buffer) => {
            if (xong) { return; } // phần thừa sau khi vượt giới hạn: đọc bỏ
            tong += doan.length;
            if (tong > gioiHan) { ketThuc(new LoiThanQuaLon(gioiHan)); return; }
            cacDoan.push(doan);
        });
        req.on('end', () => ketThuc(undefined));
        req.on('error', e => ketThuc(e));
        req.on('close', () => ketThuc(new Error('Máy khách đóng kết nối khi đang gửi yêu cầu.')));
    });
}

/**
 * Ghi một đoạn ra máy khách; bộ đệm đầy thì chờ 'drain' rồi mới đọc tiếp từ nhà cung cấp. Thôi chờ khi kết nối đóng
 * hoặc lượt bị hủy/quá hạn (máy khách đọc quá chậm không được giữ lượt gọi mãi).
 */
export function ghiDoan(res: ServerResponse, doan: Uint8Array | string, tinHieu?: AbortSignal): Promise<void> {
    if (res.destroyed || res.writableEnded) { return Promise.resolve(); }
    if (res.write(doan) || tinHieu?.aborted) { return Promise.resolve(); }
    return new Promise(ok => {
        const xong = () => {
            res.off('drain', xong);
            res.off('close', xong);
            tinHieu?.removeEventListener('abort', xong);
            ok();
        };
        res.on('drain', xong);
        res.on('close', xong);
        tinHieu?.addEventListener('abort', xong);
    });
}

/** Đọc hết thân phản hồi (tối đa gioiHan byte; phần vượt bị bỏ và ngừng đọc). */
export async function docHetPhanHoi(phanHoi: Response, gioiHan: number): Promise<Buffer> {
    if (!phanHoi.body) { return Buffer.alloc(0); }
    const docGia = phanHoi.body.getReader();
    const cacDoan: Uint8Array[] = [];
    let tong = 0;
    for (;;) {
        const { done, value } = await docGia.read();
        if (done) { break; }
        cacDoan.push(value);
        tong += value.length;
        if (tong >= gioiHan) { await docGia.cancel().catch(() => undefined); break; }
    }
    return Buffer.concat(cacDoan).subarray(0, gioiHan);
}

/** Ghép địa chỉ gốc của nhà cung cấp với đường dẫn API (bỏ dấu / thừa). */
export const noiDuongDan = (goc: string, duongDan: string): string => goc.replace(/\/+$/, '') + duongDan;
