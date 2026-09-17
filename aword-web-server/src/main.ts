// Khởi động máy chủ AWord Web đa người dùng: cấu hình → CSDL → Cổng AI → bộ điều phối phiên → cổng truy cập → HTTP.
// Định tuyến theo tên máy: xem may-chu.ts.
//
// Dòng lệnh:
//   node src/main.ts                                                 chạy máy chủ
//   node src/main.ts tao-quan-tri <email|số điện thoại> "<Họ tên>"   tạo quản trị hệ thống đầu tiên (in mật khẩu tạm)
import * as path from 'node:path';
import { docCauHinh } from './cau-hinh.ts';
import { donNhatKyCu, moCsdl } from './csdl/csdl.ts';
import { napBangGiaMacDinh, taoCongAi } from './cong-ai/cong-ai.ts';
import { taoCongTruyCap, taoQuanTriDauTien } from './cong-truy-cap/cong-truy-cap.ts';
import { taoDieuPhoi } from './dieu-phoi/dieu-phoi.ts';
import { taoMayChu } from './may-chu.ts';

const cauHinh = docCauHinh();
const db = moCsdl(path.join(cauHinh.thuMucDuLieu, 'aword-web.db'));

if (process.argv[2] === 'tao-quan-tri') {
    const [dinhDanh, hoTen] = process.argv.slice(3);
    if (!dinhDanh || !hoTen) {
        console.error('Cách dùng: node src/main.ts tao-quan-tri <email|số điện thoại> "<Họ tên>"');
        process.exit(1);
    }
    try {
        const matKhauTam = await taoQuanTriDauTien(db, dinhDanh, hoTen);
        console.log(`Đã tạo quản trị hệ thống ${dinhDanh}. Mật khẩu tạm (đổi ngay ở lần đăng nhập đầu): ${matKhauTam}`);
        process.exit(0);
    } catch (e) {
        console.error(`Không tạo được quản trị: ${e instanceof Error ? e.message : e}`);
        process.exit(1);
    }
}

napBangGiaMacDinh(db);
const congAi = taoCongAi({ db, cauHinh });
const dieuPhoi = taoDieuPhoi({ db, cauHinh, congAi });
const congTruyCap = taoCongTruyCap({ db, cauHinh, dieuPhoi, congAi });
const mayChu = taoMayChu({ cauHinh, congAi, congTruyCap, dieuPhoi });

// Phiên rảnh quá cauHinh.phutNguKhiRanh thì cho ngủ (dừng container, giữ dữ liệu).
const henNgu = setInterval(() => { dieuPhoi.quetNgu().catch(e => console.error('[aword-web] quét phiên rảnh', e)); }, 60_000);
henNgu.unref();

// Dọn nhật ký cũ. Một lần lúc khởi động (bắt kịp phần tồn đọng sau nhiều ngày chạy) rồi mỗi ngày một lần.
// Chạy ở đây chứ không trong quetNgu: quetNgu là vòng 60 giây của nghiệp vụ phiên, không nên gánh việc dọn dẹp.
function donNhatKy(): void {
    try {
        const n = donNhatKyCu(db, cauHinh.giuNhatKyNgay);
        if (n > 0) { console.log(`[aword-web] dọn ${n} dòng nhật ký cũ hơn ${cauHinh.giuNhatKyNgay} ngày`); }
    } catch (e) {
        console.error('[aword-web] dọn nhật ký', e);
    }
}
donNhatKy();
const henDon = setInterval(donNhatKy, 24 * 3600 * 1000);
henDon.unref();

let dangTat = false;
async function tat(tinHieu: string): Promise<void> {
    if (dangTat) { return; }
    dangTat = true;
    console.log(`[aword-web] Nhận ${tinHieu} — dừng các phiên và tắt máy chủ...`);
    clearInterval(henNgu);
    clearInterval(henDon);
    mayChu.close();
    await dieuPhoi.dungTatCa().catch(e => console.error('[aword-web] dừng phiên', e));
    db.close();
    process.exit(0);
}
process.on('SIGINT', () => { void tat('SIGINT'); });
process.on('SIGTERM', () => { void tat('SIGTERM'); });

mayChu.listen(cauHinh.cong, cauHinh.diaChiNghe, () => {
    const giao = cauHinh.https ? 'https' : 'http';
    const c = cauHinh.https ? '' : `:${cauHinh.cong}`;
    console.log(`[aword-web] Cổng: ${giao}://${cauHinh.tenMien}${c}/  ·  Phiên AWord: ${giao}://${cauHinh.tenMienUngDung}${c}/`);
    console.log(`[aword-web] Nghe ${cauHinh.diaChiNghe}:${cauHinh.cong} · trình điều phối: ${cauHinh.trinhDieuPhoi} · dữ liệu: ${cauHinh.thuMucDuLieu}`);
    for (const [ncc, khoa] of Object.entries(cauHinh.khoaAi)) {
        if (!khoa) { console.log(`[aword-web] Chưa có khóa AI ${ncc} (AWORD_KHOA_${ncc.toUpperCase()}) — mô hình của ${ncc} sẽ báo lỗi cấu hình.`); }
    }
});
