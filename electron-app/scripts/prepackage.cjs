// Chạy toàn bộ các bước chuẩn bị trước khi electron-builder đóng gói:
//   1. Sinh lại bản dịch tiếng Việt (gen-i18n-vi) + đồng bộ vào plugins/ (sync-i18n-vi)
//   2. Việt hóa package.json của plugin Claude Code (localize-claude-code-vi)
//   3. Vá electron-main.js để app đóng gói tìm thấy thư mục plugins (patch-plugins-env)
//   4. Sinh installer.nsh từ danh sách skill thực tế (gen-installer-nsh)
const { execFileSync } = require('child_process');
const path = require('path');

const appDir = path.join(__dirname, '..');
const rootDir = path.join(appDir, '..');
const steps = [
    path.join(__dirname, 'fix-cmd-crlf.cjs'),
    path.join(rootDir, 'scripts', 'gen-i18n-vi.mjs'),
    path.join(rootDir, 'scripts', 'gen-i18n-vi-theia.mjs'),
    path.join(rootDir, 'scripts', 'sync-i18n-vi.mjs'),
    path.join(rootDir, 'scripts', 'localize-claude-code-vi.cjs'),
    path.join(__dirname, 'lazy-office-plugin.cjs'),
    path.join(__dirname, 'patch-plugins-env.cjs'),
    // Thứ tự 2 script inject cố định (cả hai đều cắt từ marker tới cuối file):
    // first-run-tools TRƯỚC, auto-update SAU — đổi chỗ sẽ xóa khối của nhau.
    path.join(__dirname, 'inject-first-run-tools.cjs'),
    path.join(__dirname, 'inject-auto-update.cjs'),
    path.join(__dirname, 'gen-installer-nsh.cjs'),
];

for (const script of steps) {
    execFileSync(process.execPath, [script], { stdio: 'inherit' });
}
console.log('[prepackage] Hoàn tất mọi bước chuẩn bị.');
