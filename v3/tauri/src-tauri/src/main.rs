// AWord Lite (v3) — backend Rust (Tauri v2).
// Chạy CLAUDE CODE THẬT (giao diện tương tác đầy đủ: tool-use, sửa file, skill) trong một
// terminal thật (PTY/ConPTY) render bằng xterm.js — vỏ ~8MB thay Electron/Theia.
// KHÔNG đóng kèm claude.exe: khi chạy tự tìm; THIẾU thì tự cài (trình cài chính thức).
// KHÔNG tự chạy `claude update` (Claude Code tự cập nhật sẵn) → mở nhanh, không "treo".
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::Engine;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Read, Write};
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

// Một phiên terminal đang chạy claude (chế độ terminal — dự phòng).
struct PtySession {
    master: Box<dyn portable_pty::MasterPty + Send>, // để resize
    writer: Box<dyn Write + Send>,                   // để gõ vào
    child: Box<dyn portable_pty::Child + Send + Sync>, // để kết thúc
}

// Tiến trình claude headless cho khung CHAT (giao diện giống extension VSCode).
struct ChatProc {
    child: Child,
    stdin: ChildStdin,
}

// Tuỳ chọn phiên chat: model, mức độ (effort), chế độ làm việc (permission mode).
struct ChatOpts {
    model: String,  // opus | sonnet | haiku (rỗng = theo settings)
    effort: String, // low|medium|high|xhigh|max (rỗng = theo settings)
    mode: String,   // acceptEdits | plan | bypassPermissions
}
impl Default for ChatOpts {
    fn default() -> Self {
        Self { model: "sonnet".into(), effort: String::new(), mode: "acceptEdits".into() }
    }
}

#[derive(Default)]
struct AppState {
    pty: Mutex<Option<PtySession>>,
    chat: Mutex<Option<ChatProc>>,
    opts: Mutex<ChatOpts>,
    extra_dirs: Mutex<Vec<String>>, // thư mục thêm cho Claude truy cập (--add-dir)
    claude_path: Mutex<Option<String>>,
}

// Ẩn cửa sổ console khi spawn tiến trình (claude/powershell) — tránh nhá cmd.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

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
    std::process::Command::new(exe).arg("--version").creation_flags(CREATE_NO_WINDOW).output().ok()
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
        .creation_flags(CREATE_NO_WINDOW)
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

fn set_claude_path(app: &AppHandle, p: &str) {
    *app.state::<AppState>().claude_path.lock().unwrap() = Some(p.to_string());
}

// Có phiên làm việc cũ cho thư mục làm việc chưa? (Claude lưu ~/.claude/projects/<cwd mã hóa>/*.jsonl)
fn has_prior_session() -> bool {
    let ws = workspace().to_string_lossy().to_string();
    let enc: String = ws.chars().map(|c| if c == ':' || c == '\\' || c == '/' { '-' } else { c }).collect();
    let dir = home().join(".claude").join("projects").join(enc);
    std::fs::read_dir(&dir)
        .map(|rd| rd.flatten().any(|e| e.path().extension().map_or(false, |x| x == "jsonl")))
        .unwrap_or(false)
}

// Mở thư mục làm việc trong Explorer.
#[tauri::command]
fn open_workspace() {
    let _ = std::process::Command::new("explorer").arg(workspace()).spawn();
}

// Mở phiên terminal chạy claude tương tác, kích thước cols×rows.
// resume=true và có phiên cũ -> `claude --continue` (khôi phục cuộc trò chuyện gần nhất).
#[tauri::command]
fn pty_spawn(app: AppHandle, state: State<AppState>, cols: u16, rows: u16, resume: bool) -> Result<(), String> {
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
    // Khôi phục phiên gần nhất nếu có (lưu phiên làm việc giữa các lần mở app).
    if resume && has_prior_session() {
        cmd.arg("--continue");
    }
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

// ===== Khung CHAT (headless stream-json) — giao diện giống extension Claude trên VSCode =====

fn short_text(v: &Value, max: usize) -> String {
    let s = if let Some(t) = v.as_str() {
        t.to_string()
    } else if let Some(arr) = v.as_array() {
        arr.iter().filter_map(|b| b["text"].as_str()).collect::<Vec<_>>().join(" ")
    } else {
        String::new()
    };
    let s = s.trim().replace('\n', " ");
    if s.chars().count() > max { format!("{}…", s.chars().take(max).collect::<String>()) } else { s }
}

// Bảo đảm tiến trình chat đang sống; nếu chưa → spawn (kèm --continue nếu resume & có phiên cũ).
fn ensure_chat(app: &AppHandle, state: &State<AppState>, resume: bool) -> Result<(), String> {
    {
        let mut g = state.chat.lock().unwrap();
        if let Some(c) = g.as_mut() {
            if c.child.try_wait().ok().flatten().is_none() {
                return Ok(()); // còn sống
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

    let mut cmd = std::process::Command::new(&exe);
    cmd.args(["--print", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose", "--include-partial-messages"]);
    // Tuỳ chọn model/mức độ/chế độ do người dùng chọn (như extension). Chế độ headless không có
    // hộp thoại duyệt quyền → mặc định acceptEdits để Claude soạn/sửa văn bản được.
    let (model, effort, mode) = {
        let o = state.opts.lock().unwrap();
        (o.model.clone(), o.effort.clone(), o.mode.clone())
    };
    if !model.is_empty() { cmd.args(["--model", &model]); }
    if !effort.is_empty() { cmd.args(["--effort", &effort]); }
    if !mode.is_empty() { cmd.args(["--permission-mode", &mode]); }
    // Thư mục thêm mà người dùng cấp quyền cho Claude.
    for d in state.extra_dirs.lock().unwrap().iter() {
        cmd.args(["--add-dir", d]);
    }
    if resume && has_prior_session() {
        cmd.arg("--continue");
    }
    cmd.creation_flags(CREATE_NO_WINDOW) // ẩn cửa sổ cmd
        .current_dir(workspace())
        .stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null());

    let mut child = cmd.spawn().map_err(|e| format!("Không chạy được claude: {e}"))?;
    let stdin = child.stdin.take().ok_or("Không mở được stdin")?;
    let stdout = child.stdout.take().ok_or("Không mở được stdout")?;

    // Luồng đọc stdout: parse stream-json -> phát 'chat'.
    let app2 = app.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        // Trạng thái gom input của khối tool_use đang chảy (input_json_delta).
        let mut in_tool = false;
        let mut tool_json = String::new();
        let mut tool_id = String::new();
        let mut tool_name = String::new();
        for line in reader.lines().map_while(Result::ok) {
            let line = line.trim();
            if line.is_empty() { continue; }
            let v: Value = match serde_json::from_str(line) { Ok(v) => v, Err(_) => continue };
            match v["type"].as_str().unwrap_or("") {
                "system" if v["subtype"] == "init" => {
                    let _ = app2.emit("chat", json!({"kind":"init","model":v["model"].as_str().unwrap_or("")}));
                }
                // Chảy từng phần: text theo token, tool theo đúng thứ tự khối.
                "stream_event" => {
                    let ev = &v["event"];
                    match ev["type"].as_str().unwrap_or("") {
                        "content_block_start" => {
                            let cb = &ev["content_block"];
                            if cb["type"] == "tool_use" {
                                in_tool = true; tool_json.clear();
                                tool_id = cb["id"].as_str().unwrap_or("").to_string();
                                tool_name = cb["name"].as_str().unwrap_or("").to_string();
                                let _ = app2.emit("chat", json!({"kind":"tool_start","id":tool_id,"name":tool_name}));
                            } else if cb["type"] == "text" {
                                in_tool = false;
                                let _ = app2.emit("chat", json!({"kind":"text_start"}));
                            }
                        }
                        "content_block_delta" => {
                            let d = &ev["delta"];
                            if d["type"] == "text_delta" {
                                if let Some(t) = d["text"].as_str() {
                                    let _ = app2.emit("chat", json!({"kind":"text","text":t}));
                                }
                            } else if d["type"] == "input_json_delta" {
                                if let Some(pj) = d["partial_json"].as_str() { tool_json.push_str(pj); }
                            }
                        }
                        "content_block_stop" => {
                            if in_tool {
                                let input: Value = serde_json::from_str(&tool_json).unwrap_or_else(|_| json!({}));
                                let _ = app2.emit("chat", json!({"kind":"tool_input","id":tool_id,"name":tool_name,"input":input}));
                                in_tool = false;
                            }
                        }
                        _ => {}
                    }
                }
                // Kết quả trả về của công cụ.
                "user" => {
                    if let Some(content) = v["message"]["content"].as_array() {
                        for b in content {
                            if b["type"] == "tool_result" {
                                let _ = app2.emit("chat", json!({
                                    "kind":"tool_result",
                                    "id": b["tool_use_id"].as_str().unwrap_or(""),
                                    "is_error": b["is_error"].as_bool().unwrap_or(false),
                                    "preview": short_text(&b["content"], 160),
                                }));
                            }
                        }
                    }
                }
                "result" => {
                    let _ = app2.emit("chat", json!({
                        "kind":"result",
                        "text": v["result"].as_str().unwrap_or(""),
                        "is_error": v["is_error"].as_bool().unwrap_or(false),
                        "cost": v["total_cost_usd"].as_f64(),
                    }));
                }
                // Bỏ qua "assistant" (bản đầy đủ) — đã chảy qua stream_event.
                _ => {}
            }
        }
        let _ = app2.emit("chat", json!({"kind":"exit"}));
    });

    *state.chat.lock().unwrap() = Some(ChatProc { child, stdin });
    Ok(())
}

// Mở/bảo đảm phiên chat (resume=true để khôi phục cuộc trò chuyện trước) với model/mức độ/chế độ.
#[tauri::command]
fn chat_start(app: AppHandle, state: State<AppState>, resume: bool, model: String, effort: String, mode: String) -> Result<(), String> {
    *state.opts.lock().unwrap() = ChatOpts { model, effort, mode };
    ensure_chat(&app, &state, resume)
}

// Đổi model/mức độ/chế độ: khởi động lại claude kèm --continue để GIỮ ngữ cảnh cuộc trò chuyện.
#[tauri::command]
fn chat_switch(app: AppHandle, state: State<AppState>, model: String, effort: String, mode: String) -> Result<(), String> {
    *state.opts.lock().unwrap() = ChatOpts { model, effort, mode };
    if let Some(mut c) = state.chat.lock().unwrap().take() { let _ = c.child.kill(); }
    ensure_chat(&app, &state, true)
}

// Cấp quyền một thư mục cho Claude: mở hộp chọn thư mục, thêm --add-dir, khởi động lại (giữ ngữ cảnh).
#[tauri::command]
fn add_directory(app: AppHandle, state: State<AppState>) -> Option<String> {
    let dir = rfd::FileDialog::new().set_title("Chọn thư mục cấp quyền cho Claude").pick_folder()?;
    let s = dir.to_string_lossy().into_owned();
    {
        let mut dirs = state.extra_dirs.lock().unwrap();
        if !dirs.contains(&s) { dirs.push(s.clone()); }
    }
    if let Some(mut c) = state.chat.lock().unwrap().take() { let _ = c.child.kill(); }
    let _ = ensure_chat(&app, &state, true);
    Some(s)
}

// Gửi một tin nhắn của người dùng.
#[tauri::command]
fn chat_send(app: AppHandle, state: State<AppState>, message: String) -> Result<(), String> {
    ensure_chat(&app, &state, true)?;
    let mut g = state.chat.lock().unwrap();
    if let Some(c) = g.as_mut() {
        let line = json!({"type":"user","message":{"role":"user","content":message}}).to_string();
        c.stdin.write_all(line.as_bytes()).map_err(|e| format!("{e}"))?;
        c.stdin.write_all(b"\n").map_err(|e| format!("{e}"))?;
        c.stdin.flush().map_err(|e| format!("{e}"))?;
    }
    Ok(())
}

// Dừng lượt hiện tại (kết thúc tiến trình; lượt sau tự khởi động lại có --continue).
#[tauri::command]
fn chat_stop(state: State<AppState>) {
    if let Some(mut c) = state.chat.lock().unwrap().take() {
        let _ = c.child.kill();
    }
}

// Cuộc trò chuyện MỚI (không khôi phục): kết thúc tiến trình cũ rồi mở phiên tươi.
#[tauri::command]
fn chat_new(app: AppHandle, state: State<AppState>) -> Result<(), String> {
    if let Some(mut c) = state.chat.lock().unwrap().take() {
        let _ = c.child.kill();
    }
    ensure_chat(&app, &state, false)
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
            bootstrap, pty_spawn, pty_write, pty_resize, pty_kill,
            chat_start, chat_switch, chat_send, chat_stop, chat_new, add_directory,
            list_files, open_workspace
        ])
        .run(tauri::generate_context!())
        .expect("loi khoi chay AWord Lite");
}
