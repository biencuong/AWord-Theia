// Tiêm cơ chế "lần khởi động ĐẦU TIÊN tự mở script cài công cụ đọc tài liệu"
// vào lib/backend/electron-main.js (đóng gói cùng app, giống inject-auto-update).
// - Chỉ chạy khi CHƯA có marker %USERPROFILE%\.claude\aword-cong-cu.ok
//   (script Cai_Dat_Cong_Cu.cmd tự ghi marker khi hoàn tất — đúng chính sách
//   "chỉ cài nếu thiếu": các lần mở sau không hiện gì nữa).
// - Mở cửa sổ console RIÊNG, KHÔNG chặn app; script tự đóng sau khi xong.
// Idempotent qua marker AWORD_FIRST_RUN_TOOLS; thay khối cũ nếu tiêm lại.
const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'lib', 'backend', 'electron-main.js');
const marker = '/* AWORD_FIRST_RUN_TOOLS */';

const snippet = `
${marker}
(() => {
  try {
    const { app } = require('electron');
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const { spawn } = require('child_process');
    app.whenReady().then(() => {
      setTimeout(() => {
        try {
          const claudeDir = path.join(os.homedir(), '.claude');
          const daXong = path.join(claudeDir, 'aword-cong-cu.ok');   // script tự ghi khi cài xong
          const daThu = path.join(claudeDir, 'aword-cong-cu.thu');   // JS ghi khi đã spawn 1 lần
          if (fs.existsSync(daXong)) { return; }
          // Chỉ tự mở MỘT LẦN. Nếu lần trước không hoàn tất (không có .ok) thì KHÔNG tự
          // bật lại mỗi lần khởi động (tránh lặp vô hạn khi máy lỗi) — người dùng chạy
          // shortcut Start Menu "Cài công cụ tài liệu (AWord)" để thử lại thủ công.
          if (fs.existsSync(daThu)) { return; }
          const script = path.join(path.dirname(process.execPath), 'Cai_Dat_Cong_Cu.cmd');
          if (!fs.existsSync(script)) { return; }
          try { fs.mkdirSync(claudeDir, { recursive: true }); fs.writeFileSync(daThu, new Date().toISOString()); } catch { /* bỏ qua */ }
          // Mở cửa sổ console THẬT (nhìn thấy tiến trình): app GUI -> "start" cấp console
          // mới cho tiến trình con. Đường dẫn cài mặc định có dấu cách -> để Node tự bọc nháy.
          spawn('cmd.exe', ['/c', 'start', 'Cai cong cu AWord', 'cmd', '/c', script],
                { detached: true, stdio: 'ignore' }).unref();
        } catch (e) { console.error('[AWord] Khong mo duoc script cai cong cu:', e); }
      }, 8000);
    });
  } catch (e) { console.error('[AWord] Khoi tao first-run tools that bai:', e); }
})();
`;

let content = fs.readFileSync(target, 'utf8');
const idx = content.indexOf(marker);
if (idx >= 0) {
    content = content.slice(0, idx).replace(/\n+$/, '\n');
}
fs.writeFileSync(target, content + '\n' + snippet, 'utf8');
console.log('[inject-first-run-tools] Đã tiêm cơ chế cài công cụ ở lần khởi động đầu.');
