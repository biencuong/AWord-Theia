// Định tuyến theo tên máy của máy chủ ghép (may-chu.ts): cổng / phiên AWord / webview / Cổng AI, tách nguồn gốc quản trị.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import type { IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Duplex } from 'node:stream';
import { moCsdl } from '../src/csdl/csdl.ts';
import { taoCongTruyCap } from '../src/cong-truy-cap/cong-truy-cap.ts';
import { taoMayChu, tachHost } from '../src/may-chu.ts';
import { bamMatKhau } from '../src/xac-thuc/ma-hoa.ts';
import { MAT_KHAU, TEN_MIEN, cauHinhThu, layCsrf, taoTrinhDuyet } from './fixtures/tai-khoan/moi-truong-cong.ts';

const MAY_PHIEN = `app.${TEN_MIEN}`;

async function dung() {
    const cauHinh = cauHinhThu();
    const db = moCsdl(':memory:');
    const ghi = { phien: [] as Array<{ id: number; host: string; url: string }>, ws: [] as number[], ai: [] as string[] };
    const dieuPhoi = {
        async dungPhien(_id: number) { /* không dùng */ },
        async xuLy(req: IncomingMessage, res: import('node:http').ServerResponse, id: number) {
            ghi.phien.push({ id, host: req.headers.host ?? '', url: req.url ?? '' });
            res.writeHead(200, { 'content-type': 'text/plain' });
            res.end(`phien:${id}`);
        },
        async xuLyWebSocket(_req: IncomingMessage, socket: Duplex, _head: Buffer, id: number) {
            ghi.ws.push(id);
            socket.end('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n');
        },
    };
    const congAi = {
        async xuLy(req: IncomingMessage, res: import('node:http').ServerResponse) {
            ghi.ai.push(`${req.headers.host} ${req.url}`);
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end('{"ai":true}');
            return true;
        },
        thuHoiToken(_id: number) { /* không dùng */ },
        daDungThang: () => 0,
    };
    const congTruyCap = taoCongTruyCap({ db, cauHinh, dieuPhoi, congAi });
    const mayChu = taoMayChu({ cauHinh, congAi, congTruyCap, dieuPhoi });
    await new Promise<void>(ok => mayChu.listen(0, '127.0.0.1', ok));
    const cong = (mayChu.address() as AddressInfo).port;
    const bay = Date.now();
    const id = Number(db.prepare(`INSERT INTO tai_khoan (ten_dang_nhap, ho_ten, email, vai_tro, mat_khau_bam, phai_doi_mat_khau, tao_luc, cap_nhat_luc)
        VALUES (?, ?, ?, 'quan_tri_he_thong', ?, 0, ?, ?)`).run('qt@so.gov.vn', 'Quản trị', 'qt@so.gov.vn', await bamMatKhau(MAT_KHAU), bay, bay).lastInsertRowid);
    const td = taoTrinhDuyet(cong, `${TEN_MIEN}:${cong}`, `http://${TEN_MIEN}:${cong}`);
    return {
        cong, id, ghi, td,
        tat: () => new Promise<void>(ok => { mayChu.closeAllConnections(); mayChu.close(() => ok()); }),
    };
}

const TRANG = { accept: 'text/html,application/xhtml+xml' };

test('tachHost: tên máy chữ thường, cổng, IPv6', () => {
    assert.deepEqual(tachHost('App.AWord.test:8080'), { may: 'app.aword.test', cong: ':8080' });
    assert.deepEqual(tachHost('[::1]:3000'), { may: '[::1]', cong: ':3000' });
    assert.deepEqual(tachHost(undefined), { may: '', cong: '' });
});

test('cổng: "/" chưa đăng nhập → trang đăng nhập; đã đăng nhập → sang máy của phiên AWord', async t => {
    const m = await dung();
    t.after(m.tat);
    let r = await m.td.goi('GET', '/', { header: TRANG });
    assert.equal(r.trangThai, 302);
    assert.equal(r.viTri, '/dang-nhap');
    // Biểu mẫu đăng nhập chuyển hướng qua "/" sang máy của phiên: form-action phải cho phép máy đó (trình duyệt chặn cả chuỗi)
    const trang = await m.td.goi('GET', '/dang-nhap', { header: TRANG });
    assert.match(String(trang.header['content-security-policy']), new RegExp(`form-action 'self' http://${MAY_PHIEN.replace(/\./g, '\\.')}:\\*;`));
    r = await m.td.dangNhap('qt@so.gov.vn', MAT_KHAU);
    assert.equal(r.trangThai, 303);
    const cookie = r.setCookie.find(c => c.startsWith('aword_phien='));
    assert.ok(cookie && /Domain=aword\.test/i.test(cookie), 'cookie đăng nhập phải phủ cả máy con (phiên, webview)');
    r = await m.td.goi('GET', '/', { header: TRANG });
    assert.equal(r.trangThai, 302);
    assert.equal(r.viTri, `http://${MAY_PHIEN}:${m.cong}/`);
});

test('máy của phiên: đã đăng nhập → bộ điều phối (kể cả /quan-tri, webview); chưa đăng nhập → về cổng hoặc 401', async t => {
    const m = await dung();
    t.after(m.tat);
    const hostPhien = `${MAY_PHIEN}:${m.cong}`;
    let r = await m.td.goi('GET', '/', { host: hostPhien, header: TRANG });
    assert.equal(r.trangThai, 302);
    assert.equal(r.viTri, `http://${TEN_MIEN}:${m.cong}/dang-nhap`);
    r = await m.td.goi('GET', '/services', { host: hostPhien });
    assert.equal(r.trangThai, 401);
    assert.equal(m.ghi.phien.length, 0);

    await m.td.dangNhap('qt@so.gov.vn', MAT_KHAU);
    r = await m.td.goi('GET', '/', { host: hostPhien, header: TRANG });
    assert.deepEqual([r.trangThai, r.than], [200, `phien:${m.id}`]);
    // Trang quản trị KHÔNG bao giờ phục vụ trên nguồn gốc của phiên — đường dẫn đó thuộc về Theia trong phiên.
    r = await m.td.goi('GET', '/quan-tri', { host: hostPhien, header: TRANG });
    assert.deepEqual([r.trangThai, r.than], [200, `phien:${m.id}`]);
    r = await m.td.goi('GET', '/index.html', { host: `abc123.webview.${hostPhien}`, header: TRANG });
    assert.deepEqual([r.trangThai, r.than], [200, `phien:${m.id}`]);
    // /ai trên máy của phiên cũng là của phiên, không lọt vào Cổng AI
    r = await m.td.goi('POST', '/ai/v1/messages', { host: hostPhien, json: {} });
    assert.equal(r.than, `phien:${m.id}`);
    assert.equal(m.ghi.ai.length, 0);
    assert.equal(m.ghi.phien.length, 4);
});

test('Cổng AI qua địa chỉ nội bộ; IP/tên lạ → về tên miền chính thức; máy con lạ không phải phiên → không vào phiên', async t => {
    const m = await dung();
    t.after(m.tat);
    let r = await m.td.goi('POST', '/ai/v1/messages', { host: `127.0.0.1:${m.cong}`, json: { model: 'x' } });
    assert.deepEqual([r.trangThai, r.than], [200, '{"ai":true}']);
    r = await m.td.goi('GET', '/quan-tri', { host: `127.0.0.1:${m.cong}`, header: TRANG });
    assert.equal(r.trangThai, 302);
    assert.equal(r.viTri, `http://${TEN_MIEN}:${m.cong}/`);
    await m.td.dangNhap('qt@so.gov.vn', MAT_KHAU);
    r = await m.td.goi('GET', '/', { host: `evil.${TEN_MIEN}:${m.cong}`, header: TRANG });
    assert.equal(r.trangThai, 302);
    assert.equal(m.ghi.phien.length, 0);
});

test('API quản trị từ nguồn gốc của phiên bị chặn (Origin khác), từ cổng thì được', async t => {
    const m = await dung();
    t.after(m.tat);
    await m.td.dangNhap('qt@so.gov.vn', MAT_KHAU);
    const csrf = layCsrf((await m.td.goi('GET', '/quan-tri')).than);
    const json = { hoTen: 'Nguyễn Văn B', email: 'b@so.gov.vn', vaiTro: 'nguoi_dung' };
    let r = await m.td.goi('POST', '/api/quan-tri/tai-khoan', { json, header: { 'x-aword-csrf': csrf }, nguon: `http://${MAY_PHIEN}:${m.cong}` });
    assert.equal(r.trangThai, 403);
    r = await m.td.goi('POST', '/api/quan-tri/tai-khoan', { json, header: { 'x-aword-csrf': csrf } });
    assert.ok(r.trangThai >= 200 && r.trangThai < 300, `tạo tài khoản từ cổng phải được (nhận ${r.trangThai}: ${r.than})`);
});

function nangCap(cong: number, host: string, cookie?: string): Promise<number> {
    return new Promise((ok, loi) => {
        const headers: Record<string, string> = { host, connection: 'Upgrade', upgrade: 'websocket', 'sec-websocket-version': '13', 'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==' };
        if (cookie) { headers.cookie = cookie; }
        const r = request({ host: '127.0.0.1', port: cong, path: '/services', headers });
        r.on('upgrade', (res, socket) => { socket.destroy(); ok(res.statusCode ?? 0); });
        r.on('response', res => { res.resume(); ok(res.statusCode ?? 0); });
        r.on('error', loi);
        r.end();
    });
}

test('WebSocket: chỉ nối vào phiên khi ở máy của phiên và đã đăng nhập', async t => {
    const m = await dung();
    t.after(m.tat);
    assert.equal(await nangCap(m.cong, `${MAY_PHIEN}:${m.cong}`), 401);
    await m.td.dangNhap('qt@so.gov.vn', MAT_KHAU);
    const cookie = [...m.td.cookie].map(([k, v]) => `${k}=${v}`).join('; ');
    assert.equal(await nangCap(m.cong, `${TEN_MIEN}:${m.cong}`, cookie), 401);
    assert.equal(await nangCap(m.cong, `${MAY_PHIEN}:${m.cong}`, cookie), 101);
    assert.deepEqual(m.ghi.ws, [m.id]);
});
