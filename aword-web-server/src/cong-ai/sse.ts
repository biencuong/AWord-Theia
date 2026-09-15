// Server-Sent Events (SSE): tách luồng văn bản thành từng sự kiện và định dạng sự kiện để phát.
// Nạp dần từng đoạn mạng: chịu được một dòng bị cắt ngang giữa hai đoạn và cả ba kiểu xuống dòng (\n, \r\n, \r).

export interface SuKienSse {
    /** Tên sự kiện (dòng `event:`), mặc định 'message'. */
    event: string;
    /** Các dòng `data:` nối bằng \n. */
    data: string;
}

export interface BoTachSse {
    nap(doan: string): void;
    /** Hết luồng: phát nốt sự kiện cuối nếu nhà cung cấp không gửi dòng trống kết thúc. */
    ketThuc(): void;
}

// Một dòng dài bất thường (nhà cung cấp lỗi) không được làm phình bộ nhớ vô hạn.
const DONG_TOI_DA = 16 * 1024 * 1024;

export function taoBoTachSse(khiCoSuKien: (suKien: SuKienSse) => void): BoTachSse {
    let dem = '';
    let tenSuKien = '';
    let duLieu: string[] = [];

    const phat = () => {
        if (duLieu.length > 0) { khiCoSuKien({ event: tenSuKien || 'message', data: duLieu.join('\n') }); }
        tenSuKien = '';
        duLieu = [];
    };
    const xuLyDong = (dong: string) => {
        if (dong === '') { phat(); return; }
        if (dong.charCodeAt(0) === 58) { return; } // ':' — chú thích, vd ": keep-alive" của DeepSeek
        const viTri = dong.indexOf(':');
        const truong = viTri < 0 ? dong : dong.slice(0, viTri);
        let giaTri = viTri < 0 ? '' : dong.slice(viTri + 1);
        if (giaTri.charCodeAt(0) === 32) { giaTri = giaTri.slice(1); }
        if (truong === 'event') { tenSuKien = giaTri; } else if (truong === 'data') { duLieu.push(giaTri); }
    };

    return {
        nap(doan: string): void {
            dem += doan;
            const n = dem.length;
            let dau = 0;
            for (let i = 0; i < n; i++) {
                const c = dem.charCodeAt(i);
                if (c !== 10 && c !== 13) { continue; }
                if (c === 13 && i === n - 1) { break; } // '\r' cuối đoạn: chờ đoạn sau để biết có '\n' đi kèm không
                xuLyDong(dem.slice(dau, i));
                if (c === 13 && dem.charCodeAt(i + 1) === 10) { i++; }
                dau = i + 1;
            }
            dem = dem.slice(dau);
            if (dem.length > DONG_TOI_DA) { dem = ''; }
        },
        ketThuc(): void {
            if (dem !== '') { xuLyDong(dem.replace(/\r$/, '')); dem = ''; }
            phat();
        },
    };
}

/** Một sự kiện SSE định dạng Anthropic: `event: <tên>` + `data: <JSON>` + dòng trống. */
export const dongSse = (ten: string, duLieu: unknown): string => `event: ${ten}\ndata: ${JSON.stringify(duLieu)}\n\n`;
