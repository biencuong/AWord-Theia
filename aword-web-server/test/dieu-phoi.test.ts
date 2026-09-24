import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { LoiPhien, taoDieuPhoi } from '../src/dieu-phoi/dieu-phoi.ts';
import type { TrinhPhien } from '../src/dieu-phoi/dieu-phoi.ts';
import { cho, choDen, dongMay, goiHttp, nghe, taoCauHinh, taoCongAiGia, taoCsdl, thuMucTam } from './fixtures/dieu-phoi/tien-ich.ts';

interface TrinhGia extends TrinhPhien {
    khoiDongGoi: Array<{ taiKhoanId: number; thuMucRieng: string; env: Record<string, string> }>;
    dungGoi: string[];
    mayChu: Map<string, http.Server>;
    songSan: Set<string>;
    /** Phiên chết lặng lẽ (không báo). */
    gietLangLe(maTrinh: string): Promise<void>;
    /** Phiên chết và trình báo cho bộ điều phối. */
    baoChet(maTrinh: string): Promise<void>;
    donDep(): Promise<void>;
}

// Trình giả: mỗi phiên là một máy chủ HTTP nhỏ; maTraVe(lanKhoiDong) quyết định GET / trả mã gì.
function taoTrinhGia(tuy: { maTraVe?: (lan: number) => number; treMs?: number; home?: string } = {}): TrinhGia {
    const mayChu = new Map<string, http.Server>();
    const nguoiNghe: Array<(ma: string) => void> = [];
    let dem = 0;
    const trinh: TrinhGia = {
        khoiDongGoi: [], dungGoi: [], mayChu, songSan: new Set(),
        async khoiDong(p) {
            trinh.khoiDongGoi.push(p);
            const lan = trinh.khoiDongGoi.length;
            if (tuy.treMs) { await cho(tuy.treMs); }
            const ma = `gia-${++dem}`;
            const may = http.createServer((_req, res) => {
                const maTraVe = tuy.maTraVe?.(lan) ?? 200;
                res.writeHead(maTraVe, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end(`phiên ${p.taiKhoanId}`);
            });
            const cong = await nghe(may);
            mayChu.set(ma, may);
            return { maTrinh: ma, diaChi: `127.0.0.1:${cong}` };
        },
        async dung(ma) {
            trinh.dungGoi.push(ma);
            const may = mayChu.get(ma);
            mayChu.delete(ma);
            if (may) { await dongMay(may); }
        },
        async conChay(ma) { return mayChu.has(ma) || trinh.songSan.has(ma); },
        khiDungNgoaiY(f) { nguoiNghe.push(f); },
        async gietLangLe(ma) {
            const may = mayChu.get(ma);
            mayChu.delete(ma);
            if (may) { await dongMay(may); }
        },
        async baoChet(ma) {
            await trinh.gietLangLe(ma);
            for (const f of nguoiNghe) { f(ma); }
        },
        async donDep() {
            for (const may of mayChu.values()) { await dongMay(may); }
            mayChu.clear();
        },
    };
    if (tuy.home) { const home = tuy.home; trinh.homeTrongPhien = () => home; }
    return trinh;
}

const dong = (db: DatabaseSync, id: number) =>
    db.prepare('SELECT * FROM phien_lam_viec WHERE tai_khoan_id = ?').get(id) as
        { trang_thai: string; ma_trinh: string | null; dia_chi: string | null; trinh: string } | undefined;

test('khởi động phiên: thư mục riêng, token mới (thu hồi token cũ trước), env đúng, trạng thái chạy, gọi lại không khởi động lại', async t => {
    const du = thuMucTam('dp');
    const db = taoCsdl();
    const congAi = taoCongAiGia();
    const trinh = taoTrinhGia();
    const cauHinh = taoCauHinh(du);
    const dp = taoDieuPhoi({ db, cauHinh, congAi, trinh, nhipKiemMs: 20 });
    t.after(() => trinh.donDep());

    const { diaChi } = await dp.damBaoPhien(1);
    const rieng = path.join(du, 'tai-khoan', '1');
    for (const con of ['Documents/AWord', '.claude', '.aword', '.theia']) {
        assert.ok(fs.statSync(path.join(rieng, con)).isDirectory(), `thiếu thư mục ${con}`);
    }
    assert.equal(trinh.khoiDongGoi.length, 1);
    const env = trinh.khoiDongGoi[0].env;
    assert.equal(trinh.khoiDongGoi[0].thuMucRieng, rieng);
    assert.equal(env.ANTHROPIC_BASE_URL, cauHinh.diaChiCongAiChoPhien);
    assert.equal(env.ANTHROPIC_AUTH_TOKEN, 'token-1-1');
    assert.equal(env.AWORD_HOME, rieng);
    assert.equal(env.HOME, rieng);
    assert.equal(env.CLAUDE_CONFIG_DIR, path.join(rieng, '.claude'));
    assert.equal(env.THEIA_CONFIG_DIR, path.join(rieng, '.theia'));
    assert.deepEqual(congAi.nhatKy, ['thu-hoi:1', 'cap:1:24:token-1-1']);
    assert.equal(dong(db, 1)?.trang_thai, 'chay');
    assert.equal(dong(db, 1)?.dia_chi, diaChi);
    assert.equal(dong(db, 1)?.trinh, 'tien-trinh');
    assert.equal((await dp.trangThai(1)).trangThai, 'chay');

    assert.deepEqual(await dp.damBaoPhien(1), { diaChi });
    assert.equal(trinh.khoiDongGoi.length, 1);
    assert.equal((db.prepare("SELECT COUNT(*) AS n FROM nhat_ky WHERE hanh_dong = 'phien_khoi_dong'").get() as { n: number }).n, 1);

    await assert.rejects(dp.damBaoPhien(99), (e: unknown) => e instanceof LoiPhien && /không tồn tại/.test(e.message));
});

test('thiết lập Theia của phiên web: không hỏi tin tưởng thư mục, không màn hình đăng nhập Claude; giữ thiết lập người dùng', async t => {
    const du = thuMucTam('dp');
    const tep = path.join(du, 'tai-khoan', '1', '.theia', 'settings.json');
    fs.mkdirSync(path.dirname(tep), { recursive: true });
    fs.writeFileSync(tep, JSON.stringify({ 'editor.fontSize': 16, 'security.workspace.trust.enabled': true }));
    const trinh = taoTrinhGia();
    const dp = taoDieuPhoi({ db: taoCsdl(), cauHinh: taoCauHinh(du), congAi: taoCongAiGia(), trinh, nhipKiemMs: 20 });
    t.after(() => trinh.donDep());
    await dp.damBaoPhien(1);
    await dp.damBaoPhien(2);
    assert.deepEqual(JSON.parse(fs.readFileSync(tep, 'utf8')),
        { 'editor.fontSize': 16, 'security.workspace.trust.enabled': false, 'claudeCode.disableLoginPrompt': true });
    const tep2 = path.join(du, 'tai-khoan', '2', '.theia', 'settings.json');
    assert.deepEqual(JSON.parse(fs.readFileSync(tep2, 'utf8')), { 'security.workspace.trust.enabled': false, 'claudeCode.disableLoginPrompt': true });
});

test('chế độ cá nhân: AWORD_WEB_HOME_TAI_KHOAN_<id> trỏ vào thư mục nhà thật (kế thừa lịch sử Claude Code)', async t => {
    const nhaThat = thuMucTam('nha-that');
    const trinh = taoTrinhGia();
    const dp = taoDieuPhoi({ db: taoCsdl(), cauHinh: taoCauHinh(thuMucTam('dp')), congAi: taoCongAiGia(), trinh, nhipKiemMs: 20 });
    t.after(() => {
        delete process.env.AWORD_WEB_HOME_TAI_KHOAN_2;
        delete process.env.AWORD_WEB_HOME_TAI_KHOAN_3;
        return trinh.donDep();
    });

    process.env.AWORD_WEB_HOME_TAI_KHOAN_2 = nhaThat;
    await dp.damBaoPhien(2);
    const goi = trinh.khoiDongGoi[0];
    assert.equal(goi.thuMucRieng, nhaThat);
    assert.equal(goi.env.HOME, nhaThat);
    assert.equal(goi.env.CLAUDE_CONFIG_DIR, path.join(nhaThat, '.claude'));
    // Cấu hình Theia vẫn để riêng trong du-lieu — không đè ~/.theia của AWord bản cài
    assert.ok(goi.env.THEIA_CONFIG_DIR.endsWith(path.join('tai-khoan', '2', '.theia')), goi.env.THEIA_CONFIG_DIR);

    // Đường dẫn không tồn tại → bỏ qua, quay về thư mục riêng trong du-lieu
    process.env.AWORD_WEB_HOME_TAI_KHOAN_3 = path.join(nhaThat, 'khong-co-that');
    await dp.damBaoPhien(3);
    assert.ok(trinh.khoiDongGoi[1].thuMucRieng.endsWith(path.join('tai-khoan', '3')));
});

test('trình có home riêng trong phiên (docker): env dùng đường dẫn trong container', async t => {
    const db = taoCsdl();
    const trinh = taoTrinhGia({ home: '/home/aword' });
    const dp = taoDieuPhoi({ db, cauHinh: taoCauHinh(thuMucTam('dp')), congAi: taoCongAiGia(), trinh, nhipKiemMs: 20 });
    t.after(() => trinh.donDep());
    await dp.damBaoPhien(2);
    const env = trinh.khoiDongGoi[0].env;
    assert.equal(env.HOME, '/home/aword');
    assert.equal(env.AWORD_HOME, '/home/aword');
    assert.equal(env.CLAUDE_CONFIG_DIR, '/home/aword/.claude');
    assert.equal(env.THEIA_CONFIG_DIR, '/home/aword/.theia');
});

test('nhiều yêu cầu cùng lúc chỉ khởi động một lần', async t => {
    const db = taoCsdl();
    const trinh = taoTrinhGia({ treMs: 80 });
    const dp = taoDieuPhoi({ db, cauHinh: taoCauHinh(thuMucTam('dp')), congAi: taoCongAiGia(), trinh, nhipKiemMs: 20 });
    t.after(() => trinh.donDep());
    const ketQua = await Promise.all(Array.from({ length: 6 }, () => dp.damBaoPhien(1)));
    assert.equal(trinh.khoiDongGoi.length, 1);
    assert.equal(new Set(ketQua.map(k => k.diaChi)).size, 1);
});

test('phiên không sẵn sàng trong hạn → trạng thái lỗi, dọn phiên, thu hồi token; chờ hết thời gian chờ mới thử lại', async t => {
    let dongHo = 1_000_000;
    const db = taoCsdl();
    const congAi = taoCongAiGia();
    const trinh = taoTrinhGia({ maTraVe: lan => (lan === 1 ? 503 : 200) });
    trinh.nhatKyGanNhat = async (ma, soDong) => `${ma}: Error: Cannot find module 'x' (${soDong} dòng)`;
    const dp = taoDieuPhoi({ db, cauHinh: taoCauHinh(thuMucTam('dp')), congAi, trinh, bayGio: () => dongHo, hanChoSanSangMs: 300, nhipKiemMs: 30, giayChoThuLai: 30 });
    t.after(() => trinh.donDep());

    await assert.rejects(dp.damBaoPhien(1), (e: unknown) => e instanceof LoiPhien && /không sẵn sàng sau/.test(e.message));
    assert.equal(dong(db, 1)?.trang_thai, 'loi');
    const nk = db.prepare("SELECT chi_tiet FROM nhat_ky WHERE hanh_dong = 'phien_loi'").get() as { chi_tiet: string };
    assert.deepEqual(JSON.parse(nk.chi_tiet), {
        loi: 'Phiên làm việc không sẵn sàng sau 0 giây.', maTrinh: 'gia-1', nhatKyPhien: "gia-1: Error: Cannot find module 'x' (40 dòng)",
    });
    assert.deepEqual(trinh.dungGoi, ['gia-1']);
    assert.deepEqual(congAi.nhatKy, ['thu-hoi:1', 'cap:1:24:token-1-1', 'thu-hoi:1']);
    const tt = await dp.trangThai(1);
    assert.equal(tt.trangThai, 'loi');
    assert.match(String(tt.loi), /không sẵn sàng/);

    // Trong thời gian chờ: báo lỗi ngay, không khởi động lại.
    await assert.rejects(dp.damBaoPhien(1), /không sẵn sàng/);
    assert.equal(trinh.khoiDongGoi.length, 1);

    // Trang lỗi tiếng Việt khi mở trang trong thời gian chờ.
    const cong = http.createServer((req, res) => { void dp.xuLy(req, res, 1); });
    const soCong = await nghe(cong);
    t.after(() => dongMay(cong));
    const trang = await goiHttp(soCong, { headers: ['Host', 'aword.localhost', 'Accept', 'text/html'] });
    assert.equal(trang.ma, 502);
    assert.match(trang.body, /Chưa mở được phiên làm việc/);

    dongHo += 31_000;
    await dp.damBaoPhien(1);
    assert.equal(trinh.khoiDongGoi.length, 2);
    assert.equal(dong(db, 1)?.trang_thai, 'chay');
});

test('phiên dừng ngay khi khởi động → báo lỗi sớm, không chờ hết hạn', async t => {
    const db = taoCsdl();
    const trinh = taoTrinhGia({ maTraVe: () => 500 });
    trinh.conChay = async () => false;
    const dp = taoDieuPhoi({ db, cauHinh: taoCauHinh(thuMucTam('dp')), congAi: taoCongAiGia(), trinh, hanChoSanSangMs: 60_000, nhipKiemMs: 20 });
    t.after(() => trinh.donDep());
    const moc = Date.now();
    await assert.rejects(dp.damBaoPhien(1), /dừng ngay khi đang khởi động/);
    assert.ok(Date.now() - moc < 5000);
});

test('tự ngủ khi rảnh quá phutNguKhiRanh; hoạt động gần đây giữ phiên thức; yêu cầu sau đó đánh thức', async t => {
    let dongHo = 5_000_000;
    const db = taoCsdl();
    const congAi = taoCongAiGia();
    const trinh = taoTrinhGia();
    const dp = taoDieuPhoi({ db, cauHinh: taoCauHinh(thuMucTam('dp'), { phutNguKhiRanh: 30 }), congAi, trinh, bayGio: () => dongHo, nhipKiemMs: 20 });
    t.after(() => trinh.donDep());

    await dp.damBaoPhien(1);
    await dp.damBaoPhien(2);
    dongHo += 20 * 60_000;
    dp.ghiNhanHoatDong(2);
    dongHo += 15 * 60_000;
    await dp.quetNgu();
    assert.equal(dong(db, 1)?.trang_thai, 'ngu');
    assert.equal(dong(db, 1)?.dia_chi, null);
    assert.equal(dong(db, 2)?.trang_thai, 'chay');
    assert.deepEqual(trinh.dungGoi, ['gia-1']);
    assert.equal(congAi.nhatKy.at(-1), 'thu-hoi:1');

    await dp.damBaoPhien(1);
    assert.equal(trinh.khoiDongGoi.length, 3);
    assert.equal(dong(db, 1)?.trang_thai, 'chay');
});

test('phiên chết giữa chừng: trình báo / quét định kỳ / proxy lỗi kết nối → đánh dấu và khởi động lại ở yêu cầu kế tiếp', async t => {
    const db = taoCsdl();
    const trinh = taoTrinhGia();
    const dp = taoDieuPhoi({ db, cauHinh: taoCauHinh(thuMucTam('dp')), congAi: taoCongAiGia(), trinh, nhipKiemMs: 20 });
    t.after(() => trinh.donDep());

    // 1) trình báo
    await dp.damBaoPhien(1);
    await trinh.baoChet(String(dong(db, 1)?.ma_trinh));
    assert.equal(dong(db, 1)?.trang_thai, 'ngu');
    await dp.damBaoPhien(1);
    assert.equal(trinh.khoiDongGoi.length, 2);

    // 2) chết lặng lẽ, quét định kỳ phát hiện
    await trinh.gietLangLe(String(dong(db, 1)?.ma_trinh));
    await dp.quetNgu();
    assert.equal(dong(db, 1)?.trang_thai, 'ngu');

    // 3) chết lặng lẽ, proxy không kết nối được → trang chờ, rồi đánh dấu
    const { diaChi } = await dp.damBaoPhien(1);
    await trinh.gietLangLe(String(dong(db, 1)?.ma_trinh));
    const cong = http.createServer((req, res) => dp.proxy(req, res, diaChi));
    const soCong = await nghe(cong);
    t.after(() => dongMay(cong));
    const kq = await goiHttp(soCong, { headers: ['Host', 'aword.localhost', 'Accept', 'text/html'] });
    assert.equal(kq.ma, 503);
    await choDen(() => dong(db, 1)?.trang_thai === 'ngu', 3000, 'đánh dấu phiên chết');
    await dp.damBaoPhien(1);
    assert.equal(trinh.khoiDongGoi.length, 4);
});

test('máy chủ khởi động lại: đối chiếu bảng phien_lam_viec với thực tế', async t => {
    const db = taoCsdl();
    const luc = Date.now();
    const chen = db.prepare('INSERT INTO phien_lam_viec (tai_khoan_id, trinh, ma_trinh, dia_chi, trang_thai, bat_dau, hoat_dong_cuoi) VALUES (?,?,?,?,?,?,?)');
    chen.run(1, 'docker', 'con-song', '127.0.0.1:1', 'chay', luc, luc);
    chen.run(2, 'docker', 'da-chet', '127.0.0.1:2', 'chay', luc, luc);
    chen.run(3, 'docker', 'do-dang', '127.0.0.1:3', 'dang_khoi_dong', luc, luc);
    const congAi = taoCongAiGia();
    const trinh = taoTrinhGia();
    trinh.songSan.add('con-song');
    trinh.songSan.add('do-dang');
    const dp = taoDieuPhoi({ db, cauHinh: taoCauHinh(thuMucTam('dp')), congAi, trinh, nhipKiemMs: 20 });
    t.after(() => trinh.donDep());

    assert.equal((await dp.trangThai(1)).trangThai, 'chay');
    assert.equal((await dp.trangThai(2)).trangThai, 'ngu');
    assert.equal((await dp.trangThai(3)).trangThai, 'ngu');
    assert.deepEqual(trinh.dungGoi, ['do-dang']);
    assert.deepEqual(congAi.nhatKy.sort(), ['thu-hoi:2', 'thu-hoi:3']);
    assert.deepEqual(await dp.damBaoPhien(1), { diaChi: '127.0.0.1:1' });
    assert.equal(trinh.khoiDongGoi.length, 0);
});

test('dừng phiên theo yêu cầu và dừng tất cả khi tắt máy chủ', async t => {
    const db = taoCsdl();
    const congAi = taoCongAiGia();
    const trinh = taoTrinhGia();
    const dp = taoDieuPhoi({ db, cauHinh: taoCauHinh(thuMucTam('dp')), congAi, trinh, nhipKiemMs: 20 });
    t.after(() => trinh.donDep());
    await Promise.all([dp.damBaoPhien(1), dp.damBaoPhien(2), dp.damBaoPhien(3)]);
    await dp.dungPhien(1);
    assert.equal(dong(db, 1)?.trang_thai, 'ngu');
    await dp.dungPhien(1); // gọi lại không lỗi
    await dp.dungTatCa();
    assert.equal(dong(db, 2)?.trang_thai, 'ngu');
    assert.equal(dong(db, 3)?.trang_thai, 'ngu');
    assert.equal(trinh.dungGoi.length, 3);
    await assert.rejects(dp.damBaoPhien(1), /đang tắt/);
});

test('xuLy: mở trang khi phiên chưa chạy → trang chờ + khởi động nền; sẵn sàng → proxy; WebSocket không đánh thức phiên ngủ', async t => {
    const db = taoCsdl();
    const trinh = taoTrinhGia({ treMs: 100 });
    const dp = taoDieuPhoi({ db, cauHinh: taoCauHinh(thuMucTam('dp')), congAi: taoCongAiGia(), trinh, nhipKiemMs: 20 });
    const cong = http.createServer((req, res) => { void dp.xuLy(req, res, 1); });
    cong.on('upgrade', (req, socket, head) => { void dp.xuLyWebSocket(req, socket, head, 1); });
    const soCong = await nghe(cong);
    t.after(async () => { await dongMay(cong); await trinh.donDep(); });

    // WebSocket khi phiên chưa chạy: 503, không khởi động
    const ws = new WebSocket(`ws://127.0.0.1:${soCong}/services`);
    await new Promise<void>(ok => { ws.onerror = () => ok(); });
    assert.equal(trinh.khoiDongGoi.length, 0);

    const cho1 = await goiHttp(soCong, { headers: ['Host', 'aword.localhost', 'Accept', 'text/html'] });
    assert.equal(cho1.ma, 503);
    assert.match(cho1.body, /Đang chuẩn bị phiên làm việc/);
    await choDen(async () => (await dp.trangThai(1)).trangThai === 'chay', 5000, 'phiên chạy');
    const trang = await goiHttp(soCong, { headers: ['Host', 'aword.localhost', 'Accept', 'text/html'] });
    assert.equal(trang.ma, 200);
    assert.equal(trang.body, 'phiên 1');

    // Yêu cầu không phải trang (XHR) khi phiên ngủ: chờ khởi động xong rồi proxy luôn
    await dp.dungPhien(1);
    const xhr = await goiHttp(soCong, { headers: ['Host', 'aword.localhost', 'Accept', '*/*'] });
    assert.equal(xhr.ma, 200);
    assert.equal(xhr.body, 'phiên 1');
    assert.equal(trinh.khoiDongGoi.length, 2);
});
