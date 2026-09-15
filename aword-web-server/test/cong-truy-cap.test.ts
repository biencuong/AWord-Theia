// Kiểm thử cổng truy cập: đăng nhập bằng email hoặc số điện thoại, cookie, khóa do sai mật khẩu, giới hạn theo IP,
// đổi mật khẩu lần đầu, CSRF, chống chuyển hướng mở, hạn phiên, trang tài khoản. Máy chủ HTTP thật trên 127.0.0.1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { chuyenDenDangNhap, taoQuanTriDauTien } from '../src/cong-truy-cap/cong-truy-cap.ts';
import { cungNguonGoc, tenMienCookie, tiepAnToan } from '../src/cong-truy-cap/http.ts';
import { moCsdl } from '../src/csdl/csdl.ts';
import { bamToken, kiemMatKhau } from '../src/xac-thuc/ma-hoa.ts';
import { MAT_KHAU, dungMoiTruong, layCsrf } from './fixtures/tai-khoan/moi-truong-cong.ts';

const PHUT = 60_000, GIO = 60 * PHUT;

const yeuCauGia = (cookie: string): IncomingMessage => ({ headers: { cookie }, socket: {} } as unknown as IncomingMessage);
const thongBaoLoi = (html: string): string | undefined => /role="alert">([^<]+)</.exec(html)?.[1];

test('đăng nhập bằng email: cookie đủ thuộc tính, về lại trang định mở, phiên AWord nhận ra tài khoản', async (t) => {
    const mt = await dungMoiTruong();
    t.after(mt.tat);
    const id = await mt.taoTaiKhoan({ email: 'nguyen.van.a@truong.edu.vn', so: '0912345678', hoTen: 'Nguyễn Văn A' });
    const td = mt.trinhDuyet();

    // Chưa đăng nhập vào trang của phiên AWord → chuyển tới đăng nhập, nhớ đường dẫn
    const chua = await td.goi('GET', '/du-an/bao-cao?mo=1');
    assert.equal(chua.trangThai, 302);
    assert.equal(chua.viTri, '/dang-nhap?tiep=%2Fdu-an%2Fbao-cao%3Fmo%3D1');

    const trang = await td.goi('GET', chua.viTri!);
    assert.equal(trang.trangThai, 200);
    assert.match(trang.than, /<h1>Đăng nhập<\/h1>/);
    assert.match(trang.than, /<label for="dinh_danh">Email hoặc số điện thoại<\/label>/);
    assert.match(trang.than, /Quên mật khẩu\? Liên hệ quản trị đơn vị để đặt lại\./);
    assert.doesNotMatch(trang.than, /[Tt]ên đăng nhập/, 'giao diện không còn khái niệm tên đăng nhập');
    assert.match(String(trang.header['content-security-policy']), /default-src 'self'.*frame-ancestors 'none'/);
    assert.equal(trang.header['x-content-type-options'], 'nosniff');
    assert.equal(trang.header['referrer-policy'], 'same-origin');

    const dn = await td.goi('POST', '/dang-nhap', { form: { csrf: layCsrf(trang.than), dinh_danh: '  Nguyen.Van.A@Truong.EDU.vn ', mat_khau: MAT_KHAU, tiep: '/du-an/bao-cao?mo=1' } });
    assert.equal(dn.trangThai, 303);
    assert.equal(dn.viTri, '/du-an/bao-cao?mo=1');
    const cookiePhien = dn.setCookie.find(c => c.startsWith('aword_phien='))!;
    assert.ok(cookiePhien, 'phải đặt cookie aword_phien');
    const thuocTinh = cookiePhien.split(';').map(s => s.trim());
    for (const tt of ['Path=/', 'HttpOnly', 'SameSite=Lax', 'Domain=aword.test', `Max-Age=${7 * 24 * 3600}`]) { assert.ok(thuocTinh.includes(tt), `thiếu ${tt}`); }
    assert.ok(!thuocTinh.includes('Secure'), 'không https thì không đặt Secure');

    const token = td.cookie.get('aword_phien')!;
    const phien = mt.db.prepare('SELECT * FROM phien_dang_nhap').all() as Array<{ token_bam: string }>;
    assert.equal(phien.length, 1);
    assert.equal(phien[0].token_bam, bamToken(token), 'CSDL chỉ lưu băm của token');

    const vao = await td.goi('GET', '/du-an/bao-cao?mo=1');
    assert.equal(vao.trangThai, 200);
    assert.deepEqual(JSON.parse(vao.than).tk, {
        id, hoTen: 'Nguyễn Văn A', email: 'nguyen.van.a@truong.edu.vn', soDienThoai: '0912345678', vaiTro: 'nguoi_dung', donViId: null,
    });
    assert.equal((mt.db.prepare('SELECT dang_nhap_cuoi FROM tai_khoan WHERE id = ?').get(id) as { dang_nhap_cuoi: number }).dang_nhap_cuoi, mt.dong.gio);
    const nk = mt.db.prepare("SELECT chi_tiet FROM nhat_ky WHERE hanh_dong = 'dang_nhap' AND tai_khoan_id = ?").get(id) as { chi_tiet: string };
    assert.deepEqual(JSON.parse(nk.chi_tiet), { bang: 'email' });

    // Đã đăng nhập mở lại /dang-nhap → về thẳng đích
    assert.equal((await td.goi('GET', '/dang-nhap?tiep=%2Fx')).viTri, '/x');

    // Đăng xuất
    const tk = await td.goi('GET', '/tai-khoan');
    const dx = await td.goi('POST', '/dang-xuat', { form: { csrf: layCsrf(tk.than) } });
    assert.equal(dx.viTri, '/dang-nhap?thong_bao=da-dang-xuat');
    assert.ok(dx.setCookie.some(c => c.startsWith('aword_phien=;') && /Max-Age=0/.test(c) && /Domain=aword\.test/.test(c)));
    assert.equal((mt.db.prepare('SELECT COUNT(*) AS n FROM phien_dang_nhap').get() as { n: number }).n, 0);
    assert.equal((await td.goi('GET', '/du-an')).trangThai, 302);
});

test('đăng nhập bằng số điện thoại ở mọi cách viết; nhập sai định dạng thì báo rõ', async (t) => {
    const mt = await dungMoiTruong();
    t.after(mt.tat);
    const id = await mt.taoTaiKhoan({ so: '0987654321', hoTen: 'Chỉ có số' });
    for (const cachViet of ['0987654321', '0987 654 321', '+84 987 654 321', '84987654321']) {
        const td = mt.trinhDuyet();
        const dn = await td.dangNhap(cachViet, MAT_KHAU);
        assert.equal(dn.trangThai, 303, cachViet);
        assert.equal(JSON.parse((await td.goi('GET', '/x')).than).tk.id, id);
    }
    assert.ok(mt.db.prepare(`SELECT 1 FROM nhat_ky WHERE hanh_dong = 'dang_nhap' AND chi_tiet = '{"bang":"so_dien_thoai"}'`).get());
    const td = mt.trinhDuyet();
    const sai = await td.dangNhap('nguyenvana', MAT_KHAU);
    assert.equal(sai.trangThai, 400);
    assert.equal(thongBaoLoi(sai.than), 'Hãy nhập đúng email hoặc số điện thoại di động (vd 0912345678).');
    assert.match(sai.than, /value="nguyenvana"/, 'giữ lại chữ đã nhập');
    assert.equal((await td.dangNhap('0212345678', MAT_KHAU)).trangThai, 400);
});

test('cookie: Secure khi https; bỏ Domain khi tên miền là IP/localhost hoặc mở bằng tên máy khác', async (t) => {
    assert.equal(tenMienCookie('aword.localhost'), 'aword.localhost');
    assert.equal(tenMienCookie('Web.AWord.vn:443'), 'web.aword.vn');
    assert.equal(tenMienCookie('localhost'), undefined);
    assert.equal(tenMienCookie('10.0.0.5'), undefined);
    assert.equal(tenMienCookie('[::1]'), undefined);

    const mt = await dungMoiTruong({ https: true, tenMien: '127.0.0.1' });
    t.after(mt.tat);
    await mt.taoTaiKhoan({ email: 'gv01@truong.vn' });
    const td = mt.trinhDuyet();
    const host = `127.0.0.1:${mt.cong_}`;
    const trang = await td.goi('GET', '/dang-nhap', { host });
    const form = { csrf: layCsrf(trang.than), dinh_danh: 'gv01@truong.vn', mat_khau: MAT_KHAU };
    assert.equal((await td.goi('POST', '/dang-nhap', { host, nguon: `http://${host}`, form })).trangThai, 403, 'https: Origin phải là https');
    const dn = await td.goi('POST', '/dang-nhap', { host, nguon: `https://${host}`, form });
    assert.equal(dn.trangThai, 303);
    const c = dn.setCookie.find(x => x.startsWith('aword_phien='))!;
    assert.match(c, /; Secure$/);
    assert.doesNotMatch(c, /Domain=/);
    assert.equal(trang.header['strict-transport-security'], 'max-age=31536000');

    const mt2 = await dungMoiTruong();
    t.after(mt2.tat);
    await mt2.taoTaiKhoan({ email: 'gv02@truong.vn' });
    const td2 = mt2.trinhDuyet();
    const host2 = `localhost:${mt2.cong_}`;
    const trang2 = await td2.goi('GET', '/dang-nhap', { host: host2 });
    const dn2 = await td2.goi('POST', '/dang-nhap', { host: host2, nguon: `http://${host2}`, form: { csrf: layCsrf(trang2.than), dinh_danh: 'gv02@truong.vn', mat_khau: MAT_KHAU } });
    const c2 = dn2.setCookie.find(x => x.startsWith('aword_phien='))!;
    assert.doesNotMatch(c2, /Domain=/);
});

test('đăng nhập sai: thông báo chung, không lộ email/số có tài khoản hay không; thoát HTML', async (t) => {
    const mt = await dungMoiTruong();
    t.after(mt.tat);
    await mt.taoTaiKhoan({ email: 'cothat@truong.vn', so: '0911111111' });
    const td = mt.trinhDuyet();
    const ketQua = await Promise.all([
        td.dangNhap('cothat@truong.vn', 'Sai-mat-khau-1'), td.dangNhap('khongco@truong.vn', 'Sai-mat-khau-1'),
        td.dangNhap('0911111111', 'Sai-mat-khau-1'), td.dangNhap('0922222222', 'Sai-mat-khau-1'),
    ]);
    for (const kq of ketQua) {
        assert.equal(kq.trangThai, 401);
        assert.equal(thongBaoLoi(kq.than), 'Email/số điện thoại hoặc mật khẩu không đúng.');
    }
    assert.ok(!td.cookie.has('aword_phien'));
    const xss = await td.dangNhap('"><script>alert(1)</script>@x.vn', 'x');
    assert.ok(!xss.than.includes('<script>alert(1)</script>'));
    assert.ok(xss.than.includes('&quot;&gt;&lt;script&gt;'));
});

test('sai 5 lần liên tiếp → khóa 15 phút (báo còn bao lâu), hết 15 phút đăng nhập lại được', async (t) => {
    const mt = await dungMoiTruong();
    t.after(mt.tat);
    const id = await mt.taoTaiKhoan({ email: 'tranthib@truong.vn', so: '0933333333' });
    const td = mt.trinhDuyet();
    // Sai xen kẽ bằng email và số điện thoại vẫn cộng dồn cho cùng tài khoản
    for (let i = 1; i <= 4; i++) { assert.equal((await td.dangNhap(i % 2 ? 'tranthib@truong.vn' : '0933333333', `Sai-${i}-abcdef`)).trangThai, 401); }
    const lan5 = await td.dangNhap('tranthib@truong.vn', 'Sai-5-abcdef');
    assert.equal(lan5.trangThai, 429);
    assert.match(lan5.than, /tạm khóa vì nhập sai mật khẩu 5 lần liên tiếp\. Vui lòng thử lại sau 15 phút/);
    assert.equal((mt.db.prepare('SELECT khoa_den FROM tai_khoan WHERE id = ?').get(id) as { khoa_den: number }).khoa_den, mt.dong.gio + 15 * PHUT);

    mt.troi(10 * PHUT);
    const dungKhiKhoa = await td.dangNhap('0933333333', MAT_KHAU);
    assert.equal(dungKhiKhoa.trangThai, 429, 'đang khóa: đúng mật khẩu cũng không vào được');
    assert.match(dungKhiKhoa.than, /thử lại sau 5 phút/);
    assert.ok(!td.cookie.has('aword_phien'));

    mt.troi(5 * PHUT + 1000);
    assert.equal((await td.dangNhap('tranthib@truong.vn', MAT_KHAU)).trangThai, 303);
    assert.deepEqual({ ...mt.db.prepare('SELECT so_lan_sai, khoa_den FROM tai_khoan WHERE id = ?').get(id) }, { so_lan_sai: 0, khoa_den: null });
    assert.ok(mt.db.prepare("SELECT 1 FROM nhat_ky WHERE hanh_dong = 'tam_khoa_dang_nhap'").get());

    // Email không có tài khoản cũng "bị khóa" y hệt
    const td2 = mt.trinhDuyet({ ip: '203.0.113.9' });
    for (let i = 1; i <= 4; i++) { await td2.dangNhap('aido@truong.vn', `Sai-${i}-abcdef`); }
    assert.match((await td2.dangNhap('AiDo@truong.vn', 'Sai-5-abcdef')).than, /tạm khóa vì nhập sai mật khẩu 5 lần liên tiếp\. Vui lòng thử lại sau 15 phút/);
});

test('giới hạn tần suất theo IP: quá 30 lần sai trong 15 phút thì chặn cả IP đó', async (t) => {
    const mt = await dungMoiTruong();
    t.after(mt.tat);
    await mt.taoTaiKhoan({ email: 'dung@truong.vn' });
    const tanCong = mt.trinhDuyet({ ip: '198.51.100.7' });
    for (let i = 0; i < 30; i++) { await tanCong.dangNhap(`ten${i}@truong.vn`, 'Sai-mat-khau-1'); }
    const biChan = await tanCong.dangNhap('dung@truong.vn', MAT_KHAU);
    assert.equal(biChan.trangThai, 429);
    assert.match(biChan.than, /quá nhiều lần thử từ mạng của bạn/);
    assert.equal((await mt.trinhDuyet({ ip: '198.51.100.8' }).dangNhap('dung@truong.vn', MAT_KHAU)).trangThai, 303, 'IP khác không bị ảnh hưởng');
});

test('tài khoản mới phải đổi mật khẩu lần đầu; đổi xong hủy các phiên khác', async (t) => {
    const mt = await dungMoiTruong();
    t.after(mt.tat);
    const id = await mt.taoTaiKhoan({ email: 'le.thi.c@truong.vn', so: '0944444444', phaiDoi: true, matKhau: 'Tam-abcd-2345' });
    const a = mt.trinhDuyet(), b = mt.trinhDuyet();
    const dn = await a.dangNhap('le.thi.c@truong.vn', 'Tam-abcd-2345', '/soan-thao');
    assert.equal(dn.viTri, '/doi-mat-khau?tiep=%2Fsoan-thao');
    await b.dangNhap('0944444444', 'Tam-abcd-2345');
    assert.equal((await a.goi('GET', '/soan-thao')).trangThai, 302, 'chưa đổi mật khẩu thì chưa vào được AWord');
    assert.equal(mt.cong.xacThucYeuCau(yeuCauGia(`aword_phien=${a.cookie.get('aword_phien')}`)), null);
    assert.equal((await a.goi('GET', '/tai-khoan')).viTri, '/doi-mat-khau?tiep=%2Ftai-khoan');
    assert.equal((await a.api('GET', '/thong-tin')).trangThai, 401);

    const trang = await a.goi('GET', '/doi-mat-khau?tiep=%2Fsoan-thao');
    assert.match(trang.than, /Đặt mật khẩu mới/);
    const csrf = layCsrf(trang.than);
    const gui = (cu: string, moi: string, nhapLai = moi) => a.goi('POST', '/doi-mat-khau', { form: { csrf, tiep: '/soan-thao', mat_khau_cu: cu, mat_khau_moi: moi, nhap_lai: nhapLai } });
    assert.match((await gui('Sai-cu-12345', 'Moi-that-2026')).than, /Mật khẩu hiện tại không đúng/);
    assert.match((await gui('Tam-abcd-2345', 'ngan1')).than, /tối thiểu 10 ký tự/);
    assert.match((await gui('Tam-abcd-2345', 'Toi-0944444444')).than, /không được chứa số điện thoại/);
    assert.match((await gui('Tam-abcd-2345', 'Moi-that-2026', 'Khac-2026-abc')).than, /không khớp/);
    const tokenCu = a.cookie.get('aword_phien');
    const xong = await gui('Tam-abcd-2345', 'Moi-that-2026');
    assert.equal(xong.trangThai, 303);
    assert.equal(xong.viTri, '/soan-thao');
    assert.notEqual(a.cookie.get('aword_phien'), tokenCu, 'đổi token phiên sau khi đổi mật khẩu');

    const tk = mt.db.prepare('SELECT mat_khau_bam, phai_doi_mat_khau FROM tai_khoan WHERE id = ?').get(id) as { mat_khau_bam: string; phai_doi_mat_khau: number };
    assert.equal(tk.phai_doi_mat_khau, 0);
    assert.equal(await kiemMatKhau('Moi-that-2026', tk.mat_khau_bam), true);
    assert.equal((await a.goi('GET', '/soan-thao')).trangThai, 200);
    assert.equal((await b.goi('GET', '/soan-thao')).trangThai, 302, 'phiên ở thiết bị khác bị hủy');
    const nk = mt.db.prepare("SELECT chi_tiet FROM nhat_ky WHERE hanh_dong = 'doi_mat_khau_lan_dau'").get() as { chi_tiet: string };
    assert.ok(nk && !nk.chi_tiet.includes('Moi-that-2026'));
});

test('CSRF: thiếu token, token sai, khác Origin, không có Origin/Referer đều bị chặn', async (t) => {
    const mt = await dungMoiTruong();
    t.after(mt.tat);
    await mt.taoTaiKhoan({ email: 'gv04@truong.vn' });
    const td = mt.trinhDuyet();
    const trang = await td.goi('GET', '/dang-nhap');
    const csrf = layCsrf(trang.than);
    const form = { dinh_danh: 'gv04@truong.vn', mat_khau: MAT_KHAU };
    assert.equal((await td.goi('POST', '/dang-nhap', { form })).trangThai, 403, 'thiếu token');
    assert.equal((await td.goi('POST', '/dang-nhap', { form: { ...form, csrf: csrf.slice(1) + 'A' } })).trangThai, 403, 'token sai');
    assert.equal((await td.goi('POST', '/dang-nhap', { form: { ...form, csrf }, nguon: 'http://ke-gian.example' })).trangThai, 403, 'khác Origin');
    assert.equal((await td.goi('POST', '/dang-nhap', { form: { ...form, csrf }, nguon: null })).trangThai, 403, 'không Origin, không Referer');
    assert.equal((await mt.trinhDuyet().goi('POST', '/dang-nhap', { form: { ...form, csrf } })).trangThai, 403, 'token của trình duyệt khác');
    const quaReferer = await td.goi('POST', '/dang-nhap', { form: { ...form, csrf }, nguon: null, header: { referer: `${mt.nguon}/dang-nhap` } });
    assert.equal(quaReferer.trangThai, 303, 'Referer cùng máy được chấp nhận thay Origin');

    const dx = await td.goi('POST', '/dang-xuat', { form: { csrf } });
    assert.equal(dx.trangThai, 403, 'token trước đăng nhập không dùng cho phiên');
    assert.equal((await td.goi('GET', '/x')).trangThai, 200, 'phiên vẫn còn');
    const sua = await td.goi('POST', '/tai-khoan/lien-he', { form: { email: 'moi@truong.vn', mat_khau: MAT_KHAU, csrf: layCsrf((await td.goi('GET', '/tai-khoan')).than) }, nguon: 'http://ke-gian.example' });
    assert.equal(sua.trangThai, 403);

    const req = (h: Record<string, string>) => ({ headers: h } as unknown as IncomingMessage);
    assert.equal(cungNguonGoc(req({ host: 'aword.test', origin: 'http://aword.test:80' }), false), true);
    assert.equal(cungNguonGoc(req({ host: '127.0.0.1:8080', 'x-forwarded-host': 'web.aword.vn', origin: 'https://web.aword.vn' }), true), true);
    assert.equal(cungNguonGoc(req({ host: 'aword.test', origin: 'http://abc.webview.aword.test' }), false), false);
    assert.equal(cungNguonGoc(req({ host: 'aword.test', origin: 'null' }), false), false);
});

test('chống chuyển hướng mở: "tiep" chỉ nhận đường dẫn tương đối cùng máy', async (t) => {
    for (const xau of ['//ke-gian.example', 'https://ke-gian.example/x', '/\\ke-gian.example', 'javascript:alert(1)', 'ke-gian.example', '/\t/ke-gian.example', '/dang-nhap?tiep=%2Fa']) {
        assert.equal(tiepAnToan(xau), '/', xau);
    }
    assert.equal(tiepAnToan('/du-an/a?b=1#c'), '/du-an/a?b=1#c');
    assert.equal(tiepAnToan('/%2F%2Fke-gian.example'), '/%2F%2Fke-gian.example');

    const mt = await dungMoiTruong();
    t.after(mt.tat);
    await mt.taoTaiKhoan({ email: 'gv05@truong.vn' });
    const td = mt.trinhDuyet();
    assert.equal((await td.dangNhap('gv05@truong.vn', MAT_KHAU, '//ke-gian.example/lua-dao')).viTri, '/');
    assert.equal((await td.goi('GET', '/dang-nhap?tiep=https%3A%2F%2Fke-gian.example')).viTri, '/');
    assert.match((await mt.trinhDuyet().goi('GET', '/dang-nhap?tiep=%2F%2Fke-gian.example')).than, /name="tiep" value="\/"/);

    const res = { writeHead(this: { h: Record<string, string> }, _m: number, h: Record<string, string>) { this.h = h; }, end() { /* */ } } as unknown as ServerResponse & { h: Record<string, string> };
    chuyenDenDangNhap(res, '//ke-gian.example');
    assert.equal(res.h.Location, '/dang-nhap');
    chuyenDenDangNhap(res, '/tai-lieu?x=1');
    assert.equal(res.h.Location, '/dang-nhap?tiep=%2Ftai-lieu%3Fx%3D1');
});

test('xacThucYeuCau trả null khi phiên hết hạn (12 giờ không hoạt động, tối đa 7 ngày), tài khoản bị khóa hoặc hết hạn dùng', async (t) => {
    const mt = await dungMoiTruong();
    t.after(mt.tat);
    const id = await mt.taoTaiKhoan({ email: 'gv06@truong.vn' });
    const td = mt.trinhDuyet();
    await td.dangNhap('gv06@truong.vn', MAT_KHAU);
    const req = () => yeuCauGia(`khac=1; aword_phien=${td.cookie.get('aword_phien')}`);
    assert.equal(mt.cong.xacThucYeuCau(req())?.id, id);
    assert.equal(mt.cong.xacThucYeuCau(yeuCauGia('aword_phien=gia-mao')), null);

    mt.troi(11 * GIO);
    assert.ok(mt.cong.xacThucYeuCau(req()));
    mt.troi(11 * GIO);
    assert.ok(mt.cong.xacThucYeuCau(req()), 'trượt: mỗi lần hoạt động kéo dài thêm 12 giờ');
    mt.troi(12 * GIO);
    assert.equal(mt.cong.xacThucYeuCau(req()), null, '12 giờ không hoạt động');

    await td.dangNhap('gv06@truong.vn', MAT_KHAU);
    for (let gio = 0; gio < 7 * 24 - 10; gio += 10) {
        mt.troi(10 * GIO);
        assert.ok(mt.cong.xacThucYeuCau(req()), `giờ thứ ${gio + 10}`);
    }
    mt.troi(11 * GIO);
    assert.equal(mt.cong.xacThucYeuCau(req()), null, 'quá 7 ngày');

    await td.dangNhap('gv06@truong.vn', MAT_KHAU);
    assert.ok(mt.cong.xacThucYeuCau(req()));
    mt.db.prepare('UPDATE tai_khoan SET han_dung = ? WHERE id = ?').run(mt.dong.gio - 1, id);
    assert.equal(mt.cong.xacThucYeuCau(req()), null, 'hết hạn dùng');
    assert.match((await td.goi('GET', '/dang-nhap')).than, /Tài khoản đã hết hạn dùng/);
    mt.db.prepare("UPDATE tai_khoan SET han_dung = NULL, trang_thai = 'hoat_dong' WHERE id = ?").run(id);
    await td.dangNhap('gv06@truong.vn', MAT_KHAU);
    assert.ok(mt.cong.xacThucYeuCau(req()));
    mt.db.prepare("UPDATE tai_khoan SET trang_thai = 'khoa' WHERE id = ?").run(id);
    assert.equal(mt.cong.xacThucYeuCau(req()), null, 'tài khoản khóa');
    const dn = await mt.trinhDuyet().dangNhap('gv06@truong.vn', MAT_KHAU);
    assert.equal(dn.trangThai, 403);
    assert.match(dn.than, /đang bị khóa/);
});

test('trang tài khoản: thông tin, hạn mức dạng tiền, thiết bị, đăng xuất mọi thiết bị; tự sửa email/số phải nhập mật khẩu, kiểm trùng', async (t) => {
    const mt = await dungMoiTruong();
    t.after(mt.tat);
    const dv = mt.taoDonVi('THCS01', 'Trường THCS <Kim Đồng>');
    const id = await mt.taoTaiKhoan({ email: 'co.hoa@truong.vn', so: '0955555555', hoTen: 'Cô <b>Hoa</b> & "bạn"', donViId: dv });
    await mt.taoTaiKhoan({ email: 'nguoi.khac@truong.vn', so: '0966666666' });
    mt.db.prepare('UPDATE tai_khoan SET han_muc_thang_dong = 200000, han_dung = ? WHERE id = ?').run(Date.UTC(2026, 11, 31, 17), id);
    const a = mt.trinhDuyet(), b = mt.trinhDuyet();
    await a.dangNhap('co.hoa@truong.vn', MAT_KHAU);
    await b.goi('GET', '/dang-nhap');
    const trangB = await b.goi('GET', '/dang-nhap');
    await b.goi('POST', '/dang-nhap', { form: { csrf: layCsrf(trangB.than), dinh_danh: '0955555555', mat_khau: MAT_KHAU }, header: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) coc_coc_browser/130.0 Chrome/130.0 Safari/537.36' } });

    const trang = await a.goi('GET', '/tai-khoan');
    assert.equal(trang.trangThai, 200);
    assert.ok(trang.than.includes('Cô &lt;b&gt;Hoa&lt;/b&gt; &amp; &quot;bạn&quot;'));
    assert.ok(!trang.than.includes('<b>Hoa</b>'));
    assert.ok(trang.than.includes('Trường THCS &lt;Kim Đồng&gt;'));
    assert.match(trang.than, /<dt>Số điện thoại<\/dt><dd>0955 555 555<\/dd>/);
    assert.match(trang.than, /123\.456 đ/);
    assert.match(trang.than, /<progress class="tien-do" max="100" value="62"/);
    assert.match(trang.than, /31\/12\/2026/);
    assert.match(trang.than, /Cốc Cốc trên Windows/);
    assert.match(trang.than, /Thiết bị này/);
    assert.doesNotMatch(trang.than, /hai lớp/, 'không còn xác thực hai lớp');
    mt.db.prepare('UPDATE tai_khoan SET han_muc_thang_dong = 130000 WHERE id = ?').run(id);
    assert.match((await a.goi('GET', '/tai-khoan')).than, /<progress class="tien-do tien-do-sap-het" max="100" value="95"/);
    mt.db.prepare('UPDATE tai_khoan SET han_muc_thang_dong = 100000 WHERE id = ?').run(id);
    assert.match((await a.goi('GET', '/tai-khoan')).than, /<progress class="tien-do tien-do-het" max="100" value="100"[^]*Đã hết hạn mức tháng này/);

    // Tự sửa email/số điện thoại
    const csrf = layCsrf(trang.than);
    const sua = (email: string, so: string, matKhau = MAT_KHAU) => a.goi('POST', '/tai-khoan/lien-he', { form: { csrf, email, so_dien_thoai: so, mat_khau: matKhau } });
    const saiMk = await sua('co.hoa.moi@truong.vn', '0955555555', 'Sai-mat-khau-9');
    assert.equal(saiMk.trangThai, 400);
    assert.match(thongBaoLoi(saiMk.than) ?? '', /Mật khẩu hiện tại không đúng/);
    assert.match(saiMk.than, /value="co.hoa.moi@truong.vn"/, 'giữ lại giá trị đang nhập');
    assert.match(thongBaoLoi((await sua('NGUOI.KHAC@truong.vn', '0955555555')).than) ?? '', /Email nguoi.khac@truong.vn đã dùng cho tài khoản khác/);
    assert.match(thongBaoLoi((await sua('co.hoa@truong.vn', '+84 966 666 666')).than) ?? '', /Số điện thoại 0966666666 đã dùng/);
    assert.match(thongBaoLoi((await sua('', '')).than) ?? '', /Cần có email hoặc số điện thoại/);
    assert.match(thongBaoLoi((await sua('khong-hop-le', '0955555555')).than) ?? '', /không đúng định dạng/);
    const ok = await sua('', '0977 777 777');
    assert.equal(ok.viTri, '/tai-khoan?thong_bao=lien-he');
    assert.deepEqual({ ...mt.db.prepare('SELECT email, so_dien_thoai, ten_dang_nhap FROM tai_khoan WHERE id = ?').get(id) },
        { email: null, so_dien_thoai: '0977777777', ten_dang_nhap: '0977777777' });
    assert.match((await a.goi('GET', '/tai-khoan?thong_bao=lien-he')).than, /Đã lưu email và số điện thoại đăng nhập/);
    assert.equal((await mt.trinhDuyet().dangNhap('co.hoa@truong.vn', MAT_KHAU)).trangThai, 401, 'email cũ không còn đăng nhập được');
    assert.equal((await mt.trinhDuyet().dangNhap('0977777777', MAT_KHAU)).trangThai, 303);
    const nk = mt.db.prepare("SELECT chi_tiet FROM nhat_ky WHERE hanh_dong = 'tu_sua_lien_he'").get() as { chi_tiet: string };
    assert.deepEqual(JSON.parse(nk.chi_tiet), { truoc: { email: 'co.hoa@truong.vn', so_dien_thoai: '0955555555' }, sau: { email: null, so_dien_thoai: '0977777777' } });

    // Đăng xuất thiết bị khác / mọi thiết bị
    const csrf2 = layCsrf((await a.goi('GET', '/tai-khoan')).than);
    assert.equal((await a.goi('POST', '/dang-xuat', { form: { csrf: csrf2, pham_vi: 'thiet-bi-khac' } })).viTri, '/tai-khoan?thong_bao=dang-xuat-khac');
    assert.equal((await b.goi('GET', '/x')).trangThai, 302);
    assert.equal((await a.goi('GET', '/x')).trangThai, 200);
    assert.equal((await a.goi('POST', '/dang-xuat', { form: { csrf: csrf2, pham_vi: 'tat-ca' } })).viTri, '/dang-nhap?thong_bao=da-dang-xuat');
    assert.equal((mt.db.prepare('SELECT COUNT(*) AS n FROM phien_dang_nhap WHERE tai_khoan_id = ?').get(id) as { n: number }).n, 0);
});

test('máy con webview không thuộc cổng; tài nguyên tĩnh có ETag; đường dẫn lạ trả 404; 2FA đã gỡ', async (t) => {
    const mt = await dungMoiTruong();
    t.after(mt.tat);
    await mt.taoTaiKhoan({ email: 'gv08@truong.vn' });
    const td = mt.trinhDuyet();
    await td.dangNhap('gv08@truong.vn', MAT_KHAU);
    const webview = await td.goi('GET', '/dang-nhap', { host: `abc123.webview.${mt.host}` });
    assert.equal(JSON.parse(webview.than).phienAword, true, 'đường dẫn trên máy webview đi vào phiên AWord');
    assert.equal(JSON.parse((await td.goi('GET', '/api/quan-tri/thong-tin', { host: `abc123.webview.${mt.host}` })).than).phienAword, true);

    const css = await td.goi('GET', '/_aword/giao-dien.css');
    assert.equal(css.trangThai, 200);
    assert.match(String(css.header['content-type']), /^text\/css/);
    assert.match(css.than, /#F26B1D/);
    assert.equal((await td.goi('GET', '/_aword/giao-dien.css', { header: { 'if-none-match': String(css.header.etag) } })).trangThai, 304);
    assert.equal((await td.goi('GET', '/_aword/khong-co.js')).trangThai, 404);
    assert.equal(JSON.parse((await td.goi('GET', '/_aword/../src/cau-hinh.ts')).than).phienAword, true, 'URL chuẩn hóa thành /src/... — không đọc tệp máy chủ');
    const api = await td.goi('GET', '/api/khong-co');
    assert.equal(api.trangThai, 404);
    assert.equal(JSON.parse(api.than).loi, 'Không có chức năng này.');
    assert.equal((await td.goi('GET', '/tai-khoanx')).trangThai, 200, '/tai-khoanx thuộc phiên AWord');
    assert.equal((await td.goi('PUT', '/dang-nhap')).trangThai, 405);
    assert.equal(JSON.parse((await td.goi('GET', '/xac-thuc-hai-lop')).than).phienAword, true, 'không còn trang xác thực hai lớp');
});

test('taoQuanTriDauTien: nhận email hoặc số điện thoại, mật khẩu tạm, bắt đổi lần đầu', async () => {
    const db = moCsdl(':memory:');
    const mk = await taoQuanTriDauTien(db, 'QuanTri@So.gov.vn', ' Quản trị viên ');
    const tk = db.prepare('SELECT * FROM tai_khoan').get() as { vai_tro: string; phai_doi_mat_khau: number; mat_khau_bam: string; email: string; ten_dang_nhap: string; ho_ten: string };
    assert.deepEqual([tk.vai_tro, tk.phai_doi_mat_khau, tk.email, tk.ten_dang_nhap, tk.ho_ten], ['quan_tri_he_thong', 1, 'quantri@so.gov.vn', 'quantri@so.gov.vn', 'Quản trị viên']);
    assert.equal(await kiemMatKhau(mk, tk.mat_khau_bam), true);
    await assert.rejects(taoQuanTriDauTien(db, 'quantri@SO.gov.vn', 'Trùng'), /đã dùng cho tài khoản khác/);
    await assert.rejects(taoQuanTriDauTien(db, 'admin', 'Sai'), /email hoặc số điện thoại/);
    await taoQuanTriDauTien(db, '+84 912 000 111', 'Quản trị 2');
    assert.ok(db.prepare("SELECT 1 FROM tai_khoan WHERE so_dien_thoai = '0912000111' AND email IS NULL AND ten_dang_nhap = '0912000111'").get());
    assert.equal((db.prepare("SELECT COUNT(*) AS n FROM nhat_ky WHERE hanh_dong = 'tao_quan_tri_dau_tien'").get() as { n: number }).n, 2);
});
