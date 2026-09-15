// Chạy AWord BẢN TRÌNH DUYỆT trên máy này bằng một cú bấm (Chay_AWord_Web.cmd gọi tệp này).
//   1. Bản web đang chạy sẵn → chỉ mở trình duyệt.
//   2. Tự làm mới những gì đã cũ: biên dịch aword-chat, plugin Claude Code (lấy bản của electron-app), native module cho
//      Node (theia rebuild:browser — dùng bộ đệm, thường vài giây), build browser-app.
//   3. Chạy máy chủ CHỈ trong máy (127.0.0.1) rồi mở http://localhost:<cổng>. Webview của Claude Code cần tên miền con
//      (*.webview.localhost) — mở bằng địa chỉ IP thì khung chat trắng.
//   4. Cài đặt giao diện Theia tách riêng ở ~/.aword-web/theia (không lẫn tùy chọn DeepSeek... với AWord bản cài);
//      dùng chung dữ liệu làm việc: Documents\AWord, ~/.claude, ~/.aword.
// Đóng cửa sổ dòng lệnh (hoặc Ctrl+C) là tắt bản web.
// Lưu ý: rebuild:browser đổi native module dùng chung sang bản cho Node; đóng gói bản cài (Phat_Hanh_AWord.ps1) tự rebuild lại cho Electron.
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

(async () => {
    if (!fs.existsSync(THEIA)) { dung(`Chưa cài thư viện (không thấy ${THEIA}). Chạy "npm ci" ở ${REPO} trước.`); }

    // 1. Đang chạy sẵn → mở trình duyệt.
    const tepCong = path.join(os.homedir(), '.aword-web', 'cong.txt');
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

    // 4. Chọn cổng, chạy máy chủ chỉ trong máy, mở trình duyệt khi sẵn sàng.
    let cong = CONG_MAC_DINH;
    while (!(await congTrong(cong))) { cong++; }
    fs.mkdirSync(path.dirname(tepCong), { recursive: true });
    fs.writeFileSync(tepCong, String(cong));
    const env = { ...process.env, THEIA_CONFIG_DIR: CAU_HINH };
    delete env.ELECTRON_RUN_AS_NODE;
    bao(`Khởi động máy chủ tại http://localhost:${cong} (chỉ máy này truy cập được)…`);
    const mayChu = spawn(process.execPath, ['lib/backend/main.js', '--hostname=127.0.0.1', `--port=${cong}`, '--plugins=local-dir:plugins'],
        { cwd: APP, env, stdio: 'inherit' });
    mayChu.on('exit', ma => { try { fs.rmSync(tepCong, { force: true }); } catch { /* bỏ qua */ } bao(`Máy chủ đã dừng (mã ${ma}).`); process.exit(ma ?? 0); });
    const tat = () => { try { mayChu.kill(); } catch { /* đã dừng */ } };
    process.on('SIGINT', tat); process.on('SIGTERM', tat); process.on('SIGHUP', tat);

    for (let i = 0; i < 120; i++) {
        if ((await hoi(`http://127.0.0.1:${cong}/`)) === 200) {
            bao(`SẴN SÀNG — mở http://localhost:${cong}. Đóng cửa sổ này để tắt AWord Web.`);
            moTrinhDuyet(`http://localhost:${cong}`);
            return;
        }
        await new Promise(r => setTimeout(r, 1000));
    }
    bao('Máy chủ khởi động lâu hơn 2 phút — xem thông báo phía trên.');
})();
