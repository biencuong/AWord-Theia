// Proxy HTTP + WebSocket từ cổng truy cập tới phiên AWord Web (Theia) của người đang đăng nhập.
//
// Giữ nguyên header Host của trình duyệt — Theia cần nó ở hai chỗ:
//   - WsOriginValidator (@theia/core/lib/node/hosting): khi không đặt THEIA_HOSTS, WebSocket chỉ được nâng cấp nếu
//     host của Origin TRÙNG header Host → đổi Host thành IP container là khung làm việc mất kết nối.
//   - PluginApiContribution (@theia/plugin-ext): webview phục vụ theo vhost khớp THEIA_WEBVIEW_EXTERNAL_ENDPOINT
//     (mặc định {{uuid}}.webview.{{hostname}}) — so với header Host của yêu cầu.
// Không chuyển vào phiên: mọi cookie của cổng (tiền tố `aword_`: phiên đăng nhập, CSRF trước đăng nhập…), header
// Authorization, mọi header `x-aword-*`. Phản hồi của phiên không được đặt cookie `aword_*` (phiên do người dùng/AI
// điều khiển, không tin cậy).
import * as http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import { guiTrangCho } from './trang.ts';

export const COOKIE_CONG = 'aword_phien';
const laCookieCong = (ten: string): boolean => ten.trim().toLowerCase().startsWith('aword_');

const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'proxy-connection',
    'te', 'trailer', 'transfer-encoding', 'upgrade']);
// Header chuyển tiếp do cổng tự đặt lại (không tin giá trị trình duyệt gửi, trừ X-Forwarded-For được nối thêm).
const HEADER_CONG_DAT = new Set(['x-forwarded-proto', 'x-forwarded-host', 'x-forwarded-port', 'forwarded']);

export interface TuyChonProxy {
    /** Cổng chạy sau HTTPS → X-Forwarded-Proto: https. */
    https?: boolean;
    /** Không kết nối được tới phiên (phiên có thể đã chết) — bộ điều phối kiểm tra lại. */
    khiLoiKetNoi?: (loi: Error) => void;
    /** WebSocket: số byte trình duyệt vừa gửi lên (để tính hoạt động cho tự ngủ). */
    khiDuLieuTuTrinhDuyet?: (soByte: number) => void;
}

/** "host:cổng" | "[ipv6]:cổng" → phần host (bỏ ngoặc) và cổng. */
export function tachDiaChi(diaChi: string): { host: string; port: number } {
    const i = diaChi.lastIndexOf(':');
    if (i <= 0) { throw new Error(`Địa chỉ phiên không hợp lệ: "${diaChi}".`); }
    const port = Number(diaChi.slice(i + 1));
    if (!Number.isInteger(port) || port <= 0 || port > 65535) { throw new Error(`Cổng phiên không hợp lệ: "${diaChi}".`); }
    return { host: diaChi.slice(0, i).replace(/^\[(.*)\]$/, '$1'), port };
}

/** Bỏ cookie của cổng khỏi chuỗi Cookie, giữ nguyên các cookie khác (vd theia-connection-token). */
export function locCookie(chuoi: string): string {
    return chuoi.split(';').map(s => s.trim())
        .filter(s => s.length > 0 && !laCookieCong(s.split('=')[0]))
        .join('; ');
}

function tenTrongConnection(raw: string[]): Set<string> {
    const ten = new Set<string>();
    for (let i = 0; i < raw.length; i += 2) {
        if (raw[i].toLowerCase() === 'connection') {
            for (const t of raw[i + 1].split(',')) { if (t.trim()) { ten.add(t.trim().toLowerCase()); } }
        }
    }
    return ten;
}

/** Header gửi tới phiên (dạng mảng phẳng như rawHeaders — giữ hoa/thường và header lặp). */
export function locHeaderYeuCau(req: IncomingMessage, tuy: { https?: boolean; nangCap?: boolean } = {}): string[] {
    const raw = req.rawHeaders;
    const trongConnection = tenTrongConnection(raw);
    const ra: string[] = [];
    const cookie: string[] = [];
    let xff = '';
    for (let i = 0; i < raw.length; i += 2) {
        const ten = raw[i];
        const t = ten.toLowerCase();
        const v = raw[i + 1];
        if (HOP_BY_HOP.has(t) || trongConnection.has(t) || HEADER_CONG_DAT.has(t)) { continue; }
        if (t === 'authorization' || t.startsWith('x-aword-')) { continue; }
        if (t === 'cookie') { cookie.push(v); continue; }
        if (t === 'x-forwarded-for') { xff = xff ? `${xff}, ${v}` : v; continue; }
        ra.push(ten, v);
    }
    const conLai = locCookie(cookie.join('; '));
    if (conLai) { ra.push('Cookie', conLai); }
    const ip = (req.socket.remoteAddress ?? '').replace(/^::ffff:/, '');
    ra.push('X-Forwarded-For', xff ? `${xff}, ${ip}` : ip);
    ra.push('X-Forwarded-Proto', tuy.https ? 'https' : 'http');
    if (req.headers.host) { ra.push('X-Forwarded-Host', req.headers.host); }
    if (tuy.nangCap) {
        ra.push('Connection', 'Upgrade', 'Upgrade', String(req.headers.upgrade ?? 'websocket'));
    }
    return ra;
}

/** Header phản hồi của phiên gửi về trình duyệt. giuNangCap: giữ Connection/Upgrade (phản hồi 101). */
export function locHeaderPhanHoi(raw: string[], giuNangCap = false): string[] {
    const trongConnection = giuNangCap ? new Set<string>() : tenTrongConnection(raw);
    const ra: string[] = [];
    for (let i = 0; i < raw.length; i += 2) {
        const t = raw[i].toLowerCase();
        const v = raw[i + 1];
        if (!giuNangCap && (HOP_BY_HOP.has(t) || trongConnection.has(t))) { continue; }
        if (t === 'set-cookie' && laCookieCong(v.split(';')[0].split('=')[0])) { continue; }
        ra.push(raw[i], v);
    }
    return ra;
}

const LOI_KET_NOI = new Set(['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'ETIMEDOUT', 'EPIPE', 'ENOTFOUND']);
const laLoiKetNoi = (e: Error): boolean => LOI_KET_NOI.has(String((e as NodeJS.ErrnoException).code));

// Agent riêng giữ kết nối tới phiên (keep-alive) — không giới hạn số kết nối đồng thời (long-poll, SSE).
const tacNhan = new http.Agent({ keepAlive: true, maxSockets: Infinity, maxFreeSockets: 64 });

/** Proxy một yêu cầu HTTP — truyền luồng hai chiều, không đệm (SSE/tải tệp lớn đi thẳng). */
export function proxyHttp(req: IncomingMessage, res: ServerResponse, diaChi: string, tuy: TuyChonProxy = {}): void {
    let dich: { host: string; port: number };
    try {
        dich = tachDiaChi(diaChi);
    } catch {
        guiTrangCho(req, res);
        return;
    }
    const ra = http.request({
        host: dich.host, port: dich.port, method: req.method, path: req.url,
        headers: locHeaderYeuCau(req, { https: tuy.https }) as unknown as http.OutgoingHttpHeaders,
        agent: tacNhan,
    }, phanHoi => {
        res.writeHead(phanHoi.statusCode ?? 502, phanHoi.statusMessage,
            locHeaderPhanHoi(phanHoi.rawHeaders) as unknown as http.OutgoingHttpHeaders);
        // Gửi header ngay (SSE: phiên có thể chưa ghi byte thân nào trong một lúc lâu).
        res.flushHeaders();
        phanHoi.pipe(res);
        phanHoi.on('error', () => res.destroy());
        phanHoi.on('close', () => { if (!phanHoi.complete) { res.destroy(); } });
    });
    let trinhDuyetBoDi = false;
    ra.on('error', loi => {
        if (trinhDuyetBoDi) { return; }
        if (res.headersSent) { res.destroy(); return; }
        if (laLoiKetNoi(loi)) { tuy.khiLoiKetNoi?.(loi); }
        guiTrangCho(req, res);
    });
    // Trình duyệt bỏ ngang (đóng thẻ, hủy fetch) → hủy yêu cầu tới phiên.
    res.on('close', () => {
        if (!res.writableFinished) { trinhDuyetBoDi = true; ra.destroy(); }
    });
    req.on('error', () => { trinhDuyetBoDi = true; ra.destroy(); });
    req.pipe(ra);
}

function dongPhanHoiTho(ma: number, loiNhan: string, raw: string[]): string {
    let s = `HTTP/1.1 ${ma} ${loiNhan}\r\n`;
    for (let i = 0; i < raw.length; i += 2) { s += `${raw[i]}: ${raw[i + 1]}\r\n`; }
    return s + '\r\n';
}

/** Nối hai socket hai chiều; một bên đóng/lỗi → đóng bên kia. */
function noiHaiChieu(trinhDuyet: Duplex, phien: Duplex, khiDuLieu?: (n: number) => void): void {
    if (khiDuLieu) { trinhDuyet.on('data', (c: Buffer) => khiDuLieu(c.length)); }
    trinhDuyet.pipe(phien);
    phien.pipe(trinhDuyet);
    const dong = (): void => {
        if (!trinhDuyet.destroyed) { trinhDuyet.destroy(); }
        if (!phien.destroyed) { phien.destroy(); }
    };
    trinhDuyet.on('error', dong);
    phien.on('error', dong);
    trinhDuyet.on('close', dong);
    phien.on('close', dong);
}

/** Proxy nâng cấp WebSocket (sự kiện `upgrade` của máy chủ HTTP). */
export function proxyWebSocket(req: IncomingMessage, socket: Duplex, head: Buffer, diaChi: string, tuy: TuyChonProxy = {}): void {
    const tuChoi = (dongTrangThai: string): void => {
        if (!socket.destroyed) {
            socket.end(`HTTP/1.1 ${dongTrangThai}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
        }
    };
    let dich: { host: string; port: number };
    try {
        dich = tachDiaChi(diaChi);
    } catch {
        tuChoi('503 Service Unavailable');
        return;
    }
    socket.on('error', () => socket.destroy());
    const ra = http.request({
        host: dich.host, port: dich.port, method: req.method, path: req.url,
        headers: locHeaderYeuCau(req, { https: tuy.https, nangCap: true }) as unknown as http.OutgoingHttpHeaders,
        agent: false,
    });
    let daXong = false;
    ra.on('upgrade', (phanHoi, socketPhien, headPhien) => {
        daXong = true;
        if (socket.destroyed) { socketPhien.destroy(); return; }
        const s = socket as Duplex & { setNoDelay?: (b: boolean) => void; setTimeout?: (ms: number) => void };
        s.setNoDelay?.(true);
        s.setTimeout?.(0);
        socketPhien.setNoDelay(true);
        socketPhien.setTimeout(0);
        socket.write(dongPhanHoiTho(101, phanHoi.statusMessage || 'Switching Protocols', locHeaderPhanHoi(phanHoi.rawHeaders, true)));
        if (headPhien && headPhien.length > 0) { socket.write(headPhien); }
        if (head && head.length > 0) { socketPhien.write(head); }
        noiHaiChieu(socket, socketPhien, tuy.khiDuLieuTuTrinhDuyet);
    });
    // Phiên từ chối nâng cấp (vd Theia chặn Origin → 400/403): chuyển nguyên phản hồi rồi đóng.
    // Thân phản hồi đã được bộ phân tích HTTP giải khung (chunked) → gửi kèm Connection: close, hết thân thì đóng.
    ra.on('response', phanHoi => {
        daXong = true;
        if (socket.destroyed) { phanHoi.destroy(); return; }
        socket.write(dongPhanHoiTho(phanHoi.statusCode ?? 502, phanHoi.statusMessage ?? '',
            [...locHeaderPhanHoi(phanHoi.rawHeaders), 'Connection', 'close']));
        phanHoi.pipe(socket);
    });
    ra.on('error', loi => {
        if (daXong) { socket.destroy(); return; }
        if (laLoiKetNoi(loi)) { tuy.khiLoiKetNoi?.(loi); }
        tuChoi('503 Service Unavailable');
    });
    // Trình duyệt bỏ đi trước khi phiên trả lời nâng cấp → hủy yêu cầu tới phiên.
    socket.on('close', () => { if (!daXong) { ra.destroy(); } });
    ra.end();
}
