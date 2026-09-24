// Chạy tự động trước "npm run package" (npm "prepackage" hook).
// electron-builder không tự khai báo cho app đã đóng gói biết thư mục plugins
// (Claude Code + gói tiếng Việt) nằm ở đâu — script "start" dùng khi phát triển
// có cờ --plugins=local-dir:plugins nhưng cờ đó KHÔNG áp dụng cho electron-main.js
// đã đóng gói (chạy trực tiếp, không qua "theia start"). Patch này tiêm việc gán
// process.env.THEIA_DEFAULT_PLUGINS ngay đầu file, dùng process.resourcesPath
// (ổn định bất kể người dùng cài vào thư mục nào) để trỏ tới
// <thư mục cài>\resources\app\plugins — đúng nơi "extraResources" đã copy vào.
//
// THÊM (nút "Cập nhật Claude Code"): nối thêm MỘT thư mục local-dir thứ hai, ghi được,
// nằm trong userData của Electron — đây là nơi nút "Cập nhật Claude Code" (aword-chat)
// giải nén bản Claude Code mới hơn khi người dùng bấm cập nhật. Theia tự chọn bản có số
// hiệu CAO HƠN giữa 2 thư mục local-dir khi quét plugin lúc khởi động (cả hai đều vào
// PluginType.System nên so bằng semver, không có chuyện thư mục nào "thắng" cố định —
// xem PluginDeployer#findBestVersion), nên KHÔNG cần đụng tới thư mục cài đặt gốc.
// Đường dẫn userData được gán qua process.env.AWORD_CAP_NHAT_PLUGIN_DIR để backend của
// aword-chat đọc lại — dùng đúng MỘT nguồn sự thật (app.getPath('userData') thật của
// Electron), tránh tự suy luận lại đường dẫn ở nơi khác rồi lệch nhau.
//
// THÊM (AWord Pro cài SONG SONG AWord 2.x): hai bản phải tách phần "của ứng dụng", dùng chung phần "dữ liệu làm việc".
//   - userData của Electron: Theia mặc định lấy theo tên gói ("electron-app") → cả hai bản cùng %APPDATA%\electron-app
//     (bố cục, bộ nhớ đệm, thư mục cập nhật plugin lẫn nhau). Pro dùng %APPDATA%\AWord Pro — gán TRƯỚC khi Theia chạy.
//   - Cài đặt người dùng của Theia (THEIA_CONFIG_DIR, mặc định ~/.theia): hộp thoại DeepSeek ghi tùy chọn wrapper vào đây;
//     dùng chung thì bản 2.x cũng chạy Claude qua DeepSeek. Pro dùng ~/.aword-pro/theia; lần đầu chép sang cài đặt,
//     phím tắt và danh sách thư mục gần đây của ~/.theia để người dùng không phải thiết lập lại.
//   - DÙNG CHUNG (không đụng): Documents\AWord, ~/.claude (cấu hình Claude, MCP, skill), ~/.aword (vai, Kho tri thức, bộ nhớ).
const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'lib', 'backend', 'electron-main.js');
const marker = '/* AWORD_PLUGINS_ENV_PATCH */';

let content = fs.readFileSync(target, 'utf8');
if (content.includes(marker)) {
    console.log('[patch-plugins-env] electron-main.js đã được patch từ trước, bỏ qua.');
} else {
    const inject = `${marker}\n`
        + `(() => {\n`
        + `  const path = require('path');\n`
        + `  const fs = require('fs');\n`
        + `  const os = require('os');\n`
        + `  try {\n`
        + `    const { app } = require('electron');\n`
        + `    if (process.resourcesPath && !process.argv.some(a => a.startsWith('--electronUserData'))) {\n`
        + `      app.setPath('userData', path.join(app.getPath('appData'), 'AWord Pro'));\n`
        + `    }\n`
        + `  } catch (e) { /* không có 'electron' (backend tách rời) */ }\n`
        + `  if (process.resourcesPath && !process.env.THEIA_CONFIG_DIR) {\n`
        + `    const cauHinhPro = path.join(os.homedir(), '.aword-pro', 'theia');\n`
        + `    try {\n`
        + `      if (!fs.existsSync(path.join(cauHinhPro, 'settings.json'))) {\n`
        + `        fs.mkdirSync(cauHinhPro, { recursive: true });\n`
        + `        for (const ten of ['settings.json', 'keymaps.json', 'recentworkspace.json']) {\n`
        + `          const nguon = path.join(os.homedir(), '.theia', ten);\n`
        + `          if (fs.existsSync(nguon)) { fs.copyFileSync(nguon, path.join(cauHinhPro, ten)); }\n`
        + `        }\n`
        + `      }\n`
        + `    } catch (e) { /* không chép được — Theia tự tạo cài đặt mặc định */ }\n`
        + `    process.env.THEIA_CONFIG_DIR = cauHinhPro;\n`
        + `  }\n`
        + `  const thuMucBundle = path.join(process.resourcesPath || __dirname, 'app', 'plugins');\n`
        + `  let thuMucCapNhat;\n`
        + `  try { thuMucCapNhat = path.join(require('electron').app.getPath('userData'), 'cap-nhat-plugin'); }\n`
        + `  catch (e) { /* không có 'electron' (vd. đang chạy backend tách rời) -> bỏ qua nguồn thứ 2 */ }\n`
        + `  process.env.THEIA_DEFAULT_PLUGINS = thuMucCapNhat\n`
        + `    ? 'local-dir:' + thuMucBundle + ',local-dir:' + thuMucCapNhat\n`
        + `    : 'local-dir:' + thuMucBundle;\n`
        + `  if (thuMucCapNhat) { process.env.AWORD_CAP_NHAT_PLUGIN_DIR = thuMucCapNhat; }\n`
        // Bản Claude Code mới trong thư mục cập nhật chỉ được nạp khi BACKEND khởi động lại (Theia quét plugin
        // một lần lúc backend chạy), còn lệnh "Restart" của Theia chỉ mở lại CỬA SỔ. Backend aword-chat ghi tệp
        // đánh dấu sau khi cài xong bản mới -> lần Restart kế tiếp khởi động lại TOÀN BỘ ứng dụng. Listener này
        // đăng ký trước handler của Theia nên chạy trước; app.exit(0) kết thúc luôn, handler của Theia không kịp mở cửa sổ.
        + `  if (thuMucCapNhat) {\n`
        + `    try {\n`
        + `      const { app, ipcMain } = require('electron');\n`
        + `      const danhDau = path.join(path.dirname(thuMucCapNhat), 'aword-can-khoi-dong-lai');\n`
        + `      try { fs.unlinkSync(danhDau); } catch (e) { /* mở app mới là đã nạp bản mới */ }\n`
        + `      ipcMain.on('Restart', () => {\n`
        + `        if (!fs.existsSync(danhDau)) { return; }\n`
        + `        try { fs.unlinkSync(danhDau); } catch (e) { /* bỏ qua */ }\n`
        + `        app.relaunch();\n`
        + `        app.exit(0);\n`
        + `      });\n`
        + `    } catch (e) { /* không có 'electron' (backend tách rời) */ }\n`
        + `  }\n`
        + `})();\n`;
    fs.writeFileSync(target, inject + content, 'utf8');
    console.log('[patch-plugins-env] Đã patch electron-main.js: THEIA_DEFAULT_PLUGINS gồm plugins đóng sẵn + thư mục cập nhật cá nhân (AWORD_CAP_NHAT_PLUGIN_DIR).');
}
