// AWord Lite (v3) — backend Rust (Tauri v2). Điều khiển claude.exe headless stream-json,
// phát sự kiện lên webview, thao tác tệp. Không cần Node/Electron/Theia.
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
}

fn home() -> PathBuf {
    PathBuf::from(std::env::var("USERPROFILE").unwrap_or_else(|_| ".".into()))
}
fn workspace() -> PathBuf {
    let ws = home().join("Documents").join("AWord");
    let _ = std::fs::create_dir_all(&ws);
    ws
}

// Tìm claude.exe: tài nguyên đóng kèm -> ~/.local/bin -> LOCALAPPDATA\Programs\claude -> PATH.
fn find_claude(app: &AppHandle) -> String {
    if let Ok(res) = app.path().resource_dir() {
        let p = res.join("claude").join("claude.exe");
        if p.exists() {
            return p.to_string_lossy().into_owned();
        }
    }
    let cands = [
        home().join(".local").join("bin").join("claude.exe"),
        PathBuf::from(std::env::var("LOCALAPPDATA").unwrap_or_default())
            .join("Programs").join("claude").join("claude.exe"),
    ];
    for c in cands {
        if c.exists() {
            return c.to_string_lossy().into_owned();
        }
    }
    "claude".into()
}

// Bảo đảm tiến trình claude đang chạy; nếu chưa, spawn + luồng đọc stdout phát sự kiện "claude".
fn ensure_claude(app: &AppHandle, state: &State<AppState>) {
    let mut guard = state.claude.lock().unwrap();
    if guard.as_mut().map_or(false, |c| c.try_wait().ok().flatten().is_none()) {
        return; // còn sống
    }
    let exe = find_claude(app);
    let mut child = match Command::new(&exe)
        .args([
            "--print",
            "--input-format", "stream-json",
            "--output-format", "stream-json",
            "--verbose",
        ])
        .current_dir(workspace())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
    {
        Ok(c) => c,
        Err(e) => {
            let _ = app.emit("claude", json!({"type":"_loi","message": format!("Không chạy được claude.exe: {}", e)}));
            return;
        }
    };
    if let Some(out) = child.stdout.take() {
        let app2 = app.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(out);
            for line in reader.lines().map_while(Result::ok) {
                let line = line.trim();
                if line.is_empty() {
                    continue;
                }
                let obj: Value = match serde_json::from_str(line) {
                    Ok(v) => v,
                    Err(_) => continue,
                };
                let t = obj["type"].as_str().unwrap_or("");
                if t == "assistant" {
                    if let Some(content) = obj["message"]["content"].as_array() {
                        let text: String = content.iter()
                            .filter(|c| c["type"] == "text")
                            .filter_map(|c| c["text"].as_str())
                            .collect();
                        if !text.is_empty() {
                            let _ = app2.emit("claude", json!({"type":"assistant","text":text}));
                        }
                    }
                } else if t == "result" {
                    let _ = app2.emit("claude", json!({
                        "type":"result",
                        "text": obj["result"].as_str().unwrap_or(""),
                        "is_error": obj["is_error"].as_bool().unwrap_or(false),
                        "cost": obj["total_cost_usd"].as_f64()
                    }));
                } else if t == "system" && obj["subtype"] == "init" {
                    let _ = app2.emit("claude", json!({
                        "type":"init",
                        "model": obj["model"].as_str().unwrap_or(""),
                        "session_id": obj["session_id"].as_str().unwrap_or("")
                    }));
                }
            }
            let _ = app2.emit("claude", json!({"type":"_claude_exit"}));
        });
    }
    *guard = Some(child);
}

#[tauri::command]
fn chat(app: AppHandle, state: State<AppState>, message: String) {
    ensure_claude(&app, &state);
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

// Kết thúc tiến trình claude (Mới / Dừng) — lượt sau khởi động lại sạch.
#[tauri::command]
fn stop(state: State<AppState>) {
    let mut guard = state.claude.lock().unwrap();
    if let Some(mut child) = guard.take() {
        let _ = child.kill();
    }
}

fn in_ws(rel: &str) -> Option<PathBuf> {
    let ws = workspace();
    let abs = ws.join(rel);
    let abs = abs.canonicalize().unwrap_or(abs);
    if abs.starts_with(ws.canonicalize().unwrap_or_else(|_| workspace())) {
        Some(abs)
    } else {
        None
    }
}

#[tauri::command]
fn list_files(dir: String) -> Value {
    let ws = workspace();
    let target = in_ws(&dir).unwrap_or(ws.clone());
    let mut items = vec![];
    if let Ok(rd) = std::fs::read_dir(&target) {
        for e in rd.flatten() {
            let name = e.file_name().to_string_lossy().into_owned();
            if name.starts_with('.') {
                continue;
            }
            let is_dir = e.path().is_dir();
            let rel = e.path().strip_prefix(&ws).map(|p| p.to_string_lossy().replace('\\', "/")).unwrap_or(name.clone());
            items.push(json!({"name":name,"dir":is_dir,"path":rel}));
        }
    }
    items.sort_by(|a, b| {
        let da = b["dir"].as_bool().unwrap_or(false).cmp(&a["dir"].as_bool().unwrap_or(false));
        da.then(a["name"].as_str().unwrap_or("").cmp(b["name"].as_str().unwrap_or("")))
    });
    json!({"workspace": ws.to_string_lossy(), "items": items})
}

const TEXT_EXT: &[&str] = &["txt","md","markdown","json","js","ts","py","csv","tsv","html","htm","css","xml","yaml","yml","ini","log","cfg","bat","cmd","ps1","sh"];

#[tauri::command]
fn read_file(path: String) -> Value {
    let abs = match in_ws(&path) {
        Some(p) if p.is_file() => p,
        _ => return json!({"kieu":"loi"}),
    };
    let ext = abs.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
    if TEXT_EXT.contains(&ext.as_str()) {
        match std::fs::read_to_string(&abs) {
            Ok(t) => json!({"kieu":"text","noiDung":t}),
            Err(_) => json!({"kieu":"loi"}),
        }
    } else {
        json!({"kieu":"ngoai"})
    }
}

// Mở tệp bằng ứng dụng mặc định Windows (Word/Excel/trình xem PDF...).
#[tauri::command]
fn open_external(path: String) -> bool {
    if let Some(abs) = in_ws(&path) {
        Command::new("cmd")
            .arg("/c").arg("start").arg("")
            .arg(abs.as_os_str())
            .spawn()
            .is_ok()
    } else {
        false
    }
}

fn main() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![chat, stop, list_files, read_file, open_external])
        .run(tauri::generate_context!())
        .expect("loi khoi chay AWord Lite");
}
