// Trang quản trị AWord Web — JavaScript thuần, gọi /api/quan-tri/* (JSON). Mọi dữ liệu hiển thị qua textContent
// (không chèn HTML từ dữ liệu). Quyền được máy chủ kiểm tra lại ở từng thao tác; giao diện chỉ ẩn bớt nút cho gọn.
(function () {
    'use strict';

    const goc = document.getElementById('quan-tri');
    if (!goc) { return; }
    const CSRF = (document.querySelector('meta[name="aword-csrf"]') || {}).content || '';
    const TRANG = goc.dataset.trang;
    const VAI_TRO = goc.dataset.vaiTro;
    const TOI = Number(goc.dataset.toi);
    const HE_THONG = VAI_TRO === 'quan_tri_he_thong';
    let TT = null; // thông tin chung: đơn vị, tên vai trò...

    const TEN_TRANG_THAI_LOC = [
        ['', 'Tất cả trạng thái'], ['hoat_dong', 'Đang hoạt động'], ['khoa', 'Đã khóa'], ['het_han', 'Hết hạn dùng'],
        ['tam_khoa', 'Tạm khóa do nhập sai'], ['chi_doc', 'Chỉ đọc'], ['luu_tru', 'Lưu trữ'],
    ];
    const TEN_HANH_DONG = {
        dang_nhap: 'Đăng nhập', dang_nhap_sai: 'Đăng nhập sai mật khẩu',
        tam_khoa_dang_nhap: 'Tạm khóa do nhập sai', dang_nhap_bi_tu_choi: 'Đăng nhập bị từ chối',
        dang_xuat: 'Đăng xuất', dang_xuat_moi_thiet_bi: 'Đăng xuất khỏi mọi thiết bị', dang_xuat_thiet_bi_khac: 'Đăng xuất thiết bị khác',
        doi_mat_khau: 'Đổi mật khẩu', doi_mat_khau_lan_dau: 'Đổi mật khẩu lần đầu', doi_mat_khau_sai: 'Đổi mật khẩu: sai mật khẩu cũ',
        tu_sua_lien_he: 'Tự sửa email/số điện thoại',
        tao_tai_khoan: 'Tạo tài khoản', nhap_tai_khoan: 'Tạo tài khoản (nhập danh sách)', nhap_danh_sach: 'Nhập danh sách',
        tao_quan_tri_dau_tien: 'Tạo quản trị đầu tiên', sua_tai_khoan: 'Sửa tài khoản', khoa_tai_khoan: 'Khóa tài khoản',
        mo_khoa_tai_khoan: 'Mở khóa tài khoản', doi_trang_thai: 'Đổi trạng thái', go_tam_khoa: 'Gỡ tạm khóa đăng nhập',
        dat_lai_mat_khau: 'Đặt lại mật khẩu', tao_don_vi: 'Tạo đơn vị', sua_don_vi: 'Sửa đơn vị', xoa_don_vi: 'Xóa đơn vị',
        them_bang_gia: 'Thêm mô hình vào bảng giá', sua_bang_gia: 'Sửa bảng giá', loi_dung_phien: 'Lỗi dừng phiên làm việc',
    };
    const TEN_TRUONG = {
        ho_ten: 'Họ tên', email: 'Email', vai_tro: 'Vai trò', don_vi_id: 'Đơn vị', han_dung: 'Hạn dùng', han_muc_thang_dong: 'Hạn mức tháng',
        trang_thai: 'Trạng thái', ma: 'Mã', ten: 'Tên', ten_hien_thi: 'Tên hiển thị', gia_vao: 'Giá vào', gia_ra: 'Giá ra',
        gia_cache_doc: 'Giá đọc cache', gia_cache_ghi: 'Giá ghi cache', bat: 'Bật', so_phien_da_huy: 'Số phiên đã hủy', lan: 'Lần',
        so_tao: 'Số tài khoản đã tạo', so_bo_qua: 'Số dòng bỏ qua', so_dien_thoai: 'Số điện thoại', so_phien: 'Số phiên', phut: 'Phút',
        bang: 'Đăng nhập bằng',
    };

    // ---------------- Tiện ích ----------------

    function el(ten, thuocTinh, ...con) {
        const e = document.createElement(ten);
        for (const [k, v] of Object.entries(thuocTinh || {})) {
            if (v === null || v === undefined || v === false) { continue; }
            if (k === 'lop') { e.className = v; } else if (k.startsWith('on')) { e.addEventListener(k.slice(2), v); } else if (k === 'giaTri') { e.value = v; } else { e.setAttribute(k, v === true ? '' : String(v)); }
        }
        for (const c of con.flat()) {
            if (c === null || c === undefined || c === false) { continue; }
            e.append(c instanceof Node ? c : document.createTextNode(String(c)));
        }
        return e;
    }
    const xoaCon = (e) => { while (e.firstChild) { e.removeChild(e.firstChild); } return e; };
    const tien = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' đ';
    const hai = (n) => String(n).padStart(2, '0');
    function thoiGian(ms) {
        if (!ms) { return '—'; }
        const d = new Date(ms + 7 * 3600 * 1000);
        return hai(d.getUTCDate()) + '/' + hai(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear() + ' ' + hai(d.getUTCHours()) + ':' + hai(d.getUTCMinutes());
    }
    const ngayChu = (iso) => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : 'Không giới hạn';
    const hienSo = (so) => so ? so.slice(0, 4) + ' ' + so.slice(4, 7) + ' ' + so.slice(7) : '';
    /** Email và/hoặc số điện thoại dùng để đăng nhập, nối bằng " · ". */
    const lienHe = (tk) => [tk.email, hienSo(tk.soDienThoai)].filter(Boolean).join(' · ');
    const tenVaiTro = (v) => (TT && TT.vaiTro[v]) || v;
    const tenDonVi = (id) => { const d = TT && TT.donVi.find((x) => x.id === id); return d ? d.ten : (id ? '#' + id : 'Chưa gắn đơn vị'); };

    async function goi(phuongThuc, duongDan, duLieu, header) {
        const h = Object.assign({ 'X-AWord-CSRF': CSRF }, header || {});
        let than;
        if (duLieu instanceof Blob || duLieu instanceof ArrayBuffer) { than = duLieu; h['Content-Type'] = 'application/octet-stream'; } else if (duLieu !== undefined) { than = JSON.stringify(duLieu); h['Content-Type'] = 'application/json'; }
        let r;
        try {
            r = await fetch('/api/quan-tri' + duongDan, { method: phuongThuc, headers: h, body: than, credentials: 'same-origin', cache: 'no-store' });
        } catch (e) {
            throw new Error('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
        }
        let kq = null;
        try { kq = await r.json(); } catch (e) { kq = null; }
        if (r.status === 401) {
            location.href = '/dang-nhap?tiep=' + encodeURIComponent(location.pathname + location.search);
            throw new Error((kq && kq.loi) || 'Phiên đăng nhập đã hết hạn.');
        }
        if (!r.ok) { throw new Error((kq && kq.loi) || ('Có lỗi xảy ra (mã ' + r.status + ').')); }
        return kq;
    }

    const vungTin = el('div', { 'aria-live': 'polite' });
    function baoTin(loai, chu) {
        xoaCon(vungTin).append(el('div', { lop: 'thong-bao thong-bao-' + loai, role: loai === 'loi' ? 'alert' : 'status' }, chu));
        if (loai !== 'loi') { setTimeout(() => { if (vungTin.textContent === chu) { xoaCon(vungTin); } }, 6000); }
        vungTin.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    function nhanTrangThai(tk) {
        if (tk.trangThai === 'khoa') { return el('span', { lop: 'nhan nhan-loi' }, 'Đã khóa'); }
        if (tk.trangThai === 'luu_tru') { return el('span', { lop: 'nhan nhan-xam' }, 'Lưu trữ'); }
        if (tk.trangThai === 'chi_doc') { return el('span', { lop: 'nhan nhan-canh-bao' }, 'Chỉ đọc'); }
        if (tk.hetHan) { return el('span', { lop: 'nhan nhan-canh-bao' }, 'Hết hạn'); }
        if (tk.tamKhoaDen) { return el('span', { lop: 'nhan nhan-canh-bao', title: 'Đến ' + thoiGian(tk.tamKhoaDen) }, 'Tạm khóa'); }
        return el('span', { lop: 'nhan nhan-tot' }, 'Hoạt động');
    }

    function mucDung(tk) {
        if (tk.hanMucThangDong === null) { return el('div', {}, tien(tk.daDungThang), el('div', { lop: 'nho' }, 'không giới hạn')); }
        const pt = tk.hanMucThangDong > 0 ? Math.min(100, Math.round(tk.daDungThang / tk.hanMucThangDong * 100)) : 100;
        return el('div', {}, tien(tk.daDungThang) + ' / ' + tien(tk.hanMucThangDong),
            el('progress', { lop: 'tien-do tien-do-nho' + (pt >= 100 ? ' tien-do-het' : pt >= 80 ? ' tien-do-sap-het' : ''), max: 100, value: pt, 'aria-label': 'Đã dùng ' + pt + '%' }));
    }

    function taiCsv(tenTep, hang) {
        const thoat = (v) => {
            let s = v === null || v === undefined ? '' : String(v);
            if (/^[=+\-@\t\r]/.test(s)) { s = "'" + s; }
            return /[",\r\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        };
        const noiDung = '﻿' + hang.map((h) => h.map(thoat).join(',')).join('\r\n') + '\r\n';
        const url = URL.createObjectURL(new Blob([noiDung], { type: 'text/csv;charset=utf-8' }));
        const a = el('a', { href: url, download: tenTep });
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    }

    function nutSaoChep(chu) {
        const nut = el('button', { type: 'button', lop: 'nut nut-phu nut-nho' }, 'Sao chép');
        nut.addEventListener('click', () => {
            if (!navigator.clipboard) { return; }
            navigator.clipboard.writeText(chu).then(() => { nut.textContent = 'Đã sao chép'; setTimeout(() => { nut.textContent = 'Sao chép'; }, 1800); });
        });
        return nut;
    }

    /** Hộp thoại dùng chung; trả về { hop, than, chan, dong }. */
    function hopThoai(tieuDe) {
        const than = el('div', { lop: 'hop-thoai-than' });
        const chan = el('div', { lop: 'hop-thoai-chan' });
        const hop = el('dialog', { lop: 'hop-thoai', 'aria-label': tieuDe },
            el('div', { lop: 'hop-thoai-dau' }, el('h2', {}, tieuDe), el('button', { type: 'button', lop: 'nut nut-phu nut-nho', onclick: () => hop.close() }, 'Đóng')),
            than, chan);
        hop.addEventListener('close', () => hop.remove());
        document.body.append(hop);
        hop.showModal();
        return { hop, than, chan, dong: () => hop.close() };
    }

    function truong(nhan, o, goiY) {
        if (!o.id) { o.id = 'o-' + Math.random().toString(36).slice(2, 9); }
        return el('div', { lop: 'truong' }, el('label', { for: o.id }, nhan), o, goiY ? el('span', { lop: 'goi-y' }, goiY) : null);
    }

    function chonVaiTro(giaTri, khoa) {
        const s = el('select', { disabled: khoa });
        for (const [ma, ten] of Object.entries(TT.vaiTro)) {
            if (!HE_THONG && ma === 'quan_tri_he_thong' && giaTri !== ma) { continue; }
            s.append(el('option', { value: ma, selected: ma === giaTri }, ten));
        }
        return s;
    }

    function chonDonVi(giaTri, khoa, coTrong) {
        const s = el('select', { disabled: khoa || !HE_THONG });
        if (coTrong && HE_THONG) { s.append(el('option', { value: '', selected: giaTri === null }, 'Chưa gắn đơn vị')); }
        for (const d of TT.donVi) { s.append(el('option', { value: d.id, selected: d.id === giaTri }, d.ten + ' (' + d.ma + ')')); }
        return s;
    }

    function khoiMatKhauTam(tk, matKhau) {
        return el('div', {},
            el('p', {}, 'Mật khẩu tạm của ', el('strong', {}, tk.hoTen), ' — đăng nhập bằng ', el('strong', {}, lienHe(tk)),
                ' (chỉ hiện một lần — hãy ghi lại hoặc sao chép để gửi cho người dùng):'),
            el('div', { lop: 'mat-khau-tam' }, el('code', {}, matKhau), nutSaoChep(matKhau)),
            el('p', { lop: 'chu-phu' }, 'Khi đăng nhập lần đầu bằng mật khẩu này, người dùng sẽ được yêu cầu đặt mật khẩu mới.'));
    }

    // ---------------- Tài khoản ----------------

    async function trangTaiKhoan(khung) {
        const loc = { tim: '', don_vi: '', trang_thai: '', vai_tro: '', trang: 1 };
        const oTim = el('input', { type: 'search', placeholder: 'Họ tên, email, số điện thoại…', 'aria-label': 'Tìm tài khoản' });
        const chonDv = el('select', { 'aria-label': 'Lọc theo đơn vị' }, el('option', { value: '' }, 'Tất cả đơn vị'));
        if (HE_THONG) { chonDv.append(el('option', { value: 'khong' }, 'Chưa gắn đơn vị')); }
        TT.donVi.forEach((d) => chonDv.append(el('option', { value: d.id }, d.ten)));
        const chonTt = el('select', { 'aria-label': 'Lọc theo trạng thái' }, TEN_TRANG_THAI_LOC.map(([ma, ten]) => el('option', { value: ma }, ten)));
        const chonVt = el('select', { 'aria-label': 'Lọc theo vai trò' }, el('option', { value: '' }, 'Tất cả vai trò'),
            Object.entries(TT.vaiTro).filter(([ma]) => HE_THONG || ma !== 'quan_tri_he_thong').map(([ma, ten]) => el('option', { value: ma }, ten)));
        const nutTao = el('button', { type: 'button', lop: 'nut nut-chinh', onclick: () => moTaoTaiKhoan(taiLai) }, 'Tạo tài khoản');
        const bang = el('div');
        const tongKet = el('p', { lop: 'chu-phu' });
        const phanTrang = el('div', { lop: 'phan-trang' });

        khung.append(el('section', { lop: 'the' },
            el('div', { lop: 'thanh-loc' },
                el('div', { lop: 'rong' }, el('label', { for: 'loc-tim' }, 'Tìm'), Object.assign(oTim, { id: 'loc-tim' })),
                HE_THONG ? el('div', {}, el('label', {}, 'Đơn vị'), chonDv) : null,
                el('div', {}, el('label', {}, 'Trạng thái'), chonTt),
                el('div', {}, el('label', {}, 'Vai trò'), chonVt),
                nutTao),
            tongKet, bang, phanTrang));

        let hen = null;
        oTim.addEventListener('input', () => { clearTimeout(hen); hen = setTimeout(() => { loc.tim = oTim.value; loc.trang = 1; taiLai(); }, 300); });
        chonDv.addEventListener('change', () => { loc.don_vi = chonDv.value; loc.trang = 1; taiLai(); });
        chonTt.addEventListener('change', () => { loc.trang_thai = chonTt.value; loc.trang = 1; taiLai(); });
        chonVt.addEventListener('change', () => { loc.vai_tro = chonVt.value; loc.trang = 1; taiLai(); });

        async function taiLai() {
            let kq;
            try {
                kq = await goi('GET', '/tai-khoan?' + new URLSearchParams(loc));
            } catch (e) { baoTin('loi', e.message); return; }
            tongKet.textContent = kq.tong === 0 ? 'Không có tài khoản nào phù hợp.' : 'Có ' + kq.tong + ' tài khoản.';
            xoaCon(bang);
            if (kq.ds.length > 0) {
                bang.append(el('div', { lop: 'bang-cuon' }, el('table', { lop: 'bang' },
                    el('thead', {}, el('tr', {}, ['Họ tên', 'Email / số điện thoại', 'Đơn vị', 'Vai trò', 'Trạng thái', 'Hạn dùng', 'AI tháng này', ''].map((t) => el('th', {}, t)))),
                    el('tbody', {}, kq.ds.map((tk) => el('tr', {},
                        el('td', { lop: 'mot-dong' }, tk.hoTen),
                        el('td', { lop: 'nho' }, tk.email ? el('div', {}, tk.email) : null, tk.soDienThoai ? el('div', { lop: 'mot-dong' }, hienSo(tk.soDienThoai)) : null),
                        el('td', { lop: 'o-rong' }, tk.tenDonVi || el('span', { lop: 'chu-phu' }, '—')),
                        el('td', { lop: 'mot-dong' }, tenVaiTro(tk.vaiTro)),
                        el('td', { lop: 'mot-dong' }, nhanTrangThai(tk), tk.phaiDoiMatKhau ? el('div', { lop: 'nho', title: 'Chưa đổi mật khẩu tạm do quản trị cấp' }, 'Mật khẩu tạm') : null),
                        el('td', { lop: 'so' }, ngayChu(tk.hanDung)),
                        el('td', { lop: 'so' }, mucDung(tk)),
                        el('td', {}, el('button', { type: 'button', lop: 'nut nut-phu nut-nho', onclick: () => moChiTiet(tk.id, taiLai) }, 'Xem / sửa'))))))));
            }
            xoaCon(phanTrang);
            const soTrang = Math.max(1, Math.ceil(kq.tong / kq.soMoiTrang));
            if (soTrang > 1) {
                phanTrang.append(
                    el('button', { type: 'button', lop: 'nut nut-phu nut-nho', disabled: kq.trang <= 1, onclick: () => { loc.trang--; taiLai(); } }, 'Trang trước'),
                    el('span', {}, 'Trang ' + kq.trang + '/' + soTrang),
                    el('button', { type: 'button', lop: 'nut nut-phu nut-nho', disabled: kq.trang >= soTrang, onclick: () => { loc.trang++; taiLai(); } }, 'Trang sau'));
            }
        }
        await taiLai();
    }

    function moTaoTaiKhoan(sauKhiTao) {
        const h = hopThoai('Tạo tài khoản');
        const o = {
            hoTen: el('input', { type: 'text', maxlength: 120, required: true }),
            email: el('input', { type: 'email', maxlength: 254, autocomplete: 'off' }),
            soDienThoai: el('input', { type: 'tel', maxlength: 20, autocomplete: 'off', placeholder: 'vd 0912345678' }),
            vaiTro: chonVaiTro('nguoi_dung', false),
            donViId: chonDonVi(HE_THONG ? null : TT.toi.donViId, false, true),
            hanDung: el('input', { type: 'date' }),
            hanMucThangDong: el('input', { type: 'text', inputmode: 'numeric', placeholder: 'Để trống = không giới hạn' }),
        };
        const loi = el('div');
        const form = el('form', { id: 'form-tao', novalidate: true },
            loi,
            el('p', { lop: 'chu-phu' }, 'Người dùng đăng nhập bằng email hoặc số điện thoại — cần nhập ít nhất một trong hai.'),
            el('div', { lop: 'luoi-form' },
                truong('Họ tên', o.hoTen),
                truong('Email', o.email),
                truong('Số điện thoại', o.soDienThoai),
                truong('Vai trò', o.vaiTro),
                truong('Đơn vị', o.donViId),
                truong('Hạn dùng', o.hanDung, 'Để trống nếu không giới hạn'),
                truong('Hạn mức AI mỗi tháng (đồng)', o.hanMucThangDong, 'Ví dụ 200000')));
        h.than.append(form);
        const nutLuu = el('button', { type: 'submit', form: 'form-tao', lop: 'nut nut-chinh' }, 'Tạo tài khoản');
        h.chan.append(el('button', { type: 'button', lop: 'nut nut-phu', onclick: h.dong }, 'Hủy'), nutLuu);
        o.hoTen.focus();
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            nutLuu.disabled = true;
            xoaCon(loi);
            try {
                const kq = await goi('POST', '/tai-khoan', {
                    hoTen: o.hoTen.value, email: o.email.value, soDienThoai: o.soDienThoai.value, vaiTro: o.vaiTro.value,
                    donViId: o.donViId.value === '' ? null : Number(o.donViId.value), hanDung: o.hanDung.value, hanMucThangDong: o.hanMucThangDong.value,
                });
                xoaCon(h.than).append(el('div', { lop: 'thong-bao thong-bao-tot' }, 'Đã tạo tài khoản cho ' + kq.taiKhoan.hoTen + '.'), khoiMatKhauTam(kq.taiKhoan, kq.matKhauTam));
                xoaCon(h.chan).append(el('button', { type: 'button', lop: 'nut nut-chinh', onclick: h.dong }, 'Xong'));
                sauKhiTao();
            } catch (err) {
                loi.append(el('div', { lop: 'thong-bao thong-bao-loi', role: 'alert' }, err.message));
                nutLuu.disabled = false;
            }
        });
    }

    async function moChiTiet(id, sauKhiDoi) {
        let tk;
        try { tk = await goi('GET', '/tai-khoan/' + id); } catch (e) { baoTin('loi', e.message); return; }
        const h = hopThoai(tk.hoTen);
        const laToi = tk.id === TOI;
        const ve = () => {
            xoaCon(h.than);
            xoaCon(h.chan);
            const o = {
                hoTen: el('input', { type: 'text', maxlength: 120, giaTri: tk.hoTen }),
                email: el('input', { type: 'email', maxlength: 254, giaTri: tk.email || '' }),
                soDienThoai: el('input', { type: 'tel', maxlength: 20, giaTri: tk.soDienThoai || '' }),
                vaiTro: chonVaiTro(tk.vaiTro, laToi),
                donViId: chonDonVi(tk.donViId, laToi, true),
                hanDung: el('input', { type: 'date', giaTri: tk.hanDung || '' }),
                hanMucThangDong: el('input', { type: 'text', inputmode: 'numeric', placeholder: 'Để trống = không giới hạn', giaTri: tk.hanMucThangDong === null ? '' : String(tk.hanMucThangDong) }),
            };
            const loi = el('div');
            // Không truyền null vào Element.append (DOM sẽ in ra chữ "null") — gom qua el() để bỏ phần tử rỗng
            h.than.append(el('div', {},
                loi,
                el('p', { lop: 'hang-nut' }, nhanTrangThai(tk), tk.phaiDoiMatKhau ? el('span', { lop: 'nhan nhan-xam' }, 'Chưa đổi mật khẩu tạm') : null),
                el('dl', { lop: 'thong-tin' },
                    el('dt', {}, 'AI đã dùng tháng này'), el('dd', {}, mucDung(tk)),
                    el('dt', {}, 'Đăng nhập gần nhất'), el('dd', {}, thoiGian(tk.dangNhapCuoi)),
                    el('dt', {}, 'Tạo lúc'), el('dd', {}, thoiGian(tk.taoLuc))),
                el('form', { id: 'form-sua', novalidate: true, onsubmit: luu },
                    el('div', { lop: 'luoi-form' },
                        truong('Họ tên', o.hoTen), truong('Email', o.email), truong('Số điện thoại', o.soDienThoai),
                        truong('Vai trò', o.vaiTro), truong('Đơn vị', o.donViId),
                        truong('Hạn dùng', o.hanDung, 'Để trống nếu không giới hạn'),
                        truong('Hạn mức AI mỗi tháng (đồng)', o.hanMucThangDong))),
                laToi ? el('p', { lop: 'thong-bao thong-bao-thong-tin' }, 'Đây là tài khoản của bạn: vai trò, đơn vị, trạng thái không tự đổi được; mật khẩu đổi ở trang Tài khoản của tôi.') : null));

            const hanhDong = async (duong, xacNhan, thanhCong) => {
                if (xacNhan && !window.confirm(xacNhan)) { return; }
                try {
                    const kq = await goi('POST', '/tai-khoan/' + tk.id + duong);
                    if (kq.matKhauTam) {
                        tk = kq.taiKhoan;
                        ve();
                        h.than.prepend(khoiMatKhauTam(tk, kq.matKhauTam));
                    } else {
                        tk = kq;
                        ve();
                        h.than.prepend(el('div', { lop: 'thong-bao thong-bao-tot', role: 'status' }, thanhCong));
                    }
                    sauKhiDoi();
                } catch (err) {
                    xoaCon(loi).append(el('div', { lop: 'thong-bao thong-bao-loi', role: 'alert' }, err.message));
                }
            };
            async function luu(e) {
                e.preventDefault();
                try {
                    tk = await goi('PUT', '/tai-khoan/' + tk.id, {
                        hoTen: o.hoTen.value, email: o.email.value, soDienThoai: o.soDienThoai.value, vaiTro: o.vaiTro.value,
                        donViId: o.donViId.value === '' ? null : Number(o.donViId.value), hanDung: o.hanDung.value, hanMucThangDong: o.hanMucThangDong.value,
                    });
                    ve();
                    h.than.prepend(el('div', { lop: 'thong-bao thong-bao-tot', role: 'status' }, 'Đã lưu thay đổi.'));
                    sauKhiDoi();
                } catch (err) {
                    xoaCon(loi).append(el('div', { lop: 'thong-bao thong-bao-loi', role: 'alert' }, err.message));
                    loi.scrollIntoView({ block: 'nearest' });
                }
            }

            h.chan.append(el('a', { lop: 'nut nut-phu', href: '/quan-tri/nhat-ky?tai_khoan_id=' + tk.id }, 'Xem nhật ký'));
            if (!laToi) {
                h.chan.append(el('button', { type: 'button', lop: 'nut nut-phu', onclick: () => hanhDong('/dat-lai-mat-khau', 'Đặt lại mật khẩu cho ' + tk.hoTen + '? Người này sẽ bị đăng xuất khỏi mọi thiết bị và phải đổi mật khẩu khi đăng nhập lại.') }, 'Đặt lại mật khẩu'));
                if (tk.trangThai === 'hoat_dong' && !tk.tamKhoaDen) {
                    h.chan.append(el('button', { type: 'button', lop: 'nut nut-nguy-hiem', onclick: () => hanhDong('/khoa', 'Khóa tài khoản ' + tk.hoTen + '? Người này bị đăng xuất ngay và không đăng nhập được cho tới khi mở khóa.', 'Đã khóa tài khoản.') }, 'Khóa tài khoản'));
                } else {
                    h.chan.append(el('button', { type: 'button', lop: 'nut nut-phu', onclick: () => hanhDong('/mo-khoa', null, 'Đã mở khóa tài khoản.') }, 'Mở khóa'));
                }
            }
            h.chan.append(el('button', { type: 'submit', form: 'form-sua', lop: 'nut nut-chinh' }, 'Lưu thay đổi'));
        };
        ve();
    }

    // ---------------- Nhập danh sách ----------------

    function trangNhap(khung) {
        const oTep = el('input', { type: 'file', accept: '.xlsx,.csv', id: 'tep-nhap' });
        const nutKiem = el('button', { type: 'button', lop: 'nut nut-chinh', disabled: true }, 'Kiểm tra tệp');
        const ketQua = el('div');
        khung.append(el('section', { lop: 'the hai-phan' },
            el('div', {},
                el('h2', {}, 'Nhập danh sách tài khoản từ Excel hoặc CSV'),
                el('p', {}, 'Dòng đầu tiên là tiêu đề cột: ', el('strong', {}, TT.cotNhap.join(', ')), '.'),
                el('ul', { lop: 'chu-phu' },
                    el('li', {}, 'Bắt buộc Họ tên và ít nhất một trong hai: Email, Số điện thoại (dùng để đăng nhập, không được trùng).'),
                    el('li', {}, 'Vai trò: Người dùng, Quản trị đơn vị' + (HE_THONG ? ', Quản trị hệ thống' : '') + ' (để trống = Người dùng).'),
                    el('li', {}, 'Hạn dùng: ngày cuối được dùng, dạng 31/12/2026 (để trống = không giới hạn). Hạn mức tháng: số đồng, ví dụ 200000.'),
                    HE_THONG ? el('li', {}, 'Mã đơn vị: đúng mã trong mục Đơn vị.') : el('li', {}, 'Mã đơn vị: để trống — tài khoản sẽ thuộc đơn vị của bạn.')),
                el('p', {}, el('a', { href: '/api/quan-tri/nhap/mau.csv' }, 'Tải tệp mẫu (CSV, mở được bằng Excel)'))),
            el('div', { lop: 'o-tai-tep' }, el('label', { for: 'tep-nhap', lop: 'nhan-o' }, 'Chọn tệp .xlsx hoặc .csv'), el('div', {}, oTep), el('div', { lop: 'hang-nut' }, nutKiem))),
        ketQua);
        oTep.addEventListener('change', () => { nutKiem.disabled = !oTep.files.length; });
        nutKiem.addEventListener('click', async () => {
            const tep = oTep.files[0];
            if (!tep) { return; }
            if (tep.size > 5 * 1024 * 1024) { baoTin('loi', 'Tệp quá lớn (tối đa 5 MB).'); return; }
            nutKiem.disabled = true;
            nutKiem.textContent = 'Đang kiểm tra…';
            try {
                const kq = await goi('POST', '/nhap/xem-truoc', tep, { 'X-AWord-Ten-Tep': encodeURIComponent(tep.name) });
                hienXemTruoc(kq);
            } catch (e) {
                xoaCon(ketQua);
                baoTin('loi', e.message);
            } finally {
                nutKiem.disabled = false;
                nutKiem.textContent = 'Kiểm tra tệp';
            }
        });

        function hienXemTruoc(kq) {
            xoaCon(vungTin);
            xoaCon(ketQua);
            const nutGhi = el('button', { type: 'button', lop: 'nut nut-chinh', disabled: kq.soHopLe === 0 }, 'Ghi ' + kq.soHopLe + ' tài khoản hợp lệ');
            ketQua.append(el('section', { lop: 'the' },
                el('h2', {}, 'Xem trước ', el('span', { lop: 'nhan nhan-tot' }, kq.soHopLe + ' dòng hợp lệ'), kq.soLoi ? el('span', { lop: 'nhan nhan-loi' }, kq.soLoi + ' dòng lỗi') : null),
                kq.soLoi ? el('p', { lop: 'thong-bao thong-bao-canh-bao' }, 'Các dòng lỗi (tô đỏ) sẽ bị bỏ qua. Bạn có thể sửa trong tệp rồi kiểm tra lại, hoặc ghi trước các dòng hợp lệ.') : null,
                el('div', { lop: 'bang-cuon' }, el('table', { lop: 'bang' },
                    el('thead', {}, el('tr', {}, ['Dòng', 'Họ tên', 'Email', 'Số điện thoại', 'Mã đơn vị', 'Vai trò', 'Hạn dùng', 'Hạn mức', 'Kiểm tra'].map((t) => el('th', {}, t)))),
                    el('tbody', {}, kq.ds.map((d) => el('tr', { lop: d.loi.length ? 'dong-loi' : '' },
                        el('td', { lop: 'so' }, d.soDong), el('td', {}, d.dong.hoTen), el('td', {}, d.dong.email), el('td', { lop: 'so' }, d.dong.soDienThoai),
                        el('td', {}, d.dong.maDonVi), el('td', {}, d.dong.vaiTro), el('td', { lop: 'so' }, d.dong.hanDung), el('td', { lop: 'so' }, d.dong.hanMucThangDong),
                        el('td', {}, d.loi.length ? el('ul', { lop: 'danh-sach-loi' }, d.loi.map((l) => el('li', {}, l))) : el('span', { lop: 'nhan nhan-tot' }, 'Hợp lệ'))))))),
                el('div', { lop: 'hang-nut' }, nutGhi)));
            nutGhi.addEventListener('click', async () => {
                if (!window.confirm('Tạo ' + kq.soHopLe + ' tài khoản?')) { return; }
                nutGhi.disabled = true;
                nutGhi.textContent = 'Đang tạo tài khoản…';
                try {
                    const ghi = await goi('POST', '/nhap/ghi', { dong: kq.ds.filter((d) => d.loi.length === 0).map((d) => d.dong) });
                    hienKetQua(ghi);
                } catch (e) {
                    baoTin('loi', e.message);
                    nutGhi.disabled = false;
                    nutGhi.textContent = 'Ghi ' + kq.soHopLe + ' tài khoản hợp lệ';
                }
            });
        }

        function hienKetQua(ghi) {
            xoaCon(ketQua);
            oTep.value = '';
            nutKiem.disabled = true;
            const hang = [['Họ tên', 'Email', 'Số điện thoại', 'Mật khẩu tạm', 'Địa chỉ đăng nhập']].concat(
                ghi.daTao.map((t) => [t.hoTen, t.email || '', t.soDienThoai || '', t.matKhauTam, location.origin + '/dang-nhap']));
            const nutTai = el('button', { type: 'button', lop: 'nut nut-chinh', onclick: () => taiCsv('mat-khau-tam-' + new Date().toISOString().slice(0, 10) + '.csv', hang) }, 'Tải danh sách mật khẩu tạm (CSV)');
            ketQua.append(el('section', { lop: 'the' },
                el('div', { lop: 'thong-bao thong-bao-tot', role: 'status' }, 'Đã tạo ' + ghi.daTao.length + ' tài khoản.' + (ghi.boQua.length ? ' Bỏ qua ' + ghi.boQua.length + ' dòng lỗi.' : '')),
                el('p', { lop: 'thong-bao thong-bao-canh-bao' }, 'Mật khẩu tạm chỉ hiện lần này. Hãy tải danh sách về để phát cho từng người; người dùng phải đặt mật khẩu mới khi đăng nhập lần đầu. Không gửi tệp này qua kênh công khai.'),
                el('div', { lop: 'hang-nut' }, nutTai),
                el('div', { lop: 'bang-cuon' }, el('table', { lop: 'bang' },
                    el('thead', {}, el('tr', {}, ['Dòng', 'Họ tên', 'Email', 'Số điện thoại', 'Mật khẩu tạm'].map((t) => el('th', {}, t)))),
                    el('tbody', {}, ghi.daTao.map((t) => el('tr', {}, el('td', { lop: 'so' }, t.soDong), el('td', {}, t.hoTen), el('td', {}, t.email || ''),
                        el('td', { lop: 'so' }, hienSo(t.soDienThoai)), el('td', {}, el('code', {}, t.matKhauTam)))))))));
        }
    }

    // ---------------- Đơn vị ----------------

    async function trangDonVi(khung) {
        const vung = el('div');
        const oMa = el('input', { type: 'text', maxlength: 32, placeholder: 'VD: THCS01' });
        const oTen = el('input', { type: 'text', maxlength: 200, placeholder: 'VD: Trường THCS Kim Đồng' });
        const form = el('form', { lop: 'thanh-loc', novalidate: true },
            el('div', {}, el('label', {}, 'Mã đơn vị mới'), oMa), el('div', { lop: 'rong' }, el('label', {}, 'Tên đơn vị'), oTen),
            el('button', { type: 'submit', lop: 'nut nut-chinh' }, 'Thêm đơn vị'));
        khung.append(el('section', { lop: 'the' }, form, vung));
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const dv = await goi('POST', '/don-vi', { ma: oMa.value, ten: oTen.value });
                oMa.value = ''; oTen.value = '';
                baoTin('tot', 'Đã thêm đơn vị ' + dv.ten + '.');
                await taiLai();
            } catch (err) { baoTin('loi', err.message); }
        });
        async function taiLai() {
            let ds;
            try { ds = await goi('GET', '/don-vi'); } catch (e) { baoTin('loi', e.message); return; }
            TT.donVi = ds.map((d) => ({ id: d.id, ma: d.ma, ten: d.ten }));
            xoaCon(vung);
            if (!ds.length) { vung.append(el('p', { lop: 'chu-phu' }, 'Chưa có đơn vị nào.')); return; }
            vung.append(el('div', { lop: 'bang-cuon' }, el('table', { lop: 'bang' },
                el('thead', {}, el('tr', {}, ['Mã', 'Tên đơn vị', 'Số tài khoản', ''].map((t) => el('th', {}, t)))),
                el('tbody', {}, ds.map((d) => el('tr', {},
                    el('td', {}, d.ma), el('td', {}, d.ten), el('td', { lop: 'so' }, d.soTaiKhoan),
                    el('td', {}, el('div', { lop: 'hang-nut' },
                        el('button', { type: 'button', lop: 'nut nut-phu nut-nho', onclick: () => suaDonVi(d) }, 'Sửa'),
                        el('button', { type: 'button', lop: 'nut nut-nguy-hiem nut-nho', disabled: d.soTaiKhoan > 0, title: d.soTaiKhoan > 0 ? 'Đơn vị còn tài khoản' : null, onclick: () => xoaDonVi(d) }, 'Xóa')))))))));
        }
        function suaDonVi(d) {
            const h = hopThoai('Sửa đơn vị');
            const ma = el('input', { type: 'text', maxlength: 32, giaTri: d.ma });
            const ten = el('input', { type: 'text', maxlength: 200, giaTri: d.ten });
            const loi = el('div');
            h.than.append(loi, el('form', { id: 'form-dv', novalidate: true, onsubmit: async (e) => {
                e.preventDefault();
                try {
                    await goi('PUT', '/don-vi/' + d.id, { ma: ma.value, ten: ten.value });
                    h.dong();
                    baoTin('tot', 'Đã lưu đơn vị.');
                    await taiLai();
                } catch (err) { xoaCon(loi).append(el('div', { lop: 'thong-bao thong-bao-loi', role: 'alert' }, err.message)); }
            } }, el('div', { lop: 'luoi-form' }, truong('Mã đơn vị', ma), truong('Tên đơn vị', ten))));
            h.chan.append(el('button', { type: 'button', lop: 'nut nut-phu', onclick: h.dong }, 'Hủy'), el('button', { type: 'submit', form: 'form-dv', lop: 'nut nut-chinh' }, 'Lưu'));
        }
        async function xoaDonVi(d) {
            if (!window.confirm('Xóa đơn vị ' + d.ten + '?')) { return; }
            try { await goi('DELETE', '/don-vi/' + d.id); baoTin('tot', 'Đã xóa đơn vị.'); await taiLai(); } catch (e) { baoTin('loi', e.message); }
        }
        await taiLai();
    }

    // ---------------- Bảng giá ----------------

    async function trangBangGia(khung) {
        const vung = el('div');
        khung.append(el('section', { lop: 'the' },
            el('div', { lop: 'tieu-de-trang' }, el('h2', {}, 'Bảng giá mô hình AI'),
                el('button', { type: 'button', lop: 'nut nut-chinh nut-nho', onclick: themMoHinh }, 'Thêm mô hình')),
            el('p', { lop: 'chu-phu' }, 'Giá tính bằng đồng cho 1 triệu token. Hạn mức tháng của từng tài khoản được trừ theo số token thực tế × giá này. Tắt một mô hình thì người dùng không gọi được mô hình đó.'),
            vung));
        async function taiLai() {
            let ds;
            try { ds = await goi('GET', '/bang-gia'); } catch (e) { baoTin('loi', e.message); return; }
            xoaCon(vung);
            if (!ds.length) { vung.append(el('p', { lop: 'chu-phu' }, 'Chưa có mô hình nào trong bảng giá.')); return; }
            vung.append(el('div', { lop: 'bang-cuon' }, el('table', { lop: 'bang' },
                el('thead', {}, el('tr', {}, ['Mô hình', 'Nhà cung cấp', 'Giá đầu vào', 'Giá đầu ra', 'Đọc bộ nhớ đệm', 'Ghi bộ nhớ đệm', 'Bật', ''].map((t) => el('th', {}, t)))),
                el('tbody', {}, ds.map(dongGia)))));
        }
        function dongGia(g) {
            const o = {
                giaVao: el('input', { type: 'text', inputmode: 'numeric', giaTri: String(g.giaVao), 'aria-label': 'Giá đầu vào ' + g.tenHienThi }),
                giaRa: el('input', { type: 'text', inputmode: 'numeric', giaTri: String(g.giaRa), 'aria-label': 'Giá đầu ra ' + g.tenHienThi }),
                giaCacheDoc: el('input', { type: 'text', inputmode: 'numeric', giaTri: String(g.giaCacheDoc), 'aria-label': 'Giá đọc bộ nhớ đệm ' + g.tenHienThi }),
                giaCacheGhi: el('input', { type: 'text', inputmode: 'numeric', giaTri: String(g.giaCacheGhi), 'aria-label': 'Giá ghi bộ nhớ đệm ' + g.tenHienThi }),
                bat: el('input', { type: 'checkbox', checked: g.bat, 'aria-label': 'Bật ' + g.tenHienThi }),
            };
            const luu = el('button', { type: 'button', lop: 'nut nut-phu nut-nho' }, 'Lưu');
            luu.addEventListener('click', async () => {
                try {
                    await goi('PUT', '/bang-gia/' + encodeURIComponent(g.ma), { giaVao: o.giaVao.value, giaRa: o.giaRa.value, giaCacheDoc: o.giaCacheDoc.value, giaCacheGhi: o.giaCacheGhi.value, bat: o.bat.checked });
                    baoTin('tot', 'Đã lưu giá ' + g.tenHienThi + '.');
                } catch (e) { baoTin('loi', e.message); }
            });
            return el('tr', {},
                el('td', {}, el('div', {}, g.tenHienThi), el('div', { lop: 'nho' }, g.ma + (g.moHinhGoc !== g.ma ? ' → ' + g.moHinhGoc : ''))),
                el('td', {}, g.nhaCungCap), el('td', {}, o.giaVao), el('td', {}, o.giaRa), el('td', {}, o.giaCacheDoc), el('td', {}, o.giaCacheGhi),
                el('td', {}, o.bat), el('td', {}, luu));
        }
        function themMoHinh() {
            const h = hopThoai('Thêm mô hình vào bảng giá');
            const o = {
                ma: el('input', { type: 'text', maxlength: 100, placeholder: 'claude-sonnet-4-5' }),
                nhaCungCap: el('select', {}, ['anthropic', 'deepseek', 'openai'].map((n) => el('option', { value: n }, n))),
                moHinhGoc: el('input', { type: 'text', maxlength: 100 }),
                tenHienThi: el('input', { type: 'text', maxlength: 100, placeholder: 'Claude Sonnet 4.5' }),
                giaVao: el('input', { type: 'text', inputmode: 'numeric' }), giaRa: el('input', { type: 'text', inputmode: 'numeric' }),
                giaCacheDoc: el('input', { type: 'text', inputmode: 'numeric', giaTri: '0' }), giaCacheGhi: el('input', { type: 'text', inputmode: 'numeric', giaTri: '0' }),
            };
            const loi = el('div');
            h.than.append(loi, el('form', { id: 'form-gia', novalidate: true, onsubmit: async (e) => {
                e.preventDefault();
                try {
                    await goi('POST', '/bang-gia', {
                        ma: o.ma.value, nhaCungCap: o.nhaCungCap.value, moHinhGoc: o.moHinhGoc.value || o.ma.value, tenHienThi: o.tenHienThi.value,
                        giaVao: o.giaVao.value, giaRa: o.giaRa.value, giaCacheDoc: o.giaCacheDoc.value, giaCacheGhi: o.giaCacheGhi.value, bat: true,
                    });
                    h.dong();
                    baoTin('tot', 'Đã thêm mô hình.');
                    await taiLai();
                } catch (err) { xoaCon(loi).append(el('div', { lop: 'thong-bao thong-bao-loi', role: 'alert' }, err.message)); }
            } }, el('div', { lop: 'luoi-form' },
                truong('Mã mô hình (tên Claude Code gửi lên)', o.ma), truong('Nhà cung cấp', o.nhaCungCap),
                truong('Tên mô hình gốc', o.moHinhGoc, 'Để trống nếu trùng mã'), truong('Tên hiển thị', o.tenHienThi),
                truong('Giá đầu vào (đ/1 triệu token)', o.giaVao), truong('Giá đầu ra (đ/1 triệu token)', o.giaRa),
                truong('Giá đọc bộ nhớ đệm', o.giaCacheDoc), truong('Giá ghi bộ nhớ đệm', o.giaCacheGhi))));
            h.chan.append(el('button', { type: 'button', lop: 'nut nut-phu', onclick: h.dong }, 'Hủy'), el('button', { type: 'submit', form: 'form-gia', lop: 'nut nut-chinh' }, 'Thêm'));
        }
        await taiLai();
    }

    // ---------------- Nhật ký ----------------

    function giaTriTruong(k, v) {
        if (v === null || v === undefined) { return '(trống)'; }
        if (k === 'vai_tro') { return tenVaiTro(v); }
        if (k === 'trang_thai') { return (TT.trangThai && TT.trangThai[v]) || v; }
        if (k === 'don_vi_id') { return tenDonVi(v); }
        if (k === 'han_dung') { return ngayChu(new Date(v + 7 * 3600 * 1000 - 1).toISOString().slice(0, 10)); }
        if (k === 'han_muc_thang_dong' || k.startsWith('gia_')) { return tien(v); }
        if (k === 'so_dien_thoai') { return hienSo(v); }
        if (k === 'bang') { return v === 'email' ? 'email' : 'số điện thoại'; }
        if (typeof v === 'boolean') { return v ? 'có' : 'không'; }
        return typeof v === 'object' ? JSON.stringify(v) : String(v);
    }

    function moTaChiTiet(ct) {
        if (ct === null || ct === undefined) { return ''; }
        if (typeof ct !== 'object') { return String(ct); }
        if (ct.truoc && ct.sau) {
            return Object.keys(ct.sau).map((k) => (TEN_TRUONG[k] || k) + ': ' + giaTriTruong(k, ct.truoc[k]) + ' → ' + giaTriTruong(k, ct.sau[k])).join('; ');
        }
        return Object.entries(ct).map(([k, v]) => (TEN_TRUONG[k] || k) + ': ' + giaTriTruong(k, v)).join('; ');
    }

    async function trangNhatKy(khung) {
        const q = new URLSearchParams(location.search);
        const idTk = q.get('tai_khoan_id');
        let trang = 1;
        const vung = el('div');
        const phanTrang = el('div', { lop: 'phan-trang' });
        khung.append(el('section', { lop: 'the' },
            idTk ? el('p', { lop: 'thong-bao thong-bao-thong-tin' }, 'Đang xem nhật ký liên quan tới một tài khoản. ', el('a', { href: '/quan-tri/nhat-ky' }, 'Xem toàn bộ')) : null,
            vung, phanTrang));
        async function taiLai() {
            let kq;
            try {
                kq = await goi('GET', '/nhat-ky?' + new URLSearchParams(Object.assign({ trang: String(trang) }, idTk ? { tai_khoan_id: idTk } : {})));
            } catch (e) { baoTin('loi', e.message); return; }
            xoaCon(vung);
            if (!kq.ds.length) { vung.append(el('p', { lop: 'chu-phu' }, 'Chưa có mục nhật ký nào.')); } else {
                vung.append(el('div', { lop: 'bang-cuon' }, el('table', { lop: 'bang' },
                    el('thead', {}, el('tr', {}, ['Thời gian', 'Người thực hiện', 'Hành động', 'Đối tượng', 'Chi tiết', 'IP'].map((t) => el('th', {}, t)))),
                    el('tbody', {}, kq.ds.map((d) => el('tr', {},
                        el('td', { lop: 'so' }, thoiGian(d.luc)),
                        el('td', {}, d.nguoiLam ? (d.nguoiLam.hoTen || '#' + d.nguoiLam.id) : el('span', { lop: 'chu-phu' }, 'Hệ thống')),
                        el('td', {}, TEN_HANH_DONG[d.hanhDong] || d.hanhDong),
                        el('td', {}, d.tenDoiTuong || d.doiTuong || ''),
                        el('td', {}, el('div', { lop: 'chi-tiet-nk' }, moTaChiTiet(d.chiTiet))),
                        el('td', { lop: 'nho' }, d.ip || '')))))));
            }
            xoaCon(phanTrang);
            const soTrang = Math.max(1, Math.ceil(kq.tong / kq.soMoiTrang));
            if (soTrang > 1) {
                phanTrang.append(
                    el('button', { type: 'button', lop: 'nut nut-phu nut-nho', disabled: kq.trang <= 1, onclick: () => { trang--; taiLai(); } }, 'Mới hơn'),
                    el('span', {}, 'Trang ' + kq.trang + '/' + soTrang),
                    el('button', { type: 'button', lop: 'nut nut-phu nut-nho', disabled: kq.trang >= soTrang, onclick: () => { trang++; taiLai(); } }, 'Cũ hơn'));
            }
        }
        await taiLai();
    }

    // ---------------- Khởi động ----------------

    (async function () {
        try {
            TT = await goi('GET', '/thong-tin');
        } catch (e) {
            xoaCon(goc).append(el('div', { lop: 'thong-bao thong-bao-loi', role: 'alert' }, e.message));
            return;
        }
        xoaCon(goc).append(vungTin);
        const khung = el('div');
        goc.append(khung);
        const bang = { 'tai-khoan': trangTaiKhoan, nhap: trangNhap, 'don-vi': trangDonVi, 'bang-gia': trangBangGia, 'nhat-ky': trangNhatKy };
        try {
            await (bang[TRANG] || trangTaiKhoan)(khung);
        } catch (e) {
            baoTin('loi', e.message);
        }
    })();
})();
