// Định dạng số kiểu Việt Nam cho chỉ báo và trang thống kê.
//
// Tách riêng và thuần túy để kiểm thử được: chỉ báo trên thanh tiêu đề rất hẹp, nên cách rút gọn số là thứ
// người dùng nhìn thấy hằng ngày, không phải chi tiết vặt. Sai một ly ở đây là một con số vô nghĩa trên
// thanh tiêu đề.

/** Dấu phân cách nghìn kiểu Việt Nam: 1234567 → "1.234.567". */
export function soDayDu(n: number): string {
    if (!Number.isFinite(n)) { return '—'; }
    const am = n < 0;
    const s = Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return am ? `-${s}` : s;
}

/** Số thập phân kiểu Việt Nam: dấu phẩy làm dấu thập phân, tối đa `soLe` chữ số. */
function thapPhan(n: number, soLe: number): string {
    const s = n.toFixed(soLe);
    return s.endsWith(',0') || s.endsWith('.0') ? s.slice(0, -2) : s.replace('.', ',');
}

/**
 * Rút gọn số lượng lớn: 950 → "950", 12.400 → "12,4K", 3.200.000 → "3,2tr".
 *
 * Dùng "K" và "tr" theo cách người Việt đọc ("100k", "1 triệu"), không dùng "M"/"B" của tiếng Anh.
 */
export function soGon(n: number): string {
    if (!Number.isFinite(n)) { return '—'; }
    const am = n < 0;
    const v = Math.abs(n);
    let ra: string;
    if (v < 1_000) { ra = String(Math.round(v)); }
    else if (v < 1_000_000) { ra = `${thapPhan(v / 1_000, 1)}K`; }
    else if (v < 1_000_000_000) { ra = `${thapPhan(v / 1_000_000, 1)}tr`; }
    else { ra = `${thapPhan(v / 1_000_000_000, 1)}tỷ`; }
    return am ? `-${ra}` : ra;
}

/** Tiền đầy đủ: 1234567 → "1.234.567 đ". */
export function tienDayDu(n: number): string {
    return `${soDayDu(n)} đ`;
}

/** Tiền rút gọn cho chỗ hẹp: 1234567 → "1,2tr". */
export function tienGon(n: number): string {
    return soGon(n);
}

/** Số ngày dạng ngắn cho trục biểu đồ: "2026-09-17" → "17/9". */
export function ngayNgan(ngay: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ngay);
    return m ? `${Number(m[3])}/${Number(m[2])}` : ngay;
}
