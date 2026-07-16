// AWord Lite (v3) — backend Rust (Tauri v2).
// Chạy CLAUDE CODE THẬT (giao diện tương tác đầy đủ: tool-use, sửa file, skill) trong một
// terminal thật (PTY/ConPTY) render bằng xterm.js — vỏ ~8MB thay Electron/Theia.
// KHÔNG đóng kèm claude.exe: khi chạy tự tìm; THIẾU thì tự cài (trình cài chính thức).
// KHÔNG tự chạy `claude update` (Claude Code tự cập nhật sẵn) → mở nhanh, không "treo".
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::Engine;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde_json::json;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

// Một phiên terminal đang chạy claude.
struct PtySession {
    master: Box<dyn portable_pty::MasterPty + Send>, // để resize
    writer: Box<dyn Write + Send>,                   // để gõ vào
    child: Box<dyn portable_pty::Child + Send + Sync>, // để kết thúc
}

#[derive(Default)]
struct AppState {
    pty: Mutex<Option<PtySession>>,
    claude_path: Mutex<Option<String>>,
}

fn home() -> PathBuf {
    PathBuf::from(std::env::var("USERPROFILE").unwrap_or_else(|_| ".".into()))
}
fn workspace() -> PathBuf {
    let ws = home().join("Documents").join("AWord");
    let _ = std::fs::create_dir_all(&ws);
    ws
}
fn localappdata() -> PathBuf {
    PathBuf::from(std::env::var("LOCALAPPDATA").unwrap_or_default())
}

// Tìm claude.exe. Trả về (đường dẫn, là_bản_đóng_kèm_AWord_Theia).
// Ưu tiên bản cài của người dùng, cuối cùng mới đến bản đóng kèm AWord Theia.
fn find_claude_path() -> Option<(String, bool)> {
    let user_cands = [
        home().join(".local").join("bin").join("claude.exe"),
        localappdata().join("Programs").join("claude").join("claude.exe"),
    ];
    for c in &user_cands {
        if c.exists() {
            return Some((c.to_string_lossy().into_owned(), false));
        }
    }
    if let Ok(rd) = std::fs::read_dir(localappdata().join("Microsoft").join("WinGet").join("Packages")) {
        for e in rd.flatten() {
            if e.file_name().to_string_lossy().starts_with("Anthropic.ClaudeCode") {
                let p = e.path().join("claude.exe");
                if p.exists() {
                    return Some((p.to_string_lossy().into_owned(), false));
                }
            }
        }
    }
    if let Ok(paths) = std::env::var("PATH") {
        for dir in std::env::split_paths(&paths) {
            let p = dir.join("claude.exe");
            if p.exists() {
                return Some((p.to_string_lossy().into_owned(), false));
            }
        }
    }
    let bundle = localappdata()
        .join("Programs").join("AWord").join("resources").join("app").join("plugins")
        .join("Anthropic.claude-code").join("extension").join("resources").join("native-binary").join("claude.exe");
    if bundle.exists() {
        return Some((bundle.to_string_lossy().into_owned(), true));
    }
    None
}

fn get_version(exe: &str) -> String {
    std::process::Command::new(exe).arg("--version").output().ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_default()
}

// Bootstrap: xác định/cài claude, phát sự kiện "boot". Chạy nền, không chặn UI.
#[tauri::command]
fn bootstrap(app: AppHandle) {
    let app2 = app.clone();
    std::thread::spawn(move || {
        if let Some((p, is_bundle)) = find_claude_path() {
            let ver = get_version(&p);
            set_claude_path(&app2, &p);
            // Sẵn sàng: giao diện sẽ khởi terminal. Claude Code tự lo cập nhật, ta không chặn.
            let _ = app2.emit("boot", json!({"status":"san_sang","path":p,"version":ver,"bundle":is_bundle}));
        } else {
            let _ = app2.emit("boot", json!({"status":"dang_cai"}));
            if cai_claude() {
                if let Some((p, is_bundle)) = find_claude_path() {
                    let ver = get_version(&p);
                    set_claude_path(&app2, &p);
                    let _ = app2.emit("boot", json!({"status":"cai_xong","path":p,"version":ver,"bundle":is_bundle}));
                } else {
                    let _ = app2.emit("boot", json!({"status":"loi","message":"Đã chạy trình cài nhưng vẫn không thấy claude. Kiểm tra kết nối mạng rồi thử lại."}));
                }
            } else {
                let _ = app2.emit("boot", json!({"status":"loi","message":"Không cài được Claude. Kiểm tra kết nối mạng (cần tải từ claude.ai)."}));
            }
        }
    });
}

// Trình cài chính thức của Claude Code cho Windows (native, bản latest).
fn cai_claude() -> bool {
    std::process::Command::new("powershell")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
            "& ([scriptblock]::Create((Invoke-RestMethod https://claude.ai/install.ps1))) latest"])
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

fn set_claude_path(app: &AppHandle, p: &str) {
    *app.state::<AppState>().claude_path.lock().unwrap() = Some(p.to_string());
}

// Mở phiên terminal chạy claude tương tác, kích thước cols×rows.
#[tauri::command]
fn pty_spawn(app: AppHandle, state: State<AppState>, cols: u16, rows: u16) -> Result<(), String> {
    {
        // Đã có phiên còn sống thì thôi.
        let mut g = state.pty.lock().unwrap();
        if let Some(s) = g.as_mut() {
            if s.child.try_wait().ok().flatten().is_none() {
                return Ok(());
            }
        }
    }
    let exe = {
        let mut pp = state.claude_path.lock().unwrap();
        if pp.is_none() {
            if let Some((p, _)) = find_claude_path() { *pp = Some(p); }
        }
        pp.clone().ok_or_else(|| "Chưa cài Claude.".to_string())?
    };

    let pty = native_pty_system();
    let pair = pty
        .openpty(PtySize { rows: rows.max(4), cols: cols.max(20), pixel_width: 0, pixel_height: 0 })
        .map_err(|e| format!("Không mở được terminal: {e}"))?;

    let mut cmd = CommandBuilder::new(&exe);
    cmd.cwd(workspace());
    // Truyền toàn bộ biến môi trường hiện tại (PATH, USERPROFILE, LOCALAPPDATA...) để claude
    // tìm được ~/.claude, gateway, MCP... y như chạy trong terminal thật.
    for (k, v) in std::env::vars() {
        cmd.env(k, v);
    }
    cmd.env("TERM", "xterm-256color");

    let child = pair.slave.spawn_command(cmd).map_err(|e| format!("Không chạy được claude: {e}"))?;
    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader().map_err(|e| format!("{e}"))?;
    let writer = pair.master.take_writer().map_err(|e| format!("{e}"))?;

    // Luồng đọc PTY -> phát 'pty' (base64) lên webview.
    let app2 = app.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let b64 = base64::engine::general_purpose::STANDARD.encode(&buf[..n]);
                    let _ = app2.emit("pty", b64);
                }
                Err(_) => break,
            }
        }
        let _ = app2.emit("pty_exit", ());
    });

    *state.pty.lock().unwrap() = Some(PtySession { master: pair.master, writer, child });
    Ok(())
}

// Gõ dữ liệu vào terminal (chuỗi UTF-8, gồm cả phím điều khiển như \r, \x03, \x1b...).
#[tauri::command]
fn pty_write(state: State<AppState>, data: String) {
    if let Some(s) = state.pty.lock().unwrap().as_mut() {
        let _ = s.writer.write_all(data.as_bytes());
        let _ = s.writer.flush();
    }
}

// Đổi kích thước terminal khi cửa sổ co giãn.
#[tauri::command]
fn pty_resize(state: State<AppState>, cols: u16, rows: u16) {
    if let Some(s) = state.pty.lock().unwrap().as_ref() {
        let _ = s.master.resize(PtySize { rows: rows.max(4), cols: cols.max(20), pixel_width: 0, pixel_height: 0 });
    }
}

// Kết thúc phiên (để khởi động lại).
#[tauri::command]
fn pty_kill(state: State<AppState>) {
    if let Some(mut s) = state.pty.lock().unwrap().take() {
        let _ = s.child.kill();
    }
}

fn in_ws(rel: &str) -> Option<PathBuf> {
    let ws = workspace();
    let abs = ws.join(rel);
    let abs = abs.canonicalize().unwrap_or(abs);
    if abs.starts_with(ws.canonicalize().unwrap_or_else(|_| workspace())) { Some(abs) } else { None }
}

// Explorer: liệt kê thư mục làm việc (để bấm chèn @tệp vào terminal).
#[tauri::command]
fn list_files(dir: String) -> serde_json::Value {
    let ws = workspace();
    let target = in_ws(&dir).unwrap_or_else(|| ws.clone());
    let mut items = vec![];
    if let Ok(rd) = std::fs::read_dir(&target) {
        for e in rd.flatten() {
            let name = e.file_name().to_string_lossy().into_owned();
            if name.starts_with('.') { continue; }
            let is_dir = e.path().is_dir();
            let rel = e.path().strip_prefix(&ws).map(|p| p.to_string_lossy().replace('\\', "/")).unwrap_or_else(|_| name.clone());
            items.push(json!({"name":name,"dir":is_dir,"path":rel}));
        }
    }
    items.sort_by(|a, b| {
        b["dir"].as_bool().unwrap_or(false).cmp(&a["dir"].as_bool().unwrap_or(false))
            .then(a["name"].as_str().unwrap_or("").cmp(b["name"].as_str().unwrap_or("")))
    });
    json!({"workspace": ws.to_string_lossy(), "items": items})
}

fn main() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            bootstrap, pty_spawn, pty_write, pty_resize, pty_kill, list_files
        ])
        .run(tauri::generate_context!())
        .expect("loi khoi chay AWord Lite");
}
