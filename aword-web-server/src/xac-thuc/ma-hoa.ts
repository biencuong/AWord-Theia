// Mật mã dùng chung: băm mật khẩu (scrypt), token ngẫu nhiên, mã hóa bí mật lưu CSDL (AES-256-GCM).
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// scrypt N=2^15, r=8, p=1 (~32 MB, vài chục ms/lần) — đủ chậm với dò mật khẩu, không làm nghẽn máy chủ.
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const DO_DAI_BAM = 32;

function scryptAsync(matKhau: string, muoi: Buffer, n: number, r: number, p: number): Promise<Buffer> {
    return new Promise((ok, loi) => scrypt(matKhau.normalize('NFC'), muoi, DO_DAI_BAM, { N: n, r, p, maxmem: SCRYPT.maxmem },
        (e, kq) => e ? loi(e) : ok(kq)));
}

/** Băm mật khẩu → chuỗi tự mô tả "scrypt$N$r$p$muối$băm" (base64url). */
export async function bamMatKhau(matKhau: string): Promise<string> {
    const muoi = randomBytes(16);
    const bam = await scryptAsync(matKhau, muoi, SCRYPT.N, SCRYPT.r, SCRYPT.p);
    return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, muoi.toString('base64url'), bam.toString('base64url')].join('$');
}

export async function kiemMatKhau(matKhau: string, chuoiBam: string): Promise<boolean> {
    const phan = chuoiBam.split('$');
    if (phan.length !== 6 || phan[0] !== 'scrypt') { return false; }
    const [, n, r, p, muoi, bam] = phan;
    const mongDoi = Buffer.from(bam, 'base64url');
    const thuc = await scryptAsync(matKhau, Buffer.from(muoi, 'base64url'), Number(n), Number(r), Number(p));
    return mongDoi.length === thuc.length && timingSafeEqual(mongDoi, thuc);
}

/** Chính sách mật khẩu: trả về thông báo lỗi tiếng Việt, hoặc undefined nếu đạt. */
export function loiMatKhau(matKhau: string, tenDangNhap?: string): string | undefined {
    if (matKhau.length < 10) { return 'Mật khẩu cần tối thiểu 10 ký tự.'; }
    if (!/[A-Za-zÀ-ỹ]/.test(matKhau) || !/\d/.test(matKhau)) { return 'Mật khẩu cần có cả chữ và số.'; }
    if (tenDangNhap && matKhau.toLowerCase().includes(tenDangNhap.toLowerCase())) { return 'Mật khẩu không được chứa tên đăng nhập.'; }
    return undefined;
}

/** Token ngẫu nhiên 256 bit (cookie phiên, token Cổng AI). */
export const taoToken = (): string => randomBytes(32).toString('base64url');

/** Token có entropy cao → SHA-256 là đủ để lưu (không cần băm chậm). */
export const bamToken = (token: string): string => createHash('sha256').update(token).digest('base64url');

function khoaMaHoa(biMat: string, muc: string): Buffer {
    return Buffer.from(hkdfSync('sha256', biMat, 'aword-web', muc, 32));
}

/** Mã hóa bí mật lưu CSDL (vd khóa TOTP): "v1.iv.tag.dữ-liệu" (base64url). */
export function maHoa(banRo: string, biMat: string, muc = 'bi-mat-csdl'): string {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', khoaMaHoa(biMat, muc), iv);
    const duLieu = Buffer.concat([c.update(banRo, 'utf8'), c.final()]);
    return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), duLieu.toString('base64url')].join('.');
}

export function giaiMa(banMa: string, biMat: string, muc = 'bi-mat-csdl'): string {
    const [v, iv, tag, duLieu] = banMa.split('.');
    if (v !== 'v1' || !iv || !tag || duLieu === undefined) { throw new Error('Bản mã không đúng định dạng.'); }
    const d = createDecipheriv('aes-256-gcm', khoaMaHoa(biMat, muc), Buffer.from(iv, 'base64url'));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(duLieu, 'base64url')), d.final()]).toString('utf8');
}
