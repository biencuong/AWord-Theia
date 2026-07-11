// Tải lại bộ công cụ Python đóng kèm (Python installer + wheels đọc tài liệu) vào
// electron-app/resources/pytools/. Thư mục này bị .gitignore (77MB nhị phân) nên máy
// mới clone repo phải chạy script này 1 lần trước khi đóng gói.
// Yêu cầu: có Python + pip trên máy (chỉ để TẢI wheel, không cần cho AWord chạy).
// Chạy: node electron-app/scripts/fetch-pytools.mjs
import fs from 'fs';
import path from 'path';
import https from 'https';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dst = path.join(__dirname, '..', 'resources', 'pytools');
const wheels = path.join(dst, 'wheels');
fs.mkdirSync(wheels, { recursive: true });

const PYTHON_URL = 'https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe';
const PKGS = ['python-docx', 'openpyxl', 'xlrd', 'pypdf', 'pymupdf', 'pdfplumber',
    'pillow', 'lxml', 'defusedxml', 'pywin32'];

function taiFile(url, dich, chuyenTiep = 0) {
    return new Promise((resolve, reject) => {
        if (chuyenTiep > 5) { return reject(new Error('Quá nhiều chuyển tiếp')); }
        https.get(url, { headers: { 'User-Agent': 'AWord-Fetch' } }, res => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                return resolve(taiFile(res.headers.location, dich, chuyenTiep + 1));
            }
            if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
            const ws = fs.createWriteStream(dich);
            res.pipe(ws);
            ws.on('finish', () => ws.close(() => resolve(dich)));
            ws.on('error', reject);
        }).on('error', reject);
    });
}

const pyExe = path.join(dst, 'python-3.12-amd64.exe');
console.log('Tải Python installer...');
await taiFile(PYTHON_URL, pyExe);
console.log('  ->', (fs.statSync(pyExe).size / 1048576).toFixed(0), 'MB');

console.log('Tải wheels (win_amd64, cp312)...');
execFileSync('python', ['-m', 'pip', 'download', '--dest', wheels,
    '--only-binary=:all:', '--platform', 'win_amd64', '--python-version', '312',
    '--implementation', 'cp', ...PKGS], { stdio: 'inherit' });

const n = fs.readdirSync(wheels).filter(f => f.endsWith('.whl')).length;
console.log(`Xong: ${n} wheel + Python installer trong ${dst}`);
