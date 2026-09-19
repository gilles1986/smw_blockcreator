// Reading and writing inside the user's GPS folder: the Block files, `list.txt` and its backup.
// The folder is remembered by the app rather than picked in a dialog each time, so the fs plugin's
// dialog scope does not cover it; these commands take a path relative to the GPS folder and
// accept only the places BlockCreator writes to.

use std::path::{Path, PathBuf};

/// Where a relative path may point: the list and its backup, or a file under `blocks/`, `routines/`.
fn project_path(gps_folder: &str, path: &str) -> Result<PathBuf, String> {
  let parts: Vec<&str> = path.split('/').collect();
  let plain = parts
    .iter()
    .all(|part| !part.is_empty() && *part != "." && *part != ".." && !part.contains(['\\', ':']));
  let allowed = matches!(path, "list.txt" | "list.txt.bak")
    || (parts.len() >= 2 && matches!(parts[0], "blocks" | "routines"));
  if !plain || !allowed {
    return Err(format!("not a place BlockCreator writes to: {path}"));
  }
  let mut full = Path::new(gps_folder).to_path_buf();
  full.extend(parts);
  Ok(full)
}

/// Whether a folder looks like a PIXI folder: PIXI itself and its sprite list.
#[tauri::command]
pub fn pixi_folder_ok(pixi_folder: String) -> bool {
  let folder = Path::new(&pixi_folder);
  folder.join("pixi.exe").is_file() && folder.join("list.txt").is_file()
}

/// The text of the PIXI folder's `list.txt`, or `None` when there is none.
#[tauri::command]
pub fn pixi_read_list(pixi_folder: String) -> Result<Option<String>, String> {
  let file = Path::new(&pixi_folder).join("list.txt");
  match std::fs::read_to_string(&file) {
    Ok(text) => Ok(Some(text)),
    Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
    Err(e) => Err(format!("cannot read {}: {e}", file.display())),
  }
}

/// The text of a file in the GPS folder, or `None` when it does not exist.
#[tauri::command]
pub fn project_read(gps_folder: String, path: String) -> Result<Option<String>, String> {
  let file = project_path(&gps_folder, &path)?;
  match std::fs::read_to_string(&file) {
    Ok(text) => Ok(Some(text)),
    Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
    Err(e) => Err(format!("cannot read {}: {e}", file.display())),
  }
}

/// Writes a file in the GPS folder, making the folders on the way.
#[tauri::command]
pub fn project_write(gps_folder: String, path: String, text: String) -> Result<(), String> {
  let file = project_path(&gps_folder, &path)?;
  if let Some(parent) = file.parent() {
    std::fs::create_dir_all(parent).map_err(|e| format!("cannot create {}: {e}", parent.display()))?;
  }
  std::fs::write(&file, text).map_err(|e| format!("cannot write {}: {e}", file.display()))
}
