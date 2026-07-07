// Tiêm bộ kiểm tra & cập nhật phiên bản tự động (qua GitHub Releases) vào
// lib/backend/electron-main.js khi đóng gói. Không dùng electron-updater để
// tránh thêm dependency (yarn install lại rất rủi ro trên môi trường này —
// xem ghi chú extract-zip/Node 26 trong kế hoạch); tự cài đặt qua chính bộ cài
// NSIS: tải AWord-Setup-x.y.z.exe từ release mới nhất rồi chạy nó.
// Idempotent: đánh dấu bằng AWORD_AUTO_UPDATE.
const fs = require('fs');
const path = require('path');

const GITHUB_REPO = 'biencuong/AWord'; // đổi ở đây nếu chuyển repo phát hành

const target = path.join(__dirname, '..', 'lib', 'backend', 'electron-main.js');
const marker = '/* AWORD_AUTO_UPDATE */';

const snippet = `
${marker}
(() => {
  try {
    const { app, dialog } = require('electron');
    const https = require('https');
    const fs = require('fs');
    const path = require('path');
    const { spawn } = require('child_process');
    const REPO = ${JSON.stringify(GITHUB_REPO)};

    const layJson = (url, chuyenTiep) => new Promise((resolve, reject) => {
      if ((chuyenTiep ?? 0) > 5) { return reject(new Error('Qua nhieu chuyen tiep')); }
      https.get(url, { headers: { 'User-Agent': 'AWord-Updater', 'Accept': 'application/vnd.github+json' } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return resolve(layJson(res.headers.location, (chuyenTiep ?? 0) + 1));
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
      }).on('error', reject);
    });

    const taiTep = (url, dich, chuyenTiep) => new Promise((resolve, reject) => {
      if ((chuyenTiep ?? 0) > 5) { return reject(new Error('Qua nhieu chuyen tiep')); }
      https.get(url, { headers: { 'User-Agent': 'AWord-Updater', 'Accept': 'application/octet-stream' } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return resolve(taiTep(res.headers.location, dich, (chuyenTiep ?? 0) + 1));
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
        const ws = fs.createWriteStream(dich);
        res.pipe(ws);
        ws.on('finish', () => ws.close(() => resolve(dich)));
        ws.on('error', reject);
      }).on('error', reject);
    });

    const soSanhPhienBan = (a, b) => { // >0 nếu a mới hơn b
      const pa = String(a).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
      const pb = String(b).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] || 0) - (pb[i] || 0);
        if (d !== 0) { return d; }
      }
      return 0;
    };

    const kiemTraCapNhat = async () => {
      const rel = await layJson('https://api.github.com/repos/' + REPO + '/releases/latest');
      const moi = rel.tag_name || rel.name || '';
      if (soSanhPhienBan(moi, app.getVersion()) <= 0) { return; }
      const asset = (rel.assets || []).find(a => /^AWord-Setup-.*\\.exe$/i.test(a.name));
      if (!asset) { return; }
      const chon = await dialog.showMessageBox({
        type: 'info',
        title: 'Cập nhật AWord',
        message: 'Đã có phiên bản AWord mới: ' + moi.replace(/^v/i, '') + ' (bạn đang dùng ' + app.getVersion() + ').',
        detail: 'Tải về và cài đặt ngay? Ứng dụng sẽ đóng để chạy bộ cài.',
        buttons: ['Cập nhật ngay', 'Để sau'],
        defaultId: 0, cancelId: 1
      });
      if (chon.response !== 0) { return; }
      const dich = path.join(app.getPath('temp'), asset.name);
      await taiTep(asset.browser_download_url, dich);
      spawn(dich, [], { detached: true, stdio: 'ignore' }).unref();
      app.quit();
    };

    app.whenReady().then(() => {
      // Chờ 15s sau khởi động cho app ổn định rồi mới kiểm tra; lỗi mạng thì im lặng bỏ qua.
      setTimeout(() => { kiemTraCapNhat().catch(() => { /* offline/không có release: bỏ qua */ }); }, 15000);
    });
  } catch (e) { console.error('[AWord] Khởi tạo kiểm tra cập nhật thất bại:', e); }
})();
`;

let content = fs.readFileSync(target, 'utf8');
if (content.includes(marker)) {
    console.log('[inject-auto-update] electron-main.js đã có bộ cập nhật, bỏ qua.');
} else {
    fs.writeFileSync(target, content + '\n' + snippet, 'utf8');
    console.log(`[inject-auto-update] Đã tiêm bộ kiểm tra cập nhật (repo ${GITHUB_REPO}).`);
}
