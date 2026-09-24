// Đánh số phiên bản THEO THÔNG LỆ CHUNG (semver MAJOR.MINOR.PATCH, vd 2.0.3) mỗi lần
// build/phát hành — tự tăng PATCH so với số trong package.json. Thời điểm đóng gói được lưu
// RIÊNG ở trường "buildTimestamp" (YYYYMMDD.HHmm, giờ Việt Nam) trong CÙNG package.json —
// đi kèm vào bộ cài để luôn tra được bản nào dựng lúc nào.
//
// Chuyển đổi từ số kiểu cũ theo giờ (YYYYMMDD.H.M, major >= 10000): RESET về 2.0.0 — KHÔNG
// dùng 1.0.0 vì GitHub còn tag đời đầu v1.0.0/v1.0.3/v1.0.4. Bộ tự cập nhật so theo 3 thế hệ
// (1.0.x đời đầu < kiểu theo giờ < semver từ 2.0.0) — xem inject-auto-update.cjs.
// Muốn tăng MINOR/MAJOR (thay đổi lớn) thay vì PATCH: chỉ định số qua biến môi trường, vd
//   $env:AWORD_PHIEN_BAN = "2.1.0"; .\Phat_Hanh_AWord.ps1
// các lần sau bỏ biến đó đi là tự tăng tiếp 2.1.1, 2.1.2...
const fs = require('fs');
const path = require('path');

// Giờ Việt Nam cố định UTC+7 (không có giờ mùa hè) — giống set-version.cjs, chạy đâu cũng khớp.
const vn = new Date(Date.now() + 7 * 3600 * 1000);
const p2 = n => String(n).padStart(2, '0');
const buildTimestamp = `${vn.getUTCFullYear()}${p2(vn.getUTCMonth() + 1)}${p2(vn.getUTCDate())}.${p2(vn.getUTCHours())}${p2(vn.getUTCMinutes())}`;

const pkgPath = path.join(__dirname, '..', 'package.json');
let raw = fs.readFileSync(pkgPath, 'utf8');
const pkg = JSON.parse(raw);
if (typeof pkg.version !== 'string') {
    console.error('[stamp-version] Khong tim thay truong "version" trong package.json!');
    process.exit(1);
}

const chiDinh = String(process.env.AWORD_PHIEN_BAN || '').replace(/^v/i, '').trim();
if (chiDinh && !/^([2-9]|[1-9]\d{1,3})\.\d+\.\d+$/.test(chiDinh)) {
    console.error('[stamp-version] AWORD_PHIEN_BAN khong hop le (can semver tu 2.0.0, vd 2.1.0): ' + chiDinh);
    process.exit(1);
}
const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(pkg.version);
const major = m ? Number(m[1]) : 0;
const version = chiDinh || ((m && major >= 2 && major < 10000)
    ? `${major}.${m[2]}.${Number(m[3]) + 1}`
    : '2.0.0'); // số kiểu theo giờ / đời đầu 1.0.x / không đọc được -> mốc semver đầu tiên

// Chỉ thay giá trị, KHÔNG format lại cả file (tránh diff nhiễu).
raw = raw.replace(/("version":\s*")[^"]*(")/, `$1${version}$2`);
if (/"buildTimestamp":\s*"[^"]*"/.test(raw)) {
    raw = raw.replace(/("buildTimestamp":\s*")[^"]*(")/, `$1${buildTimestamp}$2`);
} else {
    raw = raw.replace(/("version":\s*"[^"]*",)/, `$1\n  "buildTimestamp": "${buildTimestamp}",`);
}
fs.writeFileSync(pkgPath, raw);

// Bản web (browser-app) mang CÙNG số phiên bản — Theia báo số này qua ApplicationServer (menu Cập nhật phiên bản mới).
const pkgWeb = path.join(__dirname, '..', '..', 'browser-app', 'package.json');
if (fs.existsSync(pkgWeb)) {
    const rawWeb = fs.readFileSync(pkgWeb, 'utf8');
    fs.writeFileSync(pkgWeb, rawWeb.replace(/("version":\s*")[^"]*(")/, `$1${version}$2`));
}
// Cửa sổ khởi động (splash) hiện đúng "AWord Pro <phiên bản>". Chỉ ghi vào stderr: stdout của script này
// là số phiên bản mà Phat_Hanh_AWord.ps1 đọc.
const splash = path.join(__dirname, '..', 'resources', 'splash', 'index.html');
if (fs.existsSync(splash)) {
    const rawSplash = fs.readFileSync(splash, 'utf8');
    const moi = rawSplash.replace(/(<span class="so-phien-ban">)[^<]*(<\/span>)/, `$1${version}$2`);
    if (moi === rawSplash && !rawSplash.includes(`<span class="so-phien-ban">${version}</span>`)) {
        console.error('[stamp-version] Khong tim thay cho ghi so phien ban trong splash/index.html');
    }
    fs.writeFileSync(splash, moi);
}
console.log(version);
