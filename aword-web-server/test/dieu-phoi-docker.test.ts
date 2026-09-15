import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'node:http';
import * as path from 'node:path';
import { LoiPhien } from '../src/dieu-phoi/loi-phien.ts';
import { phanTichDockerHost, tachLuongNhatKy, taoTrinhDocker } from '../src/dieu-phoi/trinh-docker.ts';
import { dongMay, nghe, taoCauHinh, thuMucTam } from './fixtures/dieu-phoi/tien-ich.ts';

interface ContainerGia { Id: string; ten: string; Labels: Record<string, string>; Running: boolean }

// Máy chủ giả lập Docker Engine API (chỉ các đường dẫn trình docker dùng).
async function taoDockerGia(tuy: { coAnh?: boolean; coMang?: boolean; loiStart?: boolean } = {}) {
    const yeuCau: Array<{ method: string; url: string; body?: any }> = [];
    const containers = new Map<string, ContainerGia>();
    let coMang = tuy.coMang ?? false;
    let dem = 0;
    const tim = (khoa: string): ContainerGia | undefined => containers.get(khoa) ?? [...containers.values()].find(c => c.ten === khoa);
    const traJson = (res: http.ServerResponse, ma: number, json?: unknown): void => {
        res.writeHead(ma, { 'Content-Type': 'application/json' });
        res.end(json === undefined ? '' : JSON.stringify(json));
    };
    const may = http.createServer((req, res) => {
        const phan: Buffer[] = [];
        req.on('data', (c: Buffer) => phan.push(c));
        req.on('end', () => {
            const vanBan = Buffer.concat(phan).toString('utf8');
            yeuCau.push({ method: req.method!, url: req.url!, body: vanBan ? JSON.parse(vanBan) : undefined });
            const u = new URL(req.url!, 'http://docker');
            const m = /^\/v1\.43(\/.*)$/.exec(u.pathname);
            if (!m) { traJson(res, 400, { message: 'thiếu phiên bản API' }); return; }
            const p = m[1];
            let k: RegExpExecArray | null;
            if (req.method === 'GET' && p === '/networks/aword-phien') {
                if (coMang) { traJson(res, 200, { Name: 'aword-phien' }); } else { traJson(res, 404, { message: 'network aword-phien not found' }); }
            } else if (req.method === 'POST' && p === '/networks/create') {
                coMang = true;
                traJson(res, 201, { Id: 'mang1' });
            } else if (req.method === 'POST' && p === '/containers/create') {
                const ten = u.searchParams.get('name')!;
                if (!tuy.coAnh && tuy.coAnh !== undefined) { traJson(res, 404, { message: 'No such image: aword-web:latest' }); return; }
                if (tim(ten)) { traJson(res, 409, { message: 'Conflict' }); return; }
                const c: ContainerGia = { Id: `c${++dem}`, ten, Labels: JSON.parse(vanBan).Labels, Running: false };
                containers.set(c.Id, c);
                traJson(res, 201, { Id: c.Id, Warnings: [] });
            } else if ((k = /^\/containers\/([^/]+)\/json$/.exec(p)) && req.method === 'GET') {
                const c = tim(decodeURIComponent(k[1]));
                if (!c) { traJson(res, 404, { message: 'No such container' }); return; }
                traJson(res, 200, {
                    Id: c.Id, Name: `/${c.ten}`, Config: { Labels: c.Labels }, State: { Running: c.Running },
                    NetworkSettings: { Networks: c.Running ? { 'aword-phien': { IPAddress: '172.30.0.5' } } : {} },
                });
            } else if ((k = /^\/containers\/([^/]+)\/logs$/.exec(p)) && req.method === 'GET') {
                if (!tim(k[1])) { traJson(res, 404, { message: 'No such container' }); return; }
                const khungNk = (luong: number, s: string): Buffer => {
                    const du = Buffer.from(s, 'utf8');
                    const dau = Buffer.from([luong, 0, 0, 0, 0, 0, 0, 0]);
                    dau.writeUInt32BE(du.length, 4);
                    return Buffer.concat([dau, du]);
                };
                res.writeHead(200, { 'Content-Type': 'application/vnd.docker.multiplexed-stream' });
                res.end(Buffer.concat([khungNk(1, `tail=${u.searchParams.get('tail')}\n`), khungNk(2, 'Lỗi: không mở được cổng 3000\n')]));
            } else if ((k = /^\/containers\/([^/]+)\/start$/.exec(p)) && req.method === 'POST') {
                const c = tim(k[1]);
                if (!c) { traJson(res, 404, { message: 'No such container' }); return; }
                if (tuy.loiStart) { traJson(res, 500, { message: 'cannot start: permission denied on bind' }); return; }
                if (c.Running) { traJson(res, 304); return; }
                c.Running = true;
                traJson(res, 204);
            } else if ((k = /^\/containers\/([^/]+)\/stop$/.exec(p)) && req.method === 'POST') {
                const c = tim(k[1]);
                if (!c) { traJson(res, 404, { message: 'No such container' }); return; }
                if (!c.Running) { traJson(res, 304); return; }
                c.Running = false;
                traJson(res, 204);
            } else if ((k = /^\/containers\/([^/]+)$/.exec(p)) && req.method === 'DELETE') {
                const c = tim(k[1]);
                if (!c) { traJson(res, 404, { message: 'No such container' }); return; }
                containers.delete(c.Id);
                traJson(res, 204);
            } else {
                traJson(res, 404, { message: `không giả lập ${req.method} ${p}` });
            }
        });
    });
    const cong = await nghe(may);
    return { may, cong, yeuCau, containers, dockerHost: `tcp://127.0.0.1:${cong}` };
}

const tomTat = (ds: Array<{ method: string; url: string }>): string[] => ds.map(y => `${y.method} ${y.url}`);

test('phân tích DOCKER_HOST', () => {
    assert.deepEqual(phanTichDockerHost(undefined, 'linux'), { socketPath: '/var/run/docker.sock' });
    assert.deepEqual(phanTichDockerHost(undefined, 'win32'), { socketPath: '\\\\.\\pipe\\docker_engine' });
    assert.deepEqual(phanTichDockerHost('unix:///run/user/1000/docker.sock'), { socketPath: '/run/user/1000/docker.sock' });
    assert.deepEqual(phanTichDockerHost('npipe:////./pipe/docker_engine'), { socketPath: '\\\\.\\pipe\\docker_engine' });
    assert.deepEqual(phanTichDockerHost('tcp://10.0.0.2:2375'), { host: '10.0.0.2', port: 2375 });
    assert.throws(() => phanTichDockerHost('ssh://may-chu'), /chưa được hỗ trợ/);
});

test('trình docker: tạo mạng → tạo container đúng giới hạn/bind/nhãn → start → inspect → stop + xóa', async t => {
    const dk = await taoDockerGia();
    t.after(() => dongMay(dk.may));
    const du = thuMucTam('dk');
    const cauHinh = taoCauHinh(du, { trinhDieuPhoi: 'docker' });
    const trinh = taoTrinhDocker({ cauHinh, dockerHost: dk.dockerHost, env: {} });
    assert.equal(trinh.homeTrongPhien?.('/bat-ky'), '/home/aword');

    const rieng = path.join(du, 'tai-khoan', '7');
    const kq = await trinh.khoiDong({ taiKhoanId: 7, thuMucRieng: rieng, env: { HOME: '/home/aword', ANTHROPIC_AUTH_TOKEN: 'token-7' } });
    assert.deepEqual(kq, { maTrinh: 'c1', diaChi: '172.30.0.5:3000' });
    assert.deepEqual(tomTat(dk.yeuCau), [
        'GET /v1.43/networks/aword-phien',
        'POST /v1.43/networks/create',
        'GET /v1.43/containers/aword-phien-7/json',
        'POST /v1.43/containers/create?name=aword-phien-7',
        'POST /v1.43/containers/c1/start',
        'GET /v1.43/containers/c1/json',
    ]);
    const mang = dk.yeuCau[1].body;
    assert.equal(mang.Name, 'aword-phien');
    assert.equal(mang.Internal, false);
    assert.equal(mang.Options['com.docker.network.bridge.enable_icc'], 'false');
    assert.equal(mang.Options['com.docker.network.bridge.name'], 'br-aword-phien');

    const than = dk.yeuCau[3].body;
    assert.equal(than.Image, 'aword-web:latest');
    assert.equal(than.User, '1000:1000');
    assert.equal(than.Hostname, 'aword-phien-7');
    assert.deepEqual(than.Labels, { 'aword.tai-khoan': '7', 'aword.he-thong': 'aword-web' });
    assert.deepEqual(than.Env, ['HOME=/home/aword', 'ANTHROPIC_AUTH_TOKEN=token-7']);
    const hc = than.HostConfig;
    assert.deepEqual(hc.Binds, [`${rieng}:/home/aword:rw`, `${cauHinh.thuMucHeThong}:/opt/aword-he-thong:ro`]);
    assert.equal(hc.Memory, 2 * 1024 * 1024 * 1024);
    assert.equal(hc.MemorySwap, hc.Memory);
    assert.equal(hc.NanoCpus, 2_000_000_000);
    assert.equal(hc.PidsLimit, 512);
    assert.deepEqual(hc.CapDrop, ['ALL']);
    assert.deepEqual(hc.SecurityOpt, ['no-new-privileges']);
    assert.match(hc.Tmpfs['/tmp'], /nosuid/);
    assert.equal(hc.NetworkMode, 'aword-phien');
    assert.deepEqual(hc.ExtraHosts, ['host.docker.internal:host-gateway']);
    assert.equal(hc.Privileged, undefined);
    assert.deepEqual(Object.keys(than.NetworkingConfig.EndpointsConfig), ['aword-phien']);

    assert.equal(await trinh.conChay('c1'), true);
    assert.equal(await trinh.nhatKyGanNhat!('c1', 40), 'tail=40\nLỗi: không mở được cổng 3000\n');
    assert.equal(tachLuongNhatKy(Buffer.from('nhật ký TTY')), 'nhật ký TTY');
    dk.yeuCau.length = 0;
    await trinh.dung('c1');
    assert.deepEqual(tomTat(dk.yeuCau), ['POST /v1.43/containers/c1/stop?t=10', 'DELETE /v1.43/containers/c1?force=true']);
    assert.equal(await trinh.conChay('c1'), false);
    await trinh.dung('c1'); // dừng lại lần nữa: 404 → không lỗi

    // Tài khoản khác: mạng đã có (không tạo lại)
    dk.yeuCau.length = 0;
    await trinh.khoiDong({ taiKhoanId: 8, thuMucRieng: path.join(du, 'tai-khoan', '8'), env: {} });
    assert.ok(!tomTat(dk.yeuCau).some(s => s.includes('/networks')));
});

test('trình docker: container cũ của đúng tài khoản → dừng, xóa rồi tạo lại; container lạ trùng tên → từ chối', async t => {
    const dk = await taoDockerGia({ coMang: true });
    t.after(() => dongMay(dk.may));
    dk.containers.set('cu1', { Id: 'cu1', ten: 'aword-phien-3', Labels: { 'aword.tai-khoan': '3' }, Running: true });
    dk.containers.set('la1', { Id: 'la1', ten: 'aword-phien-4', Labels: {}, Running: true });
    const du = thuMucTam('dk');
    const trinh = taoTrinhDocker({ cauHinh: taoCauHinh(du), dockerHost: dk.dockerHost, env: {} });

    const kq = await trinh.khoiDong({ taiKhoanId: 3, thuMucRieng: path.join(du, 'tai-khoan', '3'), env: {} });
    assert.equal(kq.maTrinh, 'c1');
    assert.deepEqual(tomTat(dk.yeuCau), [
        'GET /v1.43/networks/aword-phien',
        'GET /v1.43/containers/aword-phien-3/json',
        'POST /v1.43/containers/cu1/stop?t=10',
        'DELETE /v1.43/containers/cu1?force=true',
        'POST /v1.43/containers/create?name=aword-phien-3',
        'POST /v1.43/containers/c1/start',
        'GET /v1.43/containers/c1/json',
    ]);
    assert.equal(dk.containers.has('cu1'), false);

    await assert.rejects(trinh.khoiDong({ taiKhoanId: 4, thuMucRieng: path.join(du, 'tai-khoan', '4'), env: {} }),
        (e: unknown) => e instanceof LoiPhien && /không do AWord Web tạo/.test(e.message));
    assert.equal(dk.containers.has('la1'), true);
});

test('trình docker: chưa có ảnh → lỗi tiếng Việt; start lỗi → xóa container vừa tạo', async t => {
    const khongAnh = await taoDockerGia({ coMang: true, coAnh: false });
    const loiStart = await taoDockerGia({ coMang: true, loiStart: true });
    t.after(async () => { await dongMay(khongAnh.may); await dongMay(loiStart.may); });
    const du = thuMucTam('dk');

    const t1 = taoTrinhDocker({ cauHinh: taoCauHinh(du), dockerHost: khongAnh.dockerHost, env: {} });
    await assert.rejects(t1.khoiDong({ taiKhoanId: 1, thuMucRieng: path.join(du, '1'), env: {} }),
        (e: unknown) => e instanceof LoiPhien && /chưa có ảnh AWord Web "aword-web:latest"/.test(e.message));

    const t2 = taoTrinhDocker({ cauHinh: taoCauHinh(du), dockerHost: loiStart.dockerHost, env: {} });
    await assert.rejects(t2.khoiDong({ taiKhoanId: 1, thuMucRieng: path.join(du, '1'), env: {} }),
        (e: unknown) => e instanceof LoiPhien && /khởi động container/.test(e.message) && /permission denied/.test(String(e.chiTiet)));
    assert.ok(tomTat(loiStart.yeuCau).includes('DELETE /v1.43/containers/c1?force=true'));
    assert.equal(loiStart.containers.size, 0);

    // Docker Engine không chạy
    const tam = http.createServer();
    const congChet = await nghe(tam);
    await dongMay(tam);
    const t3 = taoTrinhDocker({ cauHinh: taoCauHinh(du), dockerHost: `tcp://127.0.0.1:${congChet}`, env: {} });
    await assert.rejects(t3.khoiDong({ taiKhoanId: 1, thuMucRieng: path.join(du, '1'), env: {} }), /không kết nối được Docker Engine/);
});

test('trình docker: tùy chọn qua biến môi trường (RAM, CPU, số tiến trình, mạng internal, proxy ra ngoài)', async t => {
    const dk = await taoDockerGia();
    t.after(() => dongMay(dk.may));
    const du = thuMucTam('dk');
    const trinh = taoTrinhDocker({
        cauHinh: taoCauHinh(du, { anhDocker: 'aword-web:3.0.3' }), dockerHost: dk.dockerHost,
        env: { AWORD_DOCKER_BO_NHO_MB: '4096', AWORD_DOCKER_CPU: '1.5', AWORD_DOCKER_PIDS: '256', AWORD_DOCKER_MANG_NOI_BO: '1', AWORD_DOCKER_PROXY: 'http://aword-proxy:3128' },
    });
    await trinh.khoiDong({ taiKhoanId: 2, thuMucRieng: path.join(du, '2'), env: { ANTHROPIC_BASE_URL: 'http://aword-cong:8080/ai' } });
    const mang = dk.yeuCau.find(y => y.url.endsWith('/networks/create'))!.body;
    assert.equal(mang.Internal, true);
    const than = dk.yeuCau.find(y => y.url.includes('/containers/create'))!.body;
    assert.equal(than.Image, 'aword-web:3.0.3');
    assert.equal(than.HostConfig.Memory, 4096 * 1024 * 1024);
    assert.equal(than.HostConfig.NanoCpus, 1_500_000_000);
    assert.equal(than.HostConfig.PidsLimit, 256);
    assert.deepEqual(than.HostConfig.ExtraHosts, []);
    assert.ok(than.Env.includes('HTTPS_PROXY=http://aword-proxy:3128'));
    assert.ok(than.Env.includes('NO_PROXY=aword-cong,localhost,127.0.0.1'));
    assert.ok(than.Env.includes('NODE_USE_ENV_PROXY=1'));
});
