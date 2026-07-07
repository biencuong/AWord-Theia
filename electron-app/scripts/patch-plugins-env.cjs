// Chạy tự động trước "npm run package" (npm "prepackage" hook).
// electron-builder không tự khai báo cho app đã đóng gói biết thư mục plugins
// (Claude Code + gói tiếng Việt) nằm ở đâu — script "start" dùng khi phát triển
// có cờ --plugins=local-dir:plugins nhưng cờ đó KHÔNG áp dụng cho electron-main.js
// đã đóng gói (chạy trực tiếp, không qua "theia start"). Patch này tiêm việc gán
// process.env.THEIA_DEFAULT_PLUGINS ngay đầu file, dùng process.resourcesPath
// (ổn định bất kể người dùng cài vào thư mục nào) để trỏ tới
// <thư mục cài>\resources\app\plugins — đúng nơi "extraResources" đã copy vào.
const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'lib', 'backend', 'electron-main.js');
const marker = '/* AWORD_PLUGINS_ENV_PATCH */';

let content = fs.readFileSync(target, 'utf8');
if (content.includes(marker)) {
    console.log('[patch-plugins-env] electron-main.js đã được patch từ trước, bỏ qua.');
} else {
    const inject = `${marker}\nprocess.env.THEIA_DEFAULT_PLUGINS = 'local-dir:' + require('path').join(process.resourcesPath || __dirname, 'app', 'plugins');\n`;
    fs.writeFileSync(target, inject + content, 'utf8');
    console.log('[patch-plugins-env] Đã patch electron-main.js để trỏ THEIA_DEFAULT_PLUGINS tới resourcesPath/app/plugins.');
}
