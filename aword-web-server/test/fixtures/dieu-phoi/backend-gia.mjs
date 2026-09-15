// Backend giả thay cho Theia khi kiểm thử trình "tien-trinh": nhận cùng tham số dòng lệnh, nghe HTTP, sinh một tiến
// trình cháu (giống plugin host) để kiểm tra việc dừng cả cây tiến trình.
import http from 'node:http';
import { spawn } from 'node:child_process';

const thamSo = {};
const viTri = [];
for (const a of process.argv.slice(2)) {
    if (a.startsWith('--')) {
        const i = a.indexOf('=');
        thamSo[a.slice(2, i)] = a.slice(i + 1);
    } else {
        viTri.push(a);
    }
}

const chau = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore', windowsHide: true });

setTimeout(() => {
    http.createServer((req, res) => {
        if (req.url === '/thong-tin') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ thamSo, viTri, cwd: process.cwd(), pid: process.pid, chau: chau.pid, env: process.env }));
            return;
        }
        if (req.url === '/thoat') {
            res.end('tạm biệt');
            setTimeout(() => { chau.kill(); process.exit(3); }, 20);
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('AWord giả');
    }).listen(Number(thamSo.port), thamSo.hostname, () => console.log(`backend gia nghe cong ${thamSo.port}`));
}, Number(process.env.BACKEND_GIA_TRE_MS || 0));
