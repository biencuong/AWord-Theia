// Xác thực hai lớp bằng mã 6 số theo thời gian (TOTP, RFC 6238: HMAC-SHA1, bước 30 giây) — tương thích Google
// Authenticator, Microsoft Authenticator, ứng dụng xác thực của Zalo/VNeID... Không phụ thuộc thư viện ngoài.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const BANG_BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Ma(buf: Buffer): string {
    let bit = 0, giaTri = 0, ra = '';
    for (const b of buf) {
        giaTri = (giaTri << 8) | b;
        bit += 8;
        while (bit >= 5) {
            ra += BANG_BASE32[(giaTri >>> (bit - 5)) & 31];
            bit -= 5;
        }
    }
    if (bit > 0) { ra += BANG_BASE32[(giaTri << (5 - bit)) & 31]; }
    return ra;
}

export function base32Giai(chuoi: string): Buffer {
    const sach = chuoi.toUpperCase().replace(/[\s=-]/g, '');
    let bit = 0, giaTri = 0;
    const ra: number[] = [];
    for (const kyTu of sach) {
        const i = BANG_BASE32.indexOf(kyTu);
        if (i < 0) { throw new Error('Chuỗi base32 không hợp lệ.'); }
        giaTri = (giaTri << 5) | i;
        bit += 5;
        if (bit >= 8) {
            ra.push((giaTri >>> (bit - 8)) & 255);
            bit -= 8;
        }
    }
    return Buffer.from(ra);
}

/** Bí mật TOTP mới (160 bit, base32). */
export const taoBiMatTotp = (): string => base32Ma(randomBytes(20));

export function maTotp(biMat: string, luc: number = Date.now(), buoc = 30): string {
    const dem = Math.floor(luc / 1000 / buoc);
    const tin = Buffer.alloc(8);
    tin.writeBigUInt64BE(BigInt(dem));
    const h = createHmac('sha1', base32Giai(biMat)).update(tin).digest();
    const lech = h[h.length - 1] & 0x0f;
    const so = ((h[lech] & 0x7f) << 24) | (h[lech + 1] << 16) | (h[lech + 2] << 8) | h[lech + 3];
    return String(so % 1_000_000).padStart(6, '0');
}

/**
 * Kiểm mã, chấp nhận lệch ±1 bước (đồng hồ điện thoại chênh ~30 giây).
 * Trả về số bước đã khớp (để chống dùng lại mã: lưu và từ chối bước <= bước đã dùng), hoặc null.
 */
export function kiemTotp(biMat: string, ma: string, luc: number = Date.now(), buoc = 30): number | null {
    const sach = ma.replace(/\s/g, '');
    if (!/^\d{6}$/.test(sach)) { return null; }
    const hienTai = Math.floor(luc / 1000 / buoc);
    for (const d of [0, -1, 1]) {
        const thu = maTotp(biMat, (hienTai + d) * buoc * 1000, buoc);
        if (timingSafeEqual(Buffer.from(thu), Buffer.from(sach))) { return hienTai + d; }
    }
    return null;
}

/** Địa chỉ otpauth:// để ứng dụng xác thực quét (hiển thị dạng mã QR). */
export function diaChiOtpauth(biMat: string, tenDangNhap: string, nhaPhatHanh = 'AWord'): string {
    const nhan = encodeURIComponent(`${nhaPhatHanh}:${tenDangNhap}`);
    return `otpauth://totp/${nhan}?secret=${biMat}&issuer=${encodeURIComponent(nhaPhatHanh)}&algorithm=SHA1&digits=6&period=30`;
}
