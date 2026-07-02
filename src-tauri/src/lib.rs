use std::fs;
use std::io::Write;
use std::path::Path;
use serde::Serialize;

/// 读取文本文件（UTF-8）。M0 基础实现；
/// TODO(M2)：编码探测 / BOM / GBK 回退（设计 §16.3）。
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(Path::new(&path)).map_err(|e| e.to_string())
}

/// 原子写入：临时文件 + rename，避免写一半断电损坏（设计 §10.2 / §16.1）。
/// TODO(M2)：沙箱路径校验、行尾策略（§16.3 / §16.4）。
#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
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
            list_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
