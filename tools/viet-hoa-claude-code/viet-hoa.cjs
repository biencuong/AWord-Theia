// Việt hoá MỌI bản Claude Code (extension trong VS Code và AWord) đang cài trên máy, và GIỮ Việt hoá sau mỗi lần cập nhật.
//
// Vì sao cần: VS Code (và AWord) cập nhật Claude Code bằng cách cài bản mới vào THƯ MỤC MỚI, nên bản vá tay
// mất ngay. Công cụ này được Task Scheduler chạy ngầm lúc đăng nhập và mỗi giờ: tìm mọi bản đang có, áp bảng
// dịch, chỉ ghi khi có thay đổi. Bản vừa cập nhật có tiếng Việt từ lần tải lại cửa sổ kế tiếp.
//
// Bảng dịch: lấy bản mới nhất trên repo AWord (thêm bản dịch cho chuỗi mới là mọi máy nhận được, không cần cài
// lại gì), không mạng thì dùng bản lưu lần trước, cuối cùng là bản đi kèm công cụ.
//
// Hai lớp được vá:
//   1) package.json — tên lệnh (bảng lệnh), mô tả cài đặt, hướng dẫn làm quen.
//   2) webview/index.js — chữ trong KHUNG CHAT. Chỉ thay chuỗi đứng ngay sau thuộc tính hiển thị (children, label,
//      title, placeholder, description…), không đụng chuỗi logic. Luôn vá từ bản gốc lưu cạnh (index.js.goc-aword)
//      nên áp lại bao nhiêu lần cũng ra cùng kết quả; bản vá phải qua kiểm tra cú pháp mới được ghi.
//
// Chạy tay: node viet-hoa.cjs              (hoặc AWordPro.exe với biến ELECTRON_RUN_AS_NODE=1)
//           node viet-hoa.cjs --chi-xem    (chỉ liệt kê, không ghi)
//           node viet-hoa.cjs --khoi-phuc  (trả khung chat về tiếng Anh gốc)
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const https = require('https');

const URL_BANG_DICH = 'https://raw.githubusercontent.com/biencuong/AWord-Theia/main/aword-chat/src/common/viet-hoa-claude-code.json';
const KHUNG_DANH_SACH_PHIEN = 'claude-sessions-sidebar';
const DUOI_BAN_GOC = '.goc-aword';
const THU_MUC_DU_LIEU = path.join(os.homedir(), '.aword', 'viet-hoa-claude-code');
const TEP_BANG_LUU = path.join(THU_MUC_DU_LIEU, 'bang-dich.json');
const TEP_NHAT_KY = path.join(THU_MUC_DU_LIEU, 'nhat-ky.txt');
// Thuộc tính mang CHỮ HIỂN THỊ trong mã React đã nén của khung chat. Đứng trước phải là , { ( hoặc khoảng trắng
// để không khớp nhầm đuôi của tên khác (vd. "xlabel").
const RE_CHUOI_HIEN_THI = /(?<=[,{(\s])(children|placeholder|title|label|"aria-label"|description|text|tooltip|header|message|subtitle|hint|buttonText|confirmLabel|cancelLabel|emptyText):"([^"\\\n]{2,300})"/g;

// ---------- Lớp 1: package.json ----------
// Trả về true nếu pkg bị đổi. goKhung: chỉ AWord gỡ khung "danh sách phiên" (VS Code giữ nguyên tính năng này).
function apDung(pkg, bang, { goKhung = false } = {}) {
    const truoc = JSON.stringify(pkg);
    const c = pkg.contributes || {};
    if (goKhung) {
        for (const vung of Object.keys(c.viewsContainers || {})) {
            c.viewsContainers[vung] = c.viewsContainers[vung].filter(v => v.id !== KHUNG_DANH_SACH_PHIEN);
        }
        if (c.views && c.views[KHUNG_DANH_SACH_PHIEN]) { delete c.views[KHUNG_DANH_SACH_PHIEN]; }
    }
    const lenh = bang.lenh || {};
    const caiDat = bang.caiDat || {};
    const walkthrough = bang.walkthrough || {};
    const moTa = bang.moTa || {};
    if (pkg.description && moTa[pkg.description]) { pkg.description = moTa[pkg.description]; }
    for (const cmd of c.commands || []) {
        if (lenh[cmd.title]) { cmd.title = lenh[cmd.title]; }
    }
    const props = (c.configuration && c.configuration.properties) || {};
    for (const [khoa, vi] of Object.entries(caiDat)) {
        if (!props[khoa]) { continue; }
        if (props[khoa].description) { props[khoa].description = vi; } else if (props[khoa].markdownDescription) { props[khoa].markdownDescription = vi; }
    }
    for (const wt of c.walkthroughs || []) {
        if (walkthrough[wt.title]) { wt.title = walkthrough[wt.title]; }
        if (walkthrough[wt.description]) { wt.description = walkthrough[wt.description]; }
        for (const b of wt.steps || []) {
            if (walkthrough[b.title]) { b.title = walkthrough[b.title]; }
            if (walkthrough[b.description]) { b.description = walkthrough[b.description]; }
        }
    }
    if (JSON.stringify(pkg) !== truoc) { pkg._aword_vi = true; }
    return JSON.stringify(pkg) !== truoc;
}

// ---------- Lớp 2: khung chat (webview/index.js) ----------
// thuMucExt: thư mục chứa package.json của extension. Trả { trangThai, soChuoi }.
//   trangThai: 'khong-co-webview' | 'giu-nguyen' | 'da-va' | 'cu-phap-loi' (bản vá hỏng — KHÔNG ghi)
function vaWebview(thuMucExt, bangWebview, { chiXem = false, khoiPhuc = false } = {}) {
    const tep = path.join(thuMucExt, 'webview', 'index.js');
    if (!fs.existsSync(tep)) { return { trangThai: 'khong-co-webview', soChuoi: 0 }; }
    const tepGoc = tep + DUOI_BAN_GOC;
    const hienTai = fs.readFileSync(tep, 'utf8');
    const goc = fs.existsSync(tepGoc) ? fs.readFileSync(tepGoc, 'utf8') : hienTai;
    let soChuoi = 0;
    const moi = khoiPhuc ? goc : goc.replace(RE_CHUOI_HIEN_THI, (nguyen, thuocTinh, chu) => {
        const vi = bangWebview && bangWebview[chu];
        if (typeof vi !== 'string' || !vi || /["\\\n\r]/.test(vi)) { return nguyen; }
        soChuoi++;
        return `${thuocTinh}:"${vi}"`;
    });
    if (moi === hienTai) { return { trangThai: 'giu-nguyen', soChuoi }; }
    try {
        new vm.Script(moi, { filename: 'webview-index.js' });
    } catch {
        return { trangThai: 'cu-phap-loi', soChuoi };
    }
    if (chiXem) { return { trangThai: 'can-va', soChuoi }; }
    if (!fs.existsSync(tepGoc)) { fs.writeFileSync(tepGoc, hienTai, 'utf8'); }
    fs.writeFileSync(tep, moi, 'utf8');
    return { trangThai: 'da-va', soChuoi };
}

// ---------- Tìm các bản Claude Code trên máy ----------
function cacBanTrenMay() {
    const home = os.homedir();
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    const ds = [];
    const themThuMucCon = (goc, locTen, laAWord, tepCon) => {
        let ten = [];
        try { ten = fs.readdirSync(goc); } catch { return; }
        for (const t of ten) {
            if (!locTen(t)) { continue; }
            const tep = path.join(goc, t, ...tepCon);
            if (fs.existsSync(tep)) { ds.push({ tep, laAWord }); }
        }
    };
    // VS Code và các bản dựng từ VS Code: extension cài thẳng, package.json ở gốc thư mục
    for (const ide of ['.vscode', '.vscode-insiders', '.cursor', '.windsurf', '.vscode-oss']) {
        themThuMucCon(path.join(home, ide, 'extensions'), t => /^anthropic\.claude-code-/i.test(t), false, ['package.json']);
    }
    // AWord: plugin đóng sẵn (package.json trong extension/) + thư mục bản tự cập nhật
    const pf = process.env.ProgramFiles || 'C:\\Program Files';
    for (const goc of [
        path.join(local, 'Programs', 'AWordPro', 'resources', 'app', 'plugins'),
        path.join(local, 'Programs', 'AWord', 'resources', 'app', 'plugins'),
        path.join(pf, 'AWordPro', 'resources', 'app', 'plugins'),
        path.join(pf, 'AWord', 'resources', 'app', 'plugins'),
        path.join(appData, 'AWord Pro', 'cap-nhat-plugin'),
        path.join(appData, 'electron-app', 'cap-nhat-plugin')
    ]) {
        themThuMucCon(goc, t => /^Anthropic\.claude-code(-|$)/.test(t), true, ['extension', 'package.json']);
    }
    return ds;
}

// ---------- Bảng dịch: mạng -> bản lưu -> bản đi kèm ----------
function taiVanBan(url, chuyen = 0) {
    return new Promise((ok, loi) => {
        const req = https.get(url, { headers: { 'User-Agent': 'AWord-VietHoa' } }, res => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && chuyen < 5) {
                res.resume(); ok(taiVanBan(res.headers.location, chuyen + 1)); return;
            }
            if (res.statusCode !== 200) { res.resume(); loi(new Error('HTTP ' + res.statusCode)); return; }
            let d = ''; res.setEncoding('utf8'); res.on('data', c => { d += c; }); res.on('end', () => ok(d));
        });
        req.on('error', loi);
        req.setTimeout(15000, () => req.destroy(new Error('Hết thời gian chờ')));
    });
}

async function layBangDich() {
    try {
        const bang = JSON.parse(await taiVanBan(URL_BANG_DICH));
        if (bang && bang.lenh) {
            fs.mkdirSync(THU_MUC_DU_LIEU, { recursive: true });
            fs.writeFileSync(TEP_BANG_LUU, JSON.stringify(bang, null, 2), 'utf8');
            return { bang, nguon: 'repo AWord (mới nhất)' };
        }
    } catch { /* không mạng — dùng bản lưu */ }
    for (const [tep, nguon] of [[TEP_BANG_LUU, 'bản lưu lần trước'], [path.join(__dirname, 'bang-dich.json'), 'bản đi kèm công cụ']]) {
        try { return { bang: JSON.parse(fs.readFileSync(tep, 'utf8')), nguon }; } catch { /* thử nguồn sau */ }
    }
    throw new Error('Không có bảng dịch (không mạng và chưa có bản lưu).');
}

// VS Code lưu đệm khai báo extension; xoá đệm (tự tạo lại) để tên lệnh mới hiện ra sau khi tải lại cửa sổ.
function xoaDemVSCode() {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    let n = 0;
    for (const sp of ['Code', 'Code - Insiders', 'Cursor', 'Windsurf']) {
        const goc = path.join(appData, sp, 'CachedProfilesData');
        let hoSo = [];
        try { hoSo = fs.readdirSync(goc); } catch { continue; }
        for (const h of hoSo) {
            try { fs.unlinkSync(path.join(goc, h, 'extensions.user.cache')); n++; } catch { /* không có */ }
        }
    }
    return n;
}

async function main() {
    const chiXem = process.argv.includes('--chi-xem');
    const khoiPhuc = process.argv.includes('--khoi-phuc');
    const dong = [];
    const ghi = s => { dong.push(s); console.log(s); };
    ghi(`[${new Date().toLocaleString('vi-VN')}] Việt hoá Claude Code${chiXem ? ' (chỉ xem)' : ''}${khoiPhuc ? ' (KHÔI PHỤC khung chat tiếng Anh)' : ''}`);
    const { bang, nguon } = await layBangDich();
    ghi(`Bảng dịch: ${nguon} — ${Object.keys(bang.lenh || {}).length} lệnh, ${Object.keys(bang.caiDat || {}).length} cài đặt, ${Object.keys(bang.webview || {}).length} chuỗi khung chat`);
    let doiVSCode = false;
    for (const b of cacBanTrenMay()) {
        let pkg;
        try { pkg = JSON.parse(fs.readFileSync(b.tep, 'utf8')); } catch { ghi(`  bỏ qua (không đọc được): ${b.tep}`); continue; }
        const thuMucExt = path.dirname(b.tep);
        const loai = b.laAWord ? 'AWord  ' : 'VS Code';
        try {
            const doiPkg = !khoiPhuc && apDung(pkg, bang, { goKhung: b.laAWord });
            if (doiPkg && !chiXem) { fs.writeFileSync(b.tep, JSON.stringify(pkg, null, 2), 'utf8'); }
            const w = vaWebview(thuMucExt, bang.webview, { chiXem, khoiPhuc });
            if ((doiPkg || w.trangThai === 'da-va') && !chiXem && !b.laAWord) { doiVSCode = true; }
            const moTaPkg = doiPkg ? (chiXem ? 'khai báo: CẦN vá' : 'khai báo: vừa vá') : 'khai báo: ổn';
            const moTaW = {
                'khong-co-webview': 'khung chat: không có',
                'giu-nguyen': `khung chat: ổn (${w.soChuoi} chuỗi)`,
                'can-va': `khung chat: CẦN vá (${w.soChuoi} chuỗi)`,
                'da-va': `khung chat: ${khoiPhuc ? 'đã trả về tiếng Anh' : `vừa vá ${w.soChuoi} chuỗi`}`,
                'cu-phap-loi': 'khung chat: BỎ QUA — bản vá không qua kiểm tra cú pháp'
            }[w.trangThai];
            ghi(`  ${String(pkg.version).padEnd(9)} ${loai} ${moTaPkg}; ${moTaW} — ${thuMucExt}`);
        } catch (e) {
            ghi(`  ${String(pkg.version).padEnd(9)} ${loai} KHÔNG GHI ĐƯỢC (${e.code || e.message}) — ${thuMucExt}`);
        }
    }
    if (doiVSCode) {
        const n = xoaDemVSCode();
        ghi(`Đã làm mới ${n} tệp đệm của VS Code. Tải lại cửa sổ VS Code (Ctrl+Shift+P → Developer: Reload Window) để thấy tiếng Việt.`);
    }
    try {
        fs.mkdirSync(THU_MUC_DU_LIEU, { recursive: true });
        fs.writeFileSync(TEP_NHAT_KY, dong.join(os.EOL) + os.EOL, 'utf8');
    } catch { /* bỏ qua */ }
}

module.exports = { apDung, vaWebview, KHUNG_DANH_SACH_PHIEN, DUOI_BAN_GOC };

if (require.main === module) {
    main().catch(e => { console.error('LỖI:', e.message); process.exitCode = 1; });
}
