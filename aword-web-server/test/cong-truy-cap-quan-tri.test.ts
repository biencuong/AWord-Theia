// Kiểm thử trang + API quản trị: phân quyền thực thi ở máy chủ, khóa tài khoản (hủy phiên, dừng phiên làm việc, thu hồi
// token AI), đặt lại mật khẩu, email/số điện thoại, nhập Excel/CSV qua API, đơn vị, bảng giá, nhật ký không lộ mật khẩu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { kiemMatKhau } from '../src/xac-thuc/ma-hoa.ts';
import { MAT_KHAU, dangNhapQuanTri, dungMoiTruong, layCsrf } from './fixtures/tai-khoan/moi-truong-cong.ts';

const fixture = (ten: string): Buffer => readFileSync(new URL(`./fixtures/tai-khoan/${ten}`, import.meta.url));

test('người dùng thường không vào được /quan-tri và /api/quan-tri/*', async (t) => {
    const mt = await dungMoiTruong();
    t.after(mt.tat);
    await mt.taoTaiKhoan({ email: 'gv01@truong.vn' });
    const td = mt.trinhDuyet();
    await td.dangNhap('gv01@truong.vn', MAT_KHAU);
    const trang = await td.goi('GET', '/quan-tri');
    assert.equal(trang.trangThai, 403);
    assert.match(trang.than, /Không có quyền truy cập/);
    assert.equal((await td.goi('GET', '/quan-tri/nhap')).trangThai, 403);
    const api = await td.api('GET', '/thong-tin');
    assert.equal(api.trangThai, 403);
    assert.equal(api.duLieu.loi, 'Bạn không có quyền quản trị.');
    const csrf = layCsrf((await td.goi('GET', '/tai-khoan')).than);
    const tao = await td.goi('POST', '/api/quan-tri/tai-khoan', { json: { hoTen: 'X', email: 'x@y.vn' }, header: { 'x-aword-csrf': csrf } });
    assert.equal(tao.trangThai, 403);
    assert.equal((mt.db.prepare('SELECT COUNT(*) AS n FROM tai_khoan').get() as { n: number }).n, 1);
    assert.equal((await mt.trinhDuyet().goi('GET', '/api/quan-tri/tai-khoan')).trangThai, 401, 'chưa đăng nhập → 401 JSON');
});

test('CSRF ở API: thiếu header, sai token, Origin khác (kể cả máy con webview) bị chặn', async (t) => {
    const mt = await dungMoiTruong();
    t.after(mt.tat);
    const { td } = await dangNhapQuanTri(mt, 'qtht@so.gov.vn', 'quan_tri_he_thong');
    const csrf = layCsrf((await td.goi('GET', '/quan-tri')).than);
    const json = { ma: 'THCS01', ten: 'Trường THCS số 1' };
    assert.equal((await td.goi('POST', '/api/quan-tri/don-vi', { json })).trangThai, 403, 'thiếu X-AWord-CSRF');
    assert.equal((await td.goi('POST', '/api/quan-tri/don-vi', { json, header: { 'x-aword-csrf': 'sai' } })).trangThai, 403);
    assert.equal((await td.goi('POST', '/api/quan-tri/don-vi', { json, header: { 'x-aword-csrf': csrf }, nguon: 'http://ke-gian.example' })).trangThai, 403);
    assert.equal((await td.goi('POST', '/api/quan-tri/don-vi', { json, header: { 'x-aword-csrf': csrf }, nguon: `http://abc.webview.${mt.host}` })).trangThai, 403);
    assert.equal((await td.goi('POST', '/api/quan-tri/don-vi', { json, header: { 'x-aword-csrf': csrf }, nguon: null })).trangThai, 403);
    assert.equal((mt.db.prepare('SELECT COUNT(*) AS n FROM don_vi').get() as { n: number }).n, 0);
    assert.equal((await td.goi('POST', '/api/quan-tri/don-vi', { json, header: { 'x-aword-csrf': csrf } })).trangThai, 201);
    assert.equal((await td.goi('POST', '/api/quan-tri/don-vi', { than: Buffer.from('ma=A&ten=B'), header: { 'x-aword-csrf': csrf, 'content-type': 'application/x-www-form-urlencoded' } })).trangThai, 415);
});

test('quản trị đơn vị chỉ thấy/sửa tài khoản đơn vị mình, không tạo quản trị hệ thống, không sửa đơn vị/bảng giá', async (t) => {
    const mt = await dungMoiTruong();
    t.after(mt.tat);
    const dvA = mt.taoDonVi('THCS_A', 'Trường A');
    const dvB = mt.taoDonVi('THCS_B', 'Trường B');
    const { id: qtA, td } = await dangNhapQuanTri(mt, 'qt.a@truong-a.vn', 'quan_tri_don_vi', dvA);
    const uA = await mt.taoTaiKhoan({ email: 'gv.a@truong-a.vn', donViId: dvA });
    const uB = await mt.taoTaiKhoan({ email: 'gv.b@truong-b.vn', so: '0988888888', donViId: dvB });
    const htA = await mt.taoTaiKhoan({ email: 'ht@so.gov.vn', vaiTro: 'quan_tri_he_thong', donViId: dvA });
    mt.db.prepare("INSERT INTO bang_gia (ma, nha_cung_cap, mo_hinh_goc, ten_hien_thi, gia_vao, gia_ra, cap_nhat_luc) VALUES ('m1', 'anthropic', 'm1', 'M1', 1, 2, 1)").run();
    const truocB = JSON.stringify(mt.db.prepare('SELECT * FROM tai_khoan WHERE id = ?').get(uB));

    assert.equal((await td.goi('GET', '/quan-tri')).trangThai, 200);
    assert.equal((await td.goi('GET', '/quan-tri/bang-gia')).trangThai, 403);
    assert.equal((await td.goi('GET', '/quan-tri/don-vi')).trangThai, 403);

    const ds = await td.api('GET', '/tai-khoan');
    assert.deepEqual(ds.duLieu.ds.map((x: { email: string }) => x.email).sort(), ['gv.a@truong-a.vn', 'qt.a@truong-a.vn']);
    assert.equal((await td.api('GET', `/tai-khoan?don_vi=${dvB}`)).duLieu.tong, 0);
    assert.equal((await td.api('GET', '/tai-khoan?tim=0988')).duLieu.tong, 0, 'không tìm ra tài khoản đơn vị khác theo số');
    assert.deepEqual((await td.api('GET', '/thong-tin')).duLieu.donVi.map((d: { id: number }) => d.id), [dvA]);
    assert.equal(ds.duLieu.ds.find((x: { id: number }) => x.id === uA).daDungThang, 123456);
    assert.ok(!JSON.stringify(ds.duLieu).includes('scrypt$'), 'không lộ mật khẩu băm');

    for (const [pt, duong, json] of [
        ['GET', `/tai-khoan/${uB}`, undefined], ['PUT', `/tai-khoan/${uB}`, { hoTen: 'Đổi tên' }], ['POST', `/tai-khoan/${uB}/khoa`, undefined],
        ['POST', `/tai-khoan/${uB}/dat-lai-mat-khau`, undefined], ['POST', `/tai-khoan/${uB}/mo-khoa`, undefined],
        ['PUT', `/tai-khoan/${htA}`, { hoTen: 'x' }], ['POST', `/tai-khoan/${htA}/khoa`, undefined],
    ] as Array<[string, string, unknown]>) {
        assert.equal((await td.api(pt, duong, json === undefined ? {} : { json })).trangThai, 404, `${pt} ${duong}`);
    }
    assert.equal(JSON.stringify(mt.db.prepare('SELECT * FROM tai_khoan WHERE id = ?').get(uB)), truocB, 'tài khoản đơn vị khác không bị đổi');
    assert.equal(mt.dieuPhoi.daDung.length, 0);

    const taoB = await td.api('POST', '/tai-khoan', { json: { hoTen: 'Mới B', email: 'moi.b@truong-b.vn', donViId: dvB } });
    assert.equal(taoB.trangThai, 400);
    assert.match(taoB.duLieu.loi, /chỉ được quản lý tài khoản trong đơn vị của mình/);
    const taoHt = await td.api('POST', '/tai-khoan', { json: { hoTen: 'Mới HT', email: 'moi.ht@so.gov.vn', vaiTro: 'quan_tri_he_thong' } });
    assert.equal(taoHt.trangThai, 400);
    assert.match(taoHt.duLieu.loi, /không có quyền tạo hoặc gán vai trò Quản trị hệ thống/);
    const taoA = await td.api('POST', '/tai-khoan', { json: { hoTen: 'Mới A', soDienThoai: '0901 234 567' } });
    assert.equal(taoA.trangThai, 201);
    assert.equal(taoA.duLieu.taiKhoan.donViId, dvA, 'bỏ trống đơn vị → đơn vị của quản trị');
    assert.equal(taoA.duLieu.taiKhoan.soDienThoai, '0901234567');

    assert.equal((await td.api('PUT', `/tai-khoan/${uA}`, { json: { donViId: dvB } })).trangThai, 403);
    assert.equal((await td.api('PUT', `/tai-khoan/${uA}`, { json: { vaiTro: 'quan_tri_he_thong' } })).trangThai, 403);
    assert.equal((await td.api('PUT', `/tai-khoan/${qtA}`, { json: { vaiTro: 'nguoi_dung' } })).trangThai, 400, 'không tự hạ quyền');
    const trungSo = await td.api('PUT', `/tai-khoan/${uA}`, { json: { soDienThoai: '0988888888' } });
    assert.equal(trungSo.trangThai, 400);
    assert.match(trungSo.duLieu.loi, /đã dùng cho tài khoản khác/);
    const sua = await td.api('PUT', `/tai-khoan/${uA}`, { json: { hoTen: 'Giáo viên A', hanMucThangDong: '300.000', hanDung: '2027-05-31', soDienThoai: '+84 912 111 222' } });
    assert.equal(sua.trangThai, 200);
    assert.deepEqual([sua.duLieu.hanMucThangDong, sua.duLieu.hanDung, sua.duLieu.soDienThoai], [300000, '2027-05-31', '0912111222']);
    const boEmail = await td.api('PUT', `/tai-khoan/${uA}`, { json: { email: '' } });
    assert.equal(boEmail.duLieu.email, null);
    assert.equal((mt.db.prepare('SELECT ten_dang_nhap FROM tai_khoan WHERE id = ?').get(uA) as { ten_dang_nhap: string }).ten_dang_nhap, '0912111222', 'khóa nội bộ theo số khi bỏ email');
    assert.match((await td.api('PUT', `/tai-khoan/${uA}`, { json: { soDienThoai: '' } })).duLieu.loi, /Cần có email hoặc số điện thoại/);

    assert.equal((await td.api('POST', '/don-vi', { json: { ma: 'X', ten: 'X' } })).trangThai, 403);
    assert.equal((await td.api('PUT', `/don-vi/${dvA}`, { json: { ten: 'Đổi' } })).trangThai, 403);
    assert.equal((await td.api('PUT', '/bang-gia/m1', { json: { giaVao: 999 } })).trangThai, 403);
    assert.equal((await td.api('POST', '/bang-gia', { json: { ma: 'm2' } })).trangThai, 403);
    assert.equal((mt.db.prepare("SELECT gia_vao FROM bang_gia WHERE ma = 'm1'").get() as { gia_vao: number }).gia_vao, 1);

    const nk = await td.api('GET', '/nhat-ky');
    assert.ok(nk.duLieu.ds.length > 0);
    assert.ok(nk.duLieu.ds.every((d: { doiTuong: string | null }) => d.doiTuong !== `tai_khoan:${uB}`), 'nhật ký chỉ trong đơn vị mình');
});

test('khóa tài khoản: hủy phiên đăng nhập, gọi dieuPhoi.dungPhien + congAi.thuHoiToken; mở khóa đăng nhập lại được', async (t) => {
    const mt = await dungMoiTruong();
    t.after(mt.tat);
    const { id: qt, td } = await dangNhapQuanTri(mt, 'qtht@so.gov.vn', 'quan_tri_he_thong');
    const u = await mt.taoTaiKhoan({ so: '0911222333' });
    const nd = mt.trinhDuyet();
    await nd.dangNhap('0911222333', MAT_KHAU);
    assert.equal((await nd.goi('GET', '/soan-thao')).trangThai, 200);

    const khoa = await td.api('POST', `/tai-khoan/${u}/khoa`);
    assert.equal(khoa.trangThai, 200);
    assert.equal(khoa.duLieu.trangThai, 'khoa');
    assert.deepEqual(mt.dieuPhoi.daDung, [u]);
    assert.deepEqual(mt.congAi.daThuHoi, [u]);
    assert.equal((mt.db.prepare('SELECT COUNT(*) AS n FROM phien_dang_nhap WHERE tai_khoan_id = ?').get(u) as { n: number }).n, 0);
    assert.equal((await nd.goi('GET', '/soan-thao')).trangThai, 302);
    const dn = await nd.dangNhap('0911222333', MAT_KHAU);
    assert.equal(dn.trangThai, 403);
    assert.match(dn.than, /đang bị khóa/);
    assert.deepEqual({ ...mt.db.prepare("SELECT tai_khoan_id, doi_tuong FROM nhat_ky WHERE hanh_dong = 'khoa_tai_khoan'").get() }, { tai_khoan_id: qt, doi_tuong: `tai_khoan:${u}` });

    assert.equal((await td.api('POST', `/tai-khoan/${qt}/khoa`)).trangThai, 400, 'tự khóa chính mình bị từ chối');
    assert.equal((await td.api('POST', `/tai-khoan/${u}/mo-khoa`)).duLieu.trangThai, 'hoat_dong');
    assert.equal((await nd.dangNhap('0911222333', MAT_KHAU)).trangThai, 303);
    await td.api('PUT', `/tai-khoan/${u}`, { json: { trangThai: 'luu_tru' } });
    assert.deepEqual(mt.dieuPhoi.daDung, [u, u], 'chuyển lưu trữ cũng ngắt như khóa');
    assert.equal((await nd.goi('GET', '/soan-thao')).trangThai, 302);
    await td.api('POST', `/tai-khoan/${u}/mo-khoa`);
    await nd.dangNhap('0911222333', MAT_KHAU);
    const hetHan = await td.api('PUT', `/tai-khoan/${u}`, { json: { hanDung: '01/09/2026' } });
    assert.equal(hetHan.duLieu.hetHan, true);
    assert.deepEqual(mt.congAi.daThuHoi, [u, u, u], 'đặt hạn dùng về quá khứ cũng ngắt ngay');
    assert.equal((await nd.goi('GET', '/soan-thao')).trangThai, 302);

    mt.db.prepare('UPDATE tai_khoan SET han_dung = NULL, khoa_den = ?, so_lan_sai = 0 WHERE id = ?').run(mt.dong.gio + 600_000, u);
    assert.ok((await td.api('GET', `/tai-khoan/${u}`)).duLieu.tamKhoaDen);
    assert.equal((await td.api('POST', `/tai-khoan/${u}/mo-khoa`)).duLieu.tamKhoaDen, null, 'gỡ tạm khóa do nhập sai');
    assert.equal((await nd.dangNhap('0911222333', MAT_KHAU)).trangThai, 303);
});

test('tạo lẻ bằng email/số, đặt lại mật khẩu (buộc đổi, hủy phiên), tìm theo số; API và nhật ký không lộ mật khẩu', async (t) => {
    const mt = await dungMoiTruong();
    t.after(mt.tat);
    const { td } = await dangNhapQuanTri(mt, 'qtht@so.gov.vn', 'quan_tri_he_thong');
    const dv = (await td.api('POST', '/don-vi', { json: { ma: 'THPT01', ten: 'Trường THPT số 1' } })).duLieu.id;
    const thieu = await td.api('POST', '/tai-khoan', { json: { hoTen: 'Không liên hệ' } });
    assert.equal(thieu.trangThai, 400);
    assert.match(thieu.duLieu.loi, /Cần có email hoặc số điện thoại/);
    const tao = await td.api('POST', '/tai-khoan', { json: { hoTen: 'Hoàng Văn E', email: 'E.Hoang@Truong.edu.vn', soDienThoai: '0915 678 901', donViId: dv, vaiTro: 'nguoi_dung', hanDung: '2027-06-30', hanMucThangDong: '150000' } });
    assert.equal(tao.trangThai, 201);
    const { taiKhoan, matKhauTam } = tao.duLieu;
    assert.match(matKhauTam, /^[A-Z][a-z]{3}-[a-z]{4}-\d{4}$/);
    assert.deepEqual([taiKhoan.email, taiKhoan.soDienThoai, taiKhoan.hanDung, taiKhoan.hanMucThangDong, taiKhoan.phaiDoiMatKhau, taiKhoan.tenDonVi],
        ['e.hoang@truong.edu.vn', '0915678901', '2027-06-30', 150000, true, 'Trường THPT số 1']);
    const trung = await td.api('POST', '/tai-khoan', { json: { hoTen: 'Trùng', email: 'e.hoang@TRUONG.edu.vn' } });
    assert.equal(trung.trangThai, 400);
    assert.match(trung.duLieu.loi, /đã dùng cho tài khoản khác/);

    const nd = mt.trinhDuyet();
    assert.equal((await nd.dangNhap('0915678901', matKhauTam)).viTri, '/doi-mat-khau');
    const csrf = layCsrf((await nd.goi('GET', '/doi-mat-khau')).than);
    assert.equal((await nd.goi('POST', '/doi-mat-khau', { form: { csrf, mat_khau_cu: matKhauTam, mat_khau_moi: 'Rieng-cua-E-2026', nhap_lai: 'Rieng-cua-E-2026' } })).viTri, '/');
    assert.equal((await nd.goi('GET', '/x')).trangThai, 200);

    const datLai = await td.api('POST', `/tai-khoan/${taiKhoan.id}/dat-lai-mat-khau`);
    assert.equal(datLai.trangThai, 200);
    assert.notEqual(datLai.duLieu.matKhauTam, matKhauTam);
    assert.equal(datLai.duLieu.taiKhoan.phaiDoiMatKhau, true);
    assert.equal((await nd.goi('GET', '/x')).trangThai, 302, 'đặt lại mật khẩu hủy phiên đang mở');
    assert.equal((await nd.dangNhap('e.hoang@truong.edu.vn', 'Rieng-cua-E-2026')).trangThai, 401);
    assert.equal((await nd.dangNhap('e.hoang@truong.edu.vn', datLai.duLieu.matKhauTam)).viTri, '/doi-mat-khau');
    assert.equal((await td.api('POST', `/tai-khoan/${taiKhoan.id}/tat-hai-lop`)).trangThai, 404, 'không còn tắt hai lớp');

    const chiTiet = await td.api('GET', `/tai-khoan/${taiKhoan.id}`);
    assert.ok(!/mat_khau_bam|matKhauBam|matKhauTam|totp|haiLop|tenDangNhap|scrypt\$/i.test(JSON.stringify(chiTiet.duLieu)), 'API không lộ mật khẩu/bí mật');
    const nhatKy = JSON.stringify(mt.db.prepare('SELECT * FROM nhat_ky').all());
    for (const bi of [matKhauTam, datLai.duLieu.matKhauTam, 'Rieng-cua-E-2026', MAT_KHAU]) { assert.ok(!nhatKy.includes(bi), 'nhật ký không chứa mật khẩu'); }
    const hanhDong = (await td.api('GET', `/nhat-ky?tai_khoan_id=${taiKhoan.id}`)).duLieu.ds.map((d: { hanhDong: string }) => d.hanhDong);
    for (const h of ['tao_tai_khoan', 'dat_lai_mat_khau', 'doi_mat_khau_lan_dau', 'dang_nhap']) { assert.ok(hanhDong.includes(h), h); }

    for (const tim of ['hoang van', '0915678', '+84 915 678', 'truong.edu']) {
        assert.equal((await td.api('GET', `/tai-khoan?tim=${encodeURIComponent(tim)}`)).duLieu.tong, 1, `tìm "${tim}"`);
    }
    assert.equal((await td.api('GET', '/tai-khoan?trang_thai=khoa')).duLieu.tong, 0);
});

test('nhập danh sách qua API: Excel xem trước + lỗi từng dòng rồi mới ghi; CSV của quản trị đơn vị bị kiểm lại ở bước ghi', async (t) => {
    const mt = await dungMoiTruong();
    t.after(mt.tat);
    const dv = mt.taoDonVi('THCS01', 'Trường THCS số 1');
    mt.taoDonVi('THCS02', 'Trường THCS số 2');
    await mt.taoTaiKhoan({ email: 'dacosan@truong.vn', donViId: dv });
    const { td } = await dangNhapQuanTri(mt, 'qtht@so.gov.vn', 'quan_tri_he_thong');

    const xem = await td.api('POST', '/nhap/xem-truoc', { than: fixture('nhap-tai-khoan.xlsx'), header: { 'x-aword-ten-tep': encodeURIComponent('Danh sách GV.xlsx') } });
    assert.equal(xem.trangThai, 200);
    assert.equal(xem.duLieu.soHopLe, 4);
    assert.equal(xem.duLieu.soLoi, 6);
    assert.equal((mt.db.prepare('SELECT COUNT(*) AS n FROM tai_khoan').get() as { n: number }).n, 2, 'xem trước chưa ghi gì');
    const loiTheoDong = new Map(xem.duLieu.ds.map((d: { soDong: number; loi: string[] }) => [d.soDong, d.loi.join(' ')]));
    assert.match(loiTheoDong.get(5) as string, /Trùng email với dòng 2/);
    assert.match(loiTheoDong.get(6) as string, /Trùng số điện thoại với dòng 2/);
    assert.match(loiTheoDong.get(7) as string, /Mã đơn vị "KHONGCO" không có/);
    assert.match(loiTheoDong.get(8) as string, /đã dùng cho tài khoản khác/);
    assert.match(loiTheoDong.get(12) as string, /Cần có email hoặc số điện thoại/);

    const hopLe = xem.duLieu.ds.filter((d: { loi: string[] }) => d.loi.length === 0).map((d: { dong: unknown }) => d.dong);
    const ghi = await td.api('POST', '/nhap/ghi', { json: { dong: hopLe } });
    assert.equal(ghi.trangThai, 201);
    assert.deepEqual(ghi.duLieu.daTao.map((x: { soDong: number }) => x.soDong), [2, 3, 4, 9]);
    const b = ghi.duLieu.daTao.find((x: { soDienThoai: string }) => x.soDienThoai === '0912345679');
    assert.deepEqual([b.hoTen, b.email], ['Trần Thị B', null]);
    const dongB = mt.db.prepare('SELECT * FROM tai_khoan WHERE so_dien_thoai = ?').get('0912345679') as { mat_khau_bam: string; phai_doi_mat_khau: number; han_muc_thang_dong: number; vai_tro: string };
    assert.equal(await kiemMatKhau(b.matKhauTam, dongB.mat_khau_bam), true);
    assert.deepEqual([dongB.phai_doi_mat_khau, dongB.han_muc_thang_dong, dongB.vai_tro], [1, 1500000, 'quan_tri_don_vi']);
    assert.equal((await mt.trinhDuyet().dangNhap('0912 345 679', b.matKhauTam)).viTri, '/doi-mat-khau', 'đăng nhập ngay bằng số + mật khẩu tạm');
    assert.equal((await td.api('POST', '/nhap/ghi', { json: { dong: hopLe } })).trangThai, 400, 'gửi lại lần nữa → mọi dòng đã trùng');
    assert.ok(mt.db.prepare("SELECT 1 FROM nhat_ky WHERE hanh_dong = 'nhap_danh_sach'").get());

    const mau = await td.goi('GET', '/api/quan-tri/nhap/mau.csv');
    assert.match(String(mau.header['content-type']), /^text\/csv/);
    assert.match(String(mau.header['content-disposition']), /attachment/);
    assert.ok(mau.than.startsWith('﻿Họ tên,Email,Số điện thoại,Mã đơn vị,Vai trò,Hạn dùng,Hạn mức tháng (đồng)'));

    const loiTep = await td.api('POST', '/nhap/xem-truoc', { than: Buffer.from('Họ tên;Vai trò\nA;x'), header: { 'x-aword-ten-tep': 'ds.csv' } });
    assert.equal(loiTep.trangThai, 400);
    assert.match(loiTep.duLieu.loi, /ít nhất một trong hai cột/);

    // Quản trị đơn vị nhập CSV (chấm phẩy, BOM); cố ý sửa dữ liệu ở bước ghi → máy chủ kiểm lại
    const { td: tdDv } = await dangNhapQuanTri(mt, 'qt.dv1@truong.vn', 'quan_tri_don_vi', dv);
    const csv = '﻿Họ tên;Email;Số điện thoại;Mã đơn vị;Vai trò;Hạn mức tháng (đồng)\r\n"Giáo viên ""Một""";gv1@truong.vn;;;;100.000\r\nGiáo viên Hai;;0902000002;THCS02;;\r\n';
    const xemDv = await tdDv.api('POST', '/nhap/xem-truoc', { than: Buffer.from(csv), header: { 'x-aword-ten-tep': 'ds.csv' } });
    assert.equal(xemDv.duLieu.soHopLe, 1);
    assert.match(xemDv.duLieu.ds[1].loi.join(), /đơn vị của mình/);
    const giaMao = [{ ...xemDv.duLieu.ds[0].dong }, { ...xemDv.duLieu.ds[0].dong, soDong: 3, email: 'leo.quyen@truong.vn', vaiTro: 'Quản trị hệ thống' }];
    const ghiDv = await tdDv.api('POST', '/nhap/ghi', { json: { dong: giaMao } });
    assert.equal(ghiDv.trangThai, 201);
    assert.deepEqual(ghiDv.duLieu.daTao.map((x: { email: string; hoTen: string }) => [x.email, x.hoTen]), [['gv1@truong.vn', 'Giáo viên "Một"']]);
    assert.match(ghiDv.duLieu.boQua[0].loi.join(), /Quản trị hệ thống/);
    assert.equal(mt.db.prepare('SELECT 1 FROM tai_khoan WHERE email = ?').get('leo.quyen@truong.vn'), undefined);
});

test('quản trị hệ thống: đơn vị (thêm/sửa/xóa) và bảng giá mô hình (thêm/sửa giá, bật/tắt)', async (t) => {
    const mt = await dungMoiTruong();
    t.after(mt.tat);
    const { td } = await dangNhapQuanTri(mt, 'qtht@so.gov.vn', 'quan_tri_he_thong');
    assert.equal((await td.goi('GET', '/quan-tri/bang-gia')).trangThai, 200);
    assert.match((await td.goi('GET', '/quan-tri/nhat-ky')).than, /data-trang="nhat-ky"/);
    assert.equal((await td.goi('GET', '/quan-tri/khong-co')).trangThai, 404);

    const dv = await td.api('POST', '/don-vi', { json: { ma: 'MN01', ten: 'Trường Mầm non Hoa Mai' } });
    assert.equal(dv.trangThai, 201);
    assert.equal((await td.api('POST', '/don-vi', { json: { ma: 'mn01', ten: 'Trùng mã' } })).trangThai, 400);
    assert.equal((await td.api('POST', '/don-vi', { json: { ma: 'có dấu', ten: 'x' } })).trangThai, 400);
    assert.equal((await td.api('PUT', `/don-vi/${dv.duLieu.id}`, { json: { ten: 'Trường MN Hoa Mai' } })).duLieu.ten, 'Trường MN Hoa Mai');
    await mt.taoTaiKhoan({ email: 'co.mn@truong.vn', donViId: dv.duLieu.id });
    const xoa = await td.api('DELETE', `/don-vi/${dv.duLieu.id}`);
    assert.equal(xoa.trangThai, 400);
    assert.match(xoa.duLieu.loi, /còn 1 tài khoản/);
    const dv2 = await td.api('POST', '/don-vi', { json: { ma: 'TAM', ten: 'Tạm' } });
    assert.equal((await td.api('DELETE', `/don-vi/${dv2.duLieu.id}`)).trangThai, 200);

    const them = await td.api('POST', '/bang-gia', { json: { ma: 'claude-sonnet-4-5', nhaCungCap: 'anthropic', moHinhGoc: 'claude-sonnet-4-5', tenHienThi: 'Claude Sonnet 4.5', giaVao: '78.000', giaRa: 390000, giaCacheDoc: 7800, giaCacheGhi: 97500 } });
    assert.equal(them.trangThai, 201);
    assert.deepEqual([them.duLieu.giaVao, them.duLieu.giaRa, them.duLieu.bat], [78000, 390000, true]);
    assert.equal((await td.api('POST', '/bang-gia', { json: { ma: 'x', nhaCungCap: 'google', moHinhGoc: 'x', tenHienThi: 'x', giaVao: 1, giaRa: 1 } })).trangThai, 400);
    const sua = await td.api('PUT', `/bang-gia/${encodeURIComponent('claude-sonnet-4-5')}`, { json: { giaRa: '400.000', bat: false } });
    assert.equal(sua.trangThai, 200);
    assert.deepEqual([sua.duLieu.giaRa, sua.duLieu.bat, sua.duLieu.giaVao], [400000, false, 78000]);
    assert.equal((await td.api('PUT', '/bang-gia/claude-sonnet-4-5', { json: { giaVao: -1 } })).trangThai, 400);
    assert.equal((await td.api('PUT', '/bang-gia/khong-co', { json: { giaVao: 1 } })).trangThai, 404);
    const nk = mt.db.prepare("SELECT chi_tiet FROM nhat_ky WHERE hanh_dong = 'sua_bang_gia'").get() as { chi_tiet: string };
    assert.deepEqual(JSON.parse(nk.chi_tiet), { truoc: { gia_ra: 390000, bat: 1 }, sau: { gia_ra: 400000, bat: 0 } });
    assert.equal((await td.api('GET', '/bang-gia')).duLieu.length, 1);
});
