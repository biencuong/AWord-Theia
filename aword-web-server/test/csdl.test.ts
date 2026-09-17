import { test } from 'node:test';
import assert from 'node:assert/strict';
import { donNhatKyCu, ghiNhatKy, giaoDich, moCsdl, thangViet } from '../src/csdl/csdl.ts';

test('tạo lược đồ, khóa ngoại và ràng buộc hoạt động', () => {
    const db = moCsdl(':memory:');
    assert.equal((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version, 3);
    const bang = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as Array<{ name: string }>).map(r => r.name);
    for (const t of ['bang_gia', 'don_vi', 'nhat_ky', 'phien_dang_nhap', 'phien_lam_viec', 'su_dung_ai', 'tai_khoan', 'token_ai']) {
        assert.ok(bang.includes(t), `thiếu bảng ${t}`);
    }
    const bay = Date.now();
    db.prepare('INSERT INTO tai_khoan (ten_dang_nhap, ho_ten, mat_khau_bam, tao_luc, cap_nhat_luc) VALUES (?,?,?,?,?)')
        .run('NguyenVanA', 'Nguyễn Văn A', 'scrypt$x', bay, bay);
    // tên đăng nhập không phân biệt hoa thường
    assert.throws(() => db.prepare('INSERT INTO tai_khoan (ten_dang_nhap, ho_ten, mat_khau_bam, tao_luc, cap_nhat_luc) VALUES (?,?,?,?,?)')
        .run('nguyenvana', 'Trùng', 'scrypt$x', bay, bay));
    assert.throws(() => db.prepare("UPDATE tai_khoan SET vai_tro = 'vua' WHERE id = 1").run());
    assert.throws(() => db.prepare('INSERT INTO phien_dang_nhap (token_bam, tai_khoan_id, tao_luc, het_han, hoat_dong_cuoi) VALUES (?,?,?,?,?)')
        .run('t', 999, bay, bay, bay));
});

test('giao dịch hoàn tác khi lỗi', () => {
    const db = moCsdl(':memory:');
    assert.throws(() => giaoDich(db, () => {
        db.prepare("INSERT INTO don_vi (ma, ten, tao_luc) VALUES ('SGD', 'Sở GD&ĐT', 1)").run();
        throw new Error('lỗi giữa chừng');
    }));
    assert.equal((db.prepare('SELECT COUNT(*) AS n FROM don_vi').get() as { n: number }).n, 0);
});

test('tháng theo giờ Việt Nam và ghi nhật ký', () => {
    // 31/8/2026 18:30 UTC = 1/9/2026 01:30 giờ Việt Nam
    assert.equal(thangViet(Date.UTC(2026, 7, 31, 18, 30)), '2026-09');
    assert.equal(thangViet(Date.UTC(2026, 7, 31, 16, 0)), '2026-08');
    const db = moCsdl(':memory:');
    ghiNhatKy(db, { hanhDong: 'tao_tai_khoan', doiTuong: 'tai_khoan:1', chiTiet: { ho_ten: 'Nguyễn Văn A' }, ip: '127.0.0.1' });
    const r = db.prepare('SELECT * FROM nhat_ky').get() as { chi_tiet: string };
    assert.deepEqual(JSON.parse(r.chi_tiet), { ho_ten: 'Nguyễn Văn A' });
});

test('dọn nhật ký cũ: chỉ xóa dòng quá hạn, tôn trọng mốc thời gian và chế độ giữ vĩnh viễn', () => {
    const db = moCsdl(':memory:');
    const ngay = 24 * 3600 * 1000;
    const luc = (cachDayBaoNhieuNgay: number): number => Date.now() - cachDayBaoNhieuNgay * ngay;
    const them = db.prepare('INSERT INTO nhat_ky (luc, hanh_dong) VALUES (?, ?)');
    them.run(luc(200), 'cu_xa');
    them.run(luc(100), 'cu_vua');
    them.run(luc(1), 'moi');

    // giữ mãi: không đụng gì
    assert.equal(donNhatKyCu(db, 0), 0);
    assert.equal((db.prepare('SELECT COUNT(*) AS n FROM nhat_ky').get() as { n: number }).n, 3);

    // giữ 180 ngày: chỉ dòng 200 ngày trước bị xóa
    assert.equal(donNhatKyCu(db, 180), 1);
    assert.deepEqual((db.prepare('SELECT hanh_dong FROM nhat_ky ORDER BY luc').all() as Array<{ hanh_dong: string }>).map(x => x.hanh_dong),
        ['cu_vua', 'moi']);

    // Quanh mốc 100 ngày, chừa mỗi bên một ngày: donNhatKyCu lấy mốc bằng đồng hồ thật lúc gọi, còn
    // đây chèn bằng Date.now() lúc trước đó vài mili-giây — bám đúng mốc biên thì test đạt khi chạy
    // riêng mà hỏng trong bộ đầy đủ, tuỳ máy nhanh chậm.
    assert.equal(donNhatKyCu(db, 101), 0);
    assert.equal(donNhatKyCu(db, 99), 1);
    assert.equal((db.prepare('SELECT COUNT(*) AS n FROM nhat_ky').get() as { n: number }).n, 1);
});
