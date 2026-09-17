// Kiểm thử cách định dạng số. Đây là thứ người dùng nhìn thấy hằng ngày trên thanh tiêu đề nên phải chốt
// lại: một con số vô nghĩa ở đó làm mất niềm tin vào toàn bộ phần thống kê.
import { ngayNgan, soDayDu, soGon, tienDayDu, tienGon } from '../src/common/dinh-dang-so';

describe('soDayDu — dấu chấm phân cách nghìn', () => {
    test('các mốc thường gặp', () => {
        expect(soDayDu(0)).toBe('0');
        expect(soDayDu(999)).toBe('999');
        expect(soDayDu(1000)).toBe('1.000');
        expect(soDayDu(1234567)).toBe('1.234.567');
        expect(soDayDu(1000000000)).toBe('1.000.000.000');
    });

    test('số âm giữ dấu trừ ở đầu, không chen vào giữa', () => {
        expect(soDayDu(-1234567)).toBe('-1.234.567');
    });

    test('làm tròn về số nguyên', () => {
        expect(soDayDu(1234.6)).toBe('1.235');
    });

    test('không phải số thì trả gạch, không trả NaN', () => {
        expect(soDayDu(NaN)).toBe('—');
        expect(soDayDu(Infinity)).toBe('—');
    });
});

describe('soGon — rút gọn cho chỗ hẹp', () => {
    test('dùng K và tr theo cách người Việt đọc, không dùng M/B', () => {
        expect(soGon(950)).toBe('950');
        expect(soGon(12_400)).toBe('12,4K');
        expect(soGon(3_200_000)).toBe('3,2tr');
        expect(soGon(2_500_000_000)).toBe('2,5tỷ');
    });

    test('bỏ phần thập phân khi bằng 0', () => {
        expect(soGon(1000)).toBe('1K');
        expect(soGon(1_000_000)).toBe('1tr');
    });

    test('dấu phẩy là dấu thập phân, không phải dấu chấm', () => {
        expect(soGon(1_550)).toBe('1,6K');
        expect(soGon(1_550)).not.toContain('.');
    });

    test('số âm giữ dấu trừ ở đầu', () => {
        expect(soGon(-12_400)).toBe('-12,4K');
    });

    test('không phải số thì trả gạch', () => {
        expect(soGon(NaN)).toBe('—');
    });
});

describe('tiền', () => {
    test('đầy đủ có đơn vị đồng', () => {
        expect(tienDayDu(1234567)).toBe('1.234.567 đ');
        expect(tienDayDu(0)).toBe('0 đ');
    });

    test('rút gọn không kèm đơn vị — chỗ hẹp đã có nhãn bên cạnh', () => {
        expect(tienGon(1234567)).toBe('1,2tr');
    });
});

describe('ngayNgan — nhãn trục biểu đồ', () => {
    test('bỏ số 0 đứng trước', () => {
        expect(ngayNgan('2026-09-17')).toBe('17/9');
        expect(ngayNgan('2026-12-01')).toBe('1/12');
    });

    test('chuỗi không đúng dạng thì trả nguyên văn, không đoán', () => {
        expect(ngayNgan('17/09/2026')).toBe('17/09/2026');
    });
});
