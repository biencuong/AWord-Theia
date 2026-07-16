// AWord Lite v3 — frontend: nối SSE nhận phản hồi Claude, gửi tin qua POST, Explorer đọc thư mục.
'use strict';
const $ = s => document.querySelector(s);
const chat = $('#chat'), input = $('#input'), send = $('#send'), status = $('#status'), tree = $('#filetree'), wsName = $('#ws-name');

let bongAssistant = null; // bong bóng assistant đang nhận
let dangTraLoi = false;

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
  d.className = 'msg ' + loai;
  d.textContent = text;
  chat.appendChild(d);
  chat.scrollTop = chat.scrollHeight;
  return d;
}

// --- SSE: nhận sự kiện từ claude.exe ---
function noiStream() {
  const es = new EventSource('/stream');
  es.onmessage = ev => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (m.type === '_ready') { status.textContent = 'Sẵn sàng · ' + (m.workspace || ''); }
    else if (m.type === 'init') { status.textContent = 'Model: ' + (m.model || '?') + ' · sẵn sàng'; }
    else if (m.type === 'assistant') {
      if (!bongAssistant) { bongAssistant = themTin('assistant pending', ''); }
      bongAssistant.textContent += m.text;
      chat.scrollTop = chat.scrollHeight;
    }
    else if (m.type === 'result') {
      if (bongAssistant) { bongAssistant.classList.remove('pending'); }
      else if (m.text) { themTin('assistant', m.text); }
      bongAssistant = null; dangTraLoi = false; send.disabled = false;
      status.textContent = 'Xong' + (m.cost ? ` · ~$${m.cost.toFixed(4)}` : '') + (m.is_error ? ' · LỖI' : '');
    }
    else if (m.type === '_loi' || m.type === '_stderr') { status.textContent = 'Lỗi: ' + (m.message || ''); }
    else if (m.type === '_claude_exit') { status.textContent = 'Claude đã dừng (mã ' + m.code + '). Gửi tin để khởi động lại.'; dangTraLoi = false; send.disabled = false; }
  };
  es.onerror = () => { status.textContent = 'Mất kết nối máy chủ…'; };
}

// --- Gửi tin ---
async function gui() {
  const text = input.value.trim();
  if (!text || dangTraLoi) return;
  xoaWelcome();
  themTin('user', text);
  input.value = ''; input.style.height = 'auto';
  dangTraLoi = true; send.disabled = true; status.textContent = 'Claude đang trả lời…';
  bongAssistant = null;
  try {
    await fetch('/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: text }) });
  } catch { status.textContent = 'Không gửi được.'; dangTraLoi = false; send.disabled = false; }
}
send.onclick = gui;
input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); gui(); }
});
input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 160) + 'px'; });

// --- Explorer ---
async function napFiles(dir) {
  try {
    const r = await fetch('/files?dir=' + encodeURIComponent(dir || '.'));
    const j = await r.json();
    wsName.textContent = j.workspace || '';
    tree.innerHTML = '';
    for (const it of j.items) {
      const li = document.createElement('li');
      li.className = it.dir ? 'dir' : 'file';
      li.textContent = it.name;
      li.title = it.path;
      li.onclick = () => it.dir ? napFiles(it.path) : moFile(it.path);
      tree.appendChild(li);
    }
  } catch { }
}
async function moFile(p) {
  try {
    const r = await fetch('/file?path=' + encodeURIComponent(p));
    if ((r.headers.get('X-Kieu') || '') === 'text') {
      const t = await r.text();
      $('#viewer-title').textContent = p;
      $('#viewer-body').textContent = t;
      $('#viewer').classList.remove('hidden');
    } else {
      // docx/xlsx/pdf... -> mở bằng ứng dụng thật của máy (Word/Excel/PDF).
      status.textContent = 'Đang mở ' + p + ' bằng ứng dụng…';
      await fetch('/open', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: p }) });
    }
  } catch { status.textContent = 'Không mở được tệp.'; }
}
$('#viewer-close').onclick = () => $('#viewer').classList.add('hidden');

// Nút: Cuộc trò chuyện mới / Dừng
$('#btn-new').onclick = async () => {
  await fetch('/new', { method: 'POST' });
  chat.innerHTML = ''; themWelcome();
  bongAssistant = null; dangTraLoi = false; send.disabled = false;
  status.textContent = 'Cuộc trò chuyện mới.'; input.focus();
};
$('#btn-stop').onclick = async () => {
  await fetch('/stop', { method: 'POST' });
  if (bongAssistant) bongAssistant.classList.remove('pending');
  bongAssistant = null; dangTraLoi = false; send.disabled = false;
  status.textContent = 'Đã dừng.';
};

themWelcome();
noiStream();
napFiles('.');
input.focus();
