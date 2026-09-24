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

    const TRANG_TAI = 'https://github.com/' + REPO + '/releases';
    let dangThoat = false;
    app.on('before-quit', () => { dangThoat = true; });

    // Máy đã cài AWord Pro thì chỉ cần mở, không tải lại.
    const duongDanAwordPro = () => {
      const ungVien = process.platform === 'darwin'
        ? ['/Applications/AWord Pro.app', path.join(app.getPath('home'), 'Applications', 'AWord Pro.app')]
        : [path.join(process.env.LOCALAPPDATA || '', 'Programs', 'AWordPro', 'AWordPro.exe')];
      return ungVien.find(p => { try { return fs.existsSync(p); } catch (e) { return false; } });
    };
    const moAwordPro = p => {
      if (process.platform === 'darwin') { spawn('open', [p], { detached: true, stdio: 'ignore' }).unref(); }
      else { spawn(p, [], { detached: true, stdio: 'ignore', cwd: path.dirname(p) }).unref(); }
    };

    // Tìm bản mới nhất của DÒNG 2.x (bộ cài AWord-Setup-* / AWord-*.dmg) — null nếu đang là bản mới nhất.
    // Dò DANH SÁCH release, KHÔNG dùng /releases/latest: cờ "Latest" trên GitHub được giữ cố định ở bản cầu nối
    // (kiểu số theo giờ) để máy chạy bản rất cũ — chỉ biết /latest — vẫn lên được; từ bản cầu nối trở đi app tự
    // chọn bản có số hiệu cao nhất.
    const macOS = process.platform === 'darwin';
    const timBanMoi = async (khop) => {
      const ds = await layJson('https://api.github.com/repos/' + REPO + '/releases?per_page=30');
      let rel = null;
      let goi = null;
      for (const r of (Array.isArray(ds) ? ds : [])) {
        if (r.draft || r.prerelease) { continue; }
        const g = (r.assets || []).find(khop);
        if (!g) { continue; }
        if (!rel || soSanhPhienBan(r.tag_name || r.name || '', rel.tag_name || rel.name || '') > 0) { rel = r; goi = g; }
      }
      if (!rel) { return null; }
      return { phienBan: String(rel.tag_name || rel.name || '').replace(/^v/i, ''), goi, trang: rel.html_url || TRANG_TAI };
    };
    const timBan2x = async () => {
      const ban = await timBanMoi(a => (macOS ? /^AWord-.*\\.dmg$/i : /^AWord-Setup-.*\\.exe$/i).test(a.name));
      return ban && soSanhPhienBan(ban.phienBan, app.getVersion()) > 0 ? ban : null;
    };
    const timBanAwordPro = () => timBanMoi(a => (macOS ? /^AWordPro-.*\\.dmg$/i : /^AWordPro-Setup-.*\\.exe$/i).test(a.name));

    // Tải bộ cài rồi mở: tiến độ hiện trên nút app ở thanh tác vụ (bộ cài vài trăm MB).
    // thoatApp = true với bản cập nhật 2.x (bộ cài ghi đè chính app này), = false với AWord Pro (cài song song).
    const taiVaCai = async (ban, ten, thoatApp) => {
      const { BrowserWindow, Notification } = require('electron');
      const cuaSo = BrowserWindow.getAllWindows()[0];
      const dich = path.join(app.getPath('temp'), ban.goi.name);
      const tong = ban.goi.size || 0;
      try {
        if (Notification.isSupported()) {
          new Notification({
            title: 'Đang tải ' + ten + ' ' + ban.phienBan,
            body: 'Bộ cài sẽ tự mở khi tải xong (xem tiến độ trên thanh tác vụ). Bạn vẫn dùng AWord bình thường.'
          }).show();
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
      if (macOS) { spawn('open', [dich], { detached: true, stdio: 'ignore' }).unref(); }
      else { spawn(dich, [], { detached: true, stdio: 'ignore' }).unref(); }
      if (thoatApp) { app.quit(); }
    };

    const baoLoiTai = async (ban, ten, loi) => {
      const chon = await dialog.showMessageBox({
        type: 'error',
        title: 'Chưa tải được ' + ten,
        message: 'Tải bộ cài ' + ten + ' không thành công (' + (loi && loi.message ? loi.message : loi) + ').',
        detail: 'Bạn có thể tải thủ công trên trang phát hành rồi chạy tệp ' + ban.goi.name + '.',
        buttons: ['Mở trang tải', 'Đóng'], defaultId: 0, cancelId: 1, noLink: true
      });
      if (chon.response === 0) { shell.openExternal(ban.trang); }
    };

    /**
     * MỘT hộp thoại duy nhất mỗi lần mở app: báo dòng 2.x đã ngừng phát triển và HỎI RÕ muốn nâng lên bản nào —
     * AWord Pro (dòng mới, cài song song) hay chỉ cập nhật trong dòng 2.x (nếu còn bản 2.x mới hơn), hay để sau.
     */
    const hoiNangCap = async () => {
      if (dangThoat) { return; }
      const daCaiPro = duongDanAwordPro();
      let ban2x = null;
      let banPro = null;
      try { ban2x = await timBan2x(); } catch (e) { /* offline: vẫn hiện thông báo */ }
      if (!daCaiPro) { try { banPro = await timBanAwordPro(); } catch (e) { /* offline */ } }
      if (dangThoat) { return; }

      const nut = [];
      const viec = [];
      if (daCaiPro) {
        nut.push('Mở AWord Pro');
        viec.push(async () => moAwordPro(daCaiPro));
      } else if (banPro) {
        nut.push('Nâng cấp lên AWord Pro ' + banPro.phienBan);
        viec.push(async () => {
          try { await taiVaCai(banPro, 'AWord Pro', false); } catch (e) { await baoLoiTai(banPro, 'AWord Pro', e); }
        });
      } else {
        nut.push('Mở trang tải AWord Pro');
        viec.push(async () => shell.openExternal(TRANG_TAI));
      }
      if (ban2x) {
        nut.push('Chỉ cập nhật AWord ' + ban2x.phienBan);
        viec.push(async () => {
          try { await taiVaCai(ban2x, 'AWord', true); } catch (e) { await baoLoiTai(ban2x, 'AWord', e); }
        });
      }
      nut.push('Để sau');

      const dong = [
        'Bản AWord ' + app.getVersion() + ' vẫn mở được nhưng dòng 2.x KHÔNG còn nhận tính năng mới hay cập nhật Claude Code.',
        '',
        'AWord Pro cài SONG SONG, không gỡ bản này. Hai bản dùng chung thư mục làm việc Documents\\\\AWord, cấu hình Claude, '
          + 'bộ nhớ, lịch sử trò chuyện và kết nối Kho dữ liệu — không mất dữ liệu.',
        '',
        'Có trong AWord Pro: tự kết nối Kho tri thức AI giảng dạy, mô hình AI DeepSeek, Claude Code mới nhất, thống kê '
          + 'token — chi phí; sắp có bản web đăng nhập bằng tài khoản cá nhân.'
      ];
      if (ban2x) {
        dong.push('', 'Bản AWord ' + ban2x.phienBan + ' của dòng 2.x chỉ sửa lỗi và bổ sung kỹ năng, cài đè lên bản đang dùng.');
      }

      const chon = await dialog.showMessageBox({
        type: 'warning',
        title: 'AWord 2.x đã ngừng phát triển — bạn muốn nâng lên bản nào?',
        message: daCaiPro
          ? 'Dòng AWord 2.x đã NGỪNG PHÁT TRIỂN. Máy bạn đã có AWord Pro — hãy chuyển sang dùng AWord Pro.'
          : 'Dòng AWord 2.x đã NGỪNG PHÁT TRIỂN. Chọn bản bạn muốn nâng lên:',
        detail: dong.join('\\n'),
        buttons: nut,
        defaultId: 0,
        cancelId: nut.length - 1,
        noLink: true
      });
      const lam = viec[chon.response];
      if (!lam || dangThoat) { return; }
      await lam();
    };

    app.whenReady().then(() => {
      // Chờ 15s sau khởi động cho app ổn định rồi mới hỏi; lỗi mạng thì bỏ qua.
      setTimeout(() => { hoiNangCap().catch(() => { /* offline/không có release: bỏ qua */ }); }, 15000);
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
