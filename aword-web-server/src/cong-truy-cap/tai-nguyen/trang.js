// Tiện ích nhỏ cho các trang của cổng truy cập (không có script nội tuyến vì CSP chặt).
(function () {
    'use strict';

    // Hiện/ẩn mật khẩu
    document.querySelectorAll('[data-hien-mat-khau]').forEach(function (nut) {
        nut.addEventListener('click', function () {
            var o = document.getElementById(nut.getAttribute('data-hien-mat-khau'));
            if (!o) { return; }
            var hien = o.type === 'password';
            o.type = hien ? 'text' : 'password';
            nut.textContent = hien ? 'Ẩn' : 'Hiện';
            nut.setAttribute('aria-label', hien ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
        });
    });

    // Hỏi lại trước khi gửi biểu mẫu có hậu quả
    document.querySelectorAll('form[data-xac-nhan]').forEach(function (f) {
        f.addEventListener('submit', function (e) {
            if (!window.confirm(f.getAttribute('data-xac-nhan'))) { e.preventDefault(); }
        });
    });

    // Chống bấm gửi hai lần (bật lại khi quay về trang bằng nút Quay lại)
    document.querySelectorAll('form[method="post"]').forEach(function (f) {
        f.addEventListener('submit', function (e) {
            if (e.defaultPrevented) { return; }
            var nut = f.querySelector('button[type="submit"]');
            if (nut) { setTimeout(function () { nut.disabled = true; }, 0); }
        });
    });
    window.addEventListener('pageshow', function () {
        document.querySelectorAll('form[method="post"] button[type="submit"]').forEach(function (n) { n.disabled = false; });
    });
})();
