// Chạy AWord Web BẢN CÓ ĐĂNG NHẬP (máy chủ đa người dùng trong aword-web-server) trên máy này bằng một cú bấm
// — Chay_AWord_Web_DangNhap.cmd gọi tệp này.
//   1. Đang chạy sẵn → chỉ mở trình duyệt.
//   2. Làm mới phần đã cũ giống bản một người: biên dịch aword-chat, đồng bộ plugin Claude Code, native module cho
//      Node, build browser-app (phiên của từng tài khoản chính là bản web này, chạy bằng trình "tiến trình").
//   3. Lần đầu: sinh bí mật ký token, tạo tài khoản quản trị (hỏi email/số điện thoại + họ tên) và in mật khẩu tạm.
//   4. Chạy máy chủ ở NỀN, KHÔNG cửa sổ (xem ghi chú ở chay-aword-web.cjs), rồi mở http://aword.localhost:<cổng>.
// Tắt: Tat_AWord_Web_DangNhap.cmd (= node chay-aword-web-dang-nhap.cjs --tat).
//
// CẢNH BÁO: trên máy Windows chưa có Docker, máy chủ chạy trình điều phối "tiến trình" — các phiên KHÔNG được cô lập
// với nhau (xem aword-web-server/README.md). Dùng để thử và làm việc một mình; triển khai cho nhiều người phải dùng
// trình "docker" trên máy chủ Linux.
'use strict';
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const http = require('http');
const readline = require('readline');
const { spawn, spawnSync } = require('child_process');

const REPO = path.join(__dirname, '..');
const APP = path.join(REPO, 'browser-app');
const MAY_CHU = path.join(REPO, 'aword-web-server');
const THU_MUC = path.join(os.homedir(), '.aword-web-dn');
const TEP_BI_MAT = path.join(THU_MUC, 'bi-mat.txt');
const TEP_MAY_CHU = path.join(THU_MUC, 'may-chu.json');
const TEP_NHAT_KY = path.join(THU_MUC, 'nhat-ky.log');
const TEP_CMD = path.join(THU_MUC, 'may-chu.cmd');
const DU_LIEU = path.join(THU_MUC, 'du-lieu');
const TEN_MIEN = process.env.AWORD_WEB_TEN_MIEN || 'aword.localhost';
const CONG_MAC_DINH = +(process.env.AWORD_WEB_CONG || 8080);

const bao = s => console.log(`[AWord Web] ${s}`);
const dung = (s, ma = 1) => { console.error(`\n[AWord Web] LỖI: ${s}`); process.exit(ma); };
const docJson = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return undefined; } };

const hoi = (url, ms = 1500) => new Promise(res => {
    const req = http.get(url, r => { r.resume(); res(r.statusCode); });
    req.on('error', () => res(0));
    req.setTimeout(ms, () => { req.destroy(); res(0); });
});
const congTrong = cong => new Promise(res => {
    const s = net.createServer();
    s.once('error', () => res(false));
    s.listen(cong, '127.0.0.1', () => s.close(() => res(true)));
});
function moTrinhDuyet(url) {
    if (process.env.AWORD_WEB_KHONG_MO_TRINH_DUYET) { bao(`(bỏ qua mở trình duyệt) ${url}`); return; }
    if (process.platform === 'win32') { spawn('cmd', ['/c', 'start', '""', url], { detached: true, stdio: 'ignore' }).unref(); }
    else { spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { detached: true, stdio: 'ignore' }).unref(); }
}
const doiCauTraLoi = cauHoi => new Promise(res => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(cauHoi, tl => { rl.close(); res(tl.trim()); });
});

/** Biến môi trường cho máy chủ: bí mật ký token, thư mục dữ liệu, cổng, tên miền, trình điều phối. */
function moiTruong(cong) {
    fs.mkdirSync(THU_MUC, { recursive: true });
    if (!fs.existsSync(TEP_BI_MAT)) {
        fs.writeFileSync(TEP_BI_MAT, require('crypto').randomBytes(48).toString('base64url'), { mode: 0o600 });
    }
    const env = {
        ...process.env,
        AWORD_WEB_BI_MAT: fs.readFileSync(TEP_BI_MAT, 'utf8').trim(),
        AWORD_WEB_DU_LIEU: DU_LIEU,
        AWORD_WEB_CONG: String(cong),
        AWORD_WEB_TEN_MIEN: TEN_MIEN,
        AWORD_WEB_TRINH_DIEU_PHOI: process.env.AWORD_WEB_TRINH_DIEU_PHOI || 'tien-trinh',
        AWORD_WEB_REPO: REPO,
    };
    delete env.ELECTRON_RUN_AS_NODE;
    return env;
}

function tatMayChu() {
    const mc = docJson(TEP_MAY_CHU);
    if (!mc?.pid) { bao('Bản web có đăng nhập không chạy.'); return; }
    if (process.platform === 'win32') {
        const lenh = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
            `(Get-CimInstance Win32_Process -Filter "ProcessId=${Number(mc.pid)}").CommandLine`],
            { encoding: 'utf8', windowsHide: true }).stdout ?? '';
        if (!lenh.includes('may-chu.cmd') && !/src[\\/]main\.ts/.test(lenh)) {
            fs.rmSync(TEP_MAY_CHU, { force: true });
            bao('Bản web có đăng nhập không chạy.');
            return;
        }
        spawnSync('taskkill', ['/PID', String(mc.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    } else {
        try { process.kill(-mc.pid, 'SIGTERM'); } catch { try { process.kill(mc.pid, 'SIGTERM'); } catch { /* đã dừng */ } }
    }
    fs.rmSync(TEP_MAY_CHU, { force: true });
    bao(`Đã tắt AWord Web có đăng nhập (cổng ${mc.cong}).`);
}

/** Console RIÊNG nhưng ẨN (xem giải thích ở chay-aword-web.cjs). */
function chayNen(cong, env) {
    fs.writeFileSync(TEP_NHAT_KY, '');
    if (process.platform !== 'win32') {
        const nk = fs.openSync(TEP_NHAT_KY, 'a');
        const p = spawn(process.execPath, ['src/main.ts'], { cwd: MAY_CHU, env, detached: true, stdio: ['ignore', nk, nk] });
        fs.closeSync(nk);
        p.unref();
        return p.pid;
    }
    const dat = (ten, gt) => `set "${ten}=${gt}"`;
    fs.writeFileSync(TEP_CMD, [
        '@echo off',
        'chcp 65001 >nul',
        `cd /d "${MAY_CHU}"`,
        ...['AWORD_WEB_BI_MAT', 'AWORD_WEB_DU_LIEU', 'AWORD_WEB_CONG', 'AWORD_WEB_TEN_MIEN', 'AWORD_WEB_TRINH_DIEU_PHOI', 'AWORD_WEB_REPO']
            .map(ten => dat(ten, env[ten])),
        'set "ELECTRON_RUN_AS_NODE="',
        `"${process.execPath}" src${path.sep}main.ts >> "${TEP_NHAT_KY}" 2>&1`,
        '',
    ].join('\r\n'), 'ascii');
    const ps = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        `(Start-Process -FilePath '${TEP_CMD.replace(/'/g, "''")}' -WindowStyle Hidden -PassThru).Id`],
        { encoding: 'utf8', windowsHide: true });
    const pid = parseInt(String(ps.stdout ?? '').trim(), 10);
    if (!Number.isInteger(pid) || pid <= 0) {
        dung(`Không khởi động được máy chủ ở nền: ${String(ps.stderr ?? '').trim() || 'PowerShell không trả về mã tiến trình'}`);
    }
    return pid;
}

(async () => {
    if (process.argv.includes('--tat')) { tatMayChu(); return; }
    if (!fs.existsSync(path.join(MAY_CHU, 'src', 'main.ts'))) { dung(`Không thấy máy chủ ở ${MAY_CHU}.`); }

    // 1. Đang chạy sẵn → mở trình duyệt.
    const dangChay = docJson(TEP_MAY_CHU);
    if (dangChay?.cong && (await hoi(`http://127.0.0.1:${dangChay.cong}/dang-nhap`)) === 200) {
        bao(`Đang chạy — mở http://${TEN_MIEN}:${dangChay.cong}`);
        moTrinhDuyet(`http://${TEN_MIEN}:${dangChay.cong}/`);
        return;
    }

    // 2. Phiên của mỗi tài khoản chạy chính browser-app này → dùng lại bước làm mới của bản một người.
    bao('Kiểm tra và làm mới bản web (aword-chat, plugin Claude Code, native module, browser-app)…');
    const r = spawnSync(process.execPath, [path.join(__dirname, 'chay-aword-web.cjs'), '--chi-chuan-bi'],
        { cwd: REPO, stdio: 'inherit', env: { ...process.env, ELECTRON_RUN_AS_NODE: '' } });
    if (r.status !== 0) { dung('Chuẩn bị bản web thất bại (xem thông báo phía trên).'); }

    let cong = CONG_MAC_DINH;
    while (!(await congTrong(cong))) { cong++; }
    const env = moiTruong(cong);

    // 3. Lần đầu: tạo tài khoản quản trị.
    if (!fs.existsSync(path.join(DU_LIEU, 'aword-web.db'))) {
        bao('Lần đầu chạy — tạo tài khoản quản trị cho bạn.');
        const dinhDanh = await doiCauTraLoi('  Email hoặc số điện thoại đăng nhập: ');
        const hoTen = await doiCauTraLoi('  Họ và tên: ');
        const t = spawnSync(process.execPath, ['src/main.ts', 'tao-quan-tri', dinhDanh, hoTen],
            { cwd: MAY_CHU, env, encoding: 'utf8', windowsHide: true });
        process.stdout.write(t.stdout ?? '');
        if (t.status !== 0) { dung(`Không tạo được tài khoản quản trị: ${(t.stderr ?? '').trim()}`); }
        bao('GHI LẠI mật khẩu tạm ở trên — lần đăng nhập đầu tiên sẽ yêu cầu đổi mật khẩu.');
    }

    // 4. Chạy nền, chờ sẵn sàng rồi mở trình duyệt.
    bao(`Khởi động máy chủ tại http://${TEN_MIEN}:${cong} (chỉ máy này truy cập được)…`);
    const pid = chayNen(cong, env);
    fs.writeFileSync(TEP_MAY_CHU, JSON.stringify({ pid, cong, luc: new Date().toISOString() }, null, 2));
    const conSong = () => { try { process.kill(pid, 0); return true; } catch { return false; } };
    for (let i = 0; i < 90 && conSong(); i++) {
        if ((await hoi(`http://127.0.0.1:${cong}/dang-nhap`)) === 200) {
            bao(`SẴN SÀNG — mở http://${TEN_MIEN}:${cong}. Tắt bằng "Tắt AWord Web (đăng nhập)".`);
            moTrinhDuyet(`http://${TEN_MIEN}:${cong}/`);
            process.exit(0);
        }
        await new Promise(r2 => setTimeout(r2, 1000));
    }
    fs.rmSync(TEP_MAY_CHU, { force: true });
    if (conSong()) { spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); }
    let duoi = '';
    try { duoi = fs.readFileSync(TEP_NHAT_KY, 'utf8').split(/\r?\n/).slice(-25).join('\n'); } catch { /* bỏ qua */ }
    dung(`Máy chủ không sẵn sàng. Nhật ký (${TEP_NHAT_KY}):\n${duoi}`);
})();
