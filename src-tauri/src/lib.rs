use std::fs;
use std::io::Write;
use std::path::Path;

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
        .invoke_handler(tauri::generate_handler![read_text_file, write_text_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
