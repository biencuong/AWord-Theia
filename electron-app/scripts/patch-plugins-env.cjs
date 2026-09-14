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
        + `  const thuMucBundle = path.join(process.resourcesPath || __dirname, 'app', 'plugins');\n`
        + `  let thuMucCapNhat;\n`
        + `  try { thuMucCapNhat = path.join(require('electron').app.getPath('userData'), 'cap-nhat-plugin'); }\n`
        + `  catch (e) { /* không có 'electron' (vd. đang chạy backend tách rời) -> bỏ qua nguồn thứ 2 */ }\n`
        + `  process.env.THEIA_DEFAULT_PLUGINS = thuMucCapNhat\n`
        + `    ? 'local-dir:' + thuMucBundle + ',local-dir:' + thuMucCapNhat\n`
        + `    : 'local-dir:' + thuMucBundle;\n`
        + `  if (thuMucCapNhat) { process.env.AWORD_CAP_NHAT_PLUGIN_DIR = thuMucCapNhat; }\n`
        + `})();\n`;
    fs.writeFileSync(target, inject + content, 'utf8');
    console.log('[patch-plugins-env] Đã patch electron-main.js: THEIA_DEFAULT_PLUGINS gồm plugins đóng sẵn + thư mục cập nhật cá nhân (AWORD_CAP_NHAT_PLUGIN_DIR).');
}
