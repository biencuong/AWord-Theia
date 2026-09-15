// Tiêm bộ kiểm tra & cập nhật phiên bản tự động (qua GitHub Releases) vào
// lib/backend/electron-main.js khi đóng gói. Không dùng electron-updater để
// tránh thêm dependency (yarn install lại rất rủi ro trên môi trường này —
// xem ghi chú extract-zip/Node 26 trong kế hoạch); tự cài đặt qua chính bộ cài
// NSIS: tải AWord-Setup-x.y.z.exe từ release mới nhất rồi chạy nó.
// Idempotent: đánh dấu bằng AWORD_AUTO_UPDATE.
const fs = require('fs');
const path = require('path');

const GITHUB_REPO = 'biencuong/AWord-Theia'; // đổi ở đây nếu chuyển repo phát hành

const target = path.join(__dirname, '..', 'lib', 'backend', 'electron-main.js');
const marker = '/* AWORD_AUTO_UPDATE */';

const snippet = `
${marker}
(() => {
  try {
    const { app, dialog, shell } = require('electron');
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
      const req = https.get(url, { headers: { 'User-Agent': 'AWord-Updater', 'Accept': 'application/octet-stream' } }, res => {
        res.on('error', reject); // socket reset GIUA luc tai body -> khong thanh uncaught
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return resolve(taiTep(res.headers.location, dich, (chuyenTiep ?? 0) + 1));
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
        const ws = fs.createWriteStream(dich);
        res.pipe(ws);
        ws.on('finish', () => ws.close(() => resolve(dich)));
        ws.on('error', reject);
      });
      req.on('error', reject);
      req.setTimeout(120000, () => req.destroy(new Error('Het thoi gian tai bo cai'))); // khong treo mai
    });

    // Lịch sử phát hành có 3 THẾ HỆ số hiệu — so thế hệ trước rồi mới so từng phần số:
    //   0 = đời đầu 1.0.x (major < 2)                        — cũ nhất
    //   1 = kiểu theo giờ YYYYMMDD.H.M (major >= 10000)
    //   2 = semver thông lệ từ 2.0.0 (2 <= major < 10000)     — mới nhất
    // Không so thẳng giá trị số: 2.0.0 < 20260914.17.20 và release v1.0.4 đời đầu vẫn còn trên GitHub.
    const theHe = v => {
      const major = parseInt(String(v).replace(/^v/i, '').split('.')[0], 10) || 0;
      return major >= 10000 ? 1 : (major >= 2 ? 2 : 0);
    };
    const soSanhPhienBan = (a, b) => { // >0 nếu a mới hơn b
      const dTheHe = theHe(a) - theHe(b);
      if (dTheHe !== 0) { return dTheHe; }
      const pa = String(a).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
      const pb = String(b).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] || 0) - (pb[i] || 0);
        if (d !== 0) { return d; }
      }
      return 0;
    };

    const kiemTraCapNhat = async () => {
      // Dò DANH SÁCH release, KHÔNG dùng /releases/latest: cờ "Latest" trên GitHub được giữ cố
      // định ở bản cầu nối (kiểu số theo giờ) để máy chạy bản cũ — chỉ biết /latest — vẫn lên
      // được bản cầu nối; từ bản cầu nối trở đi app tự chọn bản số hiệu cao nhất có bộ cài hợp nền tảng.
      const macOS = process.platform === 'darwin';
      const khopGoi = a => macOS
        ? /^AWord-.*\\.dmg$/i.test(a.name)
        : /^AWord-Setup-.*\\.exe$/i.test(a.name);
      const ds = await layJson('https://api.github.com/repos/' + REPO + '/releases?per_page=30');
      let rel = null;
      let asset = null;
      for (const r of (Array.isArray(ds) ? ds : [])) {
        if (r.draft || r.prerelease) { continue; }
        const goi = (r.assets || []).find(khopGoi);
        if (!goi) { continue; }
        if (!rel || soSanhPhienBan(r.tag_name || r.name || '', rel.tag_name || rel.name || '') > 0) {
          rel = r;
          asset = goi;
        }
      }
      if (!rel) { return; }
      const moi = rel.tag_name || rel.name || '';
      if (soSanhPhienBan(moi, app.getVersion()) <= 0) { return; }
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
      if (macOS) {
        // Mo .dmg (mount) - nguoi dung keo AWord vao Applications de thay ban cu.
        spawn('open', [dich], { detached: true, stdio: 'ignore' }).unref();
      } else {
        spawn(dich, [], { detached: true, stdio: 'ignore' }).unref();
      }
      app.quit();
    };

    // DÒNG AWord 2.x ĐÃ NGỪNG PHÁT TRIỂN (từ 2.0.2): MỖI LẦN MỞ app đều báo và mời nâng cấp lên AWord Pro 3.x — sản phẩm
    // mới cài SONG SONG, dùng chung dữ liệu làm việc. Không còn "Không nhắc lại" (bỏ qua cả trạng thái đã lưu ở 2.0.1).
    //   - Máy đã cài AWord Pro: nút "Mở AWord Pro".
    //   - Chưa cài: nút "Cài AWord Pro ngay" → tải bộ cài (tiến độ trên thanh tác vụ) rồi tự mở; lỗi thì mở trang tải.
    // Bộ cài Pro đặt tên AWordPro-* nên kiemTraCapNhat ở trên (chỉ nhận AWord-Setup-*) không coi Pro là bản cập nhật của 2.x.
    const TRANG_TAI = 'https://github.com/' + REPO + '/releases';
    let dangThoat = false;
    app.on('before-quit', () => { dangThoat = true; });

    const duongDanAwordPro = () => {
      const ungVien = process.platform === 'darwin'
        ? ['/Applications/AWord Pro.app', path.join(app.getPath('home'), 'Applications', 'AWord Pro.app')]
        : [path.join(process.env.LOCALAPPDATA || '', 'Programs', 'AWordPro', 'AWordPro.exe')]; // executableName AWordPro → thư mục cài AWordPro
      return ungVien.find(p => { try { return fs.existsSync(p); } catch (e) { return false; } });
    };
    const moAwordPro = p => {
      if (process.platform === 'darwin') { spawn('open', [p], { detached: true, stdio: 'ignore' }).unref(); }
      else { spawn(p, [], { detached: true, stdio: 'ignore', cwd: path.dirname(p) }).unref(); }
    };
    const timBanAwordPro = async () => {
      const macOS = process.platform === 'darwin';
      const khopPro = a => macOS ? /^AWordPro-.*\\.dmg$/i.test(a.name) : /^AWordPro-Setup-.*\\.exe$/i.test(a.name);
      const ds = await layJson('https://api.github.com/repos/' + REPO + '/releases?per_page=30');
      let rel = null;
      let goi = null;
      for (const r of (Array.isArray(ds) ? ds : [])) {
        if (r.draft || r.prerelease) { continue; }
        const g = (r.assets || []).find(khopPro);
        if (!g) { continue; }
        if (!rel || soSanhPhienBan(r.tag_name || r.name || '', rel.tag_name || rel.name || '') > 0) { rel = r; goi = g; }
      }
      return rel ? { phienBan: String(rel.tag_name || rel.name || '').replace(/^v/i, ''), goi, trang: rel.html_url || TRANG_TAI } : null;
    };
    // Tải bộ cài Pro: tiến độ hiện trên nút app ở thanh tác vụ (bộ cài vài trăm MB), xong thì tự chạy bộ cài.
    const taiVaCaiAwordPro = async ban => {
      const { BrowserWindow, Notification } = require('electron');
      const cuaSo = BrowserWindow.getAllWindows()[0];
      const dich = path.join(app.getPath('temp'), ban.goi.name);
      const tong = ban.goi.size || 0;
      try {
        if (Notification.isSupported()) {
          new Notification({ title: 'Đang tải AWord Pro ' + ban.phienBan, body: 'Bộ cài sẽ tự mở khi tải xong (xem tiến độ trên thanh tác vụ). Bạn vẫn dùng AWord bình thường.' }).show();
        }
      } catch (e) { /* bỏ qua */ }
      const hen = tong && cuaSo ? setInterval(() => {
        try { cuaSo.setProgressBar(Math.min(0.99, fs.statSync(dich).size / tong)); } catch (e) { /* chưa có tệp */ }
      }, 1000) : null;
      try {
        await taiTep(ban.goi.browser_download_url, dich);
      } finally {
        if (hen) { clearInterval(hen); }
        try { if (cuaSo && !cuaSo.isDestroyed()) { cuaSo.setProgressBar(-1); } } catch (e) { /* bỏ qua */ }
      }
      if (process.platform === 'darwin') { spawn('open', [dich], { detached: true, stdio: 'ignore' }).unref(); }
      else { spawn(dich, [], { detached: true, stdio: 'ignore' }).unref(); }
    };

    const baoNgungPhatTrien = async () => {
      if (dangThoat) { return; }
      const daCai = duongDanAwordPro();
      let ban = null;
      if (!daCai) { try { ban = await timBanAwordPro(); } catch (e) { ban = null; /* offline: vẫn báo, nút mở trang tải */ } }
      if (dangThoat) { return; }
      const tenPro = 'AWord Pro' + (ban ? ' ' + ban.phienBan : ' 3.x');
      const chon = await dialog.showMessageBox({
        type: 'warning',
        title: 'AWord 2.x đã ngừng phát triển',
        message: daCai
          ? 'Dòng AWord 2.x đã NGỪNG PHÁT TRIỂN. Máy bạn đã có AWord Pro — hãy chuyển sang dùng AWord Pro.'
          : 'Dòng AWord 2.x đã NGỪNG PHÁT TRIỂN. Khuyến nghị nâng cấp lên ' + tenPro + '.',
        detail: [
          'Bản AWord ' + app.getVersion() + ' vẫn mở được nhưng KHÔNG còn nhận bản sửa lỗi, tính năng mới hay cập nhật Claude Code.',
          '',
          'AWord Pro cài SONG SONG, không gỡ bản này. Hai bản dùng chung thư mục làm việc Documents\\\\AWord, cấu hình Claude, bộ nhớ và kết nối Kho dữ liệu — không mất dữ liệu.',
          '',
          'Có trong AWord Pro: tự kết nối Kho tri thức AI giảng dạy, mô hình AI DeepSeek, Claude Code mới nhất; sắp có bản web đăng nhập bằng tài khoản cá nhân.'
        ].join('\\n'),
        buttons: [daCai ? 'Mở AWord Pro' : (ban ? 'Cài AWord Pro ngay' : 'Mở trang tải AWord Pro'), 'Để sau'],
        defaultId: 0, cancelId: 1, noLink: true
      });
      if (chon.response !== 0 || dangThoat) { return; }
      if (daCai) { moAwordPro(daCai); return; }
      if (!ban) { shell.openExternal(TRANG_TAI); return; }
      try {
        await taiVaCaiAwordPro(ban);
      } catch (e) {
        const loi = await dialog.showMessageBox({
          type: 'error',
          title: 'Chưa tải được AWord Pro',
          message: 'Tải bộ cài AWord Pro không thành công (' + (e && e.message ? e.message : e) + ').',
          detail: 'Bạn có thể tải thủ công trên trang phát hành rồi chạy tệp ' + ban.goi.name + '.',
          buttons: ['Mở trang tải', 'Đóng'], defaultId: 0, cancelId: 1, noLink: true
        });
        if (loi.response === 0) { shell.openExternal(ban.trang); }
      }
    };

    app.whenReady().then(() => {
      // Chờ 15s sau khởi động cho app ổn định: kiểm tra bản cập nhật 2.x trước (máy còn ở 2.0.0/bản cầu nối lên bản
      // 2.x cuối), rồi mới báo ngừng phát triển — nối tiếp để hai hộp thoại không chồng nhau; lỗi mạng thì bỏ qua.
      setTimeout(async () => {
        try { await kiemTraCapNhat(); } catch (e) { /* offline/không có release: bỏ qua */ }
        try { await baoNgungPhatTrien(); } catch (e) { /* bỏ qua */ }
      }, 15000);
    });
  } catch (e) { console.error('[AWord] Khởi tạo kiểm tra cập nhật thất bại:', e); }
})();
`;

let content = fs.readFileSync(target, 'utf8');
const idx = content.indexOf(marker);
if (idx >= 0) {
    // Khối updater luôn được nối vào CUỐI tệp — cắt bỏ bản cũ để thay bằng bản mới
    // (đề phòng đổi repo/logic mà electron-main.js chưa được build lại từ đầu).
    content = content.slice(0, idx).replace(/\n+$/, '\n');
}
fs.writeFileSync(target, content + '\n' + snippet, 'utf8');
console.log(`[inject-auto-update] Đã tiêm bộ kiểm tra cập nhật (repo ${GITHUB_REPO}).`);
