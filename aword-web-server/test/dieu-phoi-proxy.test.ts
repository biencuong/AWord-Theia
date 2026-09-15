import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'node:http';
import { locCookie, proxyHttp, proxyWebSocket, tachDiaChi } from '../src/dieu-phoi/proxy.ts';
import type { TuyChonProxy } from '../src/dieu-phoi/proxy.ts';
import { choDen, dongMay, goiHttp, nghe, taoMayChuWs } from './fixtures/dieu-phoi/tien-ich.ts';

async function taoCong(diaChi: string, tuy: TuyChonProxy): Promise<{ may: http.Server; cong: number }> {
    const may = http.createServer((req, res) => proxyHttp(req, res, diaChi, tuy));
    may.on('upgrade', (req, socket, head) => proxyWebSocket(req, socket, head, diaChi, tuy));
    return { may, cong: await nghe(may) };
}

test('tách địa chỉ và lọc cookie của cổng', () => {
    assert.deepEqual(tachDiaChi('172.30.0.5:3000'), { host: '172.30.0.5', port: 3000 });
    assert.deepEqual(tachDiaChi('[::1]:8080'), { host: '::1', port: 8080 });
    assert.throws(() => tachDiaChi('khong-co-cong'));
    assert.equal(locCookie('aword_phien=bi-mat; theia-connection-token=abc;  khac=1'), 'theia-connection-token=abc; khac=1');
    assert.equal(locCookie('aword_phien=bi-mat'), '');
    // Mọi cookie của cổng (tiền tố aword_, không phân biệt hoa thường) đều không vào phiên
    assert.equal(locCookie('aword_truoc_dang_nhap=csrf; AWORD_KHAC=1; theia-connection-token=abc'), 'theia-connection-token=abc');
});

test('proxy HTTP: chuyển method/body/header, giữ Host, bỏ xác thực của cổng và hop-by-hop, thêm X-Forwarded-*', async t => {
    let nhan: { method?: string; url?: string; headers: http.IncomingHttpHeaders; body: string } = { headers: {}, body: '' };
    const dich = http.createServer((req, res) => {
        const phan: Buffer[] = [];
        req.on('data', (c: Buffer) => phan.push(c));
        req.on('end', () => {
            nhan = { method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(phan).toString('utf8') };
            res.writeHead(201, [
                'Set-Cookie', 'aword_phien=gia-mao; Path=/; HttpOnly',
                'Set-Cookie', 'theia-connection-token=moi; Path=/; HttpOnly',
                'X-Phien', 'mot', 'Connection', 'X-Bo-Phan-Hoi', 'X-Bo-Phan-Hoi', '1', 'Content-Type', 'text/plain; charset=utf-8',
            ]);
            res.end('đã nhận');
        });
    });
    const congDich = await nghe(dich);
    const cong = await taoCong(`127.0.0.1:${congDich}`, { https: true });
    t.after(async () => { await dongMay(cong.may); await dongMay(dich); });

    const kq = await goiHttp(cong.cong, {
        method: 'POST', path: '/files/?q=tiếng'.replace('tiếng', encodeURIComponent('tiếng')),
        headers: [
            'Host', 'abc123.webview.aword.localhost:8080',
            'Cookie', 'aword_phien=bi-mat; theia-connection-token=abc',
            'Authorization', 'Bearer cua-cong',
            'X-Aword-Tai-Khoan', '1',
            'Connection', 'keep-alive, X-Bo-Di',
            'X-Bo-Di', '1',
            'X-Forwarded-For', '10.0.0.9',
            'X-Forwarded-Proto', 'gia-mao',
            'Content-Type', 'application/json',
        ],
        body: JSON.stringify({ noiDung: 'Tiếng Việt có dấu' }),
    });
    assert.equal(nhan.method, 'POST');
    assert.equal(nhan.url, '/files/?q=ti%E1%BA%BFng');
    assert.equal(nhan.body, JSON.stringify({ noiDung: 'Tiếng Việt có dấu' }));
    assert.equal(nhan.headers.host, 'abc123.webview.aword.localhost:8080');
    assert.equal(nhan.headers.cookie, 'theia-connection-token=abc');
    assert.equal(nhan.headers.authorization, undefined);
    assert.equal(nhan.headers['x-aword-tai-khoan'], undefined);
    assert.equal(nhan.headers['x-bo-di'], undefined);
    assert.equal(nhan.headers['x-forwarded-for'], '10.0.0.9, 127.0.0.1');
    assert.equal(nhan.headers['x-forwarded-proto'], 'https');
    assert.equal(nhan.headers['x-forwarded-host'], 'abc123.webview.aword.localhost:8080');
    assert.equal(nhan.headers['content-type'], 'application/json');

    assert.equal(kq.ma, 201);
    assert.equal(kq.body, 'đã nhận');
    assert.deepEqual(kq.headers['set-cookie'], ['theia-connection-token=moi; Path=/; HttpOnly']);
    assert.equal(kq.headers['x-phien'], 'mot');
    assert.equal(kq.headers['x-bo-phan-hoi'], undefined);
});

test('proxy HTTP: truyền luồng không đệm (SSE nhận phần đầu trước khi phiên ghi phần sau)', async t => {
    let ghiTiep: (() => void) | undefined;
    const dich = http.createServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.write('data: mot\n\n');
        ghiTiep = () => res.end('data: hai\n\n');
    });
    const congDich = await nghe(dich);
    const cong = await taoCong(`127.0.0.1:${congDich}`, {});
    t.after(async () => { await dongMay(cong.may); await dongMay(dich); });

    const cacPhan: string[] = [];
    await new Promise<void>((ok, loi) => {
        const req = http.get({ host: '127.0.0.1', port: cong.cong, path: '/sse', agent: false }, res => {
            assert.equal(res.headers['content-type'], 'text/event-stream');
            res.setEncoding('utf8');
            res.on('data', (c: string) => {
                cacPhan.push(c);
                if (cacPhan.length === 1) {
                    assert.equal(c, 'data: mot\n\n');
                    ghiTiep?.();
                }
            });
            res.on('end', ok);
        });
        req.on('error', loi);
        setTimeout(() => loi(new Error('SSE bị đệm — không nhận được phần đầu')), 3000).unref();
    });
    assert.deepEqual(cacPhan.join(''), 'data: mot\n\ndata: hai\n\n');
});

test('proxy HTTP: phiên không kết nối được → trang chờ tiếng Việt (HTML tự tải lại / văn bản) và báo lỗi kết nối', async t => {
    const tam = http.createServer();
    const congChet = await nghe(tam);
    await dongMay(tam);
    let soLanBao = 0;
    const cong = await taoCong(`127.0.0.1:${congChet}`, { khiLoiKetNoi: () => { soLanBao++; } });
    t.after(() => dongMay(cong.may));

    const trang = await goiHttp(cong.cong, { headers: ['Host', 'aword.localhost', 'Accept', 'text/html,application/xhtml+xml'] });
    assert.equal(trang.ma, 503);
    assert.match(String(trang.headers['content-type']), /text\/html/);
    assert.match(trang.body, /http-equiv="refresh"/);
    assert.match(trang.body, /Đang chuẩn bị phiên làm việc/);
    const xhr = await goiHttp(cong.cong, { headers: ['Host', 'aword.localhost', 'Accept', 'application/json'] });
    assert.equal(xhr.ma, 503);
    assert.match(xhr.body, /đang khởi động/);
    assert.equal(soLanBao, 2);
});

test('proxy WebSocket: nâng cấp, giữ Host/Origin, bỏ cookie cổng, nối hai chiều, đóng gọn từ cả hai phía', async t => {
    const ws = await taoMayChuWs();
    let byteLen = 0;
    const cong = await taoCong(`127.0.0.1:${ws.cong}`, { khiDuLieuTuTrinhDuyet: n => { byteLen += n; } });
    t.after(async () => { await dongMay(cong.may); await dongMay(ws.may); });

    const moKetNoi = (duongDan: string): WebSocket => new WebSocket(`ws://127.0.0.1:${cong.cong}${duongDan}`, {
        headers: { Origin: `http://127.0.0.1:${cong.cong}`, Cookie: 'aword_phien=bi-mat; theia-connection-token=abc', 'X-Aword-Tai-Khoan': '1' },
    } as unknown as string[]);

    // 1) vọng tin nhắn ngắn và dài (>125 byte), trình duyệt đóng
    const k1 = moKetNoi('/services?x=1');
    const nhan: string[] = [];
    await new Promise<void>((ok, loi) => {
        k1.onerror = () => loi(new Error('WebSocket lỗi'));
        k1.onopen = () => { k1.send('xin chào'); k1.send('d'.repeat(300)); };
        k1.onmessage = e => { nhan.push(String(e.data)); if (nhan.length === 2) { ok(); } };
    });
    assert.deepEqual(nhan, ['vong:xin chào', `vong:${'d'.repeat(300)}`]);
    const h = ws.nangCap[0];
    assert.equal(h.host, `127.0.0.1:${cong.cong}`);
    assert.equal(h.origin, `http://127.0.0.1:${cong.cong}`);
    assert.equal(h.cookie, 'theia-connection-token=abc');
    assert.equal(h['x-aword-tai-khoan'], undefined);
    assert.equal(String(h.upgrade).toLowerCase(), 'websocket');
    assert.ok(byteLen > 300, 'phải ghi nhận dữ liệu trình duyệt gửi lên');
    const dongK1 = new Promise<number>(ok => { k1.onclose = e => ok(e.code); });
    k1.close(1000);
    assert.equal(await dongK1, 1000);
    await choDen(() => ws.soLanKhachDong() === 1, 3000, 'máy chủ nhận khung đóng');

    // 2) phiên chủ động đóng → trình duyệt nhận close
    const k2 = moKetNoi('/services');
    const ma = await new Promise<number>((ok, loi) => {
        k2.onerror = () => loi(new Error('WebSocket lỗi'));
        k2.onopen = () => k2.send('dong-di');
        k2.onclose = e => ok(e.code);
    });
    assert.equal(ma, 1000);

    // 3) phiên từ chối nâng cấp (vd Theia chặn Origin) → trình duyệt nhận lỗi, không treo
    const k3 = moKetNoi('/tu-choi');
    await new Promise<void>(ok => { k3.onerror = () => ok(); k3.onclose = () => ok(); });
    assert.equal(k3.readyState, WebSocket.CLOSED);
});

test('proxy WebSocket: phiên không kết nối được → 503 và báo lỗi kết nối', async t => {
    const tam = http.createServer();
    const congChet = await nghe(tam);
    await dongMay(tam);
    let bao = 0;
    const cong = await taoCong(`127.0.0.1:${congChet}`, { khiLoiKetNoi: () => { bao++; } });
    t.after(() => dongMay(cong.may));
    const k = new WebSocket(`ws://127.0.0.1:${cong.cong}/services`);
    await new Promise<void>(ok => { k.onerror = () => ok(); });
    assert.equal(bao, 1);
});
