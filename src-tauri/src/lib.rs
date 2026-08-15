use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use notify::event::{ModifyKind, RenameMode};
use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[tauri::command]
fn read_text_file(path: String, state: tauri::State<'_, WatcherState>) -> Result<String, String> {
    let target = ensure_existing_allowed(Path::new(&path), &state)?;
    let bytes = fs::read(&target).map_err(|e| e.to_string())?;
    let (content, format) = decode_text_file(&bytes)?;
    if let Ok(mut formats) = state.text_formats.lock() {
        formats.insert(display_path_string(&target), format);
    }
    Ok(content)
}

#[derive(Clone, Copy)]
enum TextEncoding {
    Utf8,
    Utf8Bom,
    Gbk,
}

#[derive(Clone, Copy)]
enum LineEnding {
    Lf,
    CrLf,
    Cr,
}

#[derive(Clone, Copy)]
struct TextFileFormat {
    encoding: TextEncoding,
    line_ending: LineEnding,
}

impl Default for TextFileFormat {
    fn default() -> Self {
        Self {
            encoding: TextEncoding::Utf8,
            line_ending: LineEnding::Lf,
        }
    }
}

struct WatcherState {
    watchers: std::sync::Arc<std::sync::Mutex<HashMap<String, RecommendedWatcher>>>,
    recent_writes: std::sync::Arc<std::sync::Mutex<HashMap<String, std::time::Instant>>>,
    allowed_roots: std::sync::Arc<std::sync::Mutex<HashSet<PathBuf>>>,
    text_formats: std::sync::Arc<std::sync::Mutex<HashMap<String, TextFileFormat>>>,
}

fn canonical_existing(path: &Path) -> Result<PathBuf, String> {
    path.canonicalize().map_err(|e| e.to_string())
}

fn detect_line_ending(text: &str) -> LineEnding {
    let bytes = text.as_bytes();
    let mut crlf = 0usize;
    let mut lf = 0usize;
    let mut cr = 0usize;
    let mut i = 0usize;
    while i < bytes.len() {
        match bytes[i] {
            b'\r' if i + 1 < bytes.len() && bytes[i + 1] == b'\n' => {
                crlf += 1;
                i += 2;
            }
            b'\r' => {
                cr += 1;
                i += 1;
            }
            b'\n' => {
                lf += 1;
                i += 1;
            }
            _ => i += 1,
        }
    }
    if crlf > 0 && crlf >= lf && crlf >= cr {
        LineEnding::CrLf
    } else if cr > 0 && cr >= lf {
        LineEnding::Cr
    } else {
        LineEnding::Lf
    }
}

fn normalize_line_endings(content: &str, line_ending: LineEnding) -> String {
    let lf = content.replace("\r\n", "\n").replace('\r', "\n");
    match line_ending {
        LineEnding::Lf => lf,
        LineEnding::CrLf => lf.replace('\n', "\r\n"),
        LineEnding::Cr => lf.replace('\n', "\r"),
    }
}

#[cfg(windows)]
fn decode_gbk(bytes: &[u8]) -> Result<String, String> {
    const CP_GBK: u32 = 936;
    const MB_ERR_INVALID_CHARS: u32 = 0x0000_0008;
    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn MultiByteToWideChar(
            code_page: u32,
            flags: u32,
            multi_byte: *const i8,
            multi_byte_len: i32,
            wide_char: *mut u16,
            wide_char_len: i32,
        ) -> i32;
    }

    let input_len = i32::try_from(bytes.len()).map_err(|_| "File is too large".to_string())?;
    let needed = unsafe {
        MultiByteToWideChar(
            CP_GBK,
            MB_ERR_INVALID_CHARS,
            bytes.as_ptr() as *const i8,
            input_len,
            std::ptr::null_mut(),
            0,
        )
    };
    if needed <= 0 {
        return Err("Unsupported text encoding".to_string());
    }
    let mut wide = vec![0u16; needed as usize];
    let written = unsafe {
        MultiByteToWideChar(
            CP_GBK,
            MB_ERR_INVALID_CHARS,
            bytes.as_ptr() as *const i8,
            input_len,
            wide.as_mut_ptr(),
            needed,
        )
    };
    if written != needed {
        return Err("Unsupported text encoding".to_string());
    }
    String::from_utf16(&wide).map_err(|_| "Unsupported text encoding".to_string())
}

#[cfg(not(windows))]
fn decode_gbk(_bytes: &[u8]) -> Result<String, String> {
    Err("GBK text is only supported on Windows".to_string())
}

#[cfg(windows)]
fn encode_gbk(content: &str) -> Result<Vec<u8>, String> {
    const CP_GBK: u32 = 936;
    const WC_NO_BEST_FIT_CHARS: u32 = 0x0000_0400;
    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn WideCharToMultiByte(
            code_page: u32,
            flags: u32,
            wide_char: *const u16,
            wide_char_len: i32,
            multi_byte: *mut i8,
            multi_byte_len: i32,
            default_char: *const i8,
            used_default_char: *mut i32,
        ) -> i32;
    }

    let wide: Vec<u16> = content.encode_utf16().collect();
    let input_len = i32::try_from(wide.len()).map_err(|_| "File is too large".to_string())?;
    let needed = unsafe {
        WideCharToMultiByte(
            CP_GBK,
            WC_NO_BEST_FIT_CHARS,
            wide.as_ptr(),
            input_len,
            std::ptr::null_mut(),
            0,
            std::ptr::null(),
            std::ptr::null_mut(),
        )
    };
    if needed <= 0 {
        return Err("Text contains characters that cannot be saved as GBK".to_string());
    }
    let mut bytes = vec![0u8; needed as usize];
    let mut used_default = 0i32;
    let written = unsafe {
        WideCharToMultiByte(
            CP_GBK,
            WC_NO_BEST_FIT_CHARS,
            wide.as_ptr(),
            input_len,
            bytes.as_mut_ptr() as *mut i8,
            needed,
            std::ptr::null(),
            &mut used_default,
        )
    };
    if written != needed || used_default != 0 {
        return Err("Text contains characters that cannot be saved as GBK".to_string());
    }
    Ok(bytes)
}

#[cfg(not(windows))]
fn encode_gbk(_content: &str) -> Result<Vec<u8>, String> {
    Err("GBK text is only supported on Windows".to_string())
}
fn decode_text_file(bytes: &[u8]) -> Result<(String, TextFileFormat), String> {
    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        let content = String::from_utf8(bytes[3..].to_vec())
            .map_err(|_| "File is not valid UTF-8 BOM text".to_string())?;
        let format = TextFileFormat {
            encoding: TextEncoding::Utf8Bom,
            line_ending: detect_line_ending(&content),
        };
        return Ok((content, format));
    }

    if let Ok(content) = String::from_utf8(bytes.to_vec()) {
        let format = TextFileFormat {
            encoding: TextEncoding::Utf8,
            line_ending: detect_line_ending(&content),
        };
        return Ok((content, format));
    }

    let content = decode_gbk(bytes)?;
    let format = TextFileFormat {
        encoding: TextEncoding::Gbk,
        line_ending: detect_line_ending(&content),
    };
    Ok((content, format))
}

fn encode_text_file(content: &str, format: TextFileFormat) -> Result<Vec<u8>, String> {
    let content = normalize_line_endings(content, format.line_ending);
    match format.encoding {
        TextEncoding::Utf8 => Ok(content.into_bytes()),
        TextEncoding::Utf8Bom => {
            let mut bytes = vec![0xEF, 0xBB, 0xBF];
            bytes.extend_from_slice(content.as_bytes());
            Ok(bytes)
        }
        TextEncoding::Gbk => encode_gbk(&content),
    }
}
fn strip_extended_path_prefix(path: &str) -> String {
    #[cfg(windows)]
    {
        if let Some(rest) = path.strip_prefix(r"\\?\UNC\") {
            return format!(r"\\{}", rest);
        }
        if let Some(rest) = path.strip_prefix(r"\\?\") {
            return rest.to_string();
        }
    }
    path.to_string()
}

fn display_path_string(path: &Path) -> String {
    strip_extended_path_prefix(&path.to_string_lossy())
}

fn canonical_parent_target(path: &Path) -> Result<PathBuf, String> {
    let parent = path.parent().ok_or_else(|| "Invalid path".to_string())?;
    let name = path.file_name().ok_or_else(|| "Invalid path".to_string())?;
    Ok(canonical_existing(parent)?.join(name))
}

fn canonical_target(path: &Path) -> Result<PathBuf, String> {
    if path.exists() {
        canonical_existing(path)
    } else {
        canonical_parent_target(path)
    }
}

fn ensure_under_allowed(path: PathBuf, state: &WatcherState) -> Result<PathBuf, String> {
    let allowed = state.allowed_roots.lock().map_err(|e| e.to_string())?;
    if allowed.iter().any(|root| path.starts_with(root)) {
        Ok(path)
    } else {
        Err("Path is outside the allowed locations".to_string())
    }
}

fn ensure_existing_allowed(path: &Path, state: &WatcherState) -> Result<PathBuf, String> {
    ensure_under_allowed(canonical_existing(path)?, state)
}

fn ensure_target_allowed(path: &Path, state: &WatcherState) -> Result<PathBuf, String> {
    ensure_under_allowed(canonical_target(path)?, state)
}

fn ensure_parent_target_allowed(path: &Path, state: &WatcherState) -> Result<PathBuf, String> {
    ensure_under_allowed(canonical_parent_target(path)?, state)
}

#[tauri::command]
fn allow_path(path: String, state: tauri::State<'_, WatcherState>) -> Result<(), String> {
    let allowed_path = canonical_target(Path::new(&path))?;
    state
        .allowed_roots
        .lock()
        .map_err(|e| e.to_string())?
        .insert(allowed_path);
    Ok(())
}

#[tauri::command]
fn write_text_file(path: String, content: String, state: tauri::State<'_, WatcherState>) -> Result<(), String> {
    let target = ensure_target_allowed(Path::new(&path), &state)?;
    let target_key = display_path_string(&target);
    if let Ok(mut rw) = state.recent_writes.lock() {
        rw.insert(target_key.clone(), std::time::Instant::now());
    }
    let format = state
        .text_formats
        .lock()
        .ok()
        .and_then(|formats| formats.get(&target_key).copied())
        .or_else(|| fs::read(&target).ok().and_then(|bytes| decode_text_file(&bytes).ok().map(|(_, format)| format)))
        .unwrap_or_default();
    let bytes = encode_text_file(&content, format)?;

    let dir = target.parent().ok_or_else(|| "Invalid path".to_string())?;
    let file_name = target
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("untitled");
    let tmp = dir.join(format!(".mira-tmp-{file_name}"));

    let mut file = fs::File::create(&tmp).map_err(|e| e.to_string())?;
    file.write_all(&bytes).map_err(|e| e.to_string())?;
    file.sync_all().map_err(|e| e.to_string())?;
    fs::rename(&tmp, &target).map_err(|e| e.to_string())?;
    if let Ok(mut formats) = state.text_formats.lock() {
        formats.insert(target_key, format);
    }
    Ok(())
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileNode>>,
}

#[tauri::command]
fn list_dir(path: String, ignore: Vec<String>, state: tauri::State<'_, WatcherState>) -> Result<Vec<FileNode>, String> {
    let p = ensure_existing_allowed(Path::new(&path), &state)?;
    let mut v: Vec<FileNode> = Vec::new();
    for entry in fs::read_dir(p).map_err(|e| e.to_string())? {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let child_path = entry.path();
        let nm = child_path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();
        if nm.is_empty() || nm.starts_with('.') {
            continue;
        }
        if ignore.iter().any(|pat| nm == pat.as_str()) {
            continue;
        }
        let is_dir = match fs::metadata(&child_path) {
            Ok(m) => m.is_dir(),
            Err(_) => continue,
        };
        v.push(FileNode {
            name: nm,
            path: display_path_string(&child_path),
            is_dir,
            children: None,
        });
    }
    v.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.to_lowercase().cmp(&b.name.to_lowercase())));
    Ok(v)
}

#[tauri::command]
fn create_text_file(path: String, state: tauri::State<'_, WatcherState>) -> Result<(), String> {
    let target = ensure_parent_target_allowed(Path::new(&path), &state)?;
    if target.exists() {
        return Err("Target already exists".to_string());
    }
    if let Some(parent) = target.parent() {
        if !parent.exists() {
            return Err("Parent directory does not exist".to_string());
        }
    }
    fs::File::create(target).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn create_dir(path: String, state: tauri::State<'_, WatcherState>) -> Result<(), String> {
    let target = ensure_parent_target_allowed(Path::new(&path), &state)?;
    if target.exists() {
        return Err("Target already exists".to_string());
    }
    fs::create_dir(target).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_path(old_path: String, new_path: String, state: tauri::State<'_, WatcherState>) -> Result<(), String> {
    let old = ensure_existing_allowed(Path::new(&old_path), &state)?;
    let new = ensure_parent_target_allowed(Path::new(&new_path), &state)?;
    if !old.exists() {
        return Err("Source does not exist".to_string());
    }
    let new_parent = new.parent().ok_or_else(|| "Invalid target parent".to_string())?;
    if !new_parent.exists() {
        return Err("Target parent does not exist".to_string());
    }
    if old == new {
        return Ok(());
    }
    if old.is_dir() {
        let old_canon = old.canonicalize().map_err(|e| e.to_string())?;
        let parent_canon = new_parent.canonicalize().map_err(|e| e.to_string())?;
        if parent_canon == old_canon || parent_canon.starts_with(&old_canon) {
            return Err("Cannot move a folder inside itself".to_string());
        }
    }
    if old_path.to_lowercase() != new_path.to_lowercase() && new.exists() {
        return Err("Target already exists".to_string());
    }
    let old_key = display_path_string(&old);
    let new_key = display_path_string(&new);
    if let Ok(mut rw) = state.recent_writes.lock() {
        let now = std::time::Instant::now();
        rw.insert(old_key.clone(), now);
        rw.insert(new_key.clone(), now);
    }
    fs::rename(old, new).map_err(|e| e.to_string())?;
    if let Ok(mut formats) = state.text_formats.lock() {
        if let Some(format) = formats.remove(&old_key) {
            formats.insert(new_key, format);
        }
    }
    Ok(())
}

#[tauri::command]
fn delete_path(path: String, state: tauri::State<'_, WatcherState>) -> Result<(), String> {
    let target = ensure_existing_allowed(Path::new(&path), &state)?;
    if !target.exists() {
        return Err("Target does not exist".to_string());
    }
    let target_key = display_path_string(&target);
    if let Ok(mut rw) = state.recent_writes.lock() {
        rw.insert(target_key.clone(), std::time::Instant::now());
    }
    trash::delete(target).map_err(|e| e.to_string())?;
    if let Ok(mut formats) = state.text_formats.lock() {
        formats.remove(&target_key);
    }
    Ok(())
}

#[tauri::command]
fn write_asset(dir: String, name: String, bytes: Vec<u8>, state: tauri::State<'_, WatcherState>) -> Result<String, String> {
    let dir = ensure_existing_allowed(Path::new(&dir), &state)?;
    let assets_dir = ensure_target_allowed(&dir.join("assets"), &state)?;
    fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;
    let safe_name: String = name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' { c } else { '_' })
        .collect();
    let mut target = assets_dir.join(&safe_name);
    if target.exists() {
        let path = Path::new(&safe_name);
        let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("image");
        let ext = path.extension().and_then(|s| s.to_str());
        let mut i = 1;
        loop {
            let new_name = match ext {
                Some(e) => format!("{}-{}.{}", stem, i, e),
                None => format!("{}-{}", stem, i),
            };
            target = assets_dir.join(&new_name);
            if !target.exists() {
                break;
            }
            i += 1;
        }
    }
    fs::write(&target, &bytes).map_err(|e| e.to_string())?;
    let final_name = target.file_name().and_then(|s| s.to_str()).unwrap_or(&safe_name);
    Ok(format!("./assets/{}", final_name))
}

#[tauri::command]
fn watch(root: String, app: AppHandle, state: tauri::State<'_, WatcherState>) -> Result<(), String> {
    let root_path = canonical_existing(Path::new(&root))?;
    state
        .allowed_roots
        .lock()
        .map_err(|e| e.to_string())?
        .insert(root_path.clone());
    let root = display_path_string(&root_path);
    let mut watchers = state.watchers.lock().map_err(|e| e.to_string())?;
    if watchers.contains_key(&root) {
        return Ok(());
    }
    let recent = state.recent_writes.clone();
    let app2 = app.clone();
    let pending_rename: std::sync::Arc<std::sync::Mutex<Option<(PathBuf, std::time::Instant)>>> =
        std::sync::Arc::new(std::sync::Mutex::new(None));
    let pending_rename2 = pending_rename.clone();
    let mut watcher = RecommendedWatcher::new(
        move |res: Result<notify::Event, notify::Error>| {
            if let Ok(ev) = res {
                let now = std::time::Instant::now();
                let self_touched = if let Ok(rw) = recent.lock() {
                    ev.paths.iter().any(|p| {
                        rw.get(&display_path_string(p))
                            .map_or(false, |t| now.duration_since(*t).as_millis() < 500)
                    })
                } else {
                    false
                };
                if self_touched {
                    return;
                }
                fn ignored_path(p: &Path) -> bool {
                    p.components().any(|c| {
                        let s = c.as_os_str().to_string_lossy();
                        matches!(s.as_ref(), "node_modules" | "target" | ".git" | "dist" | ".vite")
                    })
                }
                fn emit_moved(app: &AppHandle, old_path: &Path, new_path: &Path) {
                    let _ = app.emit(
                        "fs:moved",
                        serde_json::json!({
                            "oldPath": display_path_string(old_path),
                            "newPath": display_path_string(new_path),
                        }),
                    );
                }

                match &ev.kind {
                    EventKind::Modify(ModifyKind::Name(RenameMode::Both))
                    | EventKind::Modify(ModifyKind::Name(RenameMode::Any)) if ev.paths.len() >= 2 => {
                        let old_path = &ev.paths[0];
                        let new_path = &ev.paths[1];
                        if !ignored_path(old_path) && !ignored_path(new_path) {
                            emit_moved(&app2, old_path, new_path);
                        }
                        return;
                    }
                    EventKind::Modify(ModifyKind::Name(RenameMode::From)) => {
                        if let Some(old_path) = ev.paths.first() {
                            if !ignored_path(old_path) {
                                if let Ok(mut pending) = pending_rename2.lock() {
                                    *pending = Some((old_path.clone(), now));
                                }
                            }
                        }
                        return;
                    }
                    EventKind::Modify(ModifyKind::Name(RenameMode::To)) => {
                        if let Some(new_path) = ev.paths.first() {
                            let old_path = if let Ok(mut pending) = pending_rename2.lock() {
                                pending.take().and_then(|(old_path, t)| {
                                    if now.duration_since(t).as_secs() <= 2 { Some(old_path) } else { None }
                                })
                            } else {
                                None
                            };
                            if let Some(old_path) = old_path {
                                if !ignored_path(&old_path) && !ignored_path(new_path) {
                                    emit_moved(&app2, &old_path, new_path);
                                    return;
                                }
                            }
                        }
                    }
                    _ => {}
                }

                for p in &ev.paths {
                    if ignored_path(p) {
                        continue;
                    }
                    let kind = match &ev.kind {
                        EventKind::Create(_) => "create",
                        EventKind::Modify(_) => "modify",
                        EventKind::Remove(_) => "delete",
                        _ => "other",
                    };
                    let _ = app2.emit(
                        "fs:changed",
                        serde_json::json!({ "path": display_path_string(p), "kind": kind }),
                    );
                }
            }
        },
        notify::Config::default(),
    )
    .map_err(|e| e.to_string())?;
    watcher
        .watch(Path::new(&root), RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;
    watchers.insert(root.clone(), watcher);
    Ok(())
}

#[tauri::command]
fn unwatch(root: String, state: tauri::State<'_, WatcherState>) -> Result<(), String> {
    let root = canonical_existing(Path::new(&root))
        .map(|p| display_path_string(&p))
        .unwrap_or_else(|_| strip_extended_path_prefix(&root));
    let mut watchers = state.watchers.lock().map_err(|e| e.to_string())?;
    watchers.remove(&root);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(WatcherState {
            watchers: std::sync::Arc::new(std::sync::Mutex::new(HashMap::new())),
            recent_writes: std::sync::Arc::new(std::sync::Mutex::new(HashMap::new())),
            allowed_roots: std::sync::Arc::new(std::sync::Mutex::new(HashSet::new())),
            text_formats: std::sync::Arc::new(std::sync::Mutex::new(HashMap::new())),
        })
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            allow_path,
            read_text_file,
            write_text_file,
            list_dir,
            create_text_file,
            create_dir,
            rename_path,
            delete_path,
            write_asset,
            watch,
            unwatch
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}