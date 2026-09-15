// Đọc tệp CSV: mã UTF-8 (có hoặc không BOM), phân cách bằng dấu phẩy, chấm phẩy (Excel bản tiếng Việt) hoặc tab,
// trường có ngoặc kép (kể cả dấu phân cách, xuống dòng và "" bên trong).

export function docCsv(buf: Buffer): string[][] {
    let van: string;
    try {
        van = new TextDecoder('utf-8', { fatal: true }).decode(buf);
    } catch {
        throw new Error('Tệp CSV không phải mã UTF-8. Trong Excel, hãy chọn Lưu thành → "CSV UTF-8 (Comma delimited) (*.csv)" rồi nhập lại.');
    }
    if (van.charCodeAt(0) === 0xfeff) { van = van.slice(1); }
    const phanCach = doanPhanCach(van);

    const hang: string[][] = [];
    let dong: string[] = [];
    let truong = '';
    let trongNgoac = false;
    for (let i = 0; i < van.length; i++) {
        const c = van[i];
        if (trongNgoac) {
            if (c === '"') {
                if (van[i + 1] === '"') { truong += '"'; i++; } else { trongNgoac = false; }
            } else {
                truong += c;
            }
        } else if (c === '"' && truong === '') {
            trongNgoac = true;
        } else if (c === phanCach) {
            dong.push(truong);
            truong = '';
        } else if (c === '\r' || c === '\n') {
            if (c === '\r' && van[i + 1] === '\n') { i++; }
            dong.push(truong);
            hang.push(dong);
            dong = [];
            truong = '';
        } else {
            truong += c;
        }
    }
    if (truong !== '' || dong.length > 0) {
        dong.push(truong);
        hang.push(dong);
    }
    while (hang.length > 0 && hang[hang.length - 1].every(t => t.trim() === '')) { hang.pop(); }
    return hang;
}

/** Chọn dấu phân cách xuất hiện nhiều nhất ở dòng đầu (ngoài ngoặc kép); mặc định dấu phẩy. */
function doanPhanCach(van: string): string {
    const dem: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
    let trongNgoac = false;
    for (const c of van) {
        if (c === '"') { trongNgoac = !trongNgoac; continue; }
        if (!trongNgoac && (c === '\n' || c === '\r')) { break; }
        if (!trongNgoac && c in dem) { dem[c]++; }
    }
    let tot = ',';
    for (const k of [';', '\t']) { if (dem[k] > dem[tot]) { tot = k; } }
    return tot;
}

/** Ghi CSV (dấu phẩy, ngoặc kép khi cần, CRLF, có BOM để Excel hiện đúng tiếng Việt). */
export function ghiCsv(hang: Array<Array<string | number | null | undefined>>): string {
    const thoat = (v: string | number | null | undefined): string => {
        let s = v === null || v === undefined ? '' : String(v);
        // Chặn chèn công thức khi mở bằng Excel
        if (/^[=+\-@\t\r]/.test(s)) { s = `'${s}`; }
        return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return '﻿' + hang.map(h => h.map(thoat).join(',')).join('\r\n') + '\r\n';
}
