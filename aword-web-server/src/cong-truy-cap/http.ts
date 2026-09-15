// Tiện ích HTTP của cổng truy cập: đọc cookie/thân yêu cầu có giới hạn, gửi trang/JSON kèm header bảo mật,
// kiểm tra cùng nguồn gốc (chống CSRF), chuẩn hóa đường dẫn "tiep" (chống chuyển hướng mở), lấy IP người dùng.
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { isIP } from 'node:net';

export class LoiHttp extends Error {
    trangThai: number;
    constructor(trangThai: number, thongBao: string) {
        super(thongBao);
        this.trangThai = trangThai;
    }
}

/**
 * Header bảo mật cho mọi phản hồi của cổng (trang, API, tài nguyên tĩnh).
 * `mayPhien`: tên miền của phiên AWord — sau đăng nhập/đổi mật khẩu, biểu mẫu chuyển hướng "/" rồi sang máy của phiên;
 * trình duyệt áp form-action cho CẢ chuỗi chuyển hướng nên phải cho phép máy đó, không thì bị chặn ở bước cuối.
 */
export function datHeaderBaoMat(res: ServerResponse, https: boolean, mayPhien?: string): void {
    const dichBieuMau = mayPhien ? ` ${https ? 'https' : 'http'}://${mayPhien}:*` : '';
    res.setHeader('Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; "
        + `object-src 'none'; base-uri 'none'; form-action 'self'${dichBieuMau}; frame-ancestors 'none'`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    // same-origin: vẫn gửi Referer trong cùng máy (dự phòng kiểm tra nguồn gốc), không lộ ra ngoài
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (https) { res.setHeader('Strict-Transport-Security', 'max-age=31536000'); }
}

export function guiHtml(res: ServerResponse, trangThai: number, html: string): void {
    const than = Buffer.from(html, 'utf8');
    res.writeHead(trangThai, {
        'Content-Type': 'text/html; charset=utf-8', 'Content-Length': than.length, 'Cache-Control': 'no-store',
    });
    res.end(res.req?.method === 'HEAD' ? undefined : than);
}

export function guiJson(res: ServerResponse, trangThai: number, duLieu: unknown): void {
    const than = Buffer.from(JSON.stringify(duLieu), 'utf8');
    res.writeHead(trangThai, {
        'Content-Type': 'application/json; charset=utf-8', 'Content-Length': than.length, 'Cache-Control': 'no-store',
    });
    res.end(than);
}

export function chuyenHuong(res: ServerResponse, diaChi: string, trangThai = 303): void {
    res.writeHead(trangThai, { Location: diaChi, 'Cache-Control': 'no-store', 'Content-Length': 0 });
    res.end();
}

/** Mọi cookie theo tên (một tên có thể xuất hiện nhiều lần, vd cookie tên miền cha và cookie riêng máy). */
export function docCookie(req: IncomingMessage): Map<string, string[]> {
    const kq = new Map<string, string[]>();
    for (const phan of (req.headers.cookie ?? '').split(';')) {
        const i = phan.indexOf('=');
        if (i < 0) { continue; }
        const ten = phan.slice(0, i).trim();
        let giaTri = phan.slice(i + 1).trim();
        if (giaTri.startsWith('"') && giaTri.endsWith('"')) { giaTri = giaTri.slice(1, -1); }
        if (!kq.has(ten)) { kq.set(ten, []); }
        kq.get(ten)!.push(giaTri);
    }
    return kq;
}

export function taoCookie(ten: string, giaTri: string, tuy: {
    domain?: string; secure: boolean; maxAgeGiay?: number; path?: string;
}): string {
    const phan = [`${ten}=${giaTri}`, `Path=${tuy.path ?? '/'}`, 'HttpOnly', 'SameSite=Lax'];
    if (tuy.domain) { phan.push(`Domain=${tuy.domain}`); }
    if (tuy.maxAgeGiay !== undefined) { phan.push(`Max-Age=${Math.max(0, Math.floor(tuy.maxAgeGiay))}`); }
    if (tuy.secure) { phan.push('Secure'); }
    return phan.join('; ');
}

export function themSetCookie(res: ServerResponse, cookie: string): void {
    const cu = res.getHeader('Set-Cookie');
    const ds = cu === undefined ? [] : Array.isArray(cu) ? cu : [String(cu)];
    res.setHeader('Set-Cookie', [...ds, cookie]);
}

/** Tên miền ghi vào thuộc tính Domain của cookie; undefined khi là địa chỉ IP hoặc "localhost" trần. */
export function tenMienCookie(tenMien: string): string | undefined {
    let may = tenMien.trim().toLowerCase().replace(/\.$/, '');
    if (may.startsWith('[')) { return undefined; } // IPv6 dạng [::1]
    may = may.replace(/:\d+$/, '');
    if (may === '' || may === 'localhost' || isIP(may) !== 0 || !/^[a-z0-9.-]+$/.test(may)) { return undefined; }
    return may;
}

/** Tên máy (không cổng) của yêu cầu, chữ thường. */
export function tenMayYeuCau(req: IncomingMessage): string {
    const host = (req.headers.host ?? '').toLowerCase();
    if (host.startsWith('[')) { return host.slice(0, host.indexOf(']') + 1); }
    return host.replace(/:\d+$/, '');
}

/** Yêu cầu tới máy con của tên miền (vd {uuid}.webview.<tenMien>) — thuộc phiên AWord, không phải cổng. */
export function laMayCon(req: IncomingMessage, tenMien: string): boolean {
    const may = tenMayYeuCau(req);
    const goc = tenMien.trim().toLowerCase().replace(/:\d+$/, '');
    return goc !== '' && may !== goc && may.endsWith(`.${goc}`);
}

/**
 * Kiểm tra yêu cầu thay đổi dữ liệu đến từ chính trang của máy chủ: Origin (hoặc Referer khi thiếu Origin) phải trùng
 * máy:cổng của yêu cầu (Host, hoặc X-Forwarded-Host do proxy đặt). Trình duyệt không cho trang khác giả mạo các header này.
 */
export function cungNguonGoc(req: IncomingMessage, https: boolean): boolean {
    let nguon = req.headers.origin;
    if (!nguon || nguon === 'null') {
        const referer = req.headers.referer;
        if (!referer) { return false; }
        try { nguon = new URL(referer).origin; } catch { return false; }
    }
    let url: URL;
    try { url = new URL(nguon); } catch { return false; }
    if (url.protocol !== 'https:' && (https || url.protocol !== 'http:')) { return false; }
    const hopLe = [req.headers.host, String(req.headers['x-forwarded-host'] ?? '').split(',')[0]]
        .map(h => (h ?? '').trim().toLowerCase()).filter(h => h !== '')
        .map(h => h.replace(url.protocol === 'https:' ? /:443$/ : /:80$/, ''));
    return hopLe.includes(url.host.toLowerCase());
}

/** Đường dẫn "tiep" chỉ nhận đường dẫn tương đối trên cùng máy (chống chuyển hướng mở). */
export function tiepAnToan(tiep: string | null | undefined, macDinh = '/'): string {
    if (!tiep || tiep.length > 2000 || !tiep.startsWith('/') || tiep.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(tiep)) {
        return macDinh;
    }
    try {
        const u = new URL(tiep, 'http://may-chu.invalid');
        if (u.origin !== 'http://may-chu.invalid') { return macDinh; }
        if (u.pathname === '/dang-nhap' || u.pathname === '/dang-xuat') { return macDinh; }
        return u.pathname + u.search + u.hash;
    } catch {
        return macDinh;
    }
}

export async function docThan(req: IncomingMessage, gioiHanByte: number): Promise<Buffer> {
    const doDai = Number(req.headers['content-length'] ?? 0);
    if (doDai > gioiHanByte) { throw new LoiHttp(413, `Dữ liệu gửi lên quá lớn (tối đa ${Math.round(gioiHanByte / 1024 / 1024 * 10) / 10} MB).`); }
    const manh: Buffer[] = [];
    let tong = 0;
    for await (const m of req) {
        tong += (m as Buffer).length;
        if (tong > gioiHanByte) { throw new LoiHttp(413, `Dữ liệu gửi lên quá lớn (tối đa ${Math.round(gioiHanByte / 1024 / 1024 * 10) / 10} MB).`); }
        manh.push(m as Buffer);
    }
    return Buffer.concat(manh);
}

export async function docForm(req: IncomingMessage): Promise<URLSearchParams> {
    const loai = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
    if (loai !== 'application/x-www-form-urlencoded') { throw new LoiHttp(415, 'Biểu mẫu gửi lên không đúng định dạng.'); }
    return new URLSearchParams((await docThan(req, 64 * 1024)).toString('utf8'));
}

export async function docJson(req: IncomingMessage, gioiHanByte = 2 * 1024 * 1024): Promise<Record<string, unknown>> {
    const loai = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
    if (loai !== 'application/json') { throw new LoiHttp(415, 'Dữ liệu gửi lên phải ở dạng JSON.'); }
    const van = (await docThan(req, gioiHanByte)).toString('utf8');
    try {
        const kq: unknown = van.trim() === '' ? {} : JSON.parse(van);
        if (typeof kq !== 'object' || kq === null || Array.isArray(kq)) { throw new Error(); }
        return kq as Record<string, unknown>;
    } catch {
        throw new LoiHttp(400, 'Dữ liệu JSON không hợp lệ.');
    }
}

const laLoopback = (ip: string): boolean => ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';

/** IP người dùng: sau proxy chạy trên chính máy này thì lấy phần tử cuối của X-Forwarded-For (do proxy thêm vào). */
export function layIp(req: IncomingMessage): string {
    const tructiep = req.socket.remoteAddress ?? '';
    const xff = req.headers['x-forwarded-for'];
    if (laLoopback(tructiep) && typeof xff === 'string' && xff.trim() !== '') {
        const cuoi = xff.split(',').map(s => s.trim()).filter(Boolean).pop();
        if (cuoi && isIP(cuoi)) { return cuoi; }
    }
    return tructiep.replace(/^::ffff:/, '');
}

export function hmac(biMat: string, noiDung: string): string {
    return createHmac('sha256', biMat).update(noiDung).digest('base64url');
}

export function bangNhauHangThoiGian(a: string, b: string): boolean {
    const x = Buffer.from(a), y = Buffer.from(b);
    return x.length === y.length && timingSafeEqual(x, y);
}
