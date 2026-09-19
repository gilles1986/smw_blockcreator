mod asar;
mod project;
mod userlibrary;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_opener::init())
    .invoke_handler(tauri::generate_handler![
      asar::asar_check,
      asar::gps_folder_ok,
      asar::gps_routines,
      project::pixi_folder_ok,
      project::pixi_read_list,
      project::project_read,
      project::project_write,
      userlibrary::archive_read,
      userlibrary::archive_write,
      userlibrary::user_piece_delete,
      userlibrary::user_piece_write,
      userlibrary::user_pieces_dir,
      userlibrary::user_pieces_read_all
    ])
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
    .expect("error while running tauri application");
}
