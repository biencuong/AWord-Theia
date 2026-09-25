// Tiêm WATCHDOG CHỐNG TREO vào lib/backend/electron-main.js khi đóng gói.
// Vấn đề thực tế: phiên làm việc dài -> renderer/plugin host đầy bộ nhớ, event loop
// kẹt -> cửa sổ đơ nhưng hiệu ứng Claude (CSS animation chạy trên compositor GPU)
// vẫn quay nên nhìn như còn sống; bấm X không đóng được vì Theia chờ renderer
// (đang treo) xác nhận đóng -> người dùng phải dùng Task Manager.
// Main process luôn còn sống khi renderer treo -> xử lý tại main:
//   1. Nới trần heap V8 cho renderer + mọi tiến trình node con (plugin host, CLI).
//   2. Bắt 'unresponsive' -> hộp thoại "Khởi động lại / Chờ thêm / Thoát".
//   3. Bấm đóng khi ĐANG treo -> tự destroy cửa sổ sau 3s (không kẹt X).
//   4. Đã vào quy trình thoát mà process còn nán lại -> thoát cứng (không treo ngầm).
//   5. Ghi %USERPROFILE%\.claude\aword-treo.log để chẩn đoán về sau.
// Idempotent qua marker AWORD_HANG_WATCHDOG; thay khối cũ nếu tiêm lại.
const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'lib', 'backend', 'electron-main.js');
const marker = '/* AWORD_HANG_WATCHDOG */';

const snippet = `
${marker}
(() => {
  try {
    const { app, dialog, BrowserWindow } = require('electron');
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    // 1) Noi tran heap V8: renderer (js-flags) + moi tien trinh node con qua NODE_OPTIONS
    // (plugin host chay extension Claude Code, cac fork cua backend...). Tran cao khong
    // chiem RAM truoc — chi cho phep phien dai vuot 4GB mac dinh thay vi GC ket roi treo.
    try { app.commandLine.appendSwitch('js-flags', '--max-old-space-size=8192'); } catch (e) { /* bo qua */ }
    if (!process.env.NODE_OPTIONS || process.env.NODE_OPTIONS.indexOf('--max-old-space-size') < 0) {
      process.env.NODE_OPTIONS = ((process.env.NODE_OPTIONS || '') + ' --max-old-space-size=8192').trim();
    }

    const ghiLog = (dong) => {
      try {
        fs.appendFileSync(path.join(os.homedir(), '.claude', 'aword-treo.log'),
          new Date().toISOString() + ' ' + dong + os.EOL);
      } catch (e) { /* thu muc chua co: bo qua */ }
    };
    const dangTreo = new WeakSet();

    // Chi so TUNG tien trinh luc treo (process.memoryUsage chi la tien trinh chinh — khong noi duoc ai gay treo).
    const chiSoTienTrinh = () => {
      try {
        return app.getAppMetrics().map(m => m.type + (m.name ? '(' + m.name + ')' : '') + ':' + m.pid
          + ' cpu=' + Math.round((m.cpu && m.cpu.percentCPUUsage) || 0) + '%'
          + ' ram=' + Math.round(((m.memory && m.memory.workingSetSize) || 0) / 1024) + 'MB').join(' | ');
      } catch (e) { return ''; }
    };

    // 2) Renderer ket event loop: Electron ban 'unresponsive' — main van song, hoi nguoi dung.
    // HOP THOAI KHONG DONG BO (sua 25/9/2026): ban cu dung showMessageBoxSync -> tien trinh chinh bi KHOA CUNG suot luc
    // hop thoai mo; renderer da hoi van khong chay tiep duoc (IPC dong bo phai cho main) -> nhat ky cho thay moi lan
    // "responsive tro lai" deu dung vai ms SAU khi nguoi dung bam, du hop thoai da mo 9-28 phut. Nay: cho 15s (phan lon
    // lan dung ngan tu hoi), hoi bang hop thoai bat dong bo, tu dong hop thoai khi cua so hoi lai; "Cho them" thi 60s sau
    // con treo moi hoi lai.
    const hoiKhiTreo = new WeakMap();
    const hoi = (wc, tt) => {
      tt.hen = null;
      const win = BrowserWindow.fromWebContents(wc);
      if (!win || win.isDestroyed() || !dangTreo.has(wc)) { return; }
      ghiLog('van treo, hoi nguoi dung | ' + chiSoTienTrinh());
      tt.huy = new AbortController();
      dialog.showMessageBox(win, {
        type: 'warning',
        title: 'AWord không phản hồi',
        message: 'Cửa sổ AWord đang không phản hồi.',
        detail: 'Khởi động lại là an toàn — nội dung chat và file đã được lưu tự động. Nếu đang chờ một tác vụ rất nặng thì có thể chờ thêm; cửa sổ trở lại bình thường thì hộp này tự đóng.',
        buttons: ['Khởi động lại AWord', 'Chờ thêm', 'Thoát AWord'],
        defaultId: 0, cancelId: 1, noLink: true,
        signal: tt.huy.signal
      }).then(kq => {
        tt.huy = null;
        if (!dangTreo.has(wc)) { return; } // cua so da hoi -> hop thoai bi huy, khong lam gi
        if (kq.response === 0) { ghiLog('nguoi dung chon: khoi dong lai'); app.relaunch(); app.exit(0); }
        else if (kq.response === 2) { ghiLog('nguoi dung chon: thoat'); app.exit(0); }
        else { ghiLog('nguoi dung chon: cho them'); tt.hen = setTimeout(() => hoi(wc, tt), 60000); }
      }).catch(() => { tt.huy = null; });
    };
    app.on('web-contents-created', (_e, wc) => {
      wc.on('unresponsive', () => {
        if (hoiKhiTreo.has(wc)) { return; }
        dangTreo.add(wc);
        ghiLog('unresponsive | ' + chiSoTienTrinh());
        const tt = { hen: null, huy: null };
        hoiKhiTreo.set(wc, tt);
        tt.hen = setTimeout(() => hoi(wc, tt), 15000);
      });
      wc.on('responsive', () => {
        dangTreo.delete(wc);
        const tt = hoiKhiTreo.get(wc);
        hoiKhiTreo.delete(wc);
        if (tt) {
          if (tt.hen) { clearTimeout(tt.hen); }
          if (tt.huy) { try { tt.huy.abort(); } catch (e) { /* bo qua */ } }
        }
        ghiLog('responsive tro lai');
      });
    });

    // 3) Bam X khi cua so DANG treo: Theia cho renderer xac nhan dong (khong bao gio
    // tra loi duoc) -> 3s sau van chua huy thi huy thang. Cua so binh thuong (khong
    // treo) giu nguyen luong hoi/xac nhan cua Theia.
    app.on('browser-window-created', (_e, win) => {
      win.on('close', () => {
        if (!win.webContents || !dangTreo.has(win.webContents)) { return; }
        setTimeout(() => {
          if (!win.isDestroyed()) { ghiLog('ep dong cua so treo (3s sau khi bam X)'); win.destroy(); }
        }, 3000);
      });
    });

    // 4) Khong bao gio treo ngam trong quy trinh thoat: qua han la thoat cung.
    // Hen gio tinh tu 'will-quit' (MOI cua so da dong xong), KHONG tu 'before-quit': luc before-quit
    // Theia con dang hoi "Luu thay doi?" — ep thoat luc do (vd tu cap nhat goi app.quit) mat bai chua luu.
    app.on('will-quit', () => {
      const t = setTimeout(() => {
        ghiLog('ep thoat: qua 7s sau will-quit process van song');
        try { app.exit(0); } catch (e) { process.exit(0); }
      }, 7000);
      if (t.unref) { t.unref(); }
    });
    // Dong het cua so thuong la sap thoat — NHUNG "Khoi dong lai" cua Theia (sau cap nhat Claude Code,
    // doi thiet lap...) cung dong cua so cu truoc roi moi mo cua so moi. Huy hen gio khi co cua so moi
    // va kiem lai so cua so luc het han, de khong giet chinh cua so vua khoi dong lai.
    let henGioDongHet = null;
    const huyHenGioDongHet = () => { if (henGioDongHet) { clearTimeout(henGioDongHet); henGioDongHet = null; } };
    app.on('browser-window-created', huyHenGioDongHet);
    app.on('window-all-closed', () => {
      huyHenGioDongHet();
      henGioDongHet = setTimeout(() => {
        henGioDongHet = null;
        if (BrowserWindow.getAllWindows().length > 0) { return; }
        ghiLog('ep thoat: qua 10s sau khi dong het cua so process van song');
        try { app.exit(0); } catch (e) { process.exit(0); }
      }, 10000);
      if (henGioDongHet.unref) { henGioDongHet.unref(); }
    });
  } catch (e) { console.error('[AWord] Khoi tao watchdog chong treo that bai:', e); }
})();
`;

let content = fs.readFileSync(target, 'utf8');
const idx = content.indexOf(marker);
if (idx >= 0) {
    content = content.slice(0, idx).replace(/\n+$/, '\n');
}
fs.writeFileSync(target, content + '\n' + snippet, 'utf8');
console.log('[inject-hang-watchdog] Đã tiêm watchdog chống treo (unresponsive + ép đóng + nới heap).');
