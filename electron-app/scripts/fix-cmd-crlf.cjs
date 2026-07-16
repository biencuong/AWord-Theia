// Đảm bảo mọi tệp .cmd/.bat đóng gói kèm AWord dùng CRLF (yêu cầu của cmd.exe).
// Trình soạn thảo/công cụ hay lưu LF -> cmd.exe đọc lệch, mất ký tự (nhất là sau
// `chcp 65001`), làm script không chạy. Chạy trong prepackage, sửa tại chỗ.
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..', '..');
const files = ['Ket_Noi_KhoDuLieu.cmd', 'Cai_Dat_Cong_Cu.cmd', 'Kiem_Tra_AWord.cmd', 'Dong_Goi_AWord.bat'];

for (const name of files) {
    const p = path.join(rootDir, name);
    if (!fs.existsSync(p)) { continue; }
    const raw = fs.readFileSync(p, 'utf8');
    // Bỏ BOM nếu có (cmd.exe không thích BOM ở đầu .cmd), chuẩn hóa về CRLF.
    const fixed = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
    if (fixed !== raw) {
        fs.writeFileSync(p, fixed, 'utf8'); // Node ghi utf8 KHÔNG kèm BOM
        console.log(`[fix-cmd-crlf] Đã chuyển ${name} sang CRLF.`);
    } else {
        console.log(`[fix-cmd-crlf] ${name} đã đúng CRLF.`);
    }
}
