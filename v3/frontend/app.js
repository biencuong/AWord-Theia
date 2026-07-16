// AWord Lite v3 — frontend. Chạy CLAUDE CODE THẬT trong terminal (xterm.js) qua PTY của Tauri.
'use strict';
// Guard chạy-một-lần: WebView2 có thể nạp/chạy app.js 2 lần trong cùng realm → const top-level
// sẽ "already declared". Bọc IIFE (scope hàm) + chỉ init lần đầu để tuyệt đối an toàn.
window.__APPJS_RUNS = (window.__APPJS_RUNS || 0) + 1;

if (window.__APPJS_RUNS === 1) (function () {
  const $ = s => document.querySelector(s);
  const status = $('#status'), tree = $('#filetree'), wsName = $('#ws-name');

  const T = window.__TAURI__;
  const isTauri = !!T;

  // --- Lớp transport ---
  const api = isTauri ? {
    bootstrap: () => T.core.invoke('bootstrap'),
    onBoot: cb => T.event.listen('boot', e => cb(e.payload)),
    ptySpawn: (cols, rows) => T.core.invoke('pty_spawn', { cols, rows }),
    ptyWrite: data => T.core.invoke('pty_write', { data }),
    ptyResize: (cols, rows) => T.core.invoke('pty_resize', { cols, rows }),
    ptyKill: () => T.core.invoke('pty_kill'),
    onPty: cb => T.event.listen('pty', e => cb(e.payload)),
    onPtyExit: cb => T.event.listen('pty_exit', () => cb()),
    listFiles: dir => T.core.invoke('list_files', { dir: dir || '.' }),
  } : {
    bootstrap: () => { }, onBoot: () => { },
    ptySpawn: () => { }, ptyWrite: () => { }, ptyResize: () => { }, ptyKill: () => { },
    onPty: () => { }, onPtyExit: () => { },
    listFiles: async dir => (await fetch('/files?dir=' + encodeURIComponent(dir || '.'))).json(),
  };

  // --- Terminal (xterm) ---
  const term = new Terminal({
    fontFamily: '"Cascadia Code", "Consolas", monospace',
    fontSize: 13,
    cursorBlink: true,
    allowProposedApi: true,
    scrollback: 5000,
    theme: {
      background: '#1e1e1e', foreground: '#e7e7e7',
      cursor: '#e0662a', cursorAccent: '#1e1e1e',
      selectionBackground: '#e0662a55',
      black: '#1e1e1e', brightBlack: '#666',
    },
  });
  const fit = new FitAddon.FitAddon();
  term.loadAddon(fit);
  term.open($('#terminal'));

  // base64 -> Uint8Array (tránh lỗi biên UTF-8 khi ghép mảnh; xterm ghi Uint8Array trực tiếp)
  function b64ToBytes(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  // Đăng ký nhận dữ liệu terminal TRƯỚC khi spawn (sự kiện Tauri không được đệm).
  const ioReady = Promise.all([
    Promise.resolve(api.onPty(b64 => term.write(b64ToBytes(b64)))),
    Promise.resolve(api.onPtyExit(() => {
      term.write('\r\n\x1b[33m▌ Claude đã thoát. Bấm "↻ Khởi động lại" để mở phiên mới.\x1b[0m\r\n');
      status.textContent = 'Claude đã dừng.';
    })),
  ]);

  // Gõ phím -> gửi vào PTY.
  term.onData(d => api.ptyWrite(d));

  function doFit() {
    try { fit.fit(); } catch { }
    if (isTauri) api.ptyResize(term.cols, term.rows);
  }
  new ResizeObserver(() => doFit()).observe($('#terminal'));
  window.addEventListener('resize', doFit);

  function startPty() {
    if (!isTauri) {
      term.write('\x1b[90mChế độ xem thử trong trình duyệt — terminal chỉ hoạt động khi chạy bản đóng gói AWord.\x1b[0m\r\n');
      return;
    }
    ioReady.then(() => {
      try { fit.fit(); } catch { }
      api.ptySpawn(term.cols, term.rows);
      term.focus();
    });
  }

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
        li.onclick = () => it.dir
          ? napFiles(it.path)
          : (api.ptyWrite('@' + it.path + ' '), term.focus());
        tree.appendChild(li);
      }
    } catch { }
  }

  // --- Nút Khởi động lại phiên ---
  $('#btn-restart').onclick = async () => {
    if (!isTauri) return;
    await api.ptyKill();
    term.reset();
    status.textContent = 'Đang mở lại phiên Claude…';
    startPty();
  };

  // --- Nút cửa sổ (chỉ trong Tauri) ---
  if (isTauri && T.window) {
    const win = T.window.getCurrentWindow();
    const c = document.querySelectorAll('.winctrls span');
    if (c[0]) c[0].onclick = () => win.minimize();
    if (c[1]) c[1].onclick = () => win.toggleMaximize();
    if (c[2]) c[2].onclick = () => win.close();
  } else if ($('.winctrls')) {
    $('.winctrls').style.visibility = 'hidden';
  }

  // --- Lớp phủ khởi động (tự cài Claude lần đầu) ---
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
        anBoot(); status.textContent = 'Đã cài Claude ' + (m.version || '') + ' · đang mở phiên…';
        napFiles('.'); startPty();
        break;
      case 'san_sang':
        anBoot(); status.textContent = 'Claude ' + (m.version || '') + ' · sẵn sàng';
        startPty();
        break;
      case 'loi':
        hienBoot('Chưa dùng được Claude', (m.message || '') + ' — Đóng cửa sổ này, kiểm tra mạng rồi mở lại AWord.');
        break;
    }
  }

  // --- Khởi động ---
  napFiles('.');
  if (isTauri) {
    hienBoot('Đang chuẩn bị AWord…', 'Kiểm tra Claude trên máy…');
    Promise.resolve(api.onBoot(xuLyBoot)).then(() => api.bootstrap());
  } else {
    startPty();
  }
})();
