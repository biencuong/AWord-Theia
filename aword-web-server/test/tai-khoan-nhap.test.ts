import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { moCsdl } from '../src/csdl/csdl.ts';
import { docCsv, ghiCsv } from '../src/tai-khoan/csv.ts';
import { docBangNhap, kiemDanhSachNhap } from '../src/tai-khoan/nhap-danh-sach.ts';
import {
    dinhDangTien, docDinhDanh, docEmail, docNgay, docSoDienThoai, docTien, docVaiTro, hanDungSangChu, hanDungSangNgay,
    hienSoDienThoai, kiemLienHe, loiMatKhauTaiKhoan, sinhMatKhauTam, taoCacTaiKhoan,
} from '../src/tai-khoan/tai-khoan.ts';
import { docXlsx, docZip, seriSangNgay } from '../src/tai-khoan/xlsx.ts';
import { kiemMatKhau, loiMatKhau } from '../src/xac-thuc/ma-hoa.ts';

const fixture = (ten: string): Buffer => readFileSync(new URL(`./fixtures/tai-khoan/${ten}`, import.meta.url));
const BAY_GIO = Date.UTC(2026, 8, 15, 3, 0); // 15/9/2026 10:00 giờ Việt Nam

test('đọc .xlsx do openpyxl sinh: chuỗi nội tuyến, số, ô ngày có định dạng', () => {
    const hang = docXlsx(fixture('nhap-tai-khoan.xlsx'));
    assert.deepEqual(hang[0], ['Họ tên', 'Email', 'Số điện thoại', 'Mã đơn vị', 'Vai trò', 'Hạn dùng', 'Hạn mức tháng (đồng)']);
    assert.deepEqual(hang[1], ['Nguyễn Văn A', 'A.Nguyen@thcs-xa.edu.vn', '0912 345 678', 'THCS01', 'Người dùng', '2027-06-30', 200000]);
    assert.equal(hang[2][2], 912345679);
    assert.equal(hang[3][0], 'Lê Thị C & "Hoa" <1>');
    assert.equal(hang[8][5], '2027-01-15');
    assert.deepEqual(hang[9], []); // dòng trống giữa bảng
});

test('đọc .xlsx kiểu Excel: chuỗi dùng chung + phiên âm, tiền tố x:, trang đầu ở sheet2.xml, hệ ngày 1904, công thức', () => {
    const hang = docXlsx(fixture('nhap-kieu-excel-1904.xlsx'));
    assert.equal(hang.length, 4);
    assert.deepEqual(hang[1], ['Đinh Văn G', 'dinh.g@truong.vn', null, 'THCS01', 'Người dùng', '2026-12-31', 350000]);
    assert.deepEqual(hang[2], ['Mai Thị H', null, '0977000111']);
    assert.deepEqual(hang[3], ['Bùi Thị K', 'bui.k@truong.vn']);
});

test('ZIP: nén deflate, chặn tệp hỏng', () => {
    const ten = Buffer.from('a.txt');
    const nen = deflateRawSync(Buffer.from('xin chào'));
    const cucBo = Buffer.alloc(30);
    cucBo.writeUInt32LE(0x04034b50, 0); cucBo.writeUInt16LE(8, 8); cucBo.writeUInt32LE(nen.length, 18); cucBo.writeUInt16LE(ten.length, 26);
    const tt = Buffer.alloc(46);
    tt.writeUInt32LE(0x02014b50, 0); tt.writeUInt16LE(8, 10); tt.writeUInt32LE(nen.length, 20); tt.writeUInt16LE(ten.length, 28); tt.writeUInt32LE(0, 42);
    const viTriTt = 30 + ten.length + nen.length;
    const ket = Buffer.alloc(22);
    ket.writeUInt32LE(0x06054b50, 0); ket.writeUInt16LE(1, 8); ket.writeUInt16LE(1, 10); ket.writeUInt32LE(46 + ten.length, 12); ket.writeUInt32LE(viTriTt, 16);
    const zip = Buffer.concat([cucBo, ten, nen, tt, ten, ket]);
    assert.equal(docZip(zip).get('a.txt')?.().toString(), 'xin chào');
    assert.throws(() => docXlsx(Buffer.from('không phải zip')), /Tệp Excel bị hỏng/);
    assert.throws(() => docXlsx(zip.subarray(0, zip.length - 5)), /Tệp Excel bị hỏng/);
    assert.equal(seriSangNgay(46387), '2026-12-31');
    assert.equal(seriSangNgay(46387.5), '2026-12-31T12:00:00');
});

test('CSV: BOM, chấm phẩy, ngoặc kép, xuống dòng trong ô; từ chối mã không phải UTF-8', () => {
    const csv = '﻿Họ tên;Email;Ghi chú\r\nNguyễn Văn "A";a@b.vn;"dòng 1\ndòng 2; vẫn trong ô"\r\n\r\n';
    assert.deepEqual(docCsv(Buffer.from(csv)), [
        ['Họ tên', 'Email', 'Ghi chú'],
        ['Nguyễn Văn "A"', 'a@b.vn', 'dòng 1\ndòng 2; vẫn trong ô'],
    ]);
    assert.deepEqual(docCsv(Buffer.from('a,"b,c",d\nx,"y ""z""",z')), [['a', 'b,c', 'd'], ['x', 'y "z"', 'z']]);
    assert.throws(() => docCsv(Buffer.from([0x54, 0xea, 0x6e])), /không phải mã UTF-8/); // "Tên" mã Windows-1258
    const ra = ghiCsv([['Họ tên', 'Mật khẩu'], ['a,b', '=1+1']]);
    assert.ok(ra.startsWith('﻿Họ tên,Mật khẩu\r\n"a,b",\'=1+1\r\n'));
});

test('đọc giá trị: email, số điện thoại, định danh đăng nhập, vai trò, ngày, tiền', () => {
    for (const vao of ['0912345678', '0912 345 678', '0912.345.678', '+84 912 345 678', '84912345678', '(+84) 912-345-678', '912345678', '+84 0912345678']) {
        assert.equal(docSoDienThoai(vao), '0912345678', vao);
    }
    for (const sai of ['12345', '0212345678', '091234567', '09123456789', '+1 912345678', 'abc']) { assert.equal(docSoDienThoai(sai), undefined, sai); }
    assert.equal(docSoDienThoai(' '), null);
    assert.equal(hienSoDienThoai('0912345678'), '0912 345 678');
    assert.equal(docEmail(' A.Nguyen@Truong.EDU.vn '), 'a.nguyen@truong.edu.vn');
    assert.equal(docEmail('sai-email'), undefined);
    assert.deepEqual(docDinhDanh('GV@truong.vn'), { loai: 'email', giaTri: 'gv@truong.vn' });
    assert.deepEqual(docDinhDanh('+84 987 654 321'), { loai: 'so', giaTri: '0987654321' });
    assert.equal(docDinhDanh('nguyenvana'), undefined);
    assert.equal(docDinhDanh('a@'), undefined);

    assert.equal(docVaiTro('Quản trị đơn vị'), 'quan_tri_don_vi');
    assert.equal(docVaiTro('quan_tri_he_thong'), 'quan_tri_he_thong');
    assert.equal(docVaiTro(''), 'nguoi_dung');
    assert.equal(docVaiTro('Giáo viên'), undefined);
    const han = docNgay('31/12/2026') as number;
    assert.equal(han, Date.UTC(2026, 11, 31, 17, 0)); // 0 giờ 1/1/2027 giờ Việt Nam
    assert.equal(docNgay('2026-12-31'), han);
    assert.equal(hanDungSangNgay(han), '2026-12-31');
    assert.equal(hanDungSangChu(han), '31/12/2026');
    assert.equal(docNgay('31/02/2026'), undefined);
    assert.equal(docNgay(''), null);
    assert.equal(docTien('1.500.000'), 1500000);
    assert.equal(docTien('200000 đ'), 200000);
    assert.equal(docTien(''), null);
    assert.equal(docTien('12abc'), undefined);
    assert.equal(dinhDangTien(1234567), '1.234.567 đ');
    assert.equal(dinhDangTien(0), '0 đ');
});

test('mật khẩu tạm, chính sách mật khẩu theo email/số; tạo tài khoản ghi khóa nội bộ và không lộ mật khẩu', async () => {
    for (let i = 0; i < 50; i++) {
        const mk = sinhMatKhauTam();
        assert.match(mk, /^[A-Z][a-z]{3}-[a-z]{4}-\d{4}$/);
        assert.equal(loiMatKhau(mk), undefined);
    }
    const tk = { email: 'thanh.hoa@truong.vn', so_dien_thoai: '0912345678' };
    assert.match(loiMatKhauTaiKhoan('Toi-0912345678', tk) ?? '', /số điện thoại/);
    assert.match(loiMatKhauTaiKhoan('thanh.hoa-2026', tk) ?? '', /email/);
    assert.match(loiMatKhauTaiKhoan('ngan1', tk) ?? '', /10 ký tự/);
    assert.equal(loiMatKhauTaiKhoan('Truong-em-2026', tk), undefined);

    const db = moCsdl(':memory:');
    const [a, b] = await taoCacTaiKhoan(db, [
        { hoTen: 'Có email', email: 'x@y.vn', soDienThoai: '0987654321', donViId: null, vaiTro: 'nguoi_dung', hanDung: null, hanMucThangDong: null },
        { hoTen: 'Chỉ số', email: null, soDienThoai: '0912345678', donViId: null, vaiTro: 'nguoi_dung', hanDung: null, hanMucThangDong: null },
    ], { nguoiLamId: null, bayGio: BAY_GIO });
    const dong = (id: number) => db.prepare('SELECT ten_dang_nhap, mat_khau_bam, phai_doi_mat_khau FROM tai_khoan WHERE id = ?').get(id) as { ten_dang_nhap: string; mat_khau_bam: string; phai_doi_mat_khau: number };
    assert.equal(dong(a.id).ten_dang_nhap, 'x@y.vn');
    assert.equal(dong(b.id).ten_dang_nhap, '0912345678');
    assert.equal(dong(a.id).phai_doi_mat_khau, 1);
    assert.equal(await kiemMatKhau(a.matKhauTam, dong(a.id).mat_khau_bam), true);
    const nk = JSON.stringify(db.prepare('SELECT chi_tiet FROM nhat_ky').all());
    assert.ok(!nk.includes(a.matKhauTam) && !nk.includes(b.matKhauTam));
    // Chỉ mục duy nhất ở CSDL: email không phân biệt hoa thường, số điện thoại
    assert.throws(() => db.prepare("INSERT INTO tai_khoan (ten_dang_nhap, ho_ten, email, mat_khau_bam, tao_luc, cap_nhat_luc) VALUES ('k1', 'K', 'X@Y.VN', 'x', 1, 1)").run(), /UNIQUE/);
    assert.throws(() => db.prepare("INSERT INTO tai_khoan (ten_dang_nhap, ho_ten, so_dien_thoai, mat_khau_bam, tao_luc, cap_nhat_luc) VALUES ('k2', 'K', '0912345678', 'x', 1, 1)").run(), /UNIQUE/);
    // kiemLienHe: thiếu cả hai, trùng, bỏ qua chính mình khi sửa
    assert.match(kiemLienHe(db, {}).loi.join(), /Cần có email hoặc số điện thoại/);
    assert.match(kiemLienHe(db, { email: 'x@Y.vn' }).loi.join(), /đã dùng cho tài khoản khác/);
    assert.deepEqual(kiemLienHe(db, { email: 'x@y.vn', soDienThoai: '+84987654321' }, a.id), { email: 'x@y.vn', soDienThoai: '0987654321', loi: [] });
});

test('nâng cấp lược đồ 2 trên CSDL cũ: chép tên đăng nhập dạng email/số sang cột mới, tạo chỉ mục duy nhất', () => {
    const thuMuc = mkdtempSync(join(tmpdir(), 'aword-luoc-do-'));
    const tep = join(thuMuc, 'aword.db');
    try {
        // Dựng CSDL "lược đồ 1": mở bản mới rồi gỡ phần của lược đồ 2 và hạ user_version
        let db = moCsdl(tep);
        db.exec(`DROP INDEX tai_khoan_email; DROP INDEX tai_khoan_so_dien_thoai; ALTER TABLE tai_khoan DROP COLUMN so_dien_thoai; PRAGMA user_version = 1;`);
        const them = db.prepare('INSERT INTO tai_khoan (ten_dang_nhap, ho_ten, email, mat_khau_bam, tao_luc, cap_nhat_luc) VALUES (?, ?, ?, ?, 1, 1)');
        them.run('QuanTri@So.gov.vn', 'A', null, 'x');
        them.run('0912345678', 'B', '', 'x');
        them.run('nguyenvana', 'C', 'c@truong.vn', 'x');
        db.close();
        db = moCsdl(tep);
        assert.equal((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version, 2);
        assert.deepEqual(db.prepare('SELECT ten_dang_nhap, email, so_dien_thoai FROM tai_khoan ORDER BY id').all().map(r => ({ ...r })), [
            { ten_dang_nhap: 'QuanTri@So.gov.vn', email: 'quantri@so.gov.vn', so_dien_thoai: null },
            { ten_dang_nhap: '0912345678', email: null, so_dien_thoai: '0912345678' },
            { ten_dang_nhap: 'nguyenvana', email: 'c@truong.vn', so_dien_thoai: null },
        ]);
        assert.throws(() => db.prepare("UPDATE tai_khoan SET email = 'C@TRUONG.VN' WHERE ten_dang_nhap = 'QuanTri@So.gov.vn'").run(), /UNIQUE/);
        db.close();
    } finally {
        rmSync(thuMuc, { recursive: true, force: true });
    }
});

function csdlCoDonVi() {
    const db = moCsdl(':memory:');
    db.prepare("INSERT INTO don_vi (ma, ten, tao_luc) VALUES ('THCS01', 'Trường THCS số 1', 1), ('THCS02', 'Trường THCS số 2', 1)").run();
    db.prepare("INSERT INTO tai_khoan (ten_dang_nhap, ho_ten, email, so_dien_thoai, mat_khau_bam, don_vi_id, tao_luc, cap_nhat_luc) VALUES ('dacosan@truong.vn', 'Có sẵn', 'dacosan@truong.vn', '0333444555', 'x', 1, 1, 1)").run();
    return db;
}

test('nhập Excel: xem trước báo lỗi từng dòng (trùng email/số trong tệp và CSDL, sai định dạng, thiếu cả hai...)', () => {
    const db = csdlCoDonVi();
    const dong = docBangNhap('danh-sach.xlsx', fixture('nhap-tai-khoan.xlsx'));
    assert.equal(dong.length, 10); // bỏ dòng trống
    const kq = kiemDanhSachNhap(db, { id: 99, vaiTro: 'quan_tri_he_thong', donViId: null }, dong, BAY_GIO);
    const theoDong = new Map(kq.map(k => [k.soDong, k]));

    const a = theoDong.get(2)!;
    assert.deepEqual(a.loi, []);
    assert.equal(a.dong.hanDung, '30/06/2027', 'ô ngày Excel hiện dạng dd/mm/yyyy');
    assert.deepEqual({ ...a.duLieu }, {
        hoTen: 'Nguyễn Văn A', email: 'a.nguyen@thcs-xa.edu.vn', soDienThoai: '0912345678', donViId: 1, vaiTro: 'nguoi_dung',
        hanDung: Date.UTC(2027, 5, 30, 17), hanMucThangDong: 200000,
    });
    assert.equal(theoDong.get(3)!.duLieu?.soDienThoai, '0912345679', 'ô số mất số 0 đầu vẫn nhận');
    assert.equal(theoDong.get(3)!.duLieu?.hanMucThangDong, 1500000);
    assert.equal(theoDong.get(4)!.duLieu?.donViId, null);
    assert.match(theoDong.get(5)!.loi.join(' '), /Trùng email với dòng 2/);
    assert.match(theoDong.get(6)!.loi.join(' '), /Trùng số điện thoại với dòng 2/);
    assert.match(theoDong.get(6)!.loi.join(' '), /Vai trò "Giáo viên" không hợp lệ/);
    assert.match(theoDong.get(7)!.loi.join(' '), /Mã đơn vị "KHONGCO" không có/);
    assert.match(theoDong.get(8)!.loi.join(' '), /Email dacosan@truong.vn đã dùng cho tài khoản khác/);
    assert.deepEqual(theoDong.get(9)!.loi, []);
    assert.equal(theoDong.get(9)!.duLieu?.soDienThoai, '0987654321');
    const loi11 = theoDong.get(11)!.loi.join(' ');
    for (const mau of [/Thiếu họ tên/, /Email "sai-email"/, /Số điện thoại "12345"/, /Hạn dùng "ngày mai"/, /Hạn mức tháng "12abc"/]) { assert.match(loi11, mau); }
    assert.match(theoDong.get(12)!.loi.join(' '), /Cần có email hoặc số điện thoại/);
    assert.deepEqual(kq.filter(k => k.loi.length === 0).map(k => k.soDong), [2, 3, 4, 9]);
});

test('nhập CSV bởi quản trị đơn vị: bỏ trống mã đơn vị = đơn vị mình, không được đơn vị khác hay quản trị hệ thống', () => {
    const db = csdlCoDonVi();
    const csv = 'Ho ten;SĐT;Ma don vi;Vai tro;Han dung;Han muc thang\n'
        + 'Giáo viên 01;0901000001;;;30/06/2027;100000\n'
        + 'Giáo viên 02;0901000002;THCS02;Người dùng;;\n'
        + 'Giáo viên 03;0901000003;;Quản trị hệ thống;;\n'
        + 'Giáo viên 04;0901000004;;;01/01/2020;\n'
        + 'Giáo viên 05;0333 444 555;;;;\n';
    const dong = docBangNhap('ds.csv', Buffer.from(csv));
    const kq = kiemDanhSachNhap(db, { id: 5, vaiTro: 'quan_tri_don_vi', donViId: 1 }, dong, BAY_GIO);
    assert.equal(kq[0].duLieu?.donViId, 1);
    assert.equal(kq[0].duLieu?.soDienThoai, '0901000001');
    assert.deepEqual(kq[0].loi, []);
    assert.match(kq[1].loi.join(), /chỉ được quản lý tài khoản trong đơn vị của mình/);
    assert.match(kq[2].loi.join(), /không có quyền tạo hoặc gán vai trò Quản trị hệ thống/);
    assert.match(kq[3].loi.join(), /đã qua/);
    assert.match(kq[4].loi.join(), /Số điện thoại 0333444555 đã dùng cho tài khoản khác/);
    assert.throws(() => docBangNhap('ds.csv', Buffer.from('Họ tên;Vai trò\nA;x')), /cần có cột "Họ tên" và ít nhất một trong hai cột "Email", "Số điện thoại"/);
    assert.throws(() => docBangNhap('ds.xls', Buffer.from('abc')), /Chỉ nhận tệp Excel \(.xlsx\) hoặc CSV/);
});
