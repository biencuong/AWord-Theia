// Plugin cweijan.vscode-office (39MB) khai báo activationEvents: ["onStartupFinished"]
// nên bị nạp TOÀN BỘ ở mỗi lần khởi động dù người dùng chưa mở tài liệu nào — làm chậm
// khởi động thấy rõ. AWord chỉ cần nó khi mở docx/xlsx/pdf..., nên vá lại thành kích hoạt
// LƯỜI: suy ra danh sách sự kiện từ chính phần contributes của plugin (customEditors,
// commands, languages) — mở tài liệu hoặc gọi lệnh mới nạp extension.
// Idempotent qua marker _aword_lazy; chạy lại sau khi tải lại plugin vẫn đúng.
const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '..', 'plugins', 'cweijan.vscode-office', 'extension', 'package.json');
if (!fs.existsSync(pkgPath)) {
    console.log('[lazy-office] Không thấy plugin cweijan.vscode-office — bỏ qua.');
    process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
if (pkg._aword_lazy) {
    console.log('[lazy-office] Đã vá từ trước — bỏ qua.');
    process.exit(0);
}

const c = pkg.contributes || {};
const events = new Set();
for (const ed of c.customEditors || []) {
    if (ed.viewType) { events.add(`onCustomEditor:${ed.viewType}`); }
}
for (const cmd of c.commands || []) {
    if (cmd.command) { events.add(`onCommand:${cmd.command}`); }
}
for (const lang of c.languages || []) {
    if (lang.id) { events.add(`onLanguage:${lang.id}`); }
}

if (events.size === 0) {
    console.error('[lazy-office] Không suy ra được sự kiện kích hoạt nào — giữ nguyên để an toàn.');
    process.exit(0);
}

pkg._aword_lazy = true;
pkg._aword_activation_goc = pkg.activationEvents;
pkg.activationEvents = [...events].sort();
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
console.log(`[lazy-office] Đã chuyển sang kích hoạt lười với ${events.size} sự kiện (customEditors/commands/languages).`);
