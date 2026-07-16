// AWord Lite (v3) — backend Rust (Tauri v2). Điều khiển claude.exe headless stream-json.
// KHÔNG đóng kèm claude.exe: khi chạy tự tìm; THIẾU thì tự cài (trình cài chính thức);
// CÓ thì tự kiểm tra cập nhật (nền). Không cần Node/Electron/Theia.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Default)]
struct AppState {
    claude: Mutex<Option<Child>>,
    claude_path: Mutex<Option<String>>, // đường dẫn claude.exe đã xác định (sau bootstrap)
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
// Thứ tự: cài của người dùng (~/.local/bin, LOCALAPPDATA, winget, PATH) -> bản đóng kèm AWord Theia.
fn find_claude_path() -> Option<(String, bool)> {
    // Cài của người dùng (được phép tự cập nhật)
    let user_cands = [
        home().join(".local").join("bin").join("claude.exe"),
        localappdata().join("Programs").join("claude").join("claude.exe"),
    ];
    for c in &user_cands {
        if c.exists() {
            return Some((c.to_string_lossy().into_owned(), false));
        }
    }
    // winget
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
    // PATH
    if let Ok(paths) = std::env::var("PATH") {
        for dir in std::env::split_paths(&paths) {
            let p = dir.join("claude.exe");
            if p.exists() {
                return Some((p.to_string_lossy().into_owned(), false));
            }
        }
    }
    // Bản đóng kèm AWord (Theia) — DÙNG được nhưng KHÔNG tự cập nhật (Theia tự lo).
    let bundle = localappdata()
        .join("Programs").join("AWord").join("resources").join("app").join("plugins")
        .join("Anthropic.claude-code").join("extension").join("resources").join("native-binary").join("claude.exe");
    if bundle.exists() {
        return Some((bundle.to_string_lossy().into_owned(), true));
    }
    None
}

fn get_version(exe: &str) -> String {
    Command::new(exe).arg("--version").output().ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_default()
}

// Bootstrap: xác định/cài claude, phát sự kiện "boot" cho giao diện. Chạy nền, không chặn UI.
#[tauri::command]
fn bootstrap(app: AppHandle) {
    let app2 = app.clone();
    std::thread::spawn(move || {
        if let Some((p, is_bundle)) = find_claude_path() {
            let ver = get_version(&p);
            set_claude_path(&app2, &p);
            let _ = app2.emit("boot", json!({"status":"san_sang","path":p,"version":ver,"bundle":is_bundle}));
            // Tự kiểm tra cập nhật (nền) nếu là bản cài của người dùng.
            if !is_bundle {
                let _ = app2.emit("boot", json!({"status":"kiem_tra_cap_nhat"}));
                let out = Command::new(&p).arg("update").output();
                match out {
                    Ok(o) => {
                        let msg = String::from_utf8_lossy(&o.stdout).trim().to_string();
                        let _ = app2.emit("boot", json!({"status":"cap_nhat_xong","message":msg}));
                    }
                    Err(_) => { let _ = app2.emit("boot", json!({"status":"cap_nhat_bo_qua"})); }
                }
            }
        } else {
            // THIẾU claude -> cài bằng trình cài chính thức (cần Internet).
            let _ = app2.emit("boot", json!({"status":"dang_cai"}));
            let ok = cai_claude();
            if ok {
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
    Command::new("powershell")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
            "& ([scriptblock]::Create((Invoke-RestMethod https://claude.ai/install.ps1))) latest"])
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

fn set_claude_path(app: &AppHandle, p: &str) {
    let state = app.state::<AppState>();
    *state.claude_path.lock().unwrap() = Some(p.to_string());
}

// Bảo đảm tiến trình claude đang chạy; nếu chưa, spawn + luồng đọc stdout phát sự kiện "claude".
fn ensure_claude(app: &AppHandle, state: &State<AppState>) -> bool {
    {
        let mut guard = state.claude.lock().unwrap();
        if guard.as_mut().map_or(false, |c| c.try_wait().ok().flatten().is_none()) {
            return true; // còn sống
        }
    }
    let exe = {
        let mut pp = state.claude_path.lock().unwrap();
        if pp.is_none() {
            if let Some((p, _)) = find_claude_path() { *pp = Some(p); }
        }
        match pp.clone() {
            Some(p) => p,
            None => {
                let _ = app.emit("claude", json!({"type":"_loi","message":"Chưa cài Claude. Đang thử cài lại…"}));
                return false;
            }
        }
    };
    let mut child = match Command::new(&exe)
        .args(["--print", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose"])
        .current_dir(workspace())
        .stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null())
        .spawn()
    {
        Ok(c) => c,
        Err(e) => {
            let _ = app.emit("claude", json!({"type":"_loi","message": format!("Không chạy được claude.exe: {}", e)}));
            return false;
        }
    };
    if let Some(out) = child.stdout.take() {
        let app2 = app.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(out);
            for line in reader.lines().map_while(Result::ok) {
                let line = line.trim();
                if line.is_empty() { continue; }
                let obj: Value = match serde_json::from_str(line) { Ok(v) => v, Err(_) => continue };
                let t = obj["type"].as_str().unwrap_or("");
                if t == "assistant" {
                    if let Some(content) = obj["message"]["content"].as_array() {
                        let text: String = content.iter()
                            .filter(|c| c["type"] == "text").filter_map(|c| c["text"].as_str()).collect();
                        if !text.is_empty() {
                            let _ = app2.emit("claude", json!({"type":"assistant","text":text}));
                        }
                    }
                } else if t == "result" {
                    let _ = app2.emit("claude", json!({"type":"result","text":obj["result"].as_str().unwrap_or(""),
                        "is_error":obj["is_error"].as_bool().unwrap_or(false),"cost":obj["total_cost_usd"].as_f64()}));
                } else if t == "system" && obj["subtype"] == "init" {
                    let _ = app2.emit("claude", json!({"type":"init","model":obj["model"].as_str().unwrap_or(""),
                        "session_id":obj["session_id"].as_str().unwrap_or("")}));
                }
            }
            let _ = app2.emit("claude", json!({"type":"_claude_exit"}));
        });
    }
    *state.claude.lock().unwrap() = Some(child);
    true
}

#[tauri::command]
fn chat(app: AppHandle, state: State<AppState>, message: String) {
    if !ensure_claude(&app, &state) { return; }
    let mut guard = state.claude.lock().unwrap();
    if let Some(child) = guard.as_mut() {
        if let Some(stdin) = child.stdin.as_mut() {
            let line = json!({"type":"user","message":{"role":"user","content":message}}).to_string();
            let _ = stdin.write_all(line.as_bytes());
            let _ = stdin.write_all(b"\n");
            let _ = stdin.flush();
        }
    }
}

#[tauri::command]
fn stop(state: State<AppState>) {
    let mut guard = state.claude.lock().unwrap();
    if let Some(mut child) = guard.take() { let _ = child.kill(); }
}

fn in_ws(rel: &str) -> Option<PathBuf> {
    let ws = workspace();
    let abs = ws.join(rel);
    let abs = abs.canonicalize().unwrap_or(abs);
    if abs.starts_with(ws.canonicalize().unwrap_or_else(|_| workspace())) { Some(abs) } else { None }
}

#[tauri::command]
fn list_files(dir: String) -> Value {
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

const TEXT_EXT: &[&str] = &["txt","md","markdown","json","js","ts","py","csv","tsv","html","htm","css","xml","yaml","yml","ini","log","cfg","bat","cmd","ps1","sh"];

#[tauri::command]
fn read_file(path: String) -> Value {
    let abs = match in_ws(&path) { Some(p) if p.is_file() => p, _ => return json!({"kieu":"loi"}) };
    let ext = abs.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
    if TEXT_EXT.contains(&ext.as_str()) {
        match std::fs::read_to_string(&abs) {
            Ok(t) => json!({"kieu":"text","noiDung":t}),
            Err(_) => json!({"kieu":"loi"}),
        }
    } else { json!({"kieu":"ngoai"}) }
}

#[tauri::command]
fn open_external(path: String) -> bool {
    if let Some(abs) = in_ws(&path) {
        Command::new("cmd").arg("/c").arg("start").arg("").arg(abs.as_os_str()).spawn().is_ok()
    } else { false }
}

fn main() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![bootstrap, chat, stop, list_files, read_file, open_external])
        .run(tauri::generate_context!())
        .expect("loi khoi chay AWord Lite");
}
