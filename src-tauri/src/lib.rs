use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::collections::HashMap;
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use notify::{Watcher, RecursiveMode, EventKind, RecommendedWatcher};
use notify::event::{ModifyKind, RenameMode};

/// 读取文本文件（UTF-8）。M0 基础实现；
/// TODO(M2)：编码探测 / BOM / GBK 回退（设计 §16.3）。
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(Path::new(&path)).map_err(|e| e.to_string())
}

/// 文件监听状态（设计 §16.5）：watchers 按根路径存储；recent_writes 用于过滤自身写入。
struct WatcherState {
    watchers: std::sync::Arc<std::sync::Mutex<HashMap<String, RecommendedWatcher>>>,
    recent_writes: std::sync::Arc<std::sync::Mutex<HashMap<String, std::time::Instant>>>,
}

/// 原子写入：临时文件 + rename，避免写一半断电损坏（设计 §10.2 / §16.1）。
/// TODO(M2)：沙箱路径校验、行尾策略（§16.3 / §16.4）。
#[tauri::command]
fn write_text_file(path: String, content: String, state: tauri::State<'_, WatcherState>) -> Result<(), String> {
    // 记录自身写入，供文件监听过滤（避免 Mira 自己保存触发"外部改动"提示）
    if let Ok(mut rw) = state.recent_writes.lock() {
        rw.insert(path.clone(), std::time::Instant::now());
    }
    let target = Path::new(&path);
    let dir = target.parent().ok_or_else(|| "无效路径".to_string())?;
    let file_name = target
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("untitled");
    let tmp = dir.join(format!(".mira-tmp-{file_name}"));

    let mut file = fs::File::create(&tmp).map_err(|e| e.to_string())?;
    file.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
    file.sync_all().map_err(|e| e.to_string())?;
    fs::rename(&tmp, target).map_err(|e| e.to_string())
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    /// 目录的子节点；None=未加载（懒加载），Some([])=空目录，Some([...)=已加载
    pub children: Option<Vec<FileNode>>,
}

/// 列出某个目录一层的子项（懒加载用，设计 §16.1）。
/// 不过滤扩展名（对标 Typora/Obsidian：文件树显示所有非隐藏文件）。
/// ignore 为目录/文件名黑名单（如 node_modules、.git、target）。跳过隐藏文件（以 . 开头）。
/// 排序：目录优先，然后按名称（不区分大小写）。返回的目录节点 children = None（前端展开时再调本命令）。
#[tauri::command]
fn list_dir(path: String, ignore: Vec<String>) -> Result<Vec<FileNode>, String> {
    let p = Path::new(&path);
    let mut v: Vec<FileNode> = Vec::new();
    for entry in fs::read_dir(p).map_err(|e| e.to_string())? {
        let entry = match entry { Ok(e) => e, Err(_) => continue };
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
        // 跳过无权限/不可访问项
        let is_dir = match fs::metadata(&child_path) {
            Ok(m) => m.is_dir(),
            Err(_) => continue,
        };
        v.push(FileNode {
            name: nm,
            path: child_path.to_string_lossy().to_string(),
            is_dir,
            children: None,
        });
    }
    v.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.to_lowercase().cmp(&b.name.to_lowercase())));
    Ok(v)
}

/// 新建空文本文件。若目标已存在则失败，避免覆盖用户数据。
#[tauri::command]
fn create_text_file(path: String) -> Result<(), String> {
    let target = Path::new(&path);
    if target.exists() {
        return Err("目标已存在".to_string());
    }
    if let Some(parent) = target.parent() {
        if !parent.exists() {
            return Err("父目录不存在".to_string());
        }
    }
    fs::File::create(target).map_err(|e| e.to_string())?;
    Ok(())
}

/// 新建目录。若目标已存在则失败，避免误用已有目录。
#[tauri::command]
fn create_dir(path: String) -> Result<(), String> {
    let target = Path::new(&path);
    if target.exists() {
        return Err("目标已存在".to_string());
    }
    fs::create_dir(target).map_err(|e| e.to_string())
}

/// 重命名或移动文件/目录。若目标已存在则失败，避免覆盖用户数据。
#[tauri::command]
fn rename_path(old_path: String, new_path: String, state: tauri::State<'_, WatcherState>) -> Result<(), String> {
    let old = Path::new(&old_path);
    let new = Path::new(&new_path);
    if !old.exists() {
        return Err("源文件不存在".to_string());
    }
    let new_parent = new.parent().ok_or_else(|| "目标父目录无效".to_string())?;
    if !new_parent.exists() {
        return Err("目标父目录不存在".to_string());
    }
    if old_path == new_path {
        return Ok(());
    }
    if old.is_dir() {
        let old_canon = old.canonicalize().map_err(|e| e.to_string())?;
        let parent_canon = new_parent.canonicalize().map_err(|e| e.to_string())?;
        if parent_canon == old_canon || parent_canon.starts_with(&old_canon) {
            return Err("不能将文件夹移动到自身内部".to_string());
        }
    }
    if old_path.to_lowercase() != new_path.to_lowercase() && new.exists() {
        return Err("目标已存在".to_string());
    }
    if let Ok(mut rw) = state.recent_writes.lock() {
        let now = std::time::Instant::now();
        rw.insert(old_path.clone(), now);
        rw.insert(new_path.clone(), now);
    }
    fs::rename(old, new).map_err(|e| e.to_string())
}

/// 将文件或目录移入系统回收站/废纸篓。调用方必须先确认，避免误操作。
#[tauri::command]
fn delete_path(path: String, state: tauri::State<'_, WatcherState>) -> Result<(), String> {
    let target = Path::new(&path);
    if !target.exists() {
        return Err("目标不存在".to_string());
    }
    if let Ok(mut rw) = state.recent_writes.lock() {
        rw.insert(path.clone(), std::time::Instant::now());
    }
    trash::delete(target).map_err(|e| e.to_string())
}

/// 保存粘贴/拖入的图片到 <dir>/assets/<name>，返回相对路径 ./assets/<name>（设计 §18.2）。
/// 同名自动加 -1/-2；非法字符替换为 _。
#[tauri::command]
fn write_asset(dir: String, name: String, bytes: Vec<u8>) -> Result<String, String> {
    let assets_dir = Path::new(&dir).join("assets");
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

/// 监听工作区（递归），外部改动时 emit "fs:changed" {path, kind}（设计 §16.5 / §9.4）。
/// 过滤自身 500ms 内的写入，并忽略常见高频构建/依赖目录。重复监听同一根是 no-op。
#[tauri::command]
fn watch(root: String, app: AppHandle, state: tauri::State<'_, WatcherState>) -> Result<(), String> {
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
                // 自身 500ms 内写入的路径跳过
                let self_touched = if let Ok(rw) = recent.lock() {
                    ev.paths.iter().any(|p| {
                        let key = p.to_string_lossy();
                        rw.get(&*key)
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
                            "oldPath": old_path.to_string_lossy(),
                            "newPath": new_path.to_string_lossy(),
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
                        serde_json::json!({ "path": p.to_string_lossy(), "kind": kind }),
                    );
                }
            }
        },
        notify::Config::default(),
    )
    .map_err(|e| {
        e.to_string()
    })?;
    watcher
        .watch(Path::new(&root), RecursiveMode::Recursive)
        .map_err(|e| {
            e.to_string()
        })?;
    watchers.insert(root.clone(), watcher);
    Ok(())
}

/// 停止监听某根路径。
#[tauri::command]
fn unwatch(root: String, state: tauri::State<'_, WatcherState>) -> Result<(), String> {
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
