// Việt hóa phần giao diện KHAI BÁO của extension Claude Code (Anthropic):
// tiêu đề lệnh, mô tả cài đặt, walkthrough trong package.json của plugin đã tải về.
// Extension này KHÔNG dùng cơ chế %key%/package.nls.json (chuỗi viết cứng),
// nên cách duy nhất là vá trực tiếp bản plugin được đóng gói cùng AWord.
// Lưu ý: nội dung BÊN TRONG khung chat (webview do Claude Code CLI dựng) không
// vá được từ ngoài — phần đó giữ nguyên theo sản phẩm gốc của Anthropic.
// Idempotent: đánh dấu bằng trường "_aword_vi" trong package.json.
const fs = require('fs');
const path = require('path');

// Bảng dịch dùng CHUNG với bản Claude Code AWord tự tải về khi cập nhật (aword-chat/src/node/
// cap-nhat-claude-code-server-impl.ts) — một nguồn duy nhất để hai đường Việt hoá không lệch nhau.
const BANG_DICH = require('../aword-chat/src/common/viet-hoa-claude-code.json');
const DICH_LENH = BANG_DICH.lenh;
const DICH_CAI_DAT = BANG_DICH.caiDat;
const DICH_WALKTHROUGH = BANG_DICH.walkthrough;
const DICH_MO_TA = BANG_DICH.moTa;

// Gỡ khung "danh sách phiên" (view container claude-sessions-sidebar trên thanh hoạt động): AWord chỉ để Claude Code ở
// thanh bên phụ. Trước đây khung bị đóng ngay khi Theia dựng nó, nhưng extension đã kịp resolve webview → nhật ký đầy lỗi
// "No webview view registered for handle" / "Unknown Webview" ($show, $setBadge, $setOptions, $setHtml). Gỡ khỏi khai
// báo thì khung không bao giờ được tạo; extension vẫn đăng ký provider nhưng không có view nào để resolve (vô hại).
// Bản tải qua "Cập nhật Claude Code" được gỡ tương tự trong cap-nhat-claude-code-server-impl.ts.
// Dùng CHUNG hàm vá với công cụ Việt hoá trên máy (tools/viet-hoa-claude-code) — một cách vá cho mọi nơi.
const { apDung, vaWebview } = require('../tools/viet-hoa-claude-code/viet-hoa.cjs');

function patchPluginDir(pluginRoot) {
    const pkgPath = path.join(pluginRoot, 'extension', 'package.json');
    if (!fs.existsSync(pkgPath)) return false;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (apDung(pkg, BANG_DICH, { goKhung: true })) {
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
        console.log(`[localize-claude-code-vi] Đã vá khai báo: ${pkgPath}`);
    } else {
        console.log(`[localize-claude-code-vi] Khai báo đã Việt hoá sẵn: ${pkgPath}`);
    }
    const w = vaWebview(path.join(pluginRoot, 'extension'), BANG_DICH.webview);
    if (w.trangThai === 'cu-phap-loi') {
        console.error('[localize-claude-code-vi] Bản vá khung chat KHÔNG qua kiểm tra cú pháp — giữ nguyên tiếng Anh. Rà lại bảng webview!');
    } else {
        console.log(`[localize-claude-code-vi] Khung chat: ${w.trangThai} (${w.soChuoi} chuỗi tiếng Việt)`);
    }
    return true;
}

const root = path.join(__dirname, '..');
let patched = 0;
for (const app of ['electron-app', 'browser-app']) {
    const pluginRoot = path.join(root, app, 'plugins', 'Anthropic.claude-code');
    if (patchPluginDir(pluginRoot)) patched++;
}
if (patched === 0) {
    console.error('[localize-claude-code-vi] KHÔNG tìm thấy plugin Anthropic.claude-code nào để vá!');
    process.exit(1);
}
