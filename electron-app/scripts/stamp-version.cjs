// Đánh mã phiên bản theo THỜI GIAN đóng gói, tự động mỗi lần build/phát hành.
// Ghi vào electron-app/package.json trước khi bundle+package để version bám nhất quán
// từ giao diện (Giới thiệu/Cập nhật) tới tên file cài và tag GitHub.
//
// Định dạng SEMVER (bắt buộc cho electron-builder, và so sánh được để tự cập nhật):
//   YYYYMMDD.H.M   ví dụ 20260716.18.30  (không số 0 thừa - đúng chuẩn semver)
// Giao diện HIỂN THỊ lại thành: 2026/07/16 18:30 (hàm dinhDangPhienBan trong aword-menu).
// So sánh phiên bản: major=YYYYMMDD > minor=giờ > patch=phút -> luôn tăng theo thời gian,
// và luôn LỚN HƠN các bản cũ dạng 1.0.x (1 < 2026...) nên máy cũ vẫn nhận cập nhật.
const fs = require('fs');
const path = require('path');

const now = new Date();
const p2 = n => String(n).padStart(2, '0');
const ngay = `${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}`;
const version = `${ngay}.${now.getHours()}.${now.getMinutes()}`;

const pkgPath = path.join(__dirname, '..', 'package.json');
let raw = fs.readFileSync(pkgPath, 'utf8');
if (!/"version":\s*"[^"]*"/.test(raw)) {
    console.error('[stamp-version] Khong tim thay truong "version" trong package.json!');
    process.exit(1);
}
// Chỉ thay giá trị version, KHÔNG format lại cả file (tránh diff nhiễu).
raw = raw.replace(/("version":\s*")[^"]*(")/, `$1${version}$2`);
fs.writeFileSync(pkgPath, raw);
console.log(version);
