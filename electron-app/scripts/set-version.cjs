// Ghi ma phien ban CHI DINH (vi du tu tag CI "v20260727.9.30") vao electron-app/package.json.
// Khac stamp-version.cjs (tu danh ma theo thoi gian), script nay nhan version qua doi so —
// dung cho GitHub Actions khi build tu tag: phien ban phai dung bang tag, khong lay gio build.
// Dung: node scripts/set-version.cjs v20260727.9.30   (chap nhan co/khong tien to "v")
const fs = require('fs');
const path = require('path');

const version = String(process.argv[2] || '').replace(/^v/, '').trim();
if (!/^\d+\.\d+\.\d+$/.test(version)) {
    console.error('[set-version] Phien ban khong hop le (can dang X.Y.Z): ' + (process.argv[2] || '(trong)'));
    process.exit(1);
}

const pkgPath = path.join(__dirname, '..', 'package.json');
let raw = fs.readFileSync(pkgPath, 'utf8');
if (!/"version":\s*"[^"]*"/.test(raw)) {
    console.error('[set-version] Khong tim thay truong "version" trong package.json!');
    process.exit(1);
}
// Chi thay gia tri version, KHONG format lai ca file (tranh diff nhieu) — giong stamp-version.cjs.
raw = raw.replace(/("version":\s*")[^"]*(")/, `$1${version}$2`);
fs.writeFileSync(pkgPath, raw);
console.log(version);
