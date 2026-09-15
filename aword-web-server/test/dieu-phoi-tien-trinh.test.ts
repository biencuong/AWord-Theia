import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import { CANH_BAO_KHONG_CO_LAP, locEnvMayChu, taoTrinhTienTrinh } from '../src/dieu-phoi/trinh-tien-trinh.ts';
import { taoDieuPhoi } from '../src/dieu-phoi/dieu-phoi.ts';
import { choDen, taoCauHinh, taoCongAiGia, taoCsdl, thuMucTam } from './fixtures/dieu-phoi/tien-ich.ts';

const THU_MUC_GIA = path.join(import.meta.dirname, 'fixtures', 'dieu-phoi');
const BACKEND_GIA = path.join(THU_MUC_GIA, 'backend-gia.mjs');

function layJson(diaChi: string, duongDan: string): Promise<any> {
    return new Promise((ok, loi) => {
        http.get(`http://${diaChi}${duongDan}`, { agent: false }, res => {
            let s = '';
            res.setEncoding('utf8');
            res.on('data', (c: string) => { s += c; });
            res.on('end', () => { try { ok(JSON.parse(s)); } catch (e) { loi(e); } });
        }).on('error', loi);
    });
}

const pidSong = (pid: number): boolean => { try { process.kill(pid, 0); return true; } catch { return false; } };

function taoTrinh(canhBao: string[] = []) {
    return taoTrinhTienTrinh({
        tepBackend: BACKEND_GIA, cwd: THU_MUC_GIA, thuMucPlugins: path.join(THU_MUC_GIA, 'plugins'),
        envGoc: { ...process.env, AWORD_WEB_BI_MAT: 'khong-duoc-lot-vao-phien', AWORD_KHOA_ANTHROPIC: 'sk-to-chuc', CLAUDECODE: '1' },
        canhBao: s => canhBao.push(s),
    });
}

test('lọc bí mật máy chủ khỏi env của phiên', () => {
    const env = locEnvMayChu({ PATH: '/bin', AWORD_WEB_BI_MAT: 'x', aword_khoa_openai: 'y', ANTHROPIC_API_KEY: 'z', CLAUDECODE: '1', HOME: '/root', NODE_OPTIONS: '--x' });
    assert.deepEqual(env, { PATH: '/bin', HOME: '/root' });
});

test('trình tien-trinh: cảnh báo không cô lập, chạy backend với đúng tham số/env, nhật ký ra tệp, dừng cả cây tiến trình', async t => {
    const canhBao: string[] = [];
    const trinh = taoTrinh(canhBao);
    assert.deepEqual(canhBao, [CANH_BAO_KHONG_CO_LAP]);
    assert.match(canhBao[0], /KHÔNG cô lập/);

    const rieng = path.join(thuMucTam('tt'), 'tai-khoan', '5');
    const kq = await trinh.khoiDong({
        taiKhoanId: 5, thuMucRieng: rieng,
        env: { HOME: rieng, AWORD_HOME: rieng, ANTHROPIC_BASE_URL: 'http://host.docker.internal:8080/ai', ANTHROPIC_AUTH_TOKEN: 'token-5' },
    });
    t.after(() => trinh.dung(kq.maTrinh));
    assert.match(kq.diaChi, /^127\.0\.0\.1:\d+$/);
    assert.match(kq.maTrinh, /^\d+:\d+$/);
    const cong = kq.diaChi.split(':')[1];

    let tt: any;
    await choDen(async () => { try { tt = await layJson(kq.diaChi, '/thong-tin'); return true; } catch { return false; } }, 10000, 'backend giả nghe');
    assert.deepEqual(tt.thamSo, { hostname: '127.0.0.1', port: cong, plugins: 'local-dir:plugins' });
    assert.deepEqual(tt.viTri, [path.join(rieng, 'Documents', 'AWord')]);
    assert.equal(path.resolve(tt.cwd), path.resolve(THU_MUC_GIA));
    assert.equal(tt.env.ANTHROPIC_BASE_URL, 'http://127.0.0.1:8080/ai');
    assert.equal(tt.env.ANTHROPIC_AUTH_TOKEN, 'token-5');
    assert.equal(tt.env.AWORD_HOME, rieng);
    assert.equal(tt.env.AWORD_WEB_BI_MAT, undefined);
    assert.equal(tt.env.AWORD_KHOA_ANTHROPIC, undefined);
    assert.equal(tt.env.CLAUDECODE, undefined);
    if (process.platform === 'win32') { assert.equal(tt.env.USERPROFILE, rieng); }
    assert.match(fs.readFileSync(path.join(rieng, '.aword', 'nhat-ky-phien.log'), 'utf8'), /backend gia nghe cong/);
    assert.match(await trinh.nhatKyGanNhat!(kq.maTrinh, 40), /backend gia nghe cong/);

    assert.equal(await trinh.conChay(kq.maTrinh), true);
    assert.ok(pidSong(tt.chau), 'tiến trình cháu phải đang chạy');
    await trinh.dung(kq.maTrinh);
    assert.equal(await trinh.conChay(kq.maTrinh), false);
    await choDen(() => !pidSong(tt.pid) && !pidSong(tt.chau), 10000, 'cả cây tiến trình dừng');
});

test('trình tien-trinh: tiến trình tự thoát → báo khiDungNgoaiY; dừng chủ động thì không báo', async t => {
    const trinh = taoTrinh();
    const baoDung: string[] = [];
    trinh.khiDungNgoaiY?.(ma => baoDung.push(ma));
    const rieng = path.join(thuMucTam('tt'), 'tai-khoan', '6');
    const kq = await trinh.khoiDong({ taiKhoanId: 6, thuMucRieng: rieng, env: { HOME: rieng } });
    t.after(() => trinh.dung(kq.maTrinh));
    await choDen(async () => { try { await layJson(kq.diaChi, '/thong-tin'); return true; } catch { return false; } }, 10000, 'backend giả nghe');
    await new Promise<void>(ok => http.get(`http://${kq.diaChi}/thoat`, { agent: false }, r => { r.resume(); r.on('end', ok); }));
    await choDen(() => baoDung.length === 1, 10000, 'báo phiên dừng');
    assert.deepEqual(baoDung, [kq.maTrinh]);
    assert.equal(await trinh.conChay(kq.maTrinh), false);

    const kq2 = await trinh.khoiDong({ taiKhoanId: 6, thuMucRieng: rieng, env: { HOME: rieng } });
    await trinh.dung(kq2.maTrinh);
    assert.deepEqual(baoDung, [kq.maTrinh]);
});

test('trình tien-trinh: sau khi máy chủ khởi động lại vẫn nhận ra (và dừng được) phiên cũ theo PID + cổng', { timeout: 60000 }, async t => {
    const cu = taoTrinh();
    const rieng = path.join(thuMucTam('tt'), 'tai-khoan', '7');
    const kq = await cu.khoiDong({ taiKhoanId: 7, thuMucRieng: rieng, env: { HOME: rieng } });
    t.after(() => cu.dung(kq.maTrinh));
    let tt: any;
    await choDen(async () => { try { tt = await layJson(kq.diaChi, '/thong-tin'); return true; } catch { return false; } }, 10000, 'backend giả nghe');

    const moi = taoTrinh();
    assert.equal(await moi.conChay(kq.maTrinh), true);
    // cùng PID nhưng sai cổng → không nhận (PID có thể đã bị cấp lại cho tiến trình khác)
    assert.equal(await moi.conChay(`${tt.pid}:1`), false);
    assert.equal(await moi.conChay('0:0'), false);
    await moi.dung(kq.maTrinh);
    await choDen(() => !pidSong(tt.pid), 10000, 'phiên cũ dừng');
});

test('trình tien-trinh chưa build → lỗi tiếng Việt; tích hợp với bộ điều phối chạy đủ vòng đời', { timeout: 60000 }, async t => {
    const loi = taoTrinhTienTrinh({ tepBackend: path.join(THU_MUC_GIA, 'khong-co.js'), canhBao: () => undefined });
    await assert.rejects(loi.khoiDong({ taiKhoanId: 1, thuMucRieng: thuMucTam('tt'), env: {} }), /Chưa build bản web/);

    const db = taoCsdl();
    const du = thuMucTam('tt');
    const dp = taoDieuPhoi({ db, cauHinh: taoCauHinh(du), congAi: taoCongAiGia(), trinh: taoTrinh(), nhipKiemMs: 100 });
    t.after(() => dp.dungTatCa());
    const { diaChi } = await dp.damBaoPhien(1);
    const tt = await layJson(diaChi, '/thong-tin');
    const rieng = path.join(du, 'tai-khoan', '1');
    assert.equal(tt.env.ANTHROPIC_AUTH_TOKEN, 'token-1-1');
    assert.equal(tt.env.AWORD_HOME, rieng);
    assert.equal(tt.env.THEIA_CONFIG_DIR, path.join(rieng, '.theia'));
    await dp.dungPhien(1);
    await choDen(() => !pidSong(tt.pid) && !pidSong(tt.chau), 10000, 'phiên dừng');
});
