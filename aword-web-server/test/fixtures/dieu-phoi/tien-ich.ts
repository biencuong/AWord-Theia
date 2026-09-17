// Tiện ích dùng chung cho kiểm thử khối điều phối: CSDL/cấu hình/Cổng AI giả, máy chủ WebSocket tối giản.
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as http from 'node:http';
import type { IncomingHttpHeaders } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { CauHinh } from '../../../src/cau-hinh.ts';
import { moCsdl } from '../../../src/csdl/csdl.ts';

export const cho = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

export async function choDen(dieuKien: () => boolean | Promise<boolean>, hanMs = 5000, moTa = 'điều kiện'): Promise<void> {
    const het = Date.now() + hanMs;
    while (!(await dieuKien())) {
        if (Date.now() > het) { throw new Error(`Hết thời gian chờ ${moTa}`); }
        await cho(25);
    }
}

const thuMucDaTao: string[] = [];
process.on('exit', () => {
    for (const d of thuMucDaTao) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* tệp còn bị giữ — bỏ qua */ } }
});

/** Thư mục tạm, tự xóa khi tiến trình kiểm thử kết thúc. */
export function thuMucTam(ten: string): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), `aword-${ten}-`));
    thuMucDaTao.push(d);
    return d;
}

export function taoCsdl(soTaiKhoan = 3): DatabaseSync {
    const db = moCsdl(':memory:');
    const luc = Date.now();
    for (let i = 1; i <= soTaiKhoan; i++) {
        db.prepare('INSERT INTO tai_khoan (id, ten_dang_nhap, ho_ten, mat_khau_bam, tao_luc, cap_nhat_luc) VALUES (?,?,?,?,?,?)')
            .run(i, `nguoidung${i}`, `Người dùng ${i}`, 'scrypt$x', luc, luc);
    }
    return db;
}

export function taoCauHinh(thuMucDuLieu: string, ghiDe: Partial<CauHinh> = {}): CauHinh {
    return {
        cong: 8080, diaChiNghe: '127.0.0.1', tenMien: 'aword.localhost', tenMienUngDung: 'app.aword.localhost', https: false,
        thuMucDuLieu, thuMucHeThong: path.join(thuMucDuLieu, 'he-thong'),
        trinhDieuPhoi: 'tien-trinh', anhDocker: 'aword-web:latest', phutNguKhiRanh: 30, giuNhatKyNgay: 0,
        diaChiCongAiChoPhien: 'http://host.docker.internal:8080/ai',
        khoaAi: {}, diaChiAi: { anthropic: 'x', deepseek: 'x', openai: 'x' },
        biMat: 'b'.repeat(40),
        ...ghiDe,
    };
}

export function taoCongAiGia() {
    const nhatKy: string[] = [];
    let dem = 0;
    return {
        nhatKy,
        capToken(taiKhoanId: number, soGio: number): string {
            const token = `token-${taiKhoanId}-${++dem}`;
            nhatKy.push(`cap:${taiKhoanId}:${soGio}:${token}`);
            return token;
        },
        thuHoiToken(taiKhoanId: number): void {
            nhatKy.push(`thu-hoi:${taiKhoanId}`);
        },
    };
}

export function nghe(may: http.Server): Promise<number> {
    return new Promise(ok => may.listen(0, '127.0.0.1', () => ok((may.address() as AddressInfo).port)));
}

export function dongMay(may: http.Server): Promise<void> {
    may.closeAllConnections();
    return new Promise(ok => may.close(() => ok()));
}

/** Gửi yêu cầu HTTP với header thô (giữ Host/Cookie tùy ý), trả trạng thái + header + thân. */
export function goiHttp(cong: number, tuy: { method?: string; path?: string; headers?: string[]; body?: string }):
    Promise<{ ma: number; headers: IncomingHttpHeaders; rawHeaders: string[]; body: string }> {
    return new Promise((ok, loi) => {
        const req = http.request({ host: '127.0.0.1', port: cong, method: tuy.method ?? 'GET', path: tuy.path ?? '/', headers: tuy.headers as unknown as http.OutgoingHttpHeaders, agent: false }, res => {
            const phan: Buffer[] = [];
            res.on('data', (c: Buffer) => phan.push(c));
            res.on('end', () => ok({ ma: res.statusCode ?? 0, headers: res.headers, rawHeaders: res.rawHeaders, body: Buffer.concat(phan).toString('utf8') }));
        });
        req.on('error', loi);
        req.end(tuy.body);
    });
}

// ---- Máy chủ WebSocket tối giản (RFC 6455, chỉ khung văn bản/đóng) ----

function khung(opcode: number, duLieu: Buffer): Buffer {
    const n = duLieu.length;
    let dau: Buffer;
    if (n < 126) {
        dau = Buffer.from([0x80 | opcode, n]);
    } else if (n < 65536) {
        dau = Buffer.alloc(4); dau[0] = 0x80 | opcode; dau[1] = 126; dau.writeUInt16BE(n, 2);
    } else {
        dau = Buffer.alloc(10); dau[0] = 0x80 | opcode; dau[1] = 127; dau.writeBigUInt64BE(BigInt(n), 2);
    }
    return Buffer.concat([dau, duLieu]);
}

export interface MayChuWs {
    may: http.Server;
    cong: number;
    /** Header của từng yêu cầu nâng cấp nhận được. */
    nangCap: IncomingHttpHeaders[];
    /** Số lần trình duyệt chủ động đóng (khung close từ phía khách). */
    soLanKhachDong: () => number;
}

/** Tiếng vọng: nhận "x" trả "vong:x"; nhận "dong-di" thì máy chủ chủ động đóng; đường dẫn /tu-choi trả 403. */
export async function taoMayChuWs(): Promise<MayChuWs> {
    const nangCap: IncomingHttpHeaders[] = [];
    let khachDong = 0;
    const may = http.createServer((_req, res) => { res.writeHead(426); res.end(); });
    may.on('upgrade', (req, socket: Socket) => {
        nangCap.push(req.headers);
        if (req.url?.startsWith('/tu-choi')) {
            socket.end('HTTP/1.1 403 Forbidden\r\nContent-Type: text/plain\r\nContent-Length: 8\r\n\r\ntu choi!');
            return;
        }
        const chapNhan = createHash('sha1').update(`${req.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
        socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${chapNhan}\r\n\r\n`);
        let dem = Buffer.alloc(0);
        socket.on('error', () => socket.destroy());
        socket.on('data', (d: Buffer) => {
            dem = Buffer.concat([dem, d]);
            for (;;) {
                if (dem.length < 2) { return; }
                const opcode = dem[0] & 0x0f;
                const coMat = (dem[1] & 0x80) !== 0;
                let n = dem[1] & 0x7f;
                let viTri = 2;
                if (n === 126) { if (dem.length < 4) { return; } n = dem.readUInt16BE(2); viTri = 4; }
                else if (n === 127) { if (dem.length < 10) { return; } n = Number(dem.readBigUInt64BE(2)); viTri = 10; }
                const doDaiMat = coMat ? 4 : 0;
                if (dem.length < viTri + doDaiMat + n) { return; }
                const mat = dem.subarray(viTri, viTri + doDaiMat);
                const duLieu = Buffer.from(dem.subarray(viTri + doDaiMat, viTri + doDaiMat + n));
                if (coMat) { for (let i = 0; i < duLieu.length; i++) { duLieu[i] ^= mat[i % 4]; } }
                dem = dem.subarray(viTri + doDaiMat + n);
                if (opcode === 0x8) {
                    khachDong++;
                    socket.end(khung(0x8, duLieu.subarray(0, 2)));
                    return;
                }
                if (opcode === 0x1) {
                    const vanBan = duLieu.toString('utf8');
                    if (vanBan === 'dong-di') {
                        const ma = Buffer.alloc(2); ma.writeUInt16BE(1000, 0);
                        socket.end(khung(0x8, ma));
                        return;
                    }
                    socket.write(khung(0x1, Buffer.from(`vong:${vanBan}`, 'utf8')));
                }
            }
        });
    });
    const cong = await nghe(may);
    return { may, cong, nangCap, soLanKhachDong: () => khachDong };
}
