// AWord Lite (v3) — vỏ nhẹ: máy chủ Node cục bộ điều khiển claude.exe (headless stream-json)
// và phục vụ giao diện web. KHÔNG cần Electron/Theia. Chỉ dùng module có sẵn của Node.
//
// Kiến trúc:
//   - Giữ MỘT tiến trình claude.exe sống (stdin mở) ở chế độ --print --input/output-format stream-json.
//   - Trình duyệt gửi tin nhắn qua POST /chat  -> ghi 1 dòng JSON vào stdin claude.
//   - Trình duyệt nhận phản hồi qua GET /stream (SSE) <- đọc từng dòng JSON stdout claude.
//   - GET /files, GET /file  -> Explorer đọc thư mục làm việc.
//
// Chạy:  node server.js  [thư-mục-làm-việc]   (mặc định: Documents\AWord)

'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const readline = require('readline');

const PORT = 41789;
const FE_DIR = path.join(__dirname, '..', 'frontend');
const WORKSPACE = process.argv[2] || path.join(os.homedir(), 'Documents', 'AWord');

// --- Tìm claude.exe: PATH -> các vị trí cài phổ biến -> bản đóng kèm AWord ---
function timClaude() {
    const ung = [
        path.join(os.homedir(), '.local', 'bin', 'claude.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'claude', 'claude.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'AWord', 'resources', 'app', 'plugins',
            'Anthropic.claude-code', 'extension', 'resources', 'native-binary', 'claude.exe'),
        // Khi chạy từ repo (dev):
        path.join(__dirname, '..', '..', 'electron-app', 'plugins', 'Anthropic.claude-code',
            'extension', 'resources', 'native-binary', 'claude.exe'),
    ];
    for (const p of ung) { try { if (fs.existsSync(p)) return p; } catch { } }
    return 'claude'; // dựa vào PATH
}
const CLAUDE = timClaude();

// --- Quản lý tiến trình claude + hàng đợi client SSE ---
let cp = null;
const sseClients = new Set();

function guiSSE(obj) {
    const data = `data: ${JSON.stringify(obj)}\n\n`;
    for (const res of sseClients) { try { res.write(data); } catch { } }
}

function khoiDongClaude() {
    if (cp && !cp.killed) return;
    // --include-partial-messages để nhận text dần (nếu bản claude hỗ trợ); không có cũng chạy.
    const args = ['--print', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose'];
    cp = spawn(CLAUDE, args, { cwd: WORKSPACE, env: process.env, windowsHide: true });
    cp.on('error', e => guiSSE({ type: '_loi', message: 'Không chạy được claude.exe: ' + e.message }));
    cp.on('exit', code => { guiSSE({ type: '_claude_exit', code }); cp = null; });
    const rl = readline.createInterface({ input: cp.stdout });
    rl.on('line', line => {
        line = line.trim();
        if (!line) return;
        let obj; try { obj = JSON.parse(line); } catch { return; }
        // Chỉ chuyển tiếp thứ giao diện cần: assistant (text), result (xong), lỗi.
        if (obj.type === 'assistant' && obj.message && Array.isArray(obj.message.content)) {
            const text = obj.message.content.filter(c => c.type === 'text').map(c => c.text).join('');
            if (text) guiSSE({ type: 'assistant', text });
        } else if (obj.type === 'result') {
            guiSSE({ type: 'result', text: obj.result || '', is_error: !!obj.is_error, cost: obj.total_cost_usd });
        } else if (obj.type === 'system' && obj.subtype === 'init') {
            guiSSE({ type: 'init', model: obj.model, session_id: obj.session_id });
        }
    });
    let err = '';
    cp.stderr.on('data', d => { err += d; if (err.length > 400) { guiSSE({ type: '_stderr', message: err.slice(-400) }); err = ''; } });
}

function guiTinNhan(noiDung) {
    khoiDongClaude();
    const msg = JSON.stringify({ type: 'user', message: { role: 'user', content: noiDung } }) + '\n';
    try { cp.stdin.write(msg); } catch (e) { guiSSE({ type: '_loi', message: 'Ghi stdin thất bại: ' + e.message }); }
}

// --- Explorer: liệt kê thư mục / đọc tệp (giới hạn trong WORKSPACE) ---
function trongWorkspace(p) {
    const abs = path.resolve(WORKSPACE, p || '.');
    return abs.startsWith(path.resolve(WORKSPACE)) ? abs : null;
}
function lietKe(dir) {
    const abs = trongWorkspace(dir);
    if (!abs || !fs.existsSync(abs)) return [];
    return fs.readdirSync(abs, { withFileTypes: true })
        .filter(e => !e.name.startsWith('.'))
        .map(e => ({ name: e.name, dir: e.isDirectory(), path: path.relative(WORKSPACE, path.join(abs, e.name)).replace(/\\/g, '/') }))
        .sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name, 'vi'));
}

// --- HTTP ---
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
function phucVuTinh(res, file) {
    fs.readFile(file, (e, buf) => {
        if (e) { res.writeHead(404); res.end('không thấy'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(buf);
    });
}
function docBody(req) {
    return new Promise(resolve => { let b = ''; req.on('data', c => b += c); req.on('end', () => resolve(b)); });
}

const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, `http://localhost:${PORT}`);
    if (u.pathname === '/stream') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
        res.write(`data: ${JSON.stringify({ type: '_ready', workspace: WORKSPACE })}\n\n`);
        sseClients.add(res);
        req.on('close', () => sseClients.delete(res));
        return;
    }
    if (u.pathname === '/chat' && req.method === 'POST') {
        const body = await docBody(req);
        let noiDung = ''; try { noiDung = JSON.parse(body).content || ''; } catch { }
        if (noiDung) guiTinNhan(noiDung);
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
        return;
    }
    if (u.pathname === '/files') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ workspace: WORKSPACE, items: lietKe(u.searchParams.get('dir') || '.') }));
        return;
    }
    if (u.pathname === '/file') {
        const abs = trongWorkspace(u.searchParams.get('path') || '');
        if (!abs || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) { res.writeHead(404); res.end(''); return; }
        // Prototype: chỉ đọc text; docx/pdf để giai đoạn sau (docx-preview/pdf.js).
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(fs.readFileSync(abs));
        return;
    }
    // Tĩnh
    let file = u.pathname === '/' ? 'index.html' : u.pathname.replace(/^\//, '');
    phucVuTinh(res, path.join(FE_DIR, file));
});

try { fs.mkdirSync(WORKSPACE, { recursive: true }); } catch { }
server.listen(PORT, '127.0.0.1', () => {
    console.log(`AWord Lite v3 chay tai http://127.0.0.1:${PORT}`);
    console.log(`claude.exe: ${CLAUDE}`);
    console.log(`Thu muc lam viec: ${WORKSPACE}`);
});
