// Hook Kho tri thức AI bản Node (docker/giao-vien/hook_trithuc.mjs) phải cư xử như bản PowerShell
// (electron-app/resources/giao-vien/hook_trithuc.ps1). Trên Windows có PowerShell: chạy CẢ HAI với cùng tình huống và so kết quả.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import { dongMay, nghe, thuMucTam } from './fixtures/dieu-phoi/tien-ich.ts';

const HOOK_NODE = path.resolve(import.meta.dirname, '..', 'docker', 'giao-vien', 'hook_trithuc.mjs');
const HOOK_PS1 = path.resolve(import.meta.dirname, '..', '..', 'electron-app', 'resources', 'giao-vien', 'hook_trithuc.ps1');
const CO_POWERSHELL = process.platform === 'win32' && fs.existsSync(HOOK_PS1)
    && spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'exit 0'], { windowsHide: true }).status === 0;

function chay(ban: 'node' | 'ps1', home: string): Promise<{ ma: number | null; ra: string }> {
    const [lenh, thamSo] = ban === 'node'
        ? [process.execPath, [HOOK_NODE]]
        : ['powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', HOOK_PS1]];
    return new Promise(ok => {
        const con = spawn(lenh, thamSo, { env: { ...process.env, HOME: home, USERPROFILE: home, NO_PROXY: '127.0.0.1' }, windowsHide: true });
        let ra = '';
        con.stdout.setEncoding('utf8');
        con.stdout.on('data', (c: string) => { ra += c; });
        con.stdin.end('{"hook_event_name":"SessionStart","source":"startup"}');
        con.on('close', ma => ok({ ma, ra }));
    });
}

interface MayKho { cong: number; yeuCau: Array<{ url: string; headers: http.IncomingHttpHeaders }>; tra: (res: http.ServerResponse) => void }

async function taoMayKho(t: { after: (fn: () => Promise<void>) => void }): Promise<MayKho> {
    const kho: MayKho = { cong: 0, yeuCau: [], tra: res => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"thong_bao":[]}'); } };
    const may = http.createServer((req, res) => {
        kho.yeuCau.push({ url: req.url!, headers: req.headers });
        kho.tra(res);
    });
    kho.cong = await nghe(may);
    t.after(() => dongMay(may));
    return kho;
}

function taoHome(tep: string | undefined, noiDung: string): string {
    const home = thuMucTam('hook');
    if (tep) {
        fs.mkdirSync(path.join(home, '.aword'), { recursive: true });
        fs.writeFileSync(path.join(home, '.aword', tep), noiDung, 'utf8');
    }
    return home;
}

const traJson = (json: unknown, loai = 'application/json; charset=utf-8') => (res: http.ServerResponse): void => {
    res.writeHead(200, { 'Content-Type': loai });
    res.end(JSON.stringify(json));
};

/** Chạy bản Node (và bản PowerShell nếu có), khẳng định hai bản cho cùng kết quả; trả kết quả bản Node (JSON hoặc undefined). */
async function chayVaSo(home: string, kho?: MayKho): Promise<{ json: any; yeuCau: MayKho['yeuCau'] }> {
    const node = await chay('node', home);
    assert.equal(node.ma, 0);
    const yeuCauNode = kho ? kho.yeuCau.splice(0) : [];
    const jsonNode = node.ra.trim() ? JSON.parse(node.ra) : undefined;
    if (CO_POWERSHELL) {
        const ps = await chay('ps1', home);
        assert.equal(ps.ma, 0);
        const jsonPs = ps.ra.trim() ? JSON.parse(ps.ra) : undefined;
        assert.deepEqual(jsonNode, jsonPs, 'bản Node và bản PowerShell phải cho cùng kết quả');
        if (kho) {
            const yeuCauPs = kho.yeuCau.splice(0);
            assert.deepEqual(yeuCauNode.map(y => y.url), yeuCauPs.map(y => y.url));
            assert.deepEqual(yeuCauNode.map(y => [y.headers.authorization, y.headers['x-may']]), yeuCauPs.map(y => [y.headers.authorization, y.headers['x-may']]));
        }
    }
    return { json: jsonNode, yeuCau: yeuCauNode };
}

const MO_DAU = 'KHO TRI THỨC AI: Có 2 thông báo từ Kho tri thức AI giảng dạy (dịch vụ, cập nhật dữ liệu, đóng góp tài liệu). Hãy nhắc người dùng NGUYÊN VĂN các dòng dưới đây ở đầu câu trả lời đầu tiên, rồi mới làm việc chính; thông báo hết hạn/chưa kích hoạt thì hướng dẫn gia hạn theo skill tra-cuu-tri-thuc:\n';

test('hook tri thức: có thông báo → in hookSpecificOutput đúng nguyên văn, gọi đúng API với 2 header thiết bị', { timeout: 60000 }, async t => {
    const kho = await taoMayKho(t);
    kho.tra = traJson({ thong_bao: [
        { noi_dung: 'Gói Kho tri thức AI sắp hết hạn', muc_do: 'khẩn', ngay: '20/09/2026' },
        { noi_dung: '' },
        null,
        { noi_dung: 'Đã cập nhật dữ liệu Toán 7' },
    ] });
    const home = taoHome('trithuc.json', JSON.stringify({ url: `  http://127.0.0.1:${kho.cong}/MCP/  `, token: 'tok-123', ma_may: 'M-AAAA-BBBB' }));
    const { json, yeuCau } = await chayVaSo(home, kho);
    assert.deepEqual(json, { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext:
        `${MO_DAU}- [khẩn] Gói Kho tri thức AI sắp hết hạn (20/09/2026)\n- Đã cập nhật dữ liệu Toán 7` } });
    assert.equal(yeuCau.length, 1);
    assert.equal(yeuCau[0].url, '/api/v1/thong-bao?doc=1');
    assert.equal(yeuCau[0].headers.authorization, 'Bearer tok-123');
    assert.equal(yeuCau[0].headers['x-may'], 'M-AAAA-BBBB');
});

test('hook tri thức: dạng mảng; tệp cấu hình cũ khosgk.json (có BOM) đổi /khosgk → /trithuc', { timeout: 60000 }, async t => {
    const kho = await taoMayKho(t);
    kho.tra = traJson([{ noi_dung: 'Thông báo A' }, { noi_dung: 'Thông báo B', ngay: '2026-09-15' }]);
    const home = taoHome('khosgk.json', '﻿' + JSON.stringify({ url: `http://127.0.0.1:${kho.cong}/khosgk`, token: 'cu', ma_may: 'M-1' }));
    const { json, yeuCau } = await chayVaSo(home, kho);
    assert.equal(yeuCau[0].url, '/trithuc/api/v1/thong-bao?doc=1');
    assert.equal(json.hookSpecificOutput.additionalContext, `${MO_DAU}- Thông báo A\n- Thông báo B (2026-09-15)`);
});

test('hook tri thức: các trường hợp im lặng (không in gì, mã thoát 0)', { timeout: 120000 }, async t => {
    const kho = await taoMayKho(t);
    const url = `http://127.0.0.1:${kho.cong}/mcp`;

    // chưa kết nối
    assert.equal((await chayVaSo(taoHome(undefined, ''))).json, undefined);
    // cấu hình hỏng / thiếu token → không gọi mạng
    assert.equal((await chayVaSo(taoHome('trithuc.json', '{hỏng'), kho)).json, undefined);
    const thieuToken = await chayVaSo(taoHome('trithuc.json', JSON.stringify({ url })), kho);
    assert.equal(thieuToken.json, undefined);
    assert.equal(thieuToken.yeuCau.length, 0);

    const home = taoHome('trithuc.json', JSON.stringify({ url, token: 't', ma_may: 'M' }));
    // danh sách rỗng / chỉ mục không có nội dung
    kho.tra = traJson({ thong_bao: [{ noi_dung: '' }, { muc_do: 'khẩn' }] });
    assert.equal((await chayVaSo(home, kho)).json, undefined);
    // null
    kho.tra = traJson(null);
    assert.equal((await chayVaSo(home, kho)).json, undefined);
    // lỗi máy chủ
    kho.tra = res => { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end('{"loi":"x"}'); };
    assert.equal((await chayVaSo(home, kho)).json, undefined);
    // thân không phải JSON
    kho.tra = res => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<html>bảo trì</html>'); };
    assert.equal((await chayVaSo(home, kho)).json, undefined);
});

test('hook tri thức: JSON gửi với Content-Type text/plain vẫn được đọc (như Invoke-RestMethod)', { timeout: 60000 }, async t => {
    const kho = await taoMayKho(t);
    // Có charset: thiếu charset thì PowerShell 5.1 giải mã ISO-8859-1 làm vỡ tiếng Việt (lỗi của bản .ps1, bản Node đọc UTF-8).
    kho.tra = traJson({ thong_bao: { noi_dung: 'Một thông báo lẻ', muc_do: 'thông tin' } }, 'text/plain; charset=utf-8');
    const home = taoHome('trithuc.json', JSON.stringify({ url: `http://127.0.0.1:${kho.cong}/mcp`, token: 't', ma_may: 'M' }));
    const { json } = await chayVaSo(home, kho);
    assert.match(json.hookSpecificOutput.additionalContext, /Có 1 thông báo[\s\S]*\n- \[thông tin\] Một thông báo lẻ$/);
});

test('hook tri thức (Node): máy chủ treo → im lặng sau khoảng 4 giây', { timeout: 30000 }, async t => {
    const kho = await taoMayKho(t);
    kho.tra = () => { /* không trả lời */ };
    const home = taoHome('trithuc.json', JSON.stringify({ url: `http://127.0.0.1:${kho.cong}`, token: 't' }));
    const moc = Date.now();
    const kq = await chay('node', home);
    assert.equal(kq.ma, 0);
    assert.equal(kq.ra, '');
    assert.ok(Date.now() - moc < 9000, 'phải dừng theo hạn 4 giây');
    assert.equal(kho.yeuCau[0].headers['x-may'], '');
});
