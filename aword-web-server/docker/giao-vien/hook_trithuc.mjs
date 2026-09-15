#!/usr/bin/env node
// hook_trithuc.mjs — bản Node (Linux: ảnh AWord Web; chạy được cả macOS/Windows) của hook_trithuc.ps1: Hook SessionStart
// của Claude Code (AWord, vai Giáo viên) cho Kho tri thức AI giảng dạy. Hành vi GIỐNG bản PowerShell:
//   - Đọc ~/.aword/trithuc.json (do AWord/Ket_Noi_KhoTriThuc tạo); không có thì đọc tệp cũ khosgk.json (đổi /khosgk → /trithuc).
//   - GET <url gốc>/api/v1/thong-bao?doc=1 (url gốc = url MCP bỏ đuôi "/mcp") với 2 header xác thực thiết bị
//     (Authorization: Bearer <token>, X-May: <ma_may>), hạn 4 giây.
//   - Có thông báo → in JSON hookSpecificOutput.additionalContext "KHO TRI THỨC AI: ..." để Claude nhắc người dùng
//     nguyên văn. Không có thông báo / chưa kết nối / mất mạng / lỗi → IM LẶNG (không in gì, mã thoát 0).
// Đăng ký trong settings.json: node "<home>/.aword/hook_trithuc.mjs"
// Lưu ý mạng: fetch của Node không tự dùng HTTPS_PROXY — phiên đi ra ngoài qua proxy thì đặt NODE_USE_ENV_PROXY=1.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HAN_MS = 4000;

// Chuỗi hóa giá trị như phép nội suy "$(...)" của PowerShell (mảng nối bằng dấu cách, True/False).
function chuoiPS(v) {
    if (Array.isArray(v)) { return v.map(chuoiPS).join(' '); }
    if (typeof v === 'boolean') { return v ? 'True' : 'False'; }
    return String(v);
}

async function layThongBao() {
    const thuMuc = path.join(os.homedir(), '.aword');
    let tep = path.join(thuMuc, 'trithuc.json');
    if (!fs.existsSync(tep)) { tep = path.join(thuMuc, 'khosgk.json'); }
    if (!fs.existsSync(tep)) { return undefined; }
    const cauHinh = JSON.parse(fs.readFileSync(tep, 'utf8').replace(/^﻿/, ''));
    if (!cauHinh || !cauHinh.url || !cauHinh.token) { return undefined; }

    // URL gốc = URL MCP bỏ đuôi "/mcp" (vd https://trithuc.aword.vn/mcp -> https://trithuc.aword.vn); -replace của
    // PowerShell không phân biệt hoa thường.
    const goc = String(cauHinh.url).trim().replace(/\/+$/, '').replace(/\/mcp$/i, '').replace(/\/khosgk$/i, '/trithuc');
    const phanHoi = await fetch(`${goc}/api/v1/thong-bao?doc=1`, {
        headers: {
            Authorization: `Bearer ${chuoiPS(cauHinh.token)}`,
            'X-May': cauHinh.ma_may === undefined || cauHinh.ma_may === null ? '' : chuoiPS(cauHinh.ma_may),
        },
        signal: AbortSignal.timeout(HAN_MS),
    });
    if (!phanHoi.ok) { return undefined; }
    // Invoke-RestMethod (PowerShell 5.1) thử đọc JSON bất kể Content-Type (đã đối chiếu chạy thật); không phải JSON → im lặng.
    const ketQua = JSON.parse(await phanHoi.text());
    if (ketQua === null || ketQua === undefined) { return undefined; }

    // Chấp nhận cả hai dạng: {thong_bao:[...]} hoặc mảng [...]
    let thongBao = [];
    if (Array.isArray(ketQua)) {
        thongBao = ketQua;
    } else if (typeof ketQua === 'object' && Object.hasOwn(ketQua, 'thong_bao')) {
        thongBao = Array.isArray(ketQua.thong_bao) ? ketQua.thong_bao : [ketQua.thong_bao];
    }
    thongBao = thongBao.filter(t => t && t.noi_dung);
    if (thongBao.length === 0) { return undefined; }

    const dong = thongBao.map(t => {
        const mucDo = t.muc_do ? `[${chuoiPS(t.muc_do)}] ` : '';
        const ngay = t.ngay ? ` (${chuoiPS(t.ngay)})` : '';
        return `- ${mucDo}${chuoiPS(t.noi_dung)}${ngay}`;
    });
    const vanBan = `KHO TRI THỨC AI: Có ${thongBao.length} thông báo từ Kho tri thức AI giảng dạy (dịch vụ, cập nhật dữ liệu, đóng góp tài liệu). `
        + 'Hãy nhắc người dùng NGUYÊN VĂN các dòng dưới đây ở đầu câu trả lời đầu tiên, rồi mới làm việc chính; thông báo hết '
        + 'hạn/chưa kích hoạt thì hướng dẫn gia hạn theo skill tra-cuu-tri-thuc:\n' + dong.join('\n');
    return JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: vanBan } });
}

let ra;
try {
    ra = await layThongBao();
} catch {
    // Im lặng khi lỗi mạng/máy chủ/cấu hình — không làm bẩn phiên làm việc
}
if (ra) {
    process.stdout.write(ra + '\n', () => process.exit(0));
} else {
    process.exit(0);
}
