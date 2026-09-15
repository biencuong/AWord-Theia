// Trang chờ / trang lỗi của phiên làm việc (HTML nhỏ, tiếng Việt, không phụ thuộc tài nguyên ngoài).
import type { IncomingMessage, ServerResponse } from 'node:http';

const thoat = (s: string): string => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

function khung(tieuDe: string, than: string, taiLaiSauGiay?: number): string {
    const taiLai = taiLaiSauGiay ? `<meta http-equiv="refresh" content="${taiLaiSauGiay}">` : '';
    return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${taiLai}
<title>${thoat(tieuDe)} — AWord</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font:15px/1.6 system-ui,"Segoe UI",Roboto,sans-serif;background:#faf7f2;color:#2b2b2b}
main{max-width:30rem;padding:2rem;text-align:center}h1{font-size:1.25rem;margin:0 0 .5rem}p{margin:.25rem 0;color:#555}
.xoay{width:2.25rem;height:2.25rem;margin:0 auto 1rem;border:3px solid #e8ddd0;border-top-color:#d97757;border-radius:50%;animation:x 1s linear infinite}
@keyframes x{to{transform:rotate(360deg)}}a{color:#b85c3c}</style></head><body><main>${than}</main></body></html>`;
}

/** Trình duyệt đang mở trang (điều hướng) chứ không phải lệnh gọi XHR/fetch/tài nguyên. */
export function laYeuCauTrang(req: IncomingMessage): boolean {
    return (req.method === 'GET' || req.method === 'HEAD') && /text\/html/i.test(String(req.headers.accept ?? ''));
}

/** Phiên đang khởi động: 503 + tự tải lại sau vài giây. Yêu cầu không phải trang → văn bản ngắn. */
export function guiTrangCho(req: IncomingMessage, res: ServerResponse, giayTaiLai = 3): void {
    if (res.headersSent) { res.destroy(); return; }
    const thongBao = 'Phiên làm việc AWord đang khởi động, vui lòng chờ trong giây lát.';
    if (!laYeuCauTrang(req)) {
        res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': String(giayTaiLai), 'Cache-Control': 'no-store' });
        res.end(thongBao);
        return;
    }
    res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': String(giayTaiLai), 'Cache-Control': 'no-store' });
    res.end(khung('Đang khởi động', `<div class="xoay"></div><h1>Đang chuẩn bị phiên làm việc của bạn</h1>
<p>Lần đầu hoặc sau một thời gian không dùng, việc này mất khoảng nửa phút đến một phút.</p>
<p>Trang sẽ tự tải lại — bạn không cần bấm gì.</p>`, giayTaiLai));
}

/** Phiên lỗi: trang lỗi tiếng Việt (có nút thử lại). */
export function guiTrangLoi(req: IncomingMessage, res: ServerResponse, thongBao: string, ma = 502): void {
    if (res.headersSent) { res.destroy(); return; }
    if (!laYeuCauTrang(req)) {
        res.writeHead(ma, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(thongBao);
        return;
    }
    res.writeHead(ma, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(khung('Lỗi phiên làm việc', `<h1>Chưa mở được phiên làm việc</h1><p>${thoat(thongBao)}</p>
<p>Hãy <a href="">thử lại</a> sau ít phút; nếu vẫn lỗi, vui lòng báo quản trị hệ thống.</p>`));
}
