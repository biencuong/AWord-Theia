import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'node:http';
import { moCsdl } from '../src/csdl/csdl.ts';
import { napBangGiaMacDinh } from '../src/cong-ai/cong-ai.ts';
import { tinhChiPhi } from '../src/cong-ai/bang-gia.ts';
import { taoBoTachSse, type SuKienSse } from '../src/cong-ai/sse.ts';
import { dinhDangTien } from '../src/cong-ai/tien-ich.ts';
import { cacDongSuDung, choDen, dungMoiTruong, GIO_MAC_DINH, KHOA, tachSse, type MoiTruong } from './fixtures/cong-ai/moi-truong.ts';

const TIN = { model: 'claude-sonnet-5', max_tokens: 100, messages: [{ role: 'user', content: 'Xin chào' }] };
const GIA = { gia_vao: 75_000, gia_ra: 375_000, gia_cache_doc: 7_500, gia_cache_ghi: 93_750 };

async function docLoi(r: Response): Promise<{ type: string; message: string }> {
    const j = await r.json() as { type: string; error: { type: string; message: string } };
    assert.equal(j.type, 'error');
    return j.error;
}

function traJson(res: http.ServerResponse, status: number, duLieu: unknown): void {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(duLieu));
}

const choMs = (ms: number) => new Promise(ok => setTimeout(ok, ms));

function chenSuDung(mt: MoiTruong, thang: string, chiPhi: number): void {
    mt.db.prepare(`INSERT INTO su_dung_ai (tai_khoan_id, luc, thang, mo_hinh, nha_cung_cap, chi_phi_dong, trang_thai)
        VALUES (?, ?, ?, 'nhap-tay', 'anthropic', ?, 'xong')`).run(mt.taiKhoanId, GIO_MAC_DINH, thang, chiPhi);
}

// ───────────────────────────── Đơn vị nhỏ ─────────────────────────────

test('bộ tách SSE: dòng bị cắt giữa hai đoạn, \\r\\n tách đôi, chú thích, data nhiều dòng, sự kiện cuối không có dòng trống', () => {
    const nhan: SuKienSse[] = [];
    const bo = taoBoTachSse(sk => nhan.push(sk));
    const vanBan = ': keep-alive\r\n\r\nevent: message_start\r\ndata: {"a":1}\r\n\r\nevent: x\ndata: dong1\ndata: dong2\n\ndata: khong-ten\r\rdata: cuoi';
    // nạp từng ký tự để thử mọi điểm cắt (kể cả '\r' cuối đoạn và '\n' đầu đoạn sau)
    for (const kyTu of vanBan) { bo.nap(kyTu); }
    bo.ketThuc();
    assert.deepEqual(nhan, [
        { event: 'message_start', data: '{"a":1}' },
        { event: 'x', data: 'dong1\ndong2' },
        { event: 'message', data: 'khong-ten' },
        { event: 'message', data: 'cuoi' },
    ]);
});

test('công thức chi phí làm tròn lên và định dạng tiền kiểu Việt Nam', () => {
    // (1000×75.000 + 500×375.000 + 2000×7.500 + 100×93.750) / 1.000.000 = 286,875 → 287 đồng
    assert.equal(tinhChiPhi({ vao: 1000, ra: 500, cacheDoc: 2000, cacheGhi: 100 }, GIA), 287);
    assert.equal(tinhChiPhi({ vao: 1, ra: 0, cacheDoc: 0, cacheGhi: 0 }, { gia_vao: 1, gia_ra: 0, gia_cache_doc: 0, gia_cache_ghi: 0 }), 1);
    assert.equal(tinhChiPhi({ vao: 0, ra: 0, cacheDoc: 0, cacheGhi: 0 }, GIA), 0);
    assert.equal(dinhDangTien(1234567), '1.234.567');
    assert.equal(dinhDangTien(1000000), '1.000.000');
    assert.equal(dinhDangTien(999), '999');
    assert.equal(dinhDangTien(0), '0');
});

test('napBangGiaMacDinh: chèn mẫu đang tắt, giá 0; bảng đã có dữ liệu thì không đụng tới', () => {
    const db = moCsdl(':memory:');
    napBangGiaMacDinh(db);
    const dong = db.prepare('SELECT * FROM bang_gia').all() as Array<Record<string, unknown>>;
    const cacMa = dong.map(d => d.ma);
    for (const ma of ['claude-sonnet-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-haiku-4-5-20251001', 'deepseek-flash', 'deepseek-v4-pro', 'gpt-5-codex']) {
        assert.ok(cacMa.includes(ma), `thiếu mô hình mẫu ${ma}`);
    }
    for (const d of dong) {
        assert.equal(d.bat, 0, `${d.ma} phải đang tắt`);
        assert.deepEqual([d.gia_vao, d.gia_ra, d.gia_cache_doc, d.gia_cache_ghi], [0, 0, 0, 0], `${d.ma} không được có giá bịa`);
    }
    assert.equal(dong.find(d => d.ma === 'gpt-5-codex')?.nha_cung_cap, 'openai');
    assert.equal(dong.find(d => d.ma === 'deepseek-flash')?.nha_cung_cap, 'deepseek');
    assert.equal(dong.find(d => d.ma === 'claude-opus-5')?.mo_hinh_goc, 'claude-opus-5');

    db.prepare("UPDATE bang_gia SET gia_vao = 5, bat = 1 WHERE ma = 'claude-opus-5'").run();
    db.prepare("DELETE FROM bang_gia WHERE ma = 'deepseek-flash'").run();
    napBangGiaMacDinh(db);
    assert.equal((db.prepare('SELECT COUNT(*) AS n FROM bang_gia').get() as { n: number }).n, dong.length - 1);
    assert.equal((db.prepare("SELECT gia_vao FROM bang_gia WHERE ma = 'claude-opus-5'").get() as { gia_vao: number }).gia_vao, 5);
});

// ───────────────────────────── Định tuyến và kiểm tra ─────────────────────────────

test('đường dẫn: ngoài /ai trả false; đường dẫn lạ dưới /ai → 404 dạng Anthropic; sai phương thức → 405', async t => {
    const mt = await dungMoiTruong();
    t.after(() => mt.dong());
    for (const p of ['/quan-tri', '/aix/v1/messages', '/']) {
        const r = await fetch(mt.diaChi + p);
        assert.equal(r.status, 404);
        assert.equal(await r.text(), 'ngoai-cong-ai', p);
    }
    let r = await fetch(`${mt.diaChi}/ai/v1/models`, { headers: { authorization: `Bearer ${mt.token}` } });
    assert.equal(r.status, 404);
    const e = await docLoi(r);
    assert.equal(e.type, 'not_found_error');
    assert.match(e.message, /không có đường dẫn \/ai\/v1\/models/);
    r = await fetch(`${mt.diaChi}/ai/v1/messages`);
    assert.equal(r.status, 405);
    assert.equal((await docLoi(r)).type, 'invalid_request_error');
    assert.equal(mt.yeuCauLen.length, 0);
});

test('token: thiếu, sai, hết hạn, thu hồi → 401 authentication_error; chấp nhận cả Bearer và x-api-key; CSDL chỉ lưu băm', async t => {
    const mt = await dungMoiTruong();
    t.after(() => mt.dong());
    mt.themMoHinh('claude-sonnet-5', 'anthropic');
    mt.datXuLy((_yc, res) => traJson(res, 200, { type: 'message', content: [], usage: { input_tokens: 1, output_tokens: 1 } }));

    let r = await fetch(`${mt.diaChi}/ai/v1/messages`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(TIN) });
    assert.equal(r.status, 401);
    assert.equal(r.headers.get('x-should-retry'), 'false');
    let e = await docLoi(r);
    assert.equal(e.type, 'authentication_error');
    assert.match(e.message, /Thiếu token Cổng AI/);

    r = await mt.goi('/ai/v1/messages', TIN, { authorization: 'Bearer token-bia-dat' });
    assert.equal(r.status, 401);
    assert.match((await docLoi(r)).message, /không hợp lệ/);

    r = await fetch(`${mt.diaChi}/ai/v1/messages`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': mt.token }, body: JSON.stringify(TIN) });
    assert.equal(r.status, 200, 'x-api-key đúng phải được chấp nhận');
    await r.text();

    mt.gio.hienTai = GIO_MAC_DINH + 8 * 3600_000; // đúng thời điểm hết hạn
    r = await mt.goi('/ai/v1/messages', TIN);
    assert.equal(r.status, 401);
    assert.match((await docLoi(r)).message, /hết hạn/);
    mt.gio.hienTai = GIO_MAC_DINH;

    mt.congAi.thuHoiToken(mt.taiKhoanId);
    r = await mt.goi('/ai/v1/messages', TIN);
    assert.equal(r.status, 401);
    e = await docLoi(r);
    assert.equal(e.type, 'authentication_error');
    assert.match(e.message, /thu hồi/);

    const tokenMoi = mt.congAi.capToken(mt.taiKhoanId, 1);
    r = await mt.goi('/ai/v1/messages', TIN, { authorization: `Bearer ${tokenMoi}` });
    assert.equal(r.status, 200);
    await r.text();
    assert.equal(mt.yeuCauLen.length, 2, 'chỉ hai lượt hợp lệ được chuyển lên nhà cung cấp');

    const cacBam = (mt.db.prepare('SELECT token_bam FROM token_ai').all() as Array<{ token_bam: string }>).map(d => d.token_bam);
    assert.ok(!cacBam.includes(mt.token) && !cacBam.includes(tokenMoi), 'không được lưu token rõ');
    assert.throws(() => mt.congAi.capToken(mt.taiKhoanId, 0));
});

test('tài khoản bị khóa hoặc hết hạn dùng → 403 permission_error', async t => {
    const mt = await dungMoiTruong();
    t.after(() => mt.dong());
    mt.themMoHinh('claude-sonnet-5', 'anthropic');
    mt.datXuLy((_yc, res) => traJson(res, 200, { type: 'message', content: [], usage: { input_tokens: 1, output_tokens: 1 } }));

    mt.db.prepare("UPDATE tai_khoan SET trang_thai = 'khoa' WHERE id = ?").run(mt.taiKhoanId);
    let r = await mt.goi('/ai/v1/messages', TIN);
    assert.equal(r.status, 403);
    let e = await docLoi(r);
    assert.equal(e.type, 'permission_error');
    assert.match(e.message, /bị khóa/);

    mt.db.prepare("UPDATE tai_khoan SET trang_thai = 'hoat_dong', han_dung = ? WHERE id = ?").run(GIO_MAC_DINH, mt.taiKhoanId);
    r = await mt.goi('/ai/v1/messages', TIN);
    assert.equal(r.status, 403);
    e = await docLoi(r);
    assert.equal(e.type, 'permission_error');
    assert.match(e.message, /hết hạn từ ngày 15\/09\/2026/);

    mt.db.prepare('UPDATE tai_khoan SET han_dung = ? WHERE id = ?').run(GIO_MAC_DINH + 86_400_000, mt.taiKhoanId);
    r = await mt.goi('/ai/v1/messages', TIN);
    assert.equal(r.status, 200);
    await r.text();
    assert.equal(mt.yeuCauLen.length, 1);
});

test('mô hình chưa có trong bảng giá hoặc đang tắt → 403 nêu rõ tên mô hình', async t => {
    const mt = await dungMoiTruong();
    t.after(() => mt.dong());
    mt.themMoHinh('claude-opus-5', 'anthropic', { bat: 0 });
    mt.themMoHinh('claude-sonnet-5', 'anthropic');

    let r = await mt.goi('/ai/v1/messages', { ...TIN, model: 'claude-opus-5' });
    assert.equal(r.status, 403);
    let e = await docLoi(r);
    assert.equal(e.type, 'permission_error');
    assert.match(e.message, /"claude-opus-5".*đang tắt/);
    assert.match(e.message, /được phép: claude-sonnet-5/);

    r = await mt.goi('/ai/v1/messages', { ...TIN, model: 'mo-hinh-la' });
    assert.equal(r.status, 403);
    e = await docLoi(r);
    assert.match(e.message, /"mo-hinh-la".*chưa có trong bảng giá/);
    assert.equal(mt.yeuCauLen.length, 0);
});

test('thân yêu cầu: JSON hỏng / thiếu model → 400; vượt giới hạn (khai báo hoặc chunked) → 413', async t => {
    const mt = await dungMoiTruong({ gioiHanThanByte: 2000 });
    t.after(() => mt.dong());
    mt.themMoHinh('claude-sonnet-5', 'anthropic');

    let r = await mt.goi('/ai/v1/messages', '{"model": "claude-sonnet-5", hỏng');
    assert.equal(r.status, 400);
    assert.equal((await docLoi(r)).type, 'invalid_request_error');

    r = await mt.goi('/ai/v1/messages', { messages: [] });
    assert.equal(r.status, 400);
    assert.match((await docLoi(r)).message, /model/);

    r = await mt.goi('/ai/v1/messages', { ...TIN, messages: [{ role: 'user', content: 'x'.repeat(5000) }] });
    assert.equal(r.status, 413);
    assert.equal((await docLoi(r)).type, 'invalid_request_error');

    // Không khai báo content-length (chunked): phải dừng khi vượt giới hạn
    const ketQua = await new Promise<{ status: number; than: string }>((ok, loi) => {
        const req = http.request(`${mt.diaChi}/ai/v1/messages`, { method: 'POST', headers: { authorization: `Bearer ${mt.token}`, 'content-type': 'application/json' } }, res => {
            let than = '';
            res.setEncoding('utf8');
            res.on('data', d => { than += d; });
            res.on('end', () => ok({ status: res.statusCode ?? 0, than }));
        });
        req.on('error', loi);
        req.write('{"model":"claude-sonnet-5","messages":[{"role":"user","content":"' + 'y'.repeat(1500));
        req.end('y'.repeat(1500) + '"}]}');
    });
    assert.equal(ketQua.status, 413);
    assert.match(ketQua.than, /quá lớn/);
    assert.equal(mt.yeuCauLen.length, 0);
});

test('hết hạn mức tháng → 403 với số tiền kiểu Việt Nam; tháng trước không tính; NULL = không giới hạn', async t => {
    const mt = await dungMoiTruong();
    t.after(() => mt.dong());
    mt.themMoHinh('claude-sonnet-5', 'anthropic');
    mt.datXuLy((_yc, res) => traJson(res, 200, { type: 'message', content: [], usage: { input_tokens: 1, output_tokens: 1 } }));
    mt.db.prepare('UPDATE tai_khoan SET han_muc_thang_dong = 1000000 WHERE id = ?').run(mt.taiKhoanId);
    chenSuDung(mt, '2026-09', 1_000_000);
    chenSuDung(mt, '2026-09', 234_567);
    chenSuDung(mt, '2026-08', 5_000_000);

    let r = await mt.goi('/ai/v1/messages', TIN);
    assert.equal(r.status, 403);
    assert.equal(r.headers.get('x-should-retry'), 'false');
    const e = await docLoi(r);
    assert.equal(e.type, 'permission_error');
    assert.equal(e.message, 'Đã dùng hết hạn mức AI tháng 09/2026 (1.234.567 đồng / 1.000.000 đồng). Liên hệ quản trị đơn vị để nâng hạn mức.');
    assert.equal(mt.congAi.daDungThang(mt.taiKhoanId), 1_234_567);
    assert.equal(mt.congAi.daDungThang(mt.taiKhoanId, '2026-08'), 5_000_000);

    mt.db.prepare('UPDATE tai_khoan SET han_muc_thang_dong = 2000000 WHERE id = ?').run(mt.taiKhoanId);
    r = await mt.goi('/ai/v1/messages', TIN);
    assert.equal(r.status, 200);
    await r.text();

    mt.db.prepare('UPDATE tai_khoan SET han_muc_thang_dong = NULL WHERE id = ?').run(mt.taiKhoanId);
    chenSuDung(mt, '2026-09', 99_000_000);
    r = await mt.goi('/ai/v1/messages', TIN);
    assert.equal(r.status, 200);
    await r.text();
});

test('tháng tính hạn mức và ghi sử dụng theo giờ Việt Nam', async t => {
    const mt = await dungMoiTruong();
    t.after(() => mt.dong());
    mt.themMoHinh('claude-sonnet-5', 'anthropic', { gia_vao: 1_000_000 });
    mt.datXuLy((_yc, res) => traJson(res, 200, { type: 'message', content: [], usage: { input_tokens: 30, output_tokens: 0 } }));
    // 31/8/2026 18:30 UTC = 01:30 ngày 1/9/2026 giờ Việt Nam
    mt.gio.hienTai = Date.UTC(2026, 7, 31, 18, 30);
    mt.db.prepare('UPDATE tai_khoan SET han_muc_thang_dong = 100 WHERE id = ?').run(mt.taiKhoanId);
    chenSuDung(mt, '2026-08', 500); // tháng 8 đã vượt, nhưng đã sang tháng 9 theo giờ Việt Nam

    let r = await mt.goi('/ai/v1/messages', TIN);
    assert.equal(r.status, 200);
    await r.text();
    const dong = await choDen(() => cacDongSuDung(mt.db).find(d => d.mo_hinh === 'claude-sonnet-5'), 'ghi sử dụng');
    assert.equal(dong.luc, Date.UTC(2026, 7, 31, 18, 30));
    assert.equal(dong.thang, '2026-09');
    assert.equal(dong.chi_phi_dong, 30);
    assert.equal(mt.congAi.daDungThang(mt.taiKhoanId), 30);

    chenSuDung(mt, '2026-09', 70);
    r = await mt.goi('/ai/v1/messages', TIN);
    assert.equal(r.status, 403);
    assert.match((await docLoi(r)).message, /tháng 09\/2026 \(100 đồng \/ 100 đồng\)/);
});

// ───────────────────────────── Chuyển tiếp Anthropic / DeepSeek ─────────────────────────────

test('stream Anthropic: chuyển nguyên vẹn từng đoạn (không đệm), ghi usage + chi phí đúng công thức, không lộ token phiên', { timeout: 10_000 }, async t => {
    const mt = await dungMoiTruong();
    t.after(() => mt.dong());
    mt.themMoHinh('claude-sonnet-5', 'anthropic', GIA, 'claude-sonnet-5-that');
    const cacDoan = [
        'event: message_start\r\ndata: {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","model":"claude-sonnet-5-that","content":[],"stop_reason":null,"usage":{"input_tokens":1200,"cache_creation_input_tokens":300,"cache_read_input_tokens":5000,"output_tokens":1}}}\r\n\r\n',
        'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\nevent: ping\ndata: {"type": "ping"}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Xin chào thầy cô"}}\n\nevent: content_blo',
        'ck_stop\ndata: {"type":"content_block_stop","index":0}\n\nevent: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":20}}\n\n',
        'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":42}}\n\nevent: message_stop\ndata: {"type":"message_stop"}\n\n',
    ];
    let moKhoa: () => void = () => undefined;
    const choMayKhach = new Promise<void>(ok => { moKhoa = ok; });
    mt.datXuLy(async (_yc, res) => {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'request-id': 'req_gia_lap', 'set-cookie': 'bi-mat=1', 'anthropic-organization-id': 'org-bi-mat' });
        res.write(cacDoan[0]);
        await choMayKhach; // chỉ gửi tiếp khi máy khách đã nhận đoạn đầu → Cổng AI phải chuyển từng đoạn
        for (const d of cacDoan.slice(1)) {
            res.write(d);
            await choMs(5);
        }
        res.end();
    });

    const r = await mt.goi('/ai/v1/messages?beta=true', { ...TIN, stream: true }, {
        'anthropic-beta': 'claude-code-20250219,interleaved-thinking-2025-05-14',
        cookie: 'aword_phien=phien-bi-mat',
        'x-api-key': mt.token,
        accept: 'text/event-stream',
    });
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type') ?? '', /text\/event-stream/);
    assert.equal(r.headers.get('request-id'), 'req_gia_lap');
    assert.equal(r.headers.get('set-cookie'), null);
    assert.equal(r.headers.get('anthropic-organization-id'), null);

    const docGia = (r.body as ReadableStream<Uint8Array>).getReader();
    const giaiMa = new TextDecoder();
    let nhan = '';
    while (nhan.length < cacDoan[0].length) {
        const { done, value } = await docGia.read();
        if (done) { break; }
        nhan += giaiMa.decode(value, { stream: true });
    }
    assert.equal(nhan, cacDoan[0]);
    moKhoa();
    for (;;) {
        const { done, value } = await docGia.read();
        if (done) { break; }
        nhan += giaiMa.decode(value, { stream: true });
    }
    assert.equal(nhan, cacDoan.join(''), 'luồng SSE phải được chuyển nguyên vẹn từng byte');

    const len = mt.yeuCauLen[0];
    assert.equal(len.url, '/v1/messages?beta=true');
    assert.equal(len.headers['x-api-key'], KHOA.anthropic);
    assert.equal(len.headers['anthropic-version'], '2023-06-01');
    assert.equal(len.headers['anthropic-beta'], 'claude-code-20250219,interleaved-thinking-2025-05-14');
    assert.equal(len.headers.accept, 'text/event-stream');
    assert.equal(len.headers.authorization, undefined);
    assert.equal(len.headers.cookie, undefined);
    assert.ok(!JSON.stringify(len.headers).includes(mt.token) && !len.body.includes(mt.token), 'token phiên không được ra ngoài');
    const thanLen = JSON.parse(len.body);
    assert.equal(thanLen.model, 'claude-sonnet-5-that');
    assert.deepEqual(thanLen.messages, TIN.messages);
    assert.equal(thanLen.stream, true);

    const [dong] = await choDen(() => { const d = cacDongSuDung(mt.db); return d.length ? d : undefined; }, 'ghi sử dụng');
    assert.deepEqual([dong.token_vao, dong.token_ra, dong.token_cache_doc, dong.token_cache_ghi], [1200, 42, 5000, 300]);
    // (1200×75.000 + 42×375.000 + 5000×7.500 + 300×93.750) / 1.000.000 = 171,375 → 172
    assert.equal(dong.chi_phi_dong, Math.ceil((1200 * 75_000 + 42 * 375_000 + 5000 * 7_500 + 300 * 93_750) / 1_000_000));
    assert.equal(dong.chi_phi_dong, 172);
    assert.equal(dong.trang_thai, 'xong');
    assert.equal(dong.ma_loi, null);
    assert.equal(dong.mo_hinh, 'claude-sonnet-5');
    assert.equal(dong.nha_cung_cap, 'anthropic');
    assert.equal(dong.thang, '2026-09');
    assert.equal(dong.don_vi_id, 1);
});

test('không stream Anthropic: thân JSON chuyển nguyên trạng, đọc usage tính phí', async t => {
    const mt = await dungMoiTruong();
    t.after(() => mt.dong());
    mt.themMoHinh('claude-haiku-4-5-20251001', 'anthropic', GIA, 'claude-haiku-4-5-20251001');
    const than = JSON.stringify({ id: 'msg_2', type: 'message', role: 'assistant', content: [{ type: 'text', text: 'Chào' }], stop_reason: 'end_turn',
        usage: { input_tokens: 10_000, output_tokens: 2_000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } });
    mt.datXuLy((_yc, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(than); });

    const r = await mt.goi('/ai/v1/messages', { ...TIN, model: 'claude-haiku-4-5-20251001' });
    assert.equal(r.status, 200);
    assert.equal(await r.text(), than);
    const dong = await choDen(() => cacDongSuDung(mt.db)[0], 'ghi sử dụng');
    assert.deepEqual([dong.token_vao, dong.token_ra, dong.trang_thai], [10_000, 2_000, 'xong']);
    assert.equal(dong.chi_phi_dong, 1500); // 10.000×75.000/1e6 + 2.000×375.000/1e6 = 750 + 750
});

test('lỗi từ nhà cung cấp (5xx) chuyển về nguyên trạng và ghi trạng thái lỗi', async t => {
    const mt = await dungMoiTruong();
    t.after(() => mt.dong());
    mt.themMoHinh('claude-sonnet-5', 'anthropic', GIA);
    const thanLoi = '{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}';
    mt.datXuLy((_yc, res) => { res.writeHead(529, { 'content-type': 'application/json', 'retry-after': '3', 'x-should-retry': 'true' }); res.end(thanLoi); });

    let r = await mt.goi('/ai/v1/messages', { ...TIN, stream: true });
    assert.equal(r.status, 529);
    assert.equal(r.headers.get('retry-after'), '3');
    assert.equal(r.headers.get('x-should-retry'), 'true');
    assert.equal(await r.text(), thanLoi);

    mt.datXuLy((_yc, res) => { res.writeHead(500, { 'content-type': 'text/plain' }); res.end('Internal Server Error'); });
    r = await mt.goi('/ai/v1/messages', TIN);
    assert.equal(r.status, 500);
    assert.equal(await r.text(), 'Internal Server Error');

    const dong = await choDen(() => { const d = cacDongSuDung(mt.db); return d.length === 2 ? d : undefined; }, 'ghi hai lượt lỗi');
    assert.deepEqual(dong.map(d => [d.trang_thai, d.ma_loi, d.chi_phi_dong]), [['loi', 'http_529:overloaded_error', 0], ['loi', 'http_500', 0]]);
});

test('máy khách ngắt giữa chừng → hủy request lên nhà cung cấp, ghi phần token đã biết với trạng thái huy', { timeout: 10_000 }, async t => {
    const mt = await dungMoiTruong();
    t.after(() => mt.dong());
    mt.themMoHinh('claude-sonnet-5', 'anthropic', GIA);
    mt.datXuLy((_yc, res, req) => {
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.write('event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":800,"cache_read_input_tokens":200,"output_tokens":1}}}\n\n');
        res.write('event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Đang viết"}}\n\n');
        req.socket.on('close', () => res.destroy()); // treo cho đến khi Cổng AI hủy
    });

    const boHuy = new AbortController();
    const r = await fetch(`${mt.diaChi}/ai/v1/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${mt.token}` },
        body: JSON.stringify({ ...TIN, stream: true }),
        signal: boHuy.signal,
    });
    const docGia = (r.body as ReadableStream<Uint8Array>).getReader();
    let nhan = '';
    while (!nhan.includes('Đang viết')) {
        const { done, value } = await docGia.read();
        if (done) { break; }
        nhan += new TextDecoder().decode(value);
    }
    boHuy.abort();

    const dong = await choDen(() => cacDongSuDung(mt.db)[0], 'ghi lượt bị hủy');
    assert.equal(dong.trang_thai, 'huy');
    assert.equal(dong.ma_loi, 'may_khach_ngat');
    assert.deepEqual([dong.token_vao, dong.token_ra, dong.token_cache_doc], [800, 1, 200]);
    assert.equal(dong.chi_phi_dong, Math.ceil((800 * 75_000 + 1 * 375_000 + 200 * 7_500) / 1_000_000));
    await choDen(() => mt.yeuCauLen[0]?.biHuy, 'kết nối lên nhà cung cấp bị hủy');
});

test('DeepSeek: định tuyến tới cổng tương thích Anthropic bằng khóa tổ chức, chịu dòng keep-alive, tra được tên có hậu tố [1m]', async t => {
    const mt = await dungMoiTruong();
    t.after(() => mt.dong());
    mt.themMoHinh('deepseek-flash', 'deepseek', { gia_vao: 7_000, gia_ra: 28_000 }, 'deepseek-flash');
    mt.datXuLy((_yc, res) => {
        res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8' });
        res.write(': keep-alive\n\n: keep-alive\n\n');
        res.write('event: message_start\ndata: {"type":"message_start","message":{"id":"x","usage":{"input_tokens":50,"output_tokens":0}}}\n\n');
        res.end('event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":7}}\n\nevent: message_stop\ndata: {"type":"message_stop"}\n\n');
    });

    const r = await mt.goi('/ai/v1/messages', { ...TIN, model: 'deepseek-flash[1m]', stream: true });
    assert.equal(r.status, 200);
    assert.match(await r.text(), /: keep-alive[\s\S]*message_stop/);
    const len = mt.yeuCauLen[0];
    assert.equal(len.url, '/anthropic/v1/messages');
    assert.equal(len.headers['x-api-key'], KHOA.deepseek);
    assert.equal(len.headers.authorization, `Bearer ${KHOA.deepseek}`);
    assert.equal(JSON.parse(len.body).model, 'deepseek-flash');
    assert.ok(!JSON.stringify(len.headers).includes(mt.token));
    const dong = await choDen(() => cacDongSuDung(mt.db)[0], 'ghi sử dụng');
    assert.deepEqual([dong.nha_cung_cap, dong.mo_hinh, dong.token_vao, dong.token_ra, dong.trang_thai, dong.chi_phi_dong], ['deepseek', 'deepseek-flash', 50, 7, 'xong', 1]);
});

test('luồng có sự kiện error hoặc kết thúc thiếu message_stop → ghi trạng thái lỗi', async t => {
    const mt = await dungMoiTruong();
    t.after(() => mt.dong());
    mt.themMoHinh('claude-sonnet-5', 'anthropic', GIA);
    mt.datXuLy((_yc, res) => {
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.write('event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":100,"output_tokens":1}}}\n\n');
        res.end('event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}\n\n');
    });
    let r = await mt.goi('/ai/v1/messages', { ...TIN, stream: true });
    assert.match(await r.text(), /overloaded_error/);
    mt.datXuLy((_yc, res) => {
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.end('event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":100,"output_tokens":1}}}\n\n');
    });
    r = await mt.goi('/ai/v1/messages', { ...TIN, stream: true });
    await r.text();
    // Nhà cung cấp đứt kết nối giữa luồng → Cổng phát sự kiện error dạng Anthropic để Claude Code biết lượt hỏng
    mt.datXuLy((_yc, res) => {
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.write('event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":100,"output_tokens":1}}}\n\n');
        setTimeout(() => res.socket?.destroy(), 20);
    });
    r = await mt.goi('/ai/v1/messages', { ...TIN, stream: true });
    const cuoi = tachSse(await r.text()).at(-1);
    assert.equal(cuoi?.event, 'error');
    assert.equal(cuoi?.data.error.type, 'api_error');
    assert.match(cuoi?.data.error.message, /mất kết nối tới Anthropic/);
    const dong = await choDen(() => { const d = cacDongSuDung(mt.db); return d.length === 3 ? d : undefined; }, 'ghi ba lượt');
    assert.deepEqual(dong.slice(0, 2).map(d => [d.trang_thai, d.ma_loi, d.token_vao]), [['loi', 'luong:overloaded_error', 100], ['loi', 'luong_ket_thuc_som', 100]]);
    assert.equal(dong[2].trang_thai, 'loi');
    assert.match(dong[2].ma_loi ?? '', /^ket_noi/);
    assert.equal(dong[2].token_vao, 100);
});

test('thiếu khóa tổ chức → 503 api_error; lỗi mạng → 502; quá hạn chờ byte đầu → 504 và hủy request', { timeout: 10_000 }, async t => {
    const mt = await dungMoiTruong({ khoaAi: { anthropic: KHOA.anthropic }, hanGioByteDauMs: 150 });
    t.after(() => mt.dong());
    mt.themMoHinh('deepseek-v4-pro', 'deepseek');
    mt.themMoHinh('claude-sonnet-5', 'anthropic');

    let r = await mt.goi('/ai/v1/messages', { ...TIN, model: 'deepseek-v4-pro' });
    assert.equal(r.status, 503);
    assert.equal(r.headers.get('x-should-retry'), 'false');
    const e = await docLoi(r);
    assert.equal(e.type, 'api_error');
    assert.match(e.message, /chưa được cấu hình khóa API DeepSeek \(biến môi trường AWORD_KHOA_DEEPSEEK\)/);
    assert.equal(mt.yeuCauLen.length, 0);

    mt.datXuLy((_yc, res, req) => { req.socket.on('close', () => res.destroy()); }); // không bao giờ trả lời
    r = await mt.goi('/ai/v1/messages', { ...TIN, stream: true });
    assert.equal(r.status, 504);
    assert.match((await docLoi(r)).message, /không phản hồi sau/);
    await choDen(() => mt.yeuCauLen[0]?.biHuy, 'request lên nhà cung cấp bị hủy khi quá hạn');
    const dong = await choDen(() => cacDongSuDung(mt.db)[0], 'ghi lượt quá hạn');
    assert.deepEqual([dong.trang_thai, dong.ma_loi], ['loi', 'het_gio_byte_dau']);
    assert.equal(cacDongSuDung(mt.db).length, 1);

    const mtLoiMang = await dungMoiTruong({
        fetchFn: async () => { throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }); },
    });
    t.after(() => mtLoiMang.dong());
    mtLoiMang.themMoHinh('claude-sonnet-5', 'anthropic');
    r = await mtLoiMang.goi('/ai/v1/messages', TIN);
    assert.equal(r.status, 502);
    assert.equal((await docLoi(r)).type, 'api_error');
    const dongLoi = await choDen(() => cacDongSuDung(mtLoiMang.db)[0], 'ghi lỗi mạng');
    assert.deepEqual([dongLoi.trang_thai, dongLoi.ma_loi], ['loi', 'ket_noi:ECONNREFUSED']);
});

test('count_tokens: Anthropic chuyển tiếp; DeepSeek/OpenAI ước lượng ⌈ký tự/3⌉; không tính phí, không chặn theo hạn mức', async t => {
    const mt = await dungMoiTruong();
    t.after(() => mt.dong());
    mt.themMoHinh('claude-sonnet-5', 'anthropic', GIA, 'claude-sonnet-5-that');
    mt.themMoHinh('deepseek-flash', 'deepseek', GIA);
    mt.themMoHinh('gpt-5-codex', 'openai', GIA);
    mt.db.prepare('UPDATE tai_khoan SET han_muc_thang_dong = 0 WHERE id = ?').run(mt.taiKhoanId);
    mt.datXuLy((_yc, res) => traJson(res, 200, { input_tokens: 321 }));

    let r = await mt.goi('/ai/v1/messages/count_tokens?beta=true', { model: 'claude-sonnet-5', messages: TIN.messages });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { input_tokens: 321 });
    assert.equal(mt.yeuCauLen[0].url, '/v1/messages/count_tokens?beta=true');
    assert.equal(mt.yeuCauLen[0].headers['x-api-key'], KHOA.anthropic);
    assert.equal(JSON.parse(mt.yeuCauLen[0].body).model, 'claude-sonnet-5-that');

    const yc = {
        model: 'deepseek-flash',
        system: 'Bạn là trợ lý soạn văn bản hành chính.',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'Soạn giấy mời họp' }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'A'.repeat(9000) } }] }],
        tools: [{ name: 'Read', input_schema: { type: 'object' } }],
    };
    const khongAnh = structuredClone(yc);
    (khongAnh.messages[0].content[1] as { source: { data: string } }).source.data = '';
    const mongDoi = Math.ceil(JSON.stringify({ system: yc.system, messages: khongAnh.messages, tools: yc.tools }).length / 3);
    r = await mt.goi('/ai/v1/messages/count_tokens', yc);
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { input_tokens: mongDoi });
    assert.ok(mongDoi < 200, 'dữ liệu base64 của ảnh không được tính như văn bản');

    r = await mt.goi('/ai/v1/messages/count_tokens', { ...yc, model: 'gpt-5-codex' });
    assert.deepEqual(await r.json(), { input_tokens: mongDoi });

    assert.equal(mt.yeuCauLen.length, 1, 'chỉ Anthropic được gọi thật');
    assert.equal(cacDongSuDung(mt.db).length, 0, 'count_tokens không ghi sử dụng');
});
