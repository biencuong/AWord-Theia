// Máy chủ HTTP của AWord Web: định tuyến theo tên máy giữa cổng truy cập, Cổng AI và phiên AWord của người đăng nhập.
//
// Hai NGUỒN GỐC tách biệt — mã chạy trong phiên (do người dùng/AI điều khiển) không được cùng nguồn gốc với trang quản trị:
//   <tenMien>                                            cổng: đăng nhập, tài khoản, quản trị; "/" đưa sang phiên AWord
//   <tenMienUngDung>, {uuid}.webview.<tenMienUngDung>     phiên AWord của người đang đăng nhập (proxy vào container)
//   /ai/* trên mọi máy KHÔNG phải máy của phiên            Cổng AI (phiên gọi qua ANTHROPIC_BASE_URL, xác thực bằng token)
// Cookie đăng nhập đặt Domain=<tenMien> nên máy của phiên cũng nhận; proxy bỏ mọi cookie `aword_*` trước khi vào phiên.
// Từ máy của phiên, trình duyệt không đọc được trang cổng (khác nguồn gốc) nên không lấy được token CSRF; biểu mẫu/API của
// cổng còn kiểm Origin — yêu cầu giả mạo từ phiên bị chặn.
import * as http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import type { CauHinh } from './cau-hinh.ts';
import { chuyenDenDangNhap } from './cong-truy-cap/cong-truy-cap.ts';
import type { TaiKhoanDangNhap } from './cong-truy-cap/cong-truy-cap.ts';
import { trangLoi } from './cong-truy-cap/giao-dien.ts';
import { chuyenHuong, guiHtml } from './cong-truy-cap/http.ts';

export interface ThanhPhanMayChu {
    cauHinh: CauHinh;
    congAi: { xuLy(req: IncomingMessage, res: ServerResponse): Promise<boolean> };
    congTruyCap: {
        xuLy(req: IncomingMessage, res: ServerResponse): Promise<boolean>;
        xacThucYeuCau(req: IncomingMessage): TaiKhoanDangNhap | null;
    };
    dieuPhoi: {
        xuLy(req: IncomingMessage, res: ServerResponse, taiKhoanId: number): Promise<void>;
        xuLyWebSocket(req: IncomingMessage, socket: Duplex, head: Buffer, taiKhoanId: number): Promise<void>;
    };
}

/** Tên máy (chữ thường, không cổng) và phần ":cổng" của header Host. */
export function tachHost(host: string | undefined): { may: string; cong: string } {
    const m = /^(\[[^\]]+\]|[^:]+)(:\d+)?$/.exec((host ?? '').trim().toLowerCase());
    return { may: m?.[1] ?? '', cong: m?.[2] ?? '' };
}

function laYeuCauTrang(req: IncomingMessage): boolean {
    return (req.method === 'GET' || req.method === 'HEAD') && (req.headers.accept ?? '').includes('text/html');
}

export function taoMayChu(tp: ThanhPhanMayChu): http.Server {
    const { cauHinh, congAi, congTruyCap, dieuPhoi } = tp;

    const laMayPhien = (may: string): boolean =>
        may === cauHinh.tenMienUngDung || may.endsWith(`.webview.${cauHinh.tenMienUngDung}`);
    // Sau proxy HTTPS (443) trình duyệt không thấy cổng nội bộ → bỏ phần cổng khỏi địa chỉ tuyệt đối.
    const diaChi = (may: string, cong: string): string => `${cauHinh.https ? 'https' : 'http'}://${may}${cauHinh.https ? '' : cong}`;

    function khongTimThay(res: ServerResponse): void {
        guiHtml(res, 404, trangLoi({ trangThai: 404, tieuDe: 'Không tìm thấy trang', noiDung: 'Địa chỉ này không có trên AWord Web.' }));
    }

    async function xuLyYeuCau(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const { may, cong } = tachHost(req.headers.host);
        const duongDan = (req.url ?? '/').split('?')[0];

        if (laMayPhien(may)) {
            const tk = congTruyCap.xacThucYeuCau(req);
            if (!tk) {
                if (laYeuCauTrang(req)) { return chuyenHuong(res, `${diaChi(cauHinh.tenMien, cong)}/dang-nhap`, 302); }
                res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
                res.end(JSON.stringify({ loi: 'Phiên đăng nhập đã hết hạn. Tải lại trang để đăng nhập lại.' }));
                return;
            }
            return dieuPhoi.xuLy(req, res, tk.id);
        }

        if ((duongDan === '/ai' || duongDan.startsWith('/ai/')) && await congAi.xuLy(req, res)) { return; }

        if (may !== cauHinh.tenMien) {
            // Truy cập bằng IP hoặc tên khác: đưa về tên miền chính thức (webview và cookie chỉ chạy đúng trên tên miền).
            if (laYeuCauTrang(req)) { return chuyenHuong(res, `${diaChi(cauHinh.tenMien, cong)}/`, 302); }
            return khongTimThay(res);
        }

        if (await congTruyCap.xuLy(req, res)) { return; }
        if (duongDan === '/') {
            if (!congTruyCap.xacThucYeuCau(req)) { return chuyenDenDangNhap(res, '/'); }
            return chuyenHuong(res, `${diaChi(cauHinh.tenMienUngDung, cong)}/`, 302);
        }
        khongTimThay(res);
    }

    async function xuLyNangCap(req: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
        const { may } = tachHost(req.headers.host);
        const tk = laMayPhien(may) ? congTruyCap.xacThucYeuCau(req) : null;
        if (!tk) {
            socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
            return;
        }
        await dieuPhoi.xuLyWebSocket(req, socket, head, tk.id);
    }

    const mayChu = http.createServer((req, res) => {
        xuLyYeuCau(req, res).catch(e => {
            console.error('[aword-web]', e);
            if (!res.headersSent) {
                guiHtml(res, 500, trangLoi({ trangThai: 500, tieuDe: 'Không thực hiện được', noiDung: 'Máy chủ gặp lỗi khi xử lý yêu cầu. Vui lòng thử lại sau ít phút.' }));
            } else if (!res.writableEnded) {
                res.destroy();
            }
        });
    });
    mayChu.on('upgrade', (req, socket, head) => {
        socket.on('error', () => { /* trình duyệt ngắt giữa chừng */ });
        xuLyNangCap(req, socket, head).catch(e => {
            console.error('[aword-web] websocket', e);
            socket.destroy();
        });
    });
    // Stream AI dài và WebSocket: không để Node tự cắt yêu cầu sau 5 phút mặc định.
    mayChu.requestTimeout = 0;
    mayChu.headersTimeout = 60_000;
    return mayChu;
}
