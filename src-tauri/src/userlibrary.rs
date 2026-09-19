// The user's own Pieces: a folder under the app's data dir with the same layout as the built-in
// Library (`actions/<id>/`, `conditions/<id>/`). Written by the Piece editor and the ZIP import,
// read as a whole when the Library loads. The paths BlockCreator may touch are restricted the
// same way project.rs restricts the GPS folder.

use std::path::{Path, PathBuf};
use tauri::Manager;

fn pieces_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  let dir = app
    .path()
    .app_data_dir()
    .map_err(|e| format!("no app data dir: {e}"))?;
  Ok(dir.join("pieces"))
}

/// The folder the user's own Pieces live in (created on the first write).
#[tauri::command]
pub fn user_pieces_dir(app: tauri::AppHandle) -> Result<String, String> {
  Ok(pieces_dir(&app)?.to_string_lossy().into_owned())
}

/// All files of the user's Piece folder, as (`/`-separated relative path, text) pairs.
#[tauri::command]
pub fn user_pieces_read_all(app: tauri::AppHandle) -> Result<Vec<(String, String)>, String> {
  let base = pieces_dir(&app)?;
  let mut files = Vec::new();
  if base.is_dir() {
    collect(&base, &base, &mut files)?;
  }
  files.sort();
  Ok(files)
}

fn collect(base: &Path, dir: &Path, files: &mut Vec<(String, String)>) -> Result<(), String> {
  let entries =
    std::fs::read_dir(dir).map_err(|e| format!("cannot read {}: {e}", dir.display()))?;
  for entry in entries {
    let path = entry.map_err(|e| e.to_string())?.path();
    if path.is_dir() {
      collect(base, &path, files)?;
    } else if matches!(path.extension().and_then(|e| e.to_str()), Some("json") | Some("asm")) {
      let text = std::fs::read_to_string(&path)
        .map_err(|e| format!("cannot read {}: {e}", path.display()))?;
      let rel = path
        .strip_prefix(base)
        .map_err(|e| e.to_string())?
        .iter()
        .map(|part| part.to_string_lossy().into_owned())
        .collect::<Vec<_>>()
        .join("/");
      files.push((rel, text));
    }
  }
  Ok(())
}

/// A Piece id: lower-case letters, digits and underscores, like the manifest schema asks for.
fn id_ok(id: &str) -> bool {
  !id.is_empty()
    && id
      .chars()
      .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
}

/// A path inside the user's Piece folder. With `file_required` it must be a Piece's file
/// (`actions/<id>/piece.json`, `conditions/<id>/code.asm`); without, a whole Piece folder.
fn piece_path(base: &Path, path: &str, file_required: bool) -> Result<PathBuf, String> {
  let parts: Vec<&str> = path.split('/').collect();
  let ok = match parts.as_slice() {
    [kind, id] if !file_required => matches!(*kind, "actions" | "conditions") && id_ok(id),
    [kind, id, file] => {
      matches!(*kind, "actions" | "conditions")
        && id_ok(id)
        && matches!(*file, "piece.json" | "code.asm")
    }
    _ => false,
  };
  if !ok {
    return Err(format!("not a Piece path: {path}"));
  }
  let mut full = base.to_path_buf();
  full.extend(parts);
  Ok(full)
}

/// Writes one file of a user Piece, making the folders on the way.
#[tauri::command]
pub fn user_piece_write(app: tauri::AppHandle, path: String, text: String) -> Result<(), String> {
  let file = piece_path(&pieces_dir(&app)?, &path, true)?;
  if let Some(parent) = file.parent() {
    std::fs::create_dir_all(parent)
      .map_err(|e| format!("cannot create {}: {e}", parent.display()))?;
  }
  std::fs::write(&file, text).map_err(|e| format!("cannot write {}: {e}", file.display()))
}

/// Deletes a whole user Piece (`actions/<id>` or `conditions/<id>`); missing is fine.
#[tauri::command]
pub fn user_piece_delete(app: tauri::AppHandle, path: String) -> Result<(), String> {
  let dir = piece_path(&pieces_dir(&app)?, &path, false)?;
  match std::fs::remove_dir_all(&dir) {
    Ok(()) => Ok(()),
    Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
    Err(e) => Err(format!("cannot delete {}: {e}", dir.display())),
  }
}

/// A dialog-picked archive path must be a .zip; the check is a backstop, not a security boundary.
fn zip_path(path: &str) -> Result<&Path, String> {
  if !path.to_ascii_lowercase().ends_with(".zip") {
    return Err(format!("not a .zip file: {path}"));
  }
  Ok(Path::new(path))
}

/// Reads a dialog-picked Pieces archive (.zip) as bytes.
#[tauri::command]
pub fn archive_read(path: String) -> Result<Vec<u8>, String> {
  std::fs::read(zip_path(&path)?).map_err(|e| format!("cannot read {path}: {e}"))
}

/// Writes a Pieces archive (.zip) to a dialog-picked path.
#[tauri::command]
pub fn archive_write(path: String, bytes: Vec<u8>) -> Result<(), String> {
  std::fs::write(zip_path(&path)?, bytes).map_err(|e| format!("cannot write {path}: {e}"))
}
