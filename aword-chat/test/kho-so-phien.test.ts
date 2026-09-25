// Kiểm thử tầng đọc tăng dần: giữ trạng thái giữa các lần chạy, không đếm trùng, và tự tính lại khi tệp bị
// ghi lại. Dùng thư mục tạm với tệp dựng sẵn — KHÔNG chạm vào sổ phiên thật của máy.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { taoKhoSoPhien, type KhoSoPhien } from '../src/node/kho-so-phien';
import type { GiaModel, SoToken } from '../src/common/so-token';

const GIA: Record<string, GiaModel> = {
    // 1000 đ / 1 triệu token cho mọi loại — để tính nhẩm ra số tiền chẵn.
    'model-a': { vao: 1000, ra: 1000, cacheDoc: 1000, cacheGhi: 1000 },
};

/** Một dòng assistant, cùng `message.id` thì tính là CÙNG một lượt. */
function dong(id: string, t: Partial<{ vao: number; ra: number; luc: string; model: string }> = {}): string {
    return JSON.stringify({
        type: 'assistant',
        timestamp: t.luc ?? new Date().toISOString(),
        isSidechain: false,
        uuid: `u-${id}`,
        message: {
            id,
            model: t.model ?? 'model-a',
            usage: { input_tokens: t.vao ?? 0, output_tokens: t.ra ?? 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
        },
    }) + '\n';
}

describe('kho số phiên — đọc tăng dần và giữ trạng thái', () => {
    let goc: string;
    let tepTrangThai: string;
    let kho: KhoSoPhien | undefined;

    const moKho = (): KhoSoPhien => {
        kho = taoKhoSoPhien({
            goc,
            tepTrangThai,
            traGia: m => GIA[m],
            nhipPollMs: 1_000_000, // tắt nhịp poll trong kiểm thử; ta tự gọi quetNgay()
        });
        return kho;
    };

    beforeEach(() => {
        goc = fs.mkdtempSync(path.join(os.tmpdir(), 'aword-sophien-'));
        tepTrangThai = path.join(goc, '..', `${path.basename(goc)}-tt.json`);
    });

    afterEach(() => {
        kho?.dung();
        kho = undefined;
        fs.rmSync(goc, { recursive: true, force: true });
        fs.rmSync(tepTrangThai, { force: true });
    });

    test('quét lần đầu: cộng đúng số và tính đúng tiền', async () => {
        fs.writeFileSync(path.join(goc, 'a.jsonl'), dong('m1', { vao: 1000, ra: 2000 }));
        fs.writeFileSync(path.join(goc, 'b.jsonl'), dong('m2', { vao: 3000, ra: 4000 }));

        const k = moKho();
        await k.batDau();

        const cs = k.docChiSo();
        expect(cs.tokenHomNay).toMatchObject({ vao: 4000, ra: 6000, luot: 2 });
        // ⌈(4000×1000 + 6000×1000)/1_000_000⌉ = 10
        expect(cs.tienHomNay).toBe(10);
        expect(cs.tienThang).toBe(10);
        expect(cs.dangQuet).toBe(false);
    });

    test('MỘT lượt nằm ở nhiều dòng chỉ tính một lần', async () => {
        fs.writeFileSync(path.join(goc, 'a.jsonl'),
            dong('m1', { vao: 100, ra: 100 }) + dong('m1', { vao: 100, ra: 100 }) + dong('m1', { vao: 100, ra: 100 }));

        const k = moKho();
        await k.batDau();
        expect(k.docChiSo().tokenHomNay).toMatchObject({ vao: 100, ra: 100, luot: 1 });
    });

    test('mở lại lần sau: KHÔNG đếm trùng, chỉ đọc phần thêm vào', async () => {
        const tepA = path.join(goc, 'a.jsonl');
        fs.writeFileSync(tepA, dong('m1', { vao: 1000 }));

        const k1 = moKho();
        await k1.batDau();
        expect(k1.docChiSo().tokenHomNay.vao).toBe(1000);
        k1.dung();
        expect(fs.existsSync(tepTrangThai)).toBe(true);

        fs.appendFileSync(tepA, dong('m2', { vao: 500 }));

        const k2 = moKho();
        await k2.batDau();
        expect(k2.docChiSo().tokenHomNay).toMatchObject({ vao: 1500, luot: 2 });
    });

    test('lần đọc sau chỉ tốn công trên tệp đã đổi', async () => {
        fs.writeFileSync(path.join(goc, 'a.jsonl'), dong('m1', { vao: 1000 }));
        fs.writeFileSync(path.join(goc, 'b.jsonl'), dong('m2', { vao: 2000 }));

        const k = moKho();
        await k.batDau();
        const truoc = k.docChiSo().tokenHomNay;

        fs.appendFileSync(path.join(goc, 'b.jsonl'), dong('m3', { vao: 500 }));
        await k.quetNgay();

        expect(k.docChiSo().tokenHomNay).toMatchObject({ vao: truoc.vao + 500, luot: 3 });
    });

    test('dòng cuối ghi dở chưa có \\n thì chưa tính, ghi xong mới tính — và không nhân đôi', async () => {
        const tepA = path.join(goc, 'a.jsonl');
        const hoanChinh = dong('m1', { vao: 1000 });
        const doDang = dong('m2', { vao: 700 });
        fs.writeFileSync(tepA, hoanChinh + doDang.slice(0, 50));

        const k = moKho();
        await k.batDau();
        expect(k.docChiSo().tokenHomNay).toMatchObject({ vao: 1000, luot: 1 });

        fs.writeFileSync(tepA, hoanChinh + doDang);
        await k.quetNgay();
        expect(k.docChiSo().tokenHomNay).toMatchObject({ vao: 1700, luot: 2 });
    });

    test('tệp bị CẮT NGẮN thì tự tính lại toàn bộ, không cộng dồn sai', async () => {
        const tepA = path.join(goc, 'a.jsonl');
        fs.writeFileSync(tepA, dong('m1', { vao: 1000 }) + dong('m2', { vao: 2000 }));

        const k = moKho();
        await k.batDau();
        expect(k.docChiSo().tokenHomNay.vao).toBe(3000);

        // Ghi lại tệp từ đầu, ngắn hơn hẳn — nội dung hoàn toàn khác
        fs.writeFileSync(tepA, dong('m9', { vao: 100 }));
        await k.quetNgay();

        const cs = k.docChiSo();
        expect(cs.tokenHomNay).toMatchObject({ vao: 100, luot: 1 });
        expect(cs.soTepGhiLai).toBeGreaterThan(0);
    });

    test('tệp bị ghi lại nhưng DÀI HƠN cũng bị phát hiện (nhờ băm phần đầu)', async () => {
        const tepA = path.join(goc, 'a.jsonl');
        fs.writeFileSync(tepA, dong('m1', { vao: 1000 }));

        const k = moKho();
        await k.batDau();
        expect(k.docChiSo().tokenHomNay.vao).toBe(1000);

        // Nội dung khác hoàn toàn nhưng dài hơn độ dài đã đọc
        fs.writeFileSync(tepA, dong('x1', { vao: 10 }) + dong('x2', { vao: 20 }) + dong('x3', { vao: 30 }));
        await k.quetNgay();

        expect(k.docChiSo().tokenHomNay).toMatchObject({ vao: 60, luot: 3 });
    });

    test('quét ĐỆ QUY: tệp trong thư mục con subagents/ vẫn được tính', async () => {
        fs.mkdirSync(path.join(goc, 'du-an', 'subagents'), { recursive: true });
        fs.writeFileSync(path.join(goc, 'du-an', 'phien.jsonl'), dong('m1', { vao: 1000 }));
        fs.writeFileSync(path.join(goc, 'du-an', 'subagents', 'agent-1.jsonl'), dong('m2', { vao: 2000 }));

        const k = moKho();
        await k.batDau();
        expect(k.docChiSo().tokenHomNay).toMatchObject({ vao: 3000, luot: 2 });
    });

    test('model chưa có giá: vẫn đếm token, tiền 0, và BÁO RÕ là chưa có giá', async () => {
        fs.writeFileSync(path.join(goc, 'a.jsonl'), dong('m1', { vao: 1000, model: 'model-la' }));

        const k = moKho();
        await k.batDau();
        const cs = k.docChiSo();
        expect(cs.tokenHomNay.vao).toBe(1000);
        expect(cs.tienHomNay).toBe(0);
        expect(cs.soModelChuaCoGia).toBe(1);

        const bc = k.docBaoCao(30);
        expect(bc.theoModel.find(m => m.model === 'model-la')).toMatchObject({ chuaCoGia: true, tien: 0 });
    });

    test('đếm MODEL chưa có giá, không đếm ô ngày × model', async () => {
        // Cùng một model thiếu giá ở nhiều ngày vẫn là MỘT model cần bổ sung giá. Đếm theo ô cho ra
        // con số vô nghĩa (số ngày × số model) và làm người dùng tưởng phải khai báo hàng trăm model.
        const ngay = [0, 1, 2].map(d => new Date(Date.now() - d * 24 * 3600 * 1000).toISOString());
        fs.writeFileSync(path.join(goc, 'a.jsonl'),
            ngay.map((luc, i) => dong(`m${i}`, { vao: 100, luc, model: 'model-la' })).join(''));
        fs.writeFileSync(path.join(goc, 'b.jsonl'), dong('m9', { vao: 50, model: 'model-a' }));

        const k = moKho();
        await k.batDau();
        expect(k.docChiSo().soModelChuaCoGia).toBe(1);
    });

    test('quét lại từ đầu cho ra đúng cùng con số', async () => {
        fs.writeFileSync(path.join(goc, 'a.jsonl'), dong('m1', { vao: 1000 }));
        fs.writeFileSync(path.join(goc, 'b.jsonl'), dong('m2', { vao: 2000 }));

        const k = moKho();
        await k.batDau();
        const truoc = k.docChiSo().tokenHomNay;

        await k.quetLai();
        expect(k.docChiSo().tokenHomNay).toEqual(truoc);
    });

    test('báo cáo: theo ngày và theo model khớp với tổng', async () => {
        const homNay = new Date().toISOString();
        const homQua = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        fs.writeFileSync(path.join(goc, 'a.jsonl'),
            dong('m1', { vao: 1000, luc: homNay }) +
            dong('m2', { vao: 2000, luc: homQua }) +
            dong('m3', { vao: 50, luc: homQua, model: 'model-b' }));

        const k = moKho();
        await k.batDau();
        const bc = k.docBaoCao(30);

        expect(bc.theoNgay).toHaveLength(2);
        const tongNgay = bc.theoNgay.reduce((s, n) => s + n.token.vao, 0);
        const tongModel = bc.theoModel.reduce((s, m) => s + m.token.vao, 0);
        expect(tongNgay).toBe(3050);
        expect(tongModel).toBe(3050);
        // model-b không có giá → vẫn nằm trong báo cáo, chỉ là tiền 0
        expect(bc.theoModel.map(m => m.model).sort()).toEqual(['model-a', 'model-b']);
    });

    // ---- Chống treo khi chạy lâu (25/9/2026): lượt quét không được đọc lại tệp không đổi ----

    test('lượt quét khi KHÔNG có gì mới thì không mở tệp nào (chỉ stat)', async () => {
        fs.writeFileSync(path.join(goc, 'a.jsonl'), dong('m1', { vao: 1000 }));
        fs.writeFileSync(path.join(goc, 'b.jsonl'), dong('m2', { vao: 2000 }));
        const k = moKho();
        await k.batDau();

        const moTep = jest.spyOn(fs, 'openSync');
        const docCa = jest.spyOn(fs, 'readFileSync');
        try {
            await k.quetNgay();
            expect(moTep).not.toHaveBeenCalled();
            expect(docCa.mock.calls.filter(c => String(c[0]).endsWith('.jsonl'))).toHaveLength(0);
        } finally {
            moTep.mockRestore();
            docCa.mockRestore();
        }
        expect(k.docChiSo().tokenHomNay).toMatchObject({ vao: 3000, luot: 2 });
    });

    test('chỉ đọc PHẦN MỚI của tệp lớn, không đọc lại phần đầu', async () => {
        const tepA = path.join(goc, 'a.jsonl');
        const dem = 200;
        let noiDung = '';
        for (let i = 0; i < dem; i++) { noiDung += dong(`cu${i}`, { vao: 1 }); }
        fs.writeFileSync(tepA, noiDung);
        const k = moKho();
        await k.batDau();
        expect(k.docChiSo().tokenHomNay.luot).toBe(dem);

        fs.appendFileSync(tepA, dong('moi', { vao: 5000 }));
        const docDoan = jest.spyOn(fs, 'readSync');
        try {
            await k.quetNgay();
            // Byte đọc = ≤ 4 KB băm đầu + đúng dòng mới (+ băm lại nếu cần), không phải cả tệp.
            const tongByte = docDoan.mock.calls.reduce((s, c) => s + Number((c as unknown[])[3]), 0);
            expect(tongByte).toBeLessThan(4096 + dong('moi', { vao: 5000 }).length + 1);
        } finally {
            docDoan.mockRestore();
        }
        expect(k.docChiSo().tokenHomNay).toMatchObject({ vao: dem + 5000, luot: dem + 1 });
    });

    test('một dòng DÀI HƠN lô đọc (ảnh base64) vẫn tính đúng', async () => {
        const tepA = path.join(goc, 'a.jsonl');
        const dai = JSON.stringify({ type: 'user', message: { content: 'x'.repeat(5000) } }) + '\n';
        fs.writeFileSync(tepA, dong('m1', { vao: 10 }) + dai + dong('m2', { vao: 20 }));
        kho = taoKhoSoPhien({ goc, tepTrangThai, traGia: m => GIA[m], nhipPollMs: 1_000_000, loDocByte: 512 });
        await kho.batDau();
        expect(kho.docChiSo().tokenHomNay).toMatchObject({ vao: 30, luot: 2 });
        // Mở lại: không đếm trùng
        kho.dung();
        kho = taoKhoSoPhien({ goc, tepTrangThai, traGia: m => GIA[m], nhipPollMs: 1_000_000, loDocByte: 512 });
        await kho.batDau();
        expect(kho.docChiSo().tokenHomNay).toMatchObject({ vao: 30, luot: 2 });
    });

    test('"Tính lại từ đầu" bấm ĐÚNG LÚC đang quét vẫn ra đủ số', async () => {
        for (let i = 0; i < 60; i++) {
            fs.writeFileSync(path.join(goc, `t${i}.jsonl`), dong(`m${i}`, { vao: 100 }));
        }
        kho = taoKhoSoPhien({ goc, tepTrangThai, traGia: m => GIA[m], nhipPollMs: 1_000_000, soTepMoiLo: 5 });
        const batDau = kho.batDau();          // quét lần đầu đang chạy (nhường luồng mỗi 5 tệp)
        const tinhLai = kho.quetLai();        // người dùng bấm trong lúc đó
        await Promise.all([batDau, tinhLai]);
        expect(kho.docChiSo().tokenHomNay).toMatchObject({ vao: 6000, luot: 60 });
    });

    test('bảng giá đổi thì số tiền đổi theo, không cần quét lại', async () => {
        fs.writeFileSync(path.join(goc, 'a.jsonl'), dong('m1', { vao: 1000 }));

        let gia: SoToken | undefined = GIA['model-a'];
        const k = taoKhoSoPhien({
            goc, tepTrangThai,
            traGia: () => gia,
            nhipPollMs: 1_000_000,
        });
        kho = k;
        await k.batDau();
        expect(k.docChiSo().tienHomNay).toBe(1);

        gia = { vao: 2000, ra: 2000, cacheDoc: 2000, cacheGhi: 2000 };
        expect(k.docChiSo().tienHomNay).toBe(2);
    });
});
