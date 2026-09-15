// Khuôn trang HTML của cổng truy cập. Mọi giá trị chèn vào khuôn đều được thoát HTML, trừ khi bọc bằng raw()
// (chỉ dùng cho đoạn HTML cố định do chính máy chủ viết). Không có script/style nội tuyến (CSP chặt).
import {
    TEN_VAI_TRO, dinhDangTien, hanDungSangChu, hienSoDienThoai, laQuanTri, thoiGianViet,
} from '../tai-khoan/tai-khoan.ts';
import type { DongTaiKhoan } from '../tai-khoan/tai-khoan.ts';
import type { DongPhien } from './phien.ts';

export interface Html { readonly __html: string }
export const raw = (s: string): Html => ({ __html: s });

export function thoatHtml(s: string): string {
    return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

function noi(v: unknown): string {
    if (v === null || v === undefined || v === false) { return ''; }
    if (Array.isArray(v)) { return v.map(noi).join(''); }
    if (typeof v === 'object' && '__html' in v) { return (v as Html).__html; }
    return thoatHtml(String(v));
}

export function html(chuoi: TemplateStringsArray, ...giaTri: unknown[]): Html {
    let kq = chuoi[0];
    giaTri.forEach((v, i) => { kq += noi(v) + chuoi[i + 1]; });
    return raw(kq);
}

const logo = html`<span class="logo" aria-label="AWord"><span class="logo-a">A</span>Word</span>`;

/** Tên hiển thị định danh đăng nhập của tài khoản: email, không có thì số điện thoại. */
const dinhDanhHien = (tk: DongTaiKhoan): string => tk.email ?? hienSoDienThoai(tk.so_dien_thoai);

function khung(tuy: { tieuDe: string; csrf?: string; lop?: string; than: Html; nguoi?: DongTaiKhoan; csrfDangXuat?: string; hienTai?: string; kichBan?: string[] }): string {
    const nav = tuy.nguoi ? html`
    <nav class="dieu-huong" aria-label="Chính">
        <a href="/">Mở AWord</a>
        <a href="/tai-khoan"${tuy.hienTai === 'tai-khoan' ? raw(' aria-current="page"') : ''}>Tài khoản</a>
        ${laQuanTri(tuy.nguoi.vai_tro) ? html`<a href="/quan-tri"${tuy.hienTai === 'quan-tri' ? raw(' aria-current="page"') : ''}>Quản trị</a>` : ''}
    </nav>
    <div class="nguoi-dung">
        <span class="ten-nguoi" title="${dinhDanhHien(tuy.nguoi)}">${tuy.nguoi.ho_ten}</span>
        <form method="post" action="/dang-xuat"><input type="hidden" name="csrf" value="${tuy.csrfDangXuat ?? ''}"><button type="submit" class="nut nut-phu nut-nho">Đăng xuất</button></form>
    </div>` : '';
    return '<!doctype html>' + noi(html`
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="same-origin">
${tuy.csrf ? html`<meta name="aword-csrf" content="${tuy.csrf}">` : ''}
<title>${tuy.tieuDe} — AWord</title>
<link rel="stylesheet" href="/_aword/giao-dien.css">
<script src="/_aword/trang.js" defer></script>
${(tuy.kichBan ?? []).map(k => html`<script src="${k}" defer></script>`)}
</head>
<body${tuy.lop ? html` class="${tuy.lop}"` : ''}>
${tuy.nguoi ? html`<header class="dau-trang"><a class="thuong-hieu" href="/">${logo}</a>${nav}</header>` : ''}
${tuy.than}
</body>
</html>`);
}

function thongBao(loi?: string, tin?: string): Html {
    return html`${loi ? html`<div class="thong-bao thong-bao-loi" role="alert">${loi}</div>` : ''}${tin ? html`<div class="thong-bao thong-bao-tot" role="status">${tin}</div>` : ''}`;
}

/**
 * Khối giữa màn hình cho đăng nhập / đổi mật khẩu lần đầu / đăng xuất / báo lỗi. Máy tính: hai cột ngang (trái giới thiệu
 * ngắn, phải biểu mẫu) để thấp gọn, vừa màn hình laptop không phải cuộn; màn hình hẹp: một cột, bỏ phần giới thiệu.
 */
function khungDon(tieuDe: string, chinh: Html): string {
    return khung({
        tieuDe, lop: 'trang-don',
        than: html`<main class="khung-don">
<div class="khoi-don">
    <div class="o-logo">${logo}</div>
    <div class="o-gioi-thieu">
        <p class="mo-ta">Trợ lý AI giúp cán bộ, giáo viên làm việc với văn bản nhanh và đúng quy định.</p>
        <ul class="y-chinh">
            <li>Soạn văn bản đúng thể thức</li>
            <li>Đọc, tóm tắt và tra cứu tài liệu</li>
            <li>Dữ liệu của mỗi người được giữ riêng</li>
        </ul>
        <p class="ho-tro">Cần hỗ trợ? Liên hệ quản trị đơn vị của bạn.</p>
    </div>
    <div class="o-chinh">${chinh}</div>
</div>
</main>`,
    });
}

const truongTiep = (tiep: string): Html => html`<input type="hidden" name="tiep" value="${tiep}">`;

export function trangDangNhap(t: { csrf: string; tiep: string; loi?: string; tin?: string; dinhDanh?: string }): string {
    return khungDon('Đăng nhập', html`
    <h1>Đăng nhập</h1>
    ${thongBao(t.loi, t.tin)}
    <form method="post" action="/dang-nhap" class="bieu-mau">
        <input type="hidden" name="csrf" value="${t.csrf}">${truongTiep(t.tiep)}
        <label for="dinh_danh">Email hoặc số điện thoại</label>
        <input id="dinh_danh" name="dinh_danh" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required maxlength="254" placeholder="vd: ten@truong.edu.vn hoặc 0912345678" value="${t.dinhDanh ?? ''}"${t.dinhDanh ? '' : raw(' autofocus')}>
        <label for="mat_khau">Mật khẩu</label>
        <div class="o-mat-khau">
            <input id="mat_khau" name="mat_khau" type="password" autocomplete="current-password" required maxlength="200"${t.dinhDanh ? raw(' autofocus') : ''}>
            <button type="button" class="nut-hien" data-hien-mat-khau="mat_khau" aria-label="Hiện mật khẩu">Hiện</button>
        </div>
        <button type="submit" class="nut nut-chinh nut-rong">Đăng nhập</button>
    </form>
    <p class="ghi-chu">Quên mật khẩu? Liên hệ quản trị đơn vị để đặt lại.<br>Nhập sai mật khẩu 5 lần liên tiếp sẽ bị tạm khóa 15 phút.</p>`);
}

export function trangDoiMatKhau(t: { csrf: string; tiep: string; loi?: string; lanDau: boolean; nguoi: DongTaiKhoan }): string {
    return khungDon('Đổi mật khẩu', html`
    <h1>${t.lanDau ? 'Đặt mật khẩu mới' : 'Đổi mật khẩu'}</h1>
    ${t.lanDau ? html`<p class="dan">Bạn đang dùng mật khẩu tạm — hãy đặt mật khẩu riêng.</p>` : ''}
    ${thongBao(t.loi)}
    ${bieuMauDoiMatKhau(t.csrf, t.tiep, t.nguoi)}
    ${t.lanDau ? html`<form method="post" action="/dang-xuat" class="bieu-mau-phu"><input type="hidden" name="csrf" value="${t.csrf}"><button type="submit" class="nut-lien-ket">Đăng xuất</button></form>`
        : html`<p class="bieu-mau-phu"><a href="/tai-khoan">Quay lại trang tài khoản</a></p>`}`);
}

function bieuMauDoiMatKhau(csrf: string, tiep: string, nguoi: DongTaiKhoan): Html {
    return html`<form method="post" action="/doi-mat-khau" class="bieu-mau">
        <input type="hidden" name="csrf" value="${csrf}">${truongTiep(tiep)}
        <input type="text" name="dinh_danh" value="${nguoi.email ?? nguoi.so_dien_thoai ?? ''}" autocomplete="username" hidden>
        <label for="mat_khau_cu">Mật khẩu hiện tại</label>
        <input id="mat_khau_cu" name="mat_khau_cu" type="password" autocomplete="current-password" required maxlength="200">
        <label for="mat_khau_moi">Mật khẩu mới</label>
        <input id="mat_khau_moi" name="mat_khau_moi" type="password" autocomplete="new-password" required minlength="10" maxlength="200" aria-describedby="goi-y-mk">
        <p id="goi-y-mk" class="goi-y">Tối thiểu 10 ký tự, có cả chữ và số (vd: Truong-em-2026).</p>
        <label for="nhap_lai">Nhập lại mật khẩu mới</label>
        <input id="nhap_lai" name="nhap_lai" type="password" autocomplete="new-password" required maxlength="200">
        <button type="submit" class="nut nut-chinh">Lưu mật khẩu mới</button>
    </form>`;
}

export function trangDangXuat(t: { csrf: string; nguoi: DongTaiKhoan }): string {
    return khungDon('Đăng xuất', html`
    <h1>Đăng xuất</h1>
    <p class="dan">Bạn đang đăng nhập bằng <strong>${dinhDanhHien(t.nguoi)}</strong>. Đăng xuất khỏi thiết bị này?</p>
    <form method="post" action="/dang-xuat" class="bieu-mau">
        <input type="hidden" name="csrf" value="${t.csrf}">
        <button type="submit" class="nut nut-chinh nut-rong">Đăng xuất</button>
    </form>
    <p class="bieu-mau-phu"><a href="/">Quay lại AWord</a></p>`);
}

/** Tóm tắt trình duyệt: "Cốc Cốc trên Windows". */
export function tomTatTrinhDuyet(ua: string | null): string {
    if (!ua) { return 'Không rõ thiết bị'; }
    const trinh = /coc_coc_browser/i.test(ua) ? 'Cốc Cốc' : /Edg\//.test(ua) ? 'Microsoft Edge' : /Firefox\//.test(ua) ? 'Firefox'
        : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Trình duyệt khác';
    const he = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iPhone/iPad'
        : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
    return he ? `${trinh} trên ${he}` : trinh;
}

export function trangTaiKhoan(t: {
    nguoi: DongTaiKhoan; csrf: string; tenDonVi: string | null; daDung: number; thang: string;
    phien: DongPhien[]; tokenBamHienTai: string; loi?: string; tin?: string;
    /** Giá trị đang nhập ở biểu mẫu sửa email/số (khi báo lỗi thì giữ lại). */
    lienHe?: { email: string; soDienThoai: string };
}): string {
    const tk = t.nguoi;
    const hanMuc = tk.han_muc_thang_dong;
    const phanTram = hanMuc && hanMuc > 0 ? Math.min(100, Math.round(t.daDung / hanMuc * 100)) : (hanMuc === 0 ? 100 : 0);
    const lopTienDo = hanMuc === null || phanTram < 80 ? 'tien-do' : phanTram >= 100 ? 'tien-do tien-do-het' : 'tien-do tien-do-sap-het';
    const [nam, thang] = t.thang.split('-');
    const lienHe = t.lienHe ?? { email: tk.email ?? '', soDienThoai: tk.so_dien_thoai ?? '' };
    return khung({
        tieuDe: 'Tài khoản', nguoi: tk, csrfDangXuat: t.csrf, hienTai: 'tai-khoan',
        than: html`<main class="noi-dung">
    <h1>Tài khoản của tôi</h1>
    ${thongBao(t.loi, t.tin)}
    <div class="luoi-cot">
    <section class="the">
        <h2>Thông tin</h2>
        <dl class="thong-tin">
            <dt>Họ tên</dt><dd>${tk.ho_ten}</dd>
            <dt>Email</dt><dd>${tk.email ?? html`<span class="chu-phu">Chưa có</span>`}</dd>
            <dt>Số điện thoại</dt><dd>${tk.so_dien_thoai ? hienSoDienThoai(tk.so_dien_thoai) : html`<span class="chu-phu">Chưa có</span>`}</dd>
            <dt>Đơn vị</dt><dd>${t.tenDonVi ?? 'Chưa gắn đơn vị'}</dd>
            <dt>Vai trò</dt><dd>${TEN_VAI_TRO[tk.vai_tro]}</dd>
            <dt>Hạn dùng</dt><dd>${hanDungSangChu(tk.han_dung)}</dd>
        </dl>
    </section>
    <section class="the">
        <h2>Mức dùng AI tháng ${thang}/${nam}</h2>
        <p class="so-lon">${dinhDangTien(t.daDung)}${hanMuc !== null ? html` <span class="chu-phu">/ ${dinhDangTien(hanMuc)}</span>` : ''}</p>
        ${hanMuc !== null ? html`<progress class="${lopTienDo}" max="100" value="${phanTram}" aria-label="Đã dùng ${phanTram}% hạn mức">${phanTram}%</progress>
        <p class="chu-phu">${phanTram >= 100 ? 'Đã hết hạn mức tháng này — liên hệ quản trị đơn vị nếu cần thêm.' : `Đã dùng ${phanTram}% hạn mức. Hạn mức được tính lại từ ngày 1 hằng tháng.`}</p>`
        : html`<p class="chu-phu">Tài khoản không giới hạn hạn mức.</p>`}
    </section>
    <section class="the">
        <h2>Email và số điện thoại đăng nhập</h2>
        <form method="post" action="/tai-khoan/lien-he" class="bieu-mau">
            <input type="hidden" name="csrf" value="${t.csrf}">
            <label for="email">Email</label>
            <input id="email" name="email" type="email" autocomplete="email" maxlength="254" value="${lienHe.email}">
            <label for="so_dien_thoai">Số điện thoại</label>
            <input id="so_dien_thoai" name="so_dien_thoai" type="tel" autocomplete="tel" inputmode="tel" maxlength="20" value="${lienHe.soDienThoai}">
            <p class="goi-y">Đăng nhập được bằng một trong hai. Cần giữ ít nhất một.</p>
            <label for="mat_khau_xac_nhan">Mật khẩu hiện tại (để xác nhận)</label>
            <input id="mat_khau_xac_nhan" name="mat_khau" type="password" autocomplete="current-password" required maxlength="200">
            <button type="submit" class="nut nut-chinh">Lưu thay đổi</button>
        </form>
    </section>
    <section class="the">
        <h2>Đổi mật khẩu</h2>
        ${bieuMauDoiMatKhau(t.csrf, '/tai-khoan', tk)}
    </section>
    </div>
    <section class="the">
        <h2>Thiết bị đang đăng nhập</h2>
        <div class="bang-cuon"><table class="bang">
            <thead><tr><th>Thiết bị</th><th>Địa chỉ IP</th><th>Đăng nhập lúc</th><th>Hoạt động gần nhất</th></tr></thead>
            <tbody>${t.phien.map(p => html`<tr>
                <td>${tomTatTrinhDuyet(p.trinh_duyet)}${p.token_bam === t.tokenBamHienTai ? html` <span class="nhan nhan-thong-tin">Thiết bị này</span>` : ''}</td>
                <td>${p.ip ?? ''}</td><td>${thoiGianViet(p.tao_luc)}</td><td>${thoiGianViet(p.hoat_dong_cuoi)}</td></tr>`)}
            </tbody>
        </table></div>
        <div class="hang-nut">
            ${t.phien.length > 1 ? html`<form method="post" action="/dang-xuat"><input type="hidden" name="csrf" value="${t.csrf}"><input type="hidden" name="pham_vi" value="thiet-bi-khac"><button type="submit" class="nut nut-phu">Đăng xuất các thiết bị khác</button></form>` : ''}
            <form method="post" action="/dang-xuat" data-xac-nhan="Đăng xuất khỏi mọi thiết bị, kể cả thiết bị này?"><input type="hidden" name="csrf" value="${t.csrf}"><input type="hidden" name="pham_vi" value="tat-ca"><button type="submit" class="nut nut-nguy-hiem">Đăng xuất khỏi mọi thiết bị</button></form>
        </div>
    </section>
</main>`,
    });
}

export function trangQuanTri(t: { nguoi: DongTaiKhoan; csrf: string; trang: string }): string {
    const heThong = t.nguoi.vai_tro === 'quan_tri_he_thong';
    const muc: Array<[string, string, string]> = [
        ['tai-khoan', '/quan-tri', 'Tài khoản'],
        ['nhap', '/quan-tri/nhap', 'Nhập danh sách'],
        ...(heThong ? [['don-vi', '/quan-tri/don-vi', 'Đơn vị'], ['bang-gia', '/quan-tri/bang-gia', 'Bảng giá mô hình']] as Array<[string, string, string]> : []),
        ['nhat-ky', '/quan-tri/nhat-ky', 'Nhật ký'],
    ];
    return khung({
        tieuDe: 'Quản trị', nguoi: t.nguoi, csrf: t.csrf, csrfDangXuat: t.csrf, hienTai: 'quan-tri', kichBan: ['/_aword/quan-tri.js'],
        than: html`<main class="noi-dung">
    <div class="dau-quan-tri">
        <h1>Quản trị <span class="nhan nhan-thong-tin">${TEN_VAI_TRO[t.nguoi.vai_tro]}</span></h1>
        <nav class="the-tab" aria-label="Mục quản trị">${muc.map(([ma, dc, ten]) => html`<a href="${dc}"${ma === t.trang ? raw(' aria-current="page"') : ''}>${ten}</a>`)}</nav>
    </div>
    <div id="quan-tri" data-trang="${t.trang}" data-vai-tro="${t.nguoi.vai_tro}" data-toi="${t.nguoi.id}">
        <noscript><p class="thong-bao thong-bao-loi">Trang quản trị cần bật JavaScript trên trình duyệt.</p></noscript>
        <p class="chu-phu" data-dang-tai>Đang tải…</p>
    </div>
</main>`,
    });
}

export function trangLoi(t: { trangThai: number; tieuDe: string; noiDung: string; nguoi?: DongTaiKhoan; csrf?: string }): string {
    const than = html`<h1>${t.tieuDe}</h1><p class="dan">${t.noiDung}</p>
    <p class="hang-nut"><a class="nut nut-chinh" href="/">Về trang AWord</a>${t.nguoi ? html` <a class="nut nut-phu" href="/tai-khoan">Tài khoản của tôi</a>` : ''}</p>`;
    if (t.nguoi) {
        return khung({ tieuDe: t.tieuDe, nguoi: t.nguoi, csrfDangXuat: t.csrf, than: html`<main class="noi-dung"><section class="the">${than}</section></main>` });
    }
    return khungDon(t.tieuDe, than);
}
