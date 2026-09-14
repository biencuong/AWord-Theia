// Ghi ma phien ban CHI DINH (vi du tu tag CI "v2.0.3") vao electron-app/package.json.
// Khac stamp-version.cjs (tu danh so), script nay nhan version qua doi so — dung cho GitHub
// Actions khi build tu tag: phien ban phai dung bang tag. Kem ghi "buildTimestamp" (thoi diem
// dong goi, gio Viet Nam) — cung truong ma stamp-version.cjs ghi khi phat hanh local.
// Dung: node scripts/set-version.cjs v2.0.3   (chap nhan co/khong tien to "v")
const fs = require('fs');
const path = require('path');

const version = String(process.argv[2] || '').replace(/^v/, '').trim();
if (!/^\d+\.\d+\.\d+$/.test(version)) {
    console.error('[set-version] Phien ban khong hop le (can dang X.Y.Z): ' + (process.argv[2] || '(trong)'));
    process.exit(1);
}

// Gio Viet Nam co dinh UTC+7 (khong co gio mua he) — runner CI chay UTC.
const vn = new Date(Date.now() + 7 * 3600 * 1000);
const p2 = n => String(n).padStart(2, '0');
const buildTimestamp = `${vn.getUTCFullYear()}${p2(vn.getUTCMonth() + 1)}${p2(vn.getUTCDate())}.${p2(vn.getUTCHours())}${p2(vn.getUTCMinutes())}`;

const pkgPath = path.join(__dirname, '..', 'package.json');
let raw = fs.readFileSync(pkgPath, 'utf8');
if (!/"version":\s*"[^"]*"/.test(raw)) {
    console.error('[set-version] Khong tim thay truong "version" trong package.json!');
    process.exit(1);
}
// Chi thay gia tri, KHONG format lai ca file (tranh diff nhieu) — giong stamp-version.cjs.
raw = raw.replace(/("version":\s*")[^"]*(")/, `$1${version}$2`);
if (/"buildTimestamp":\s*"[^"]*"/.test(raw)) {
    raw = raw.replace(/("buildTimestamp":\s*")[^"]*(")/, `$1${buildTimestamp}$2`);
} else {
    raw = raw.replace(/("version":\s*"[^"]*",)/, `$1\n  "buildTimestamp": "${buildTimestamp}",`);
}
fs.writeFileSync(pkgPath, raw);
console.log(version);
