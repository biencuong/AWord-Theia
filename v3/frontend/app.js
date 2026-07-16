// AWord Lite v3 — frontend. Chạy được CẢ HAI chế độ:
//  - Tauri (bản đóng gói): dùng window.__TAURI__ invoke/event.
//  - HTTP (chạy dev qua node server.js): dùng fetch + SSE.
'use strict';
const $ = s => document.querySelector(s);
const chat = $('#chat'), input = $('#input'), send = $('#send'), status = $('#status'), tree = $('#filetree'), wsName = $('#ws-name');

const T = window.__TAURI__;
const isTauri = !!T;

// --- Lớp transport ---
const api = isTauri ? {
  bootstrap: () => T.core.invoke('bootstrap'),
  onBoot: cb => T.event.listen('boot', e => cb(e.payload)),
  chat: content => T.core.invoke('chat', { message: content }),
  onEvent: cb => T.event.listen('claude', e => cb(e.payload)),
  listFiles: dir => T.core.invoke('list_files', { dir: dir || '.' }),
  readFile: path => T.core.invoke('read_file', { path }),
  openExternal: path => T.core.invoke('open_external', { path }),
  stop: () => T.core.invoke('stop'),
} : {
  bootstrap: () => { },
  onBoot: () => { },
  chat: content => fetch('/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) }),
  onEvent: cb => { const es = new EventSource('/stream'); es.onmessage = ev => { try { cb(JSON.parse(ev.data)); } catch { } }; es.onerror = () => status.textContent = 'Mất kết nối máy chủ…'; },
  listFiles: async dir => (await fetch('/files?dir=' + encodeURIComponent(dir || '.'))).json(),
  readFile: async path => { const r = await fetch('/file?path=' + encodeURIComponent(path)); return (r.headers.get('X-Kieu') || '') === 'text' ? { kieu: 'text', noiDung: await r.text() } : { kieu: 'ngoai' }; },
  openExternal: path => fetch('/open', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) }),
  stop: () => fetch('/stop', { method: 'POST' }),
};

let bongAssistant = null, dangTraLoi = false;

function themWelcome() {
  const d = document.createElement('div');
  d.className = 'welcome';
  d.innerHTML = '<div class="big">A</div><div><b>Chào mừng đến với AWord</b></div>' +
    '<div style="margin-top:6px">Gõ yêu cầu bằng tiếng Việt để bắt đầu trò chuyện với Claude.</div>';
  chat.appendChild(d);
}
function xoaWelcome() { const w = chat.querySelector('.welcome'); if (w) w.remove(); }
function themTin(loai, text) {
  const d = document.createElement('div');
  d.className = 'msg ' + loai; d.textContent = text;
  chat.appendChild(d); chat.scrollTop = chat.scrollHeight; return d;
}

// --- Nhận sự kiện từ claude ---
function xuLySuKien(m) {
  if (!m || !m.type) return;
  if (m.type === '_ready') status.textContent = 'Sẵn sàng · ' + (m.workspace || '');
  else if (m.type === 'init') status.textContent = 'Model: ' + (m.model || '?') + ' · sẵn sàng';
  else if (m.type === 'assistant') {
    if (!bongAssistant) bongAssistant = themTin('assistant pending', '');
    bongAssistant.textContent += m.text; chat.scrollTop = chat.scrollHeight;
  } else if (m.type === 'result') {
    if (bongAssistant) bongAssistant.classList.remove('pending');
    else if (m.text) themTin('assistant', m.text);
    bongAssistant = null; dangTraLoi = false; send.disabled = false;
    status.textContent = 'Xong' + (m.cost ? ` · ~$${(+m.cost).toFixed(4)}` : '') + (m.is_error ? ' · LỖI' : '');
  } else if (m.type === '_loi' || m.type === '_stderr') status.textContent = 'Lỗi: ' + (m.message || '');
  else if (m.type === '_claude_exit') { status.textContent = 'Claude đã dừng. Gửi tin để khởi động lại.'; dangTraLoi = false; send.disabled = false; }
}

async function gui() {
  const text = input.value.trim();
  if (!text || dangTraLoi) return;
  xoaWelcome(); themTin('user', text);
  input.value = ''; input.style.height = 'auto';
  dangTraLoi = true; send.disabled = true; status.textContent = 'Claude đang trả lời…'; bongAssistant = null;
  try { await api.chat(text); } catch { status.textContent = 'Không gửi được.'; dangTraLoi = false; send.disabled = false; }
}
send.onclick = gui;
input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); gui(); } });
input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 160) + 'px'; });

// --- Explorer ---
async function napFiles(dir) {
  try {
    const j = await api.listFiles(dir);
    wsName.textContent = j.workspace || '';
    tree.innerHTML = '';
    for (const it of j.items || []) {
      const li = document.createElement('li');
      li.className = it.dir ? 'dir' : 'file'; li.textContent = it.name; li.title = it.path;
      li.onclick = () => it.dir ? napFiles(it.path) : moFile(it.path);
      tree.appendChild(li);
    }
  } catch { }
}
async function moFile(p) {
  try {
    const r = await api.readFile(p);
    if (r.kieu === 'text') {
      $('#viewer-title').textContent = p; $('#viewer-body').textContent = r.noiDung || '';
      $('#viewer').classList.remove('hidden');
    } else {
      status.textContent = 'Đang mở ' + p + ' bằng ứng dụng…';
      await api.openExternal(p);
    }
  } catch { status.textContent = 'Không mở được tệp.'; }
}
$('#viewer-close').onclick = () => $('#viewer').classList.add('hidden');

// --- Nút Mới / Dừng ---
$('#btn-new').onclick = async () => {
  await api.stop(); chat.innerHTML = ''; themWelcome();
  bongAssistant = null; dangTraLoi = false; send.disabled = false;
  status.textContent = 'Cuộc trò chuyện mới.'; input.focus();
};
$('#btn-stop').onclick = async () => {
  await api.stop();
  if (bongAssistant) bongAssistant.classList.remove('pending');
  bongAssistant = null; dangTraLoi = false; send.disabled = false; status.textContent = 'Đã dừng.';
};

// --- Nút cửa sổ (chỉ trong Tauri) ---
if (isTauri && T.window) {
  const win = T.window.getCurrentWindow();
  const c = document.querySelectorAll('.winctrls span');
  if (c[0]) c[0].onclick = () => win.minimize();
  if (c[1]) c[1].onclick = () => win.toggleMaximize();
  if (c[2]) c[2].onclick = () => win.close();
} else {
  $('.winctrls')?.style && ($('.winctrls').style.visibility = 'hidden'); // chạy trong trình duyệt: ẩn nút giả
}

// --- Khởi động: tự phát hiện/cài/cập nhật Claude (chỉ Tauri) ---
const bootOverlay = $('#bootoverlay'), bootMsg = $('#boot-msg'), bootSub = $('#boot-sub');
function hienBoot(msg, sub) { bootMsg.textContent = msg; bootSub.textContent = sub || ''; bootOverlay.classList.remove('hidden'); }
function anBoot() { bootOverlay.classList.add('hidden'); }

function xuLyBoot(m) {
  if (!m || !m.status) return;
  switch (m.status) {
    case 'dang_cai':
      hienBoot('Đang cài đặt Claude Code (lần đầu)…', 'Đang tải bản mới nhất từ Anthropic. Vui lòng chờ, có thể mất một lát.');
      break;
    case 'cai_xong':
      anBoot(); status.textContent = 'Đã cài Claude ' + (m.version || '') + ' · sẵn sàng'; napFiles('.');
      break;
    case 'kiem_tra_cap_nhat':
      status.textContent = 'Đang kiểm tra cập nhật Claude…';
      break;
    case 'cap_nhat_xong':
    case 'cap_nhat_bo_qua':
      status.textContent = 'Sẵn sàng';
      break;
    case 'san_sang':
      anBoot(); status.textContent = 'Model: sẵn sàng · Claude ' + (m.version || '');
      break;
    case 'loi':
      hienBoot('Chưa dùng được Claude', (m.message || '') + ' — Đóng cửa sổ này, kiểm tra mạng rồi mở lại AWord.');
      break;
  }
}

if (isTauri) {
  hienBoot('Đang chuẩn bị AWord…', 'Kiểm tra Claude trên máy…');
  api.onBoot(xuLyBoot);
  api.bootstrap();
}

api.onEvent(xuLySuKien);
themWelcome();
napFiles('.');
input.focus();
