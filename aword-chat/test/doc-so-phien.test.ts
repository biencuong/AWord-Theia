// Kiểm thử lõi đọc sổ phiên. Dựng dữ liệu ngay trong tệp này — KHÔNG đọc sổ phiên thật của máy, để bài
// kiểm thử chạy được ở mọi máy và cho cùng một kết quả.
import {
    congDon, dauThangViet, docLuot, gopTheoNgay, khuyenTrung, mocNgayViet, ngayBatDauCachDay, ngayViet,
    quetKhoi, tongTheoNgay, type LuotGoi, type MauTheoNgay,
} from '../src/node/doc-so-phien';
import { tienLuot } from '../src/common/so-token';

interface ThamSoDong {
    id: string;
    model?: string;
    luc?: string;
    vao?: number;
    ra?: number;
    cacheDoc?: number;
    cacheGhi?: number;
    phu?: boolean;
    type?: string;
}

/** Đếm tăng dần thay cho số ngẫu nhiên: dữ liệu kiểm thử phải tất định giữa các lần chạy. */
let demDong = 0;

/** Một dòng jsonl đúng như Claude Code ghi. */
function dong(t: ThamSoDong): string {
    return JSON.stringify({
        type: t.type ?? 'assistant',
        timestamp: t.luc ?? '2026-09-17T01:36:33.809Z',
        isSidechain: t.phu ?? false,
        uuid: `u-${t.id}-${demDong++}`,
        sessionId: 's-1',
        message: {
            id: t.id,
            model: t.model ?? 'claude-sonnet-5',
            usage: {
                input_tokens: t.vao ?? 0,
                output_tokens: t.ra ?? 0,
                cache_read_input_tokens: t.cacheDoc ?? 0,
                cache_creation_input_tokens: t.cacheGhi ?? 0,
            },
        },
    });
}

const buf = (s: string): Buffer => Buffer.from(s, 'utf8');

describe('docLuot — tách một dòng thành lượt gọi', () => {
    test('bản ghi assistant hợp lệ được đọc đủ số', () => {
        const l = docLuot(JSON.parse(dong({ id: 'm1', vao: 2, ra: 2665, cacheDoc: 29852, cacheGhi: 23663 })));
        expect(l).not.toBeNull();
        expect(l).toMatchObject({ id: 'm1', vao: 2, ra: 2665, cacheDoc: 29852, cacheGhi: 23663 });
    });

    test('bản ghi không phải assistant bị bỏ', () => {
        expect(docLuot(JSON.parse(dong({ id: 'm2', type: 'user' })))).toBeNull();
    });

    test('model <synthetic> bị bỏ — không phải lượt gọi thật', () => {
        expect(docLuot(JSON.parse(dong({ id: 'm3', model: '<synthetic>' })))).toBeNull();
    });

    test('thiếu usage hoặc thiếu id thì bỏ', () => {
        expect(docLuot({ type: 'assistant', timestamp: '2026-09-17T01:36:33.809Z', message: { id: 'x', model: 'y' } })).toBeNull();
        expect(docLuot({ type: 'assistant', timestamp: '2026-09-17T01:36:33.809Z', message: { model: 'y', usage: {} } })).toBeNull();
    });

    test('thiếu mốc thời gian thì bỏ (không gán bừa vào hôm nay)', () => {
        const r = { type: 'assistant', message: { id: 'x', model: 'y', usage: { input_tokens: 1 } } };
        expect(docLuot(r)).toBeNull();
    });

    test('số âm hoặc không phải số được coi là 0, không làm hỏng tổng', () => {
        const l = docLuot({
            type: 'assistant', timestamp: '2026-09-17T01:36:33.809Z',
            message: { id: 'm4', model: 'y', usage: { input_tokens: -5, output_tokens: 'nhieu' } },
        });
        expect(l).toMatchObject({ vao: 0, ra: 0 });
    });
});

describe('quetKhoi — đọc theo byte, chỉ tiêu thụ dòng đã trọn vẹn', () => {
    test('MỘT lượt gọi nằm ở NHIỀU dòng: ba dòng cùng message.id chỉ tính một lần', () => {
        // Đây là lỗi đắt nhất nếu cộng ngây thơ: đo trên sổ thật, cộng theo dòng sai 3,58 lần ở token vào.
        const noiDung = [dong({ id: 'm1' }), dong({ id: 'm1' }), dong({ id: 'm1' })].join('\n') + '\n';
        const kq = quetKhoi(buf(noiDung));
        expect(kq.luot).toHaveLength(3);

        const daThay = new Set<string>();
        const moi = khuyenTrung(kq.luot, daThay);
        expect(moi).toHaveLength(1);
        expect(moi[0]!.id).toBe('m1');
    });

    test('dòng cuối ghi dở KHÔNG được tính, và lần đọc sau đọc trọn nó mà không nhân đôi', () => {
        const d1 = dong({ id: 'm1', vao: 10 });
        const d2 = dong({ id: 'm2', vao: 20 });
        const d3 = dong({ id: 'm3', vao: 30 });

        // Lần 1: tệp mới có d1 và một nửa của d2
        const lan1 = buf(`${d1}\n${d2.slice(0, 40)}`);
        const kq1 = quetKhoi(lan1);
        expect(kq1.luot.map(l => l.id)).toEqual(['m1']);
        expect(kq1.daDoc).toBe(Buffer.byteLength(d1) + 1);

        // Lần 2: d2 đã ghi xong, thêm d3; đọc tiếp từ đúng chỗ đã tiêu thụ
        const toanBo = buf(`${d1}\n${d2}\n${d3}\n`);
        const kq2 = quetKhoi(toanBo.subarray(kq1.daDoc));
        expect(kq2.luot.map(l => l.id)).toEqual(['m2', 'm3']);
        expect(daDocTong(kq1, kq2)).toBe(toanBo.length);
    });

    test('không có dòng nào trọn vẹn thì không tiêu thụ byte nào', () => {
        const kq = quetKhoi(buf(dong({ id: 'm1' }).slice(0, 30)));
        expect(kq.luot).toHaveLength(0);
        expect(kq.daDoc).toBe(0);
    });

    test('ranh giới byte đúng với tiếng Việt nhiều byte', () => {
        const d1 = JSON.stringify({ type: 'assistant', ghiChu: 'Nguyễn Văn A — Trường THCS Mường Tè', timestamp: '2026-09-17T01:36:33.809Z', message: { id: 'm1', model: 'x', usage: { input_tokens: 1 } } });
        const kq = quetKhoi(buf(`${d1}\n`));
        expect(kq.daDoc).toBe(Buffer.byteLength(`${d1}\n`));
        expect(Buffer.byteLength(d1)).toBeGreaterThan(d1.length); // có ký tự nhiều byte thật
        expect(kq.luot).toHaveLength(1);
    });

    test('dòng JSON hỏng được đếm riêng, không làm hỏng các dòng còn lại', () => {
        const noiDung = `${dong({ id: 'm1' })}\n{hong\n${dong({ id: 'm2' })}\n`;
        const kq = quetKhoi(buf(noiDung));
        expect(kq.luot.map(l => l.id)).toEqual(['m1', 'm2']);
        expect(kq.boQua.hong).toBe(1);
    });

    test('dòng thuộc loại khác được đếm riêng', () => {
        const noiDung = `${dong({ id: 'm1' })}\n${dong({ id: 'm2', type: 'user' })}\n${dong({ id: 'm3', model: '<synthetic>' })}\n`;
        const kq = quetKhoi(buf(noiDung));
        expect(kq.luot).toHaveLength(1);
        expect(kq.boQua.khongPhaiLuot).toBe(2);
    });
});

function daDocTong(...kq: Array<{ daDoc: number }>): number {
    return kq.reduce((s, k) => s + k.daDoc, 0);
}

describe('khuyenTrung — lọc lượt đã gặp, giữ vòng id', () => {
    test('giữ nguyên thứ tự và chỉ trả lượt mới', () => {
        const luot = [{ id: 'a' }, { id: 'b' }, { id: 'a' }, { id: 'c' }] as unknown as LuotGoi[];
        const daThay = new Set<string>();
        expect(khuyenTrung(luot, daThay).map(l => l.id)).toEqual(['a', 'b', 'c']);
        // gọi lần nữa với cùng dữ liệu → không còn gì mới
        expect(khuyenTrung(luot, daThay)).toHaveLength(0);
    });
});

describe('ngày theo giờ Việt Nam', () => {
    test('18:30 UTC ngày 31/8 là 01:30 ngày 1/9 giờ Việt Nam', () => {
        expect(ngayViet(Date.UTC(2026, 7, 31, 18, 30))).toBe('2026-09-01');
        expect(ngayViet(Date.UTC(2026, 7, 31, 16, 0))).toBe('2026-08-31');
    });

    test('mốc nửa đêm giờ Việt Nam khứ hồi đúng', () => {
        const m = mocNgayViet('2026-09-01');
        expect(ngayViet(m)).toBe('2026-09-01');
        expect(ngayViet(m - 1)).toBe('2026-08-31');
    });

    test('mốc ngày sai dạng trả NaN chứ không đoán', () => {
        expect(Number.isNaN(mocNgayViet('01/09/2026'))).toBe(true);
    });

    test('đầu tháng và mốc cách đây N ngày', () => {
        const luc = Date.UTC(2026, 8, 17, 5, 0);
        expect(dauThangViet(luc)).toBe('2026-09-01');
        expect(ngayBatDauCachDay(luc, 1)).toBe('2026-09-17');
        expect(ngayBatDauCachDay(luc, 7)).toBe('2026-09-11');
    });
});

describe('cộng dồn và gộp theo ngày × model', () => {
    const luot = [
        { id: '1', luc: Date.UTC(2026, 8, 17, 1), model: 'a', vao: 10, ra: 1, cacheDoc: 0, cacheGhi: 0, phu: false },
        { id: '2', luc: Date.UTC(2026, 8, 17, 2), model: 'a', vao: 20, ra: 2, cacheDoc: 0, cacheGhi: 0, phu: true },
        { id: '3', luc: Date.UTC(2026, 8, 16, 2), model: 'b', vao: 30, ra: 3, cacheDoc: 0, cacheGhi: 0, phu: false },
    ] as LuotGoi[];

    test('cộng dồn toàn bộ', () => {
        expect(congDon(luot)).toEqual({ vao: 60, ra: 6, cacheDoc: 0, cacheGhi: 0, luot: 3 });
    });

    test('gộp theo ngày × model rồi tổng lại khớp cộng dồn', () => {
        const mau: MauTheoNgay = {};
        gopTheoNgay(luot, mau);
        expect(Object.keys(mau).sort()).toEqual(['2026-09-16', '2026-09-17']);
        expect(mau['2026-09-17']!['a']).toEqual({ vao: 30, ra: 3, cacheDoc: 0, cacheGhi: 0, luot: 2 });
        expect(tongTheoNgay(mau)).toEqual(congDon(luot));
    });

    test('lọc từ một ngày trở đi', () => {
        const mau: MauTheoNgay = {};
        gopTheoNgay(luot, mau);
        expect(tongTheoNgay(mau, '2026-09-17')).toEqual({ vao: 30, ra: 3, cacheDoc: 0, cacheGhi: 0, luot: 2 });
    });
});

describe('tienLuot — khớp công thức của Cổng AI bên AWord Web', () => {
    test('làm tròn LÊN, đơn vị đồng trên 1 triệu token', () => {
        // ⌈(1000×15000 + 500×75000) / 1_000_000⌉ = ⌈52,5⌉ = 53
        expect(tienLuot({ vao: 1000, ra: 500, cacheDoc: 0, cacheGhi: 0 }, { vao: 15000, ra: 75000, cacheDoc: 0, cacheGhi: 0 }))
            .toEqual({ dong: 53, chuaCoGia: false });
    });

    test('token bằng 0 thì tiền bằng 0 nhưng vẫn là có giá', () => {
        expect(tienLuot({ vao: 0, ra: 0, cacheDoc: 0, cacheGhi: 0 }, { vao: 1, ra: 1, cacheDoc: 1, cacheGhi: 1 }))
            .toEqual({ dong: 0, chuaCoGia: false });
    });

    test('model chưa có giá: KHÔNG đoán, trả cờ chuaCoGia', () => {
        expect(tienLuot({ vao: 999999, ra: 999999, cacheDoc: 0, cacheGhi: 0 }, undefined))
            .toEqual({ dong: 0, chuaCoGia: true });
    });
});
