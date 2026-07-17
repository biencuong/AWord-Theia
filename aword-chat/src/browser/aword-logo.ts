// Logo AWord (mới — "icon C": ô vuông bo góc gradient cam + nội dung TRẮNG: chữ A, tia sáng,
// mũi tên chuyển đổi số, các dòng chữ). Dạng chuỗi SVG để nhúng vào hộp Giới thiệu và trang
// chào mừng (đồng bộ với icon ứng dụng build/icon.ico). Dùng id gradient riêng ("awlg") để
// không đụng khi có nhiều bản trên cùng trang.
export const AWORD_LOGO_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="100%" height="100%">'
    + '<defs><linearGradient id="awlg" gradientUnits="userSpaceOnUse" x1="40" y1="24" x2="220" y2="232">'
    + '<stop offset="0" stop-color="#ffb347"/><stop offset="0.55" stop-color="#f2701b"/><stop offset="1" stop-color="#e04c10"/>'
    + '</linearGradient></defs>'
    + '<rect x="26" y="26" width="204" height="204" rx="50" fill="url(#awlg)"/>'
    + '<g fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M132 116 L184 64"/><polyline points="158,62 186,62 186,90"/></g>'
    + '<path fill="#fff" d="M86 72 C88.2 87 90.3 89.1 105 91.3 C90.3 93.5 88.2 95.6 86 110.6 C83.8 95.6 81.7 93.5 67 91.3 C81.7 89.1 83.8 87 86 72 Z"/>'
    + '<g fill="none" stroke="#fff" stroke-width="15" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M70 188 L93 122 L116 188"/><path d="M81 166 H105"/></g>'
    + '<g fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round">'
    + '<path d="M132 150 H176"/><path d="M132 168 H165"/><path d="M132 186 H152"/></g>'
    + '</svg>';
