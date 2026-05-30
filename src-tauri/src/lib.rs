// Denkeez Tauri バックエンド エントリポイント
// Plan §3: Rust 側コマンドは最小限。ファイル I/O は標準プラグイン経由 + permissions で制限する。
// Phase 2-F2: GitHub Releases からの自動更新を tauri-plugin-updater 経由で提供。

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        // Phase 2-I3: メーカー公式ページを既定ブラウザで開く (品番 deep-link)
        .plugin(tauri_plugin_opener::init())
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
        .run(tauri::generate_context!())
        .expect("error while running Denkeez");
}
