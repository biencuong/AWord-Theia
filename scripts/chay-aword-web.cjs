// Chạy AWord BẢN TRÌNH DUYỆT trên máy này bằng một cú bấm (Chay_AWord_Web.cmd gọi tệp này).
//   1. Bản web đang chạy sẵn → chỉ mở trình duyệt.
//   2. Tự làm mới những gì đã cũ: biên dịch aword-chat, plugin Claude Code (lấy bản của electron-app), native module cho
//      Node (theia rebuild:browser — dùng bộ đệm, thường vài giây), build browser-app.
//   3. Chạy máy chủ CHỈ trong máy (127.0.0.1) ở NỀN, KHÔNG cửa sổ (nhật ký: ~/.aword-web/nhat-ky.log), chờ sẵn sàng rồi mở
//      http://localhost:<cổng> và thoát — cửa sổ dòng lệnh tự đóng. Webview của Claude Code cần tên miền con
//      (*.webview.localhost) — mở bằng địa chỉ IP thì khung chat trắng.
//   4. Cài đặt giao diện Theia tách riêng ở ~/.aword-web/theia (không lẫn tùy chọn DeepSeek... với AWord bản cài);
//      dùng chung dữ liệu làm việc: Documents\AWord, ~/.claude, ~/.aword.
// Tắt bản web: Tat_AWord_Web.cmd (= node chay-aword-web.cjs --tat) — dừng máy chủ kèm mọi tiến trình con.
// Lưu ý: rebuild:browser đổi native module dùng chung sang bản cho Node; đóng gói bản cài (Phat_Hanh_AWord.ps1) tự rebuild lại
// cho Electron — hãy tắt bản web trước khi đóng gói (tệp native đang bị máy chủ web giữ).
'use strict';
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');

const REPO = path.join(__dirname, '..');
const APP = path.join(REPO, 'browser-app');
const CHAT = path.join(REPO, 'aword-chat');
const THEIA = path.join(REPO, 'node_modules', '.bin', process.platform === 'win32' ? 'theia.cmd' : 'theia');
const CONG_MAC_DINH = +(process.env.AWORD_WEB_CONG || 3030);
const CAU_HINH = path.join(os.homedir(), '.aword-web', 'theia');
const PLUGIN = path.join('Anthropic.claude-code', 'extension', 'package.json');

const bao = s => console.log(`[AWord Web] ${s}`);
const dung = (s, ma = 1) => { console.error(`\n[AWord Web] LỖI: ${s}`); process.exit(ma); };

// Mốc sửa mới nhất trong thư mục (bỏ qua node_modules).
function moiNhat(thuMuc) {
    let m = 0;
    const duyet = d => {
        let ds = [];
        try { ds = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
        for (const e of ds) {
            if (e.name === 'node_modules') { continue; }
            const p = path.join(d, e.name);
            if (e.isDirectory()) { duyet(p); } else { try { m = Math.max(m, fs.statSync(p).mtimeMs); } catch { /* bỏ qua */ } }
        }
    };
    duyet(thuMuc);
    return m;
}
const mtime = p => { try { return fs.statSync(p).mtimeMs; } catch { return 0; } };
const docJson = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return undefined; } };

function chay(ten, lenh, args, cwd) {
    bao(`${ten}…`);
    const r = spawnSync(`"${lenh}"`, args, { cwd, stdio: 'inherit', shell: true, env: { ...process.env, ELECTRON_RUN_AS_NODE: '' } });
    if (r.status !== 0) { dung(`${ten} thất bại (mã ${r.status}).`); }
}

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

const THU_MUC_WEB = path.join(os.homedir(), '.aword-web');
const TEP_CONG = path.join(THU_MUC_WEB, 'cong.txt');
const TEP_MAY_CHU = path.join(THU_MUC_WEB, 'may-chu.json'); // { pid, cong, luc } của máy chủ đang chạy nền
const TEP_NHAT_KY = path.join(THU_MUC_WEB, 'nhat-ky.log');

// Tắt máy chủ web: dừng cả cây tiến trình (plugin host, claude.exe, terminal...) — không để tiến trình mồ côi.
function tatMayChu() {
    const mc = docJson(TEP_MAY_CHU);
    if (!mc?.pid) { bao('Bản web không chạy.'); return; }
    // PID trong tệp có thể đã bị Windows cấp lại cho tiến trình khác (máy chủ dừng bất thường, khởi động lại máy):
    // chỉ dừng khi đúng là máy chủ AWord Web.
    const lenh = process.platform === 'win32'
        ? spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
            `(Get-CimInstance Win32_Process -Filter "ProcessId=${Number(mc.pid)}").CommandLine`], { encoding: 'utf8', windowsHide: true }).stdout ?? ''
        : '';
    const laMayChu = lenh.includes('may-chu.cmd') // tệp trung gian tạo console ẩn
        || (/lib[\\/]backend[\\/]main\.js/.test(lenh) && lenh.includes(`--port=${mc.cong}`));
    if (process.platform === 'win32' && !laMayChu) {
        for (const t of [TEP_MAY_CHU, TEP_CONG]) { try { fs.rmSync(t, { force: true }); } catch { /* bỏ qua */ } }
        bao('Bản web không chạy.');
        return;
    }
    if (process.platform === 'win32') {
        spawnSync('taskkill', ['/PID', String(mc.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    } else {
        try { process.kill(-mc.pid, 'SIGTERM'); } catch { try { process.kill(mc.pid, 'SIGTERM'); } catch { /* đã dừng */ } }
    }
    for (const t of [TEP_MAY_CHU, TEP_CONG]) { try { fs.rmSync(t, { force: true }); } catch { /* bỏ qua */ } }
    bao(`Đã tắt AWord Web (cổng ${mc.cong}).`);
}

/**
 * Chạy máy chủ ở NỀN, KHÔNG cửa sổ nào hiện ra, và sống tiếp sau khi cửa sổ dòng lệnh đóng. Trả về PID để theo dõi/tắt.
 *
 * Trên Windows phải cho máy chủ một console RIÊNG nhưng ẨN:
 *   - tách rời (detached = DETACHED_PROCESS): máy chủ không có console nào → mỗi tiến trình con là ứng dụng console
 *     (plugin host, claude.exe…) tự mở một cửa sổ mới — đúng hai cửa sổ người dùng thấy;
 *   - chỉ ẩn cửa sổ (windowsHide = CREATE_NO_WINDOW): máy chủ dùng chung console của cửa sổ dòng lệnh → đóng cửa sổ đó
 *     là máy chủ bị tắt theo.
 * Cách dùng ở đây: một tệp .cmd trung gian (đặt biến môi trường + chuyển nhật ký ra tệp) chạy qua
 * `Start-Process -WindowStyle Hidden`, tức ShellExecute với SW_HIDE: console mới được tạo nhưng ẩn, mọi tiến trình con
 * dùng chung console ẩn đó.
 */
function chayMayChuNen(cong, env) {
    const lenhNode = `"${process.execPath}" lib${path.sep}backend${path.sep}main.js --hostname=127.0.0.1 --port=${cong} --plugins=local-dir:plugins`;
    if (process.platform !== 'win32') {
        const nhatKy = fs.openSync(TEP_NHAT_KY, 'w');
        const p = spawn(process.execPath, ['lib/backend/main.js', '--hostname=127.0.0.1', `--port=${cong}`, '--plugins=local-dir:plugins'],
            { cwd: APP, env, detached: true, stdio: ['ignore', nhatKy, nhatKy] });
        fs.closeSync(nhatKy);
        p.unref();
        return p.pid;
    }
    fs.writeFileSync(TEP_NHAT_KY, ''); // mỗi lần chạy một nhật ký mới (cmd chỉ biết nối thêm)
    const tepCmd = path.join(THU_MUC_WEB, 'may-chu.cmd');
    fs.writeFileSync(tepCmd, [
        '@echo off',
        'chcp 65001 >nul',
        `cd /d "${APP}"`,
        `set "THEIA_CONFIG_DIR=${CAU_HINH}"`,
        'set "ELECTRON_RUN_AS_NODE="',
        `${lenhNode} >> "${TEP_NHAT_KY}" 2>&1`,
        '',
    ].join('\r\n'), 'ascii');
    const ps = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        `(Start-Process -FilePath '${tepCmd.replace(/'/g, "''")}' -WindowStyle Hidden -PassThru).Id`],
        { encoding: 'utf8', windowsHide: true });
    const pid = parseInt(String(ps.stdout ?? '').trim(), 10);
    if (!Number.isInteger(pid) || pid <= 0) {
        dung(`Không khởi động được máy chủ ở nền: ${String(ps.stderr ?? '').trim() || 'PowerShell không trả về mã tiến trình'}`);
    }
    return pid;
}

(async () => {
    if (process.argv.includes('--tat')) { tatMayChu(); return; }
    if (!fs.existsSync(THEIA)) { dung(`Chưa cài thư viện (không thấy ${THEIA}). Chạy "npm ci" ở ${REPO} trước.`); }

    // 1. Đang chạy sẵn → mở trình duyệt.
    const tepCong = TEP_CONG;
    const congCu = +(fs.existsSync(tepCong) ? fs.readFileSync(tepCong, 'utf8').trim() : 0);
    if (congCu && (await hoi(`http://127.0.0.1:${congCu}/`)) === 200) {
        bao(`Bản web đang chạy — mở http://localhost:${congCu}`);
        moTrinhDuyet(`http://localhost:${congCu}`);
        return;
    }

    // 2a. aword-chat: mã nguồn mới hơn bản biên dịch → biên dịch.
    if (moiNhat(path.join(CHAT, 'src')) > moiNhat(path.join(CHAT, 'lib'))) {
        chay('Biên dịch aword-chat', 'npm', ['--prefix', `"${CHAT}"`, 'run', 'build'], REPO);
    }
    // 2b. Plugin Claude Code: đồng bộ theo bản đóng gói của electron-app (đã Việt hóa).
    const banE = docJson(path.join(REPO, 'electron-app', 'plugins', PLUGIN))?.version;
    const banB = docJson(path.join(APP, 'plugins', PLUGIN))?.version;
    if (banE && banE !== banB) {
        bao(`Đồng bộ plugin Claude Code ${banB || '(chưa có)'} → ${banE}…`);
        const nguon = path.join(REPO, 'electron-app', 'plugins', 'Anthropic.claude-code');
        const dich = path.join(APP, 'plugins', 'Anthropic.claude-code');
        fs.rmSync(dich, { recursive: true, force: true });
        fs.cpSync(nguon, dich, { recursive: true });
    }
    // 2c. Native module cho Node (dùng bộ đệm; đã đúng thì theia báo "already rebuilt" ngay).
    chay('Kiểm tra native module cho trình duyệt', THEIA, ['rebuild:browser', '--cacheRoot', '..'], APP);
    // 2d. Build browser-app khi chưa có hoặc cũ hơn aword-chat / package.json.
    const mocBuild = mtime(path.join(APP, 'lib', 'backend', 'main.js'));
    if (!mocBuild || moiNhat(path.join(CHAT, 'lib')) > mocBuild || mtime(path.join(APP, 'package.json')) > mocBuild) {
        chay('Build bản trình duyệt (lần đầu hoặc sau khi mã đổi, khoảng 1 phút)', THEIA, ['build', '--mode', 'production'], APP);
    }

    // 3. Cài đặt giao diện riêng; lần đầu chép cài đặt + thư mục gần đây từ ~/.theia.
    if (!fs.existsSync(path.join(CAU_HINH, 'settings.json'))) {
        fs.mkdirSync(CAU_HINH, { recursive: true });
        for (const ten of ['settings.json', 'keymaps.json', 'recentworkspace.json']) {
            const nguon = path.join(os.homedir(), '.theia', ten);
            if (fs.existsSync(nguon)) { fs.copyFileSync(nguon, path.join(CAU_HINH, ten)); }
        }
    }

    // 4. Chọn cổng, chạy máy chủ NỀN chỉ trong máy (không cửa sổ, nhật ký ra tệp), mở trình duyệt khi sẵn sàng.
    let cong = CONG_MAC_DINH;
    while (!(await congTrong(cong))) { cong++; }
    fs.mkdirSync(THU_MUC_WEB, { recursive: true });
    const env = { ...process.env, THEIA_CONFIG_DIR: CAU_HINH };
    delete env.ELECTRON_RUN_AS_NODE;
    bao(`Khởi động máy chủ tại http://localhost:${cong} (chỉ máy này truy cập được)…`);
    const pid = chayMayChuNen(cong, env);
    fs.writeFileSync(tepCong, String(cong));
    fs.writeFileSync(TEP_MAY_CHU, JSON.stringify({ pid, cong, luc: new Date().toISOString() }, null, 2));

    const conSong = () => { try { process.kill(pid, 0); return true; } catch { return false; } };
    for (let i = 0; i < 120 && conSong(); i++) {
        if ((await hoi(`http://127.0.0.1:${cong}/`)) === 200) {
            bao(`SẴN SÀNG — mở http://localhost:${cong}. Máy chủ chạy nền; tắt bằng "Tắt AWord Web" (Tat_AWord_Web.cmd).`);
            moTrinhDuyet(`http://localhost:${cong}`);
            process.exit(0);
        }
        await new Promise(r => setTimeout(r, 1000));
    }
    const daDung = !conSong();
    for (const t of [TEP_MAY_CHU, TEP_CONG]) { try { fs.rmSync(t, { force: true }); } catch { /* bỏ qua */ } }
    if (!daDung) { try { spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch { /* bỏ qua */ } }
    let duoi = '';
    try { duoi = fs.readFileSync(TEP_NHAT_KY, 'utf8').split(/\r?\n/).slice(-25).join('\n'); } catch { /* bỏ qua */ }
    dung(`Máy chủ ${daDung ? 'đã dừng ngay khi khởi động' : 'không sẵn sàng sau 2 phút'}. Nhật ký (${TEP_NHAT_KY}):\n${duoi}`);
})();
