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

    // AWord 2.0.1 là bản CUỐI của dòng 2.x. Giới thiệu AWord Pro — sản phẩm mới cài SONG SONG, dùng chung dữ liệu
    // làm việc — chỉ khi đã có bản phát hành AWord Pro và máy chưa cài nó. "Để sau" nhắc lại sau 7 ngày, "Không nhắc
    // lại" thì thôi hẳn. Bộ cài Pro đặt tên AWordPro-* nên kiemTraCapNhat ở trên (chỉ nhận AWord-Setup-*) không coi
    // Pro là bản cập nhật của dòng 2.x.
    const daCaiAwordPro = () => {
      const ungVien = process.platform === 'darwin'
        ? ['/Applications/AWord Pro.app', path.join(app.getPath('home'), 'Applications', 'AWord Pro.app')]
        : [path.join(process.env.LOCALAPPDATA || '', 'Programs', 'AWordPro', 'AWordPro.exe')]; // executableName AWordPro → thư mục cài AWordPro
      return ungVien.some(p => { try { return fs.existsSync(p); } catch (e) { return false; } });
    };
    const gioiThieuAwordPro = async () => {
      const tepTrangThai = path.join(app.getPath('userData'), 'gioi-thieu-aword-pro.json');
      let tt = {};
      try { tt = JSON.parse(fs.readFileSync(tepTrangThai, 'utf8')) || {}; } catch (e) { tt = {}; }
      if (tt.khongNhacLai || daCaiAwordPro()) { return; }
      if (tt.nhacLuc && Date.now() - tt.nhacLuc < 7 * 24 * 3600 * 1000) { return; }
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
      if (!rel) { return; }
      const ghi = moi => {
        try { fs.writeFileSync(tepTrangThai, JSON.stringify(Object.assign(tt, moi), null, 2)); } catch (e) { /* bỏ qua */ }
      };
      const chon = await dialog.showMessageBox({
        type: 'info',
        title: 'AWord Pro đã phát hành',
        message: 'AWord Pro ' + String(rel.tag_name || rel.name || '').replace(/^v/i, '') + ' — dòng sản phẩm mới của AWord, chạy song song bản web.',
        detail: [
          'Bản AWord ' + app.getVersion() + ' bạn đang dùng vẫn chạy bình thường, nhưng dòng AWord 2.x sẽ không nhận cập nhật mới nữa.',
          '',
          'AWord Pro cài SONG SONG, không gỡ bản này. Hai bản dùng chung thư mục làm việc Documents\\\\AWord, cấu hình Claude, bộ nhớ và kết nối Kho dữ liệu — không mất dữ liệu.',
          '',
          'Có sẵn trong AWord Pro: tự kết nối Kho tri thức AI giảng dạy, mô hình AI DeepSeek, Claude Code mới nhất; sắp có bản web đăng nhập bằng tài khoản cá nhân.',
          '',
          'Nâng cấp khi bạn có nhu cầu.'
        ].join('\\n'),
        buttons: ['Tải AWord Pro', 'Để sau', 'Không nhắc lại'],
        defaultId: 0, cancelId: 1, noLink: true
      });
      if (chon.response === 2) { ghi({ khongNhacLai: true, luc: new Date().toISOString() }); return; }
      ghi({ nhacLuc: Date.now() });
      if (chon.response === 0) { shell.openExternal(goi.browser_download_url || rel.html_url); }
    };

    app.whenReady().then(() => {
      // Chờ 15s sau khởi động cho app ổn định rồi mới kiểm tra; lỗi mạng thì im lặng bỏ qua.
      setTimeout(() => { kiemTraCapNhat().catch(() => { /* offline/không có release: bỏ qua */ }); }, 15000);
      // Lệch 10s để không chồng hai hộp thoại.
      setTimeout(() => { gioiThieuAwordPro().catch(() => { /* offline: bỏ qua */ }); }, 25000);
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
