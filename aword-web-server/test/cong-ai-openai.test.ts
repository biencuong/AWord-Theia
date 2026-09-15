import { test } from 'node:test';
import assert from 'node:assert/strict';
import { soTokenRong } from '../src/cong-ai/bang-gia.ts';
import { dichPhanHoiResponses, dichYeuCauSangResponses, taoBoDichLuongResponses } from '../src/cong-ai/dich-openai.ts';
import { cacDongSuDung, choDen, dungMoiTruong, KHOA, tachSse } from './fixtures/cong-ai/moi-truong.ts';

const suKien = (d: Record<string, unknown>): string => `event: ${String(d.type)}\ndata: ${JSON.stringify(d)}\n\n`;

/** Chạy một chuỗi sự kiện Responses qua bộ dịch, trả về các sự kiện Anthropic đã phát. */
function dichLuong(cacSuKien: Array<Record<string, unknown>>, ketThuc = true) {
    const soToken = soTokenRong();
    const bo = taoBoDichLuongResponses('gpt-5-codex', soToken, 'msg_kiem_thu');
    let ra = cacSuKien.map(sk => bo.nap(sk)).join('');
    if (ketThuc) { ra += bo.ketThuc(); }
    return { suKien: tachSse(ra), soToken, bo };
}

// ───────────────────────────── Yêu cầu ─────────────────────────────

test('dịch yêu cầu: system khối, text/ảnh của user, text + tool_use của assistant, tool_result, bỏ thinking, tools, tool_choice, max_tokens', () => {
    const schemaRead = { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] };
    const yc = {
        model: 'gpt-5-codex', max_tokens: 4096, temperature: 1, stream: true,
        system: [{ type: 'text', text: 'Bạn là trợ lý AWord.', cache_control: { type: 'ephemeral' } }, { type: 'text', text: 'Trả lời tiếng Việt.' }],
        tools: [
            { name: 'Read', description: 'Đọc tệp', input_schema: schemaRead },
            { type: 'web_search_20250305', name: 'web_search', max_uses: 5 }, // công cụ máy chủ của Anthropic: bỏ
        ],
        tool_choice: { type: 'any', disable_parallel_tool_use: true },
        metadata: { user_id: 'nguoi-dung-bi-mat' },
        messages: [
            { role: 'user', content: [{ type: 'text', text: 'Xem ảnh này' }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo=' } }] },
            { role: 'assistant', content: [
                { type: 'thinking', thinking: 'suy nghĩ nội bộ', signature: 'chu-ky' },
                { type: 'text', text: 'Tôi sẽ đọc tệp.' },
                { type: 'tool_use', id: 'call_1', name: 'Read', input: { file_path: '/du-lieu/a.txt' } },
            ] },
            { role: 'user', content: [
                { type: 'tool_result', tool_use_id: 'call_1', content: [{ type: 'text', text: 'dòng 1' }, { type: 'text', text: 'dòng 2' }] },
                { type: 'text', text: 'Tóm tắt giúp tôi' },
            ] },
            { role: 'assistant', content: 'Đây là tóm tắt.' },
        ],
    };
    assert.deepEqual(dichYeuCauSangResponses(yc, 'gpt-5-codex-goc'), {
        model: 'gpt-5-codex-goc',
        instructions: 'Bạn là trợ lý AWord.\n\nTrả lời tiếng Việt.',
        input: [
            { type: 'message', role: 'user', content: [
                { type: 'input_text', text: 'Xem ảnh này' },
                { type: 'input_image', image_url: 'data:image/png;base64,iVBORw0KGgo=', detail: 'auto' },
            ] },
            { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Tôi sẽ đọc tệp.' }] },
            { type: 'function_call', call_id: 'call_1', name: 'Read', arguments: '{"file_path":"/du-lieu/a.txt"}' },
            { type: 'function_call_output', call_id: 'call_1', output: 'dòng 1\ndòng 2' },
            { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Tóm tắt giúp tôi' }] },
            { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Đây là tóm tắt.' }] },
        ],
        tools: [{ type: 'function', name: 'Read', description: 'Đọc tệp', parameters: schemaRead, strict: false }],
        tool_choice: 'required',
        parallel_tool_calls: false,
        max_output_tokens: 4096,
        stream: true,
        store: false,
    });
});

test('dịch yêu cầu: system chuỗi, tool_result chuỗi và có ảnh, tool_choice tool/auto, temperature khác 1, PDF', () => {
    const kq = dichYeuCauSangResponses({
        model: 'gpt-5-codex', system: 'Hệ thống', temperature: 0.2, top_p: 0.9, max_tokens: 10,
        tools: [{ name: 'Bash', input_schema: { type: 'object' } }],
        tool_choice: { type: 'tool', name: 'Bash' },
        messages: [
            { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_a', name: 'Bash', input: { command: 'ls' } }, { type: 'tool_use', id: 'toolu_b', name: 'Bash', input: {} }] },
            { role: 'user', content: [
                { type: 'tool_result', tool_use_id: 'toolu_a', content: 'a.txt\nb.txt' },
                { type: 'tool_result', tool_use_id: 'toolu_b', is_error: true, content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: '/9j/' } }] },
                { type: 'document', title: 'cong-van.pdf', source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERi0=' } },
            ] },
        ],
    }, 'goc');
    assert.equal(kq.instructions, 'Hệ thống');
    assert.equal(kq.temperature, 0.2);
    assert.equal(kq.top_p, 0.9);
    assert.equal(kq.stream, undefined);
    assert.equal(kq.store, false);
    assert.deepEqual(kq.tool_choice, { type: 'function', name: 'Bash' });
    assert.deepEqual(kq.input, [
        { type: 'function_call', call_id: 'toolu_a', name: 'Bash', arguments: '{"command":"ls"}' },
        { type: 'function_call', call_id: 'toolu_b', name: 'Bash', arguments: '{}' },
        { type: 'function_call_output', call_id: 'toolu_a', output: 'a.txt\nb.txt' },
        { type: 'function_call_output', call_id: 'toolu_b', output: '[Kết quả công cụ là hình ảnh — đính kèm ở tin nhắn kế tiếp.]' },
        { type: 'message', role: 'user', content: [
            { type: 'input_file', filename: 'cong-van.pdf', file_data: 'data:application/pdf;base64,JVBERi0=' },
            { type: 'input_image', image_url: 'data:image/jpeg;base64,/9j/', detail: 'auto' },
        ] },
    ]);
    const auto = dichYeuCauSangResponses({ model: 'x', tools: [{ name: 'A', input_schema: { type: 'object' } }], tool_choice: { type: 'auto' }, messages: [] }, 'x');
    assert.equal(auto.tool_choice, 'auto');
    // không có công cụ thì không gửi tool_choice (OpenAI từ chối tool_choice khi thiếu tools)
    assert.equal(dichYeuCauSangResponses({ model: 'x', tool_choice: { type: 'any' }, messages: [] }, 'x').tool_choice, undefined);
});

// ───────────────────────────── Phản hồi không stream ─────────────────────────────

test('dịch phản hồi không stream: text + function_call → text + tool_use; usage trừ phần cache; stop_reason', () => {
    const kq = dichPhanHoiResponses({
        id: 'resp_1', status: 'completed',
        output: [
            { type: 'reasoning', id: 'rs_1', summary: [] },
            { type: 'message', id: 'msg_a', role: 'assistant', content: [{ type: 'output_text', text: 'Để tôi xem.', annotations: [] }] },
            { type: 'function_call', id: 'fc_1', call_id: 'call_x', name: 'Read', arguments: '{"file_path":"/a.txt"}' },
        ],
        usage: { input_tokens: 1000, input_tokens_details: { cached_tokens: 400 }, output_tokens: 50, output_tokens_details: { reasoning_tokens: 30 } },
    }, 'gpt-5-codex');
    assert.equal(kq.loi, undefined);
    assert.deepEqual(kq.soToken, { vao: 600, ra: 50, cacheDoc: 400, cacheGhi: 0 });
    const tin = kq.tinNhan as Record<string, unknown>;
    assert.match(String(tin.id), /^msg_/);
    assert.equal(tin.model, 'gpt-5-codex');
    assert.equal(tin.stop_reason, 'tool_use');
    assert.deepEqual(tin.content, [
        { type: 'text', text: 'Để tôi xem.' },
        { type: 'tool_use', id: 'call_x', name: 'Read', input: { file_path: '/a.txt' } },
    ]);
    assert.deepEqual(tin.usage, { input_tokens: 600, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 400 });

    const catDo = dichPhanHoiResponses({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' },
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'Dở' }] }], usage: { input_tokens: 5, output_tokens: 9 } }, 'm');
    assert.equal(catDo.tinNhan?.stop_reason, 'max_tokens');
    const binhThuong = dichPhanHoiResponses({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'Xong' }] }] }, 'm');
    assert.equal(binhThuong.tinNhan?.stop_reason, 'end_turn');
    const hong = dichPhanHoiResponses({ status: 'failed', error: { code: 'server_error', message: 'Lỗi máy chủ' } }, 'm');
    assert.equal(hong.loi?.type, 'api_error');
    assert.match(hong.loi?.message ?? '', /Lỗi máy chủ/);
});

// ───────────────────────────── Luồng (bộ dịch) ─────────────────────────────

test('bộ dịch luồng: incomplete vì max_output_tokens → max_tokens; chỉ có bản trọn (không delta) vẫn phát đủ; kết thúc sớm → error', () => {
    let kq = dichLuong([
        { type: 'response.created', response: { id: 'r' } },
        { type: 'response.output_item.added', output_index: 0, item: { type: 'message', content: [] } },
        { type: 'response.output_text.delta', output_index: 0, content_index: 0, delta: 'Viết dở' },
        { type: 'response.incomplete', response: { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, usage: { input_tokens: 10, output_tokens: 100 } } },
    ]);
    assert.deepEqual(kq.suKien.map(s => s.event), ['message_start', 'content_block_start', 'content_block_delta', 'content_block_stop', 'message_delta', 'message_stop']);
    assert.equal(kq.suKien[4].data.delta.stop_reason, 'max_tokens');
    assert.equal(kq.bo.trangThai, 'xong');

    kq = dichLuong([
        { type: 'response.output_item.done', output_index: 0, item: { type: 'function_call', call_id: 'call_z', name: 'Glob', arguments: '{"pattern":"*.docx"}' } },
        { type: 'response.output_item.done', output_index: 1, item: { type: 'message', content: [{ type: 'output_text', text: 'Trọn một lần' }] } },
        { type: 'response.completed', response: { status: 'completed', usage: { input_tokens: 3, output_tokens: 4 } } },
    ]);
    assert.deepEqual(kq.suKien.map(s => [s.event, s.data.index]), [
        ['message_start', undefined], ['content_block_start', 0], ['content_block_delta', 0], ['content_block_stop', 0],
        ['content_block_start', 1], ['content_block_delta', 1], ['content_block_stop', 1], ['message_delta', undefined], ['message_stop', undefined],
    ]);
    assert.deepEqual(kq.suKien[1].data.content_block, { type: 'tool_use', id: 'call_z', name: 'Glob', input: {} });
    assert.equal(kq.suKien[2].data.delta.partial_json, '{"pattern":"*.docx"}');
    assert.equal(kq.suKien[5].data.delta.text, 'Trọn một lần');
    assert.equal(kq.suKien[7].data.delta.stop_reason, 'tool_use');

    kq = dichLuong([
        { type: 'response.created', response: {} },
        { type: 'response.output_text.delta', output_index: 0, content_index: 0, delta: 'Đang' },
    ]);
    assert.deepEqual(kq.suKien.map(s => s.event), ['message_start', 'content_block_start', 'content_block_delta', 'content_block_stop', 'error']);
    assert.equal(kq.suKien[4].data.error.type, 'api_error');
    assert.equal(kq.bo.trangThai, 'loi');

    kq = dichLuong([
        { type: 'response.created', response: {} },
        { type: 'response.failed', response: { status: 'failed', error: { code: 'rate_limit_exceeded', message: 'Chậm lại' }, usage: { input_tokens: 7, output_tokens: 0 } } },
    ]);
    assert.equal(kq.suKien.at(-1)?.event, 'error');
    assert.equal(kq.suKien.at(-1)?.data.error.type, 'rate_limit_error');
    assert.equal(kq.bo.maLoi, 'rate_limit_exceeded');
    assert.equal(kq.soToken.vao, 7);
});

// ───────────────────────────── Tích hợp qua Cổng AI ─────────────────────────────

test('OpenAI streaming qua Cổng AI: text + tool call → đúng chuỗi sự kiện Anthropic, stop_reason tool_use, ghi usage', { timeout: 10_000 }, async t => {
    const mt = await dungMoiTruong();
    t.after(() => mt.dong());
    mt.themMoHinh('gpt-5-codex', 'openai', { gia_vao: 30_000, gia_ra: 250_000, gia_cache_doc: 3_000 }, 'gpt-5-codex-goc');
    const luong = [
        { type: 'response.created', sequence_number: 0, response: { id: 'resp_1', status: 'in_progress', output: [] } },
        { type: 'response.in_progress', sequence_number: 1, response: { id: 'resp_1', status: 'in_progress' } },
        { type: 'response.output_item.added', sequence_number: 2, output_index: 0, item: { id: 'rs_1', type: 'reasoning', summary: [] } },
        { type: 'response.output_item.done', sequence_number: 3, output_index: 0, item: { id: 'rs_1', type: 'reasoning', summary: [] } },
        { type: 'response.output_item.added', sequence_number: 4, output_index: 1, item: { id: 'msg_1', type: 'message', status: 'in_progress', role: 'assistant', content: [] } },
        { type: 'response.content_part.added', sequence_number: 5, item_id: 'msg_1', output_index: 1, content_index: 0, part: { type: 'output_text', text: '', annotations: [] } },
        { type: 'response.output_text.delta', sequence_number: 6, item_id: 'msg_1', output_index: 1, content_index: 0, delta: 'Tôi sẽ ' },
        { type: 'response.output_text.delta', sequence_number: 7, item_id: 'msg_1', output_index: 1, content_index: 0, delta: 'đọc tệp.' },
        { type: 'response.output_text.done', sequence_number: 8, item_id: 'msg_1', output_index: 1, content_index: 0, text: 'Tôi sẽ đọc tệp.' },
        { type: 'response.content_part.done', sequence_number: 9, item_id: 'msg_1', output_index: 1, content_index: 0, part: { type: 'output_text', text: 'Tôi sẽ đọc tệp.' } },
        { type: 'response.output_item.done', sequence_number: 10, output_index: 1, item: { id: 'msg_1', type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Tôi sẽ đọc tệp.' }] } },
        { type: 'response.output_item.added', sequence_number: 11, output_index: 2, item: { id: 'fc_1', type: 'function_call', status: 'in_progress', call_id: 'call_abc', name: 'Read', arguments: '' } },
        { type: 'response.function_call_arguments.delta', sequence_number: 12, item_id: 'fc_1', output_index: 2, delta: '{"file_path":' },
        { type: 'response.function_call_arguments.delta', sequence_number: 13, item_id: 'fc_1', output_index: 2, delta: '"/du-lieu/giấy mời.docx"}' },
        { type: 'response.function_call_arguments.done', sequence_number: 14, item_id: 'fc_1', output_index: 2, arguments: '{"file_path":"/du-lieu/giấy mời.docx"}' },
        { type: 'response.output_item.done', sequence_number: 15, output_index: 2, item: { id: 'fc_1', type: 'function_call', status: 'completed', call_id: 'call_abc', name: 'Read', arguments: '{"file_path":"/du-lieu/giấy mời.docx"}' } },
        { type: 'response.completed', sequence_number: 16, response: { id: 'resp_1', status: 'completed', usage: { input_tokens: 2000, input_tokens_details: { cached_tokens: 1500 }, output_tokens: 120, output_tokens_details: { reasoning_tokens: 80 }, total_tokens: 2120 } } },
    ];
    const vanBan = luong.map(suKien).join('');
    mt.datXuLy(async (_yc, res) => {
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        // cắt thành đoạn 37 byte để thử cả chỗ cắt giữa ký tự UTF-8 nhiều byte
        const buf = Buffer.from(vanBan, 'utf8');
        for (let i = 0; i < buf.length; i += 37) {
            res.write(buf.subarray(i, i + 37));
            if (i % 370 === 0) { await new Promise(ok => setTimeout(ok, 1)); }
        }
        res.end();
    });

    const r = await mt.goi('/ai/v1/messages?beta=true', {
        model: 'gpt-5-codex', max_tokens: 32000, stream: true, system: 'Trợ lý AWord',
        tools: [{ name: 'Read', description: 'Đọc tệp', input_schema: { type: 'object', properties: { file_path: { type: 'string' } } } }],
        messages: [{ role: 'user', content: 'Đọc giấy mời' }],
    }, { 'x-api-key': mt.token, 'anthropic-beta': 'claude-code-20250219' });
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type') ?? '', /text\/event-stream/);
    const cacSuKien = tachSse(await r.text());

    for (const s of cacSuKien) { assert.equal(s.event, s.data.type, 'tên sự kiện SSE phải trùng data.type'); }
    assert.deepEqual(cacSuKien.map(s => s.event), [
        'message_start',
        'content_block_start', 'content_block_delta', 'content_block_delta', 'content_block_stop',
        'content_block_start', 'content_block_delta', 'content_block_delta', 'content_block_stop',
        'message_delta', 'message_stop',
    ]);
    const batDau = cacSuKien[0].data.message;
    assert.equal(batDau.model, 'gpt-5-codex');
    assert.equal(batDau.role, 'assistant');
    assert.deepEqual(cacSuKien[1].data, { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
    assert.equal(cacSuKien.slice(2, 4).map(s => s.data.delta.text).join(''), 'Tôi sẽ đọc tệp.');
    assert.equal(cacSuKien[2].data.delta.type, 'text_delta');
    assert.deepEqual(cacSuKien[5].data, { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'call_abc', name: 'Read', input: {} } });
    assert.ok(cacSuKien.slice(6, 8).every(s => s.data.delta.type === 'input_json_delta' && s.data.index === 1));
    assert.deepEqual(JSON.parse(cacSuKien.slice(6, 8).map(s => s.data.delta.partial_json).join('')), { file_path: '/du-lieu/giấy mời.docx' });
    assert.equal(cacSuKien[8].data.index, 1);
    assert.deepEqual(cacSuKien[9].data, {
        type: 'message_delta',
        delta: { stop_reason: 'tool_use', stop_sequence: null },
        usage: { input_tokens: 500, output_tokens: 120, cache_creation_input_tokens: 0, cache_read_input_tokens: 1500 },
    });

    const len = mt.yeuCauLen[0];
    assert.equal(len.url, '/v1/responses');
    assert.equal(len.headers.authorization, `Bearer ${KHOA.openai}`);
    assert.equal(len.headers['x-api-key'], undefined);
    assert.equal(len.headers['anthropic-beta'], undefined);
    assert.ok(!JSON.stringify(len.headers).includes(mt.token) && !len.body.includes(mt.token));
    const thanLen = JSON.parse(len.body);
    assert.equal(thanLen.model, 'gpt-5-codex-goc');
    assert.equal(thanLen.store, false);
    assert.equal(thanLen.stream, true);
    assert.equal(thanLen.instructions, 'Trợ lý AWord');
    assert.equal(thanLen.max_output_tokens, 32000);

    const dong = await choDen(() => cacDongSuDung(mt.db)[0], 'ghi sử dụng OpenAI');
    assert.deepEqual([dong.nha_cung_cap, dong.mo_hinh, dong.token_vao, dong.token_cache_doc, dong.token_ra, dong.trang_thai],
        ['openai', 'gpt-5-codex', 500, 1500, 120, 'xong']);
    // (500×30.000 + 120×250.000 + 1500×3.000) / 1.000.000 = 49,5 → 50
    assert.equal(dong.chi_phi_dong, 50);
});

test('OpenAI không stream và lỗi HTTP qua Cổng AI: JSON Anthropic; lỗi thường giữ mã HTTP, che khóa API; khóa tổ chức hỏng → 503', async t => {
    const mt = await dungMoiTruong();
    t.after(() => mt.dong());
    mt.themMoHinh('gpt-5-codex', 'openai', { gia_vao: 1_000_000 }, 'gpt-5-codex');
    mt.datXuLy((_yc, res) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ id: 'resp_2', status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'Kính gửi' }] }], usage: { input_tokens: 12, output_tokens: 3 } }));
    });
    let r = await mt.goi('/ai/v1/messages', { model: 'gpt-5-codex', max_tokens: 50, messages: [{ role: 'user', content: 'Mở đầu công văn' }] });
    assert.equal(r.status, 200);
    const tin = await r.json() as Record<string, unknown>;
    assert.equal(tin.type, 'message');
    assert.deepEqual(tin.content, [{ type: 'text', text: 'Kính gửi' }]);
    assert.equal(tin.stop_reason, 'end_turn');
    const dong = await choDen(() => cacDongSuDung(mt.db)[0], 'ghi sử dụng');
    assert.deepEqual([dong.token_vao, dong.token_ra, dong.chi_phi_dong, dong.trang_thai], [12, 3, 12, 'xong']);

    // Lỗi thường (400): giữ mã HTTP, che khóa nếu thông báo có nhắc tới
    mt.datXuLy((_yc, res) => {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Invalid parameter (key sk-to-chu*********************-MAT).', type: 'invalid_request_error', code: 'invalid_value' } }));
    });
    r = await mt.goi('/ai/v1/messages', { model: 'gpt-5-codex', max_tokens: 50, stream: true, messages: [{ role: 'user', content: 'x' }] });
    assert.equal(r.status, 400);
    const e = await r.json() as { type: string; error: { type: string; message: string } };
    assert.equal(e.type, 'error');
    assert.match(e.error.message, /OpenAI trả lỗi HTTP 400: .*sk-\*\*\*/);
    assert.ok(!e.error.message.includes('MAT'), 'không được lộ phần nào của khóa');
    const dongLoi = await choDen(() => cacDongSuDung(mt.db)[1], 'ghi lỗi');
    assert.deepEqual([dongLoi.trang_thai, dongLoi.ma_loi], ['loi', 'http_400:invalid_value']);

    // Khóa tổ chức sai (401): 503 tiếng Việt cho quản trị — không để Claude Code hiểu nhầm là token phiên hỏng
    mt.datXuLy((_yc, res) => {
        res.writeHead(401, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Incorrect API key provided: sk-to-chu*********************-MAT.', type: 'invalid_request_error', code: 'invalid_api_key' } }));
    });
    r = await mt.goi('/ai/v1/messages', { model: 'gpt-5-codex', max_tokens: 50, stream: true, messages: [{ role: 'user', content: 'x' }] });
    assert.equal(r.status, 503);
    assert.equal(r.headers.get('x-should-retry'), 'false');
    const e2 = await r.json() as { type: string; error: { type: string; message: string } };
    assert.equal(e2.error.type, 'api_error');
    assert.match(e2.error.message, /Khóa AI của tổ chức cho OpenAI không hợp lệ/);
    assert.ok(!e2.error.message.includes('MAT'));
    const dongLoi2 = await choDen(() => cacDongSuDung(mt.db)[2], 'ghi lỗi khóa');
    assert.deepEqual([dongLoi2.trang_thai, dongLoi2.ma_loi], ['loi', 'khoa_to_chuc_401:invalid_api_key']);
});
