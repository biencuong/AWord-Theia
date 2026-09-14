// Biên dịch aword-claude-wrapper.exe (xem claude-wrapper/aword-claude-wrapper.cs) vào
// resources/aword-bin/ bằng csc.exe của .NET Framework 4.x — có sẵn trên Windows 10/11 và runner
// windows-latest, không cần cài thêm gì. Chạy trong prepackage; trên máy không phải Windows thì bỏ qua
// (macOS dùng wrapper dạng shell do backend AWord tự sinh lúc bật cấu hình).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

if (process.platform !== 'win32') {
    console.log('[build-claude-wrapper] Không phải Windows — bỏ qua.');
    process.exit(0);
}

const nguon = path.join(__dirname, 'claude-wrapper', 'aword-claude-wrapper.cs');
const thuMucRa = path.join(__dirname, '..', 'resources', 'aword-bin');
const tepRa = path.join(thuMucRa, 'aword-claude-wrapper.exe');
const windir = process.env.WINDIR || 'C:\\Windows';
const csc = [
    path.join(windir, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'),
    path.join(windir, 'Microsoft.NET', 'Framework', 'v4.0.30319', 'csc.exe'),
].find(p => fs.existsSync(p));

if (!csc) {
    console.error('[build-claude-wrapper] Không tìm thấy csc.exe của .NET Framework 4.x!');
    process.exit(1);
}

fs.mkdirSync(thuMucRa, { recursive: true });
execFileSync(csc, ['/nologo', '/optimize+', '/platform:anycpu', '/target:exe', `/out:${tepRa}`, nguon], { stdio: 'inherit' });
console.log(`[build-claude-wrapper] Đã biên dịch ${path.relative(path.join(__dirname, '..'), tepRa)} (${fs.statSync(tepRa).size} byte).`);
