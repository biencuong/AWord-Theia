// AWord Lite v3 — frontend khung CHAT (giống extension Claude trên VSCode).
// Hiển thị hội thoại + thẻ tool-use (đọc/sửa tệp, chạy skill…). Backend: claude.exe headless stream-json.
'use strict';
// Guard chạy-một-lần (WebView2 có thể chạy app.js 2 lần trong cùng realm → const "already declared").
window.__APPJS_RUNS = (window.__APPJS_RUNS || 0) + 1;

if (window.__APPJS_RUNS === 1) (function () {
  const $ = s => document.querySelector(s);
  const messages = $('#messages'), input = $('#input'), send = $('#send'),
        status = $('#status'), tree = $('#filetree'), wsName = $('#ws-name');

  const T = window.__TAURI__;
  const isTauri = !!T;
  const win = (isTauri && T.window) ? T.window.getCurrentWindow() : null;

  // --- Lớp transport ---
  const api = isTauri ? {
    bootstrap: () => T.core.invoke('bootstrap'),
    onBoot: cb => T.event.listen('boot', e => cb(e.payload)),
    onChat: cb => T.event.listen('chat', e => cb(e.payload)),
    chatStart: resume => T.core.invoke('chat_start', { resume }),
    chatSend: message => T.core.invoke('chat_send', { message }),
    chatStop: () => T.core.invoke('chat_stop'),
    chatNew: () => T.core.invoke('chat_new'),
    listFiles: dir => T.core.invoke('list_files', { dir: dir || '.' }),
    openWorkspace: () => T.core.invoke('open_workspace'),
  } : {
    bootstrap: () => { }, onBoot: () => { }, onChat: () => { },
    chatStart: () => { }, chatSend: () => { }, chatStop: () => { }, chatNew: () => { },
    listFiles: async dir => (await fetch('/files?dir=' + encodeURIComponent(dir || '.'))).json(),
    openWorkspace: () => { },
  };

  // ---------- Markdown tối giản, an toàn (escape trước, rồi định dạng) ----------
  function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function inlineMd(s) {
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, (_, c) => '<code>' + c + '</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    s = s.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" data-ext="1">$1</a>');
    return s;
  }
  function renderMd(src) {
    const blocks = String(src).split(/```/);
    let html = '';
    for (let i = 0; i < blocks.length; i++) {
      if (i % 2 === 1) { // trong khối mã ```
        html += '<pre><code>' + esc(blocks[i].replace(/^[\w-]*\n/, '')) + '</code></pre>';
        continue;
      }
      const lines = blocks[i].split('\n');
      let inList = null; // 'ul' | 'ol'
      const flush = () => { if (inList) { html += '</' + inList + '>'; inList = null; } };
      for (let raw of lines) {
        const line = raw.replace(/\s+$/, '');
        let m;
        if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { flush(); html += '<div class="md-h">' + inlineMd(m[2]) + '</div>'; }
        else if ((m = line.match(/^\s*[-*]\s+(.*)$/))) { if (inList !== 'ul') { flush(); html += '<ul>'; inList = 'ul'; } html += '<li>' + inlineMd(m[1]) + '</li>'; }
        else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { if (inList !== 'ol') { flush(); html += '<ol>'; inList = 'ol'; } html += '<li>' + inlineMd(m[1]) + '</li>'; }
        else if (line.trim() === '') { flush(); }
        else { flush(); html += '<p>' + inlineMd(line) + '</p>'; }
      }
      flush();
    }
    return html;
  }

  // ---------- Hiển thị hội thoại ----------
  function scroll() { messages.scrollTop = messages.scrollHeight; }
  function xoaWelcome() { const w = messages.querySelector('.welcome'); if (w) w.remove(); }
  function themWelcome() {
    const d = document.createElement('div');
    d.className = 'welcome';
    d.innerHTML = '<div class="wbig">A</div><b>Chào mừng đến với AWord</b>' +
      '<div class="wsub">Nhập yêu cầu để trò chuyện với Claude — soạn thảo, đọc, tra cứu văn bản.<br>' +
      'Bấm tệp bên trái để đính kèm <b>@tệp</b> vào câu hỏi.</div>';
    messages.appendChild(d);
  }
  function themUser(text) {
    const d = document.createElement('div');
    d.className = 'msg user'; d.textContent = text;
    messages.appendChild(d); scroll();
  }

  let curAsst = null, shownText = false, dangTraLoi = false;
  const toolCards = {};

  function themAsstText(t) {
    if (!curAsst) {
      curAsst = document.createElement('div');
      curAsst.className = 'msg asst'; curAsst._raw = '';
      messages.appendChild(curAsst);
    }
    curAsst._raw += t;
    curAsst.innerHTML = renderMd(curAsst._raw);
    shownText = true; scroll();
  }

  function basename(p) { return String(p || '').replace(/[\\/]+$/, '').split(/[\\/]/).pop() || String(p || ''); }
  function toolLabel(name, inp) {
    inp = inp || {};
    switch (name) {
      case 'Read': return ['📄', 'Đọc', basename(inp.file_path || inp.path || inp.notebook_path)];
      case 'Write': return ['📝', 'Tạo tệp', basename(inp.file_path)];
      case 'Edit': case 'MultiEdit': return ['✏️', 'Sửa', basename(inp.file_path)];
      case 'NotebookEdit': return ['✏️', 'Sửa sổ tay', basename(inp.notebook_path)];
      case 'Bash': return ['▶️', 'Lệnh', (inp.command || '').slice(0, 90)];
      case 'PowerShell': return ['▶️', 'PowerShell', (inp.command || '').slice(0, 90)];
      case 'Grep': return ['🔎', 'Tìm', inp.pattern || ''];
      case 'Glob': return ['🗂️', 'Liệt kê', inp.pattern || ''];
      case 'Skill': return ['⚙️', 'Kỹ năng', inp.skill || inp.command || ''];
      case 'Task': return ['🤖', 'Việc phụ', inp.description || inp.subagent_type || ''];
      case 'WebFetch': return ['🌐', 'Tải web', inp.url || ''];
      case 'WebSearch': return ['🌐', 'Tìm web', inp.query || ''];
      case 'TodoWrite': return ['✅', 'Cập nhật việc cần làm', ''];
      default: return ['⚙️', name || 'Công cụ', ''];
    }
  }
  function themToolCard(m) {
    curAsst = null; // đóng bong bóng chữ hiện tại để chữ tiếp theo là bong bóng mới
    const d = document.createElement('div');
    d.className = 'tool pending';
    const [ic, verb] = toolLabel(m.name, null);
    d.innerHTML = '<span class="tool-ic">' + ic + '</span><span class="tool-verb">' + esc(verb) +
      '</span> <span class="tool-arg"></span><span class="tool-state"></span>';
    messages.appendChild(d); scroll();
    if (m.id) toolCards[m.id] = d;
  }
  // Điền tham số (đường dẫn tệp…) và diff khi đã có input đầy đủ.
  function capNhatToolCard(m) {
    const d = m.id && toolCards[m.id]; if (!d) return;
    const [, , arg] = toolLabel(m.name, m.input);
    const a = d.querySelector('.tool-arg'); if (a) a.textContent = arg || '';
    const diff = dungDiff(m.name, m.input);
    if (diff) d.appendChild(diff);
    scroll();
  }
  // Dựng khối diff cho Edit/Write/MultiEdit (đỏ = bỏ, xanh = thêm).
  function dungDiff(name, inp) {
    if (!inp) return null;
    let box = null;
    if (name === 'Edit' && (inp.old_string != null || inp.new_string != null)) {
      box = document.createElement('div'); box.className = 'diff';
      box.appendChild(diffLines(inp.old_string || '', inp.new_string || ''));
    } else if (name === 'Write' && inp.content != null) {
      box = document.createElement('div'); box.className = 'diff';
      box.appendChild(diffLines('', inp.content));
    } else if (name === 'MultiEdit' && Array.isArray(inp.edits)) {
      box = document.createElement('div'); box.className = 'diff';
      for (const e of inp.edits.slice(0, 6)) box.appendChild(diffLines(e.old_string || '', e.new_string || ''));
    }
    return box;
  }
  function diffLines(oldS, newS) {
    const frag = document.createDocumentFragment();
    const MAX = 24;
    const add = (text, cls, sign) => {
      if (!text) return;
      const lines = text.split('\n');
      for (const ln of lines.slice(0, MAX)) {
        const r = document.createElement('div'); r.className = 'dl ' + cls; r.textContent = sign + ln; frag.appendChild(r);
      }
      if (lines.length > MAX) { const mo = document.createElement('div'); mo.className = 'dl dim'; mo.textContent = '… (+' + (lines.length - MAX) + ' dòng)'; frag.appendChild(mo); }
    };
    add(oldS, 'del', '- ');
    add(newS, 'add', '+ ');
    return frag;
  }
  function xongToolCard(m) {
    const d = m.id && toolCards[m.id]; if (!d) return;
    d.classList.remove('pending');
    if (m.is_error) d.classList.add('err');
    if (m.is_error && m.preview) {
      const p = document.createElement('div'); p.className = 'tool-prev'; p.textContent = m.preview;
      d.appendChild(p);
    }
    scroll();
  }
  function ketThucLuot(m) {
    if (!shownText && m && m.text) themAsstText(m.text);
    // đánh dấu mọi thẻ tool còn treo là xong (phòng khi thiếu tool_result)
    for (const id in toolCards) toolCards[id].classList.remove('pending');
    dangTraLoi = false; send.disabled = false; $('#btn-stop').disabled = true;
    status.textContent = 'Xong' + (m && m.cost ? ' · ~$' + (+m.cost).toFixed(4) : '') + (m && m.is_error ? ' · CÓ LỖI' : '');
  }

  function onChat(m) {
    if (!m || !m.kind) return;
    switch (m.kind) {
      case 'init': status.textContent = 'Model: ' + (m.model || '?') + ' · sẵn sàng'; break;
      case 'text_start': xoaWelcome(); curAsst = null; break; // bắt đầu khối chữ mới
      case 'text': xoaWelcome(); themAsstText(m.text); break; // chảy từng token
      case 'tool_start': xoaWelcome(); themToolCard(m); break; // thẻ tool (chưa có tham số)
      case 'tool_input': capNhatToolCard(m); break; // điền tham số + diff
      case 'tool_result': xongToolCard(m); break;
      case 'result': ketThucLuot(m); break;
      case 'exit':
        if (dangTraLoi) { dangTraLoi = false; send.disabled = false; $('#btn-stop').disabled = true; status.textContent = 'Claude đã dừng.'; }
        break;
    }
  }

  async function gui() {
    const text = input.value.trim();
    if (!text || dangTraLoi) return;
    xoaWelcome(); themUser(text);
    input.value = ''; input.style.height = 'auto';
    dangTraLoi = true; send.disabled = true; $('#btn-stop').disabled = false;
    curAsst = null; shownText = false;
    status.textContent = 'Claude đang trả lời…';
    try { await api.chatSend(text); }
    catch (e) { status.textContent = 'Không gửi được: ' + e; dangTraLoi = false; send.disabled = false; $('#btn-stop').disabled = true; }
  }
  send.onclick = gui;
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); gui(); } });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 180) + 'px'; });

  // Mở liên kết ngoài bằng trình duyệt hệ thống.
  messages.addEventListener('click', e => {
    const a = e.target.closest('a[data-ext]');
    if (a) { e.preventDefault(); if (isTauri && T.opener) T.opener.openUrl(a.href).catch(() => { }); else window.open(a.href, '_blank'); }
  });

  // --- Nút Mới / Dừng ---
  $('#btn-new').onclick = async () => {
    await api.chatNew();
    messages.innerHTML = ''; themWelcome();
    curAsst = null; shownText = false; dangTraLoi = false; send.disabled = false; $('#btn-stop').disabled = true;
    for (const k in toolCards) delete toolCards[k];
    status.textContent = 'Cuộc trò chuyện mới.'; input.focus();
  };
  $('#btn-stop').onclick = async () => {
    await api.chatStop();
    ketThucLuot(null); status.textContent = 'Đã dừng.';
  };

  // --- Explorer ---
  async function napFiles(dir) {
    try {
      const j = await api.listFiles(dir);
      wsName.textContent = j.workspace || '';
      tree.innerHTML = '';
      for (const it of j.items || []) {
        const li = document.createElement('li');
        li.className = it.dir ? 'dir' : 'file';
        li.textContent = it.name; li.title = it.path;
        li.onclick = () => it.dir ? napFiles(it.path) : chenTep(it.path);
        tree.appendChild(li);
      }
    } catch { }
  }
  function chenTep(path) {
    const pre = input.value && !/\s$/.test(input.value) ? ' ' : '';
    input.value += pre + '@' + path + ' ';
    input.dispatchEvent(new Event('input')); input.focus();
  }
  $('#act-files').onclick = () => { const ex = $('#explorer'); ex.classList.toggle('an'); };

  // --- Cửa sổ ---
  if (win) {
    const c = document.querySelectorAll('.winctrls span');
    if (c[0]) c[0].onclick = () => win.minimize();
    if (c[1]) c[1].onclick = () => win.toggleMaximize();
    if (c[2]) c[2].onclick = () => win.close();
  } else if ($('.winctrls')) { $('.winctrls').style.visibility = 'hidden'; }

  // ---------- MENU bật xuống ----------
  let chatFont = 14;
  function setFont(delta) {
    chatFont = delta === 0 ? 14 : Math.max(11, Math.min(22, chatFont + delta));
    messages.style.fontSize = chatFont + 'px';
  }
  function copySel() { const s = (window.getSelection() || '').toString(); if (s) navigator.clipboard && navigator.clipboard.writeText(s).catch(() => { }); }
  function chonTatCa() { const r = document.createRange(); r.selectNodeContents(messages); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
  function moGioiThieu() { $('#about').classList.remove('hidden'); }

  const MENUS = {
    tep: [
      { label: '＋ Cuộc trò chuyện mới', act: () => $('#btn-new').onclick() },
      { label: '📂 Mở thư mục làm việc', act: () => api.openWorkspace() },
      { sep: 1 },
      { label: 'Thoát', act: () => win && win.close() },
    ],
    sua: [
      { label: 'Sao chép vùng chọn', act: copySel },
      { label: 'Chọn tất cả hội thoại', act: chonTatCa },
      { sep: 1 },
      { label: 'Dán vào ô nhập', act: () => { navigator.clipboard && navigator.clipboard.readText().then(t => { input.value += t; input.dispatchEvent(new Event('input')); input.focus(); }).catch(() => input.focus()); } },
    ],
    xem: [
      { label: 'Phóng to chữ', act: () => setFont(+1) },
      { label: 'Thu nhỏ chữ', act: () => setFont(-1) },
      { label: 'Cỡ chữ mặc định', act: () => setFont(0) },
      { sep: 1 },
      { label: 'Ẩn/hiện Explorer', act: () => $('#explorer').classList.toggle('an') },
      { label: 'Phóng to cửa sổ', act: () => win && win.toggleMaximize() },
    ],
    trogiup: [
      { label: 'Giới thiệu AWord', act: moGioiThieu },
    ],
  };
  const pop = $('#menupop');
  let menuMo = null;
  function dongMenu() { pop.classList.add('hidden'); document.querySelectorAll('.menu.active').forEach(x => x.classList.remove('active')); menuMo = null; }
  function moMenu(key, anchor) {
    if (menuMo === key) { dongMenu(); return; }
    dongMenu();
    const items = MENUS[key] || [];
    pop.innerHTML = '';
    for (const it of items) {
      if (it.sep) { const s = document.createElement('div'); s.className = 'mp-sep'; pop.appendChild(s); continue; }
      const d = document.createElement('div'); d.className = 'mp-item'; d.textContent = it.label;
      d.onclick = () => { dongMenu(); try { it.act(); } catch (e) { } };
      pop.appendChild(d);
    }
    const r = anchor.getBoundingClientRect();
    pop.style.left = r.left + 'px'; pop.style.top = r.bottom + 'px';
    pop.classList.remove('hidden'); anchor.classList.add('active'); menuMo = key;
  }
  document.querySelectorAll('.menu[data-menu]').forEach(el => {
    el.onclick = e => { e.stopPropagation(); moMenu(el.dataset.menu, el); };
    el.onmouseenter = () => { if (menuMo && menuMo !== el.dataset.menu) moMenu(el.dataset.menu, el); };
  });
  document.addEventListener('click', dongMenu);
  $('#about-close').onclick = () => $('#about').classList.add('hidden');

  // ---------- Lớp phủ khởi động ----------
  const bootOverlay = $('#bootoverlay'), bootMsg = $('#boot-msg'), bootSub = $('#boot-sub');
  function hienBoot(msg, sub) { bootMsg.textContent = msg; bootSub.textContent = sub || ''; bootOverlay.classList.remove('hidden'); }
  function anBoot() { bootOverlay.classList.add('hidden'); }
  let daBatDau = false;
  function batDauChat(resume) {
    if (!isTauri) { status.textContent = 'Chế độ xem thử trong trình duyệt — chạy bản đóng gói để dùng.'; return; }
    if (daBatDau) return; daBatDau = true;
    api.chatStart(resume); input.focus();
  }
  function xuLyBoot(m) {
    if (!m || !m.status) return;
    switch (m.status) {
      case 'dang_cai': hienBoot('Đang cài đặt Claude Code (lần đầu)…', 'Đang tải bản mới nhất từ Anthropic. Vui lòng chờ, có thể mất một lát.'); break;
      case 'cai_xong':
        anBoot(); status.textContent = 'Đã cài Claude ' + (m.version || '') + ' · sẵn sàng';
        $('#about-ver').textContent = 'Claude Code ' + (m.version || '');
        batDauChat(false);
        break;
      case 'san_sang':
        anBoot(); status.textContent = 'Claude ' + (m.version || '') + ' · sẵn sàng';
        $('#about-ver').textContent = 'Claude Code ' + (m.version || '');
        batDauChat(true); // khôi phục phiên trước nếu có
        break;
      case 'loi': hienBoot('Chưa dùng được Claude', (m.message || '') + ' — Đóng cửa sổ này, kiểm tra mạng rồi mở lại AWord.'); break;
    }
  }

  // ---------- Khởi động ----------
  themWelcome();
  napFiles('.');
  Promise.resolve(api.onChat(onChat));
  if (isTauri) {
    hienBoot('Đang chuẩn bị AWord…', 'Kiểm tra Claude trên máy…');
    Promise.resolve(api.onBoot(xuLyBoot)).then(() => api.bootstrap());
  } else {
    status.textContent = 'Chế độ xem thử (trình duyệt).';
  }
})();
