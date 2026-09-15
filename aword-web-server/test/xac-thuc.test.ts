import { test } from 'node:test';
import assert from 'node:assert/strict';
import { base32Giai, base32Ma, kiemTotp, maTotp, taoBiMatTotp } from '../src/xac-thuc/totp.ts';
import { bamMatKhau, bamToken, giaiMa, kiemMatKhau, loiMatKhau, maHoa, taoToken } from '../src/xac-thuc/ma-hoa.ts';

// Véc-tơ kiểm thử RFC 6238 (SHA1, khóa ASCII "12345678901234567890"), lấy 6 chữ số cuối.
const BI_MAT_RFC = base32Ma(Buffer.from('12345678901234567890'));

test('base32 mã hóa/giải mã hai chiều', () => {
    assert.equal(BI_MAT_RFC, 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    assert.equal(base32Giai(BI_MAT_RFC).toString(), '12345678901234567890');
    const b = taoBiMatTotp();
    assert.equal(base32Giai(b).length, 20);
});

test('TOTP khớp véc-tơ RFC 6238', () => {
    const cap: Array<[number, string]> = [
        [59, '287082'], [1111111109, '081804'], [1111111111, '050471'], [1234567890, '005924'], [2000000000, '279037'],
    ];
    for (const [giay, ma] of cap) {
        assert.equal(maTotp(BI_MAT_RFC, giay * 1000), ma, `thời điểm ${giay}`);
    }
});

test('TOTP chấp nhận lệch ±1 bước, từ chối mã sai/định dạng sai', () => {
    const luc = 1_700_000_000_000;
    const ma = maTotp(BI_MAT_RFC, luc);
    assert.ok(kiemTotp(BI_MAT_RFC, ma, luc + 30_000) !== null);
    assert.ok(kiemTotp(BI_MAT_RFC, ma, luc - 30_000) !== null);
    assert.equal(kiemTotp(BI_MAT_RFC, ma, luc + 95_000), null);
    assert.equal(kiemTotp(BI_MAT_RFC, '12345', luc), null);
    assert.equal(kiemTotp(BI_MAT_RFC, 'abcdef', luc), null);
});

test('băm và kiểm mật khẩu (scrypt), mật khẩu tiếng Việt', async () => {
    const bam = await bamMatKhau('Mật khẩu 2026');
    assert.match(bam, /^scrypt\$32768\$8\$1\$/);
    assert.equal(await kiemMatKhau('Mật khẩu 2026', bam), true);
    assert.equal(await kiemMatKhau('mật khẩu 2026', bam), false);
    assert.equal(await kiemMatKhau('x', 'khong-dung-dinh-dang'), false);
});

test('chính sách mật khẩu', () => {
    assert.ok(loiMatKhau('ngan1'));
    assert.ok(loiMatKhau('chuaco-so-nao-ca'));
    assert.ok(loiMatKhau('nguyenvana2026', 'nguyenvana'));
    assert.equal(loiMatKhau('Hoa-Sen-2026-xanh', 'nguyenvana'), undefined);
});

test('token ngẫu nhiên và mã hóa bí mật AES-GCM', () => {
    const t = taoToken();
    assert.equal(Buffer.from(t, 'base64url').length, 32);
    assert.notEqual(bamToken(t), t);
    const biMat = 'x'.repeat(40);
    const ma = maHoa('JBSWY3DPEHPK3PXP', biMat);
    assert.equal(giaiMa(ma, biMat), 'JBSWY3DPEHPK3PXP');
    assert.throws(() => giaiMa(ma, 'y'.repeat(40)));
    const phan = ma.split('.');
    phan[3] = Buffer.from('gia-mao').toString('base64url');
    assert.throws(() => giaiMa(phan.join('.'), biMat));
});
