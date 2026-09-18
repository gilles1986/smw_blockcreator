// Checks generated Blocks with the GPS project's own asar.dll (ADR 4). The DLL is loaded per
// check and never shipped with BlockCreator; Asar has global state, so checks run one at a time.

use libloading::{Library, Symbol};
use serde::Serialize;
use std::collections::HashMap;
use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_int};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;

/// `struct errordata` of the Asar DLL API (asardll.h, Asar 1.91).
#[repr(C)]
struct ErrorData {
  fullerrdata: *const c_char,
  rawerrdata: *const c_char,
  block: *const c_char,
  filename: *const c_char,
  line: c_int,
  callerfilename: *const c_char,
  callerline: c_int,
  errid: c_int,
}

#[derive(Serialize)]
pub struct AsarMessage {
  /// File name without directory, e.g. `block.asm`.
  file: String,
  /// 1-based (Asar counts from 0).
  line: i32,
  message: String,
}

#[derive(Serialize)]
pub struct AsarReport {
  errors: Vec<AsarMessage>,
  warnings: Vec<AsarMessage>,
}

static ASAR: Mutex<()> = Mutex::new(());
static CHECK_NUMBER: AtomicU32 = AtomicU32::new(0);

/// Routine names of the GPS project (`routines/*.asm`), which GPS turns into `%name()` macros.
#[tauri::command]
pub fn gps_routines(gps_folder: String) -> Result<Vec<String>, String> {
  let dir = Path::new(&gps_folder).join("routines");
  let entries = match std::fs::read_dir(&dir) {
    Ok(entries) => entries,
    Err(_) => return Ok(Vec::new()),
  };
  let mut names: Vec<String> = entries
    .filter_map(|entry| entry.ok())
    .filter_map(|entry| {
      let name = entry.file_name().to_string_lossy().into_owned();
      let lower = name.to_lowercase();
      lower.ends_with(".asm").then(|| name[..name.len() - 4].to_string())
    })
    .collect();
  names.sort();
  Ok(names)
}

/// Whether a folder looks like a GPS folder BlockCreator can check with.
#[tauri::command]
pub fn gps_folder_ok(gps_folder: String) -> bool {
  let folder = Path::new(&gps_folder);
  folder.join("asar.dll").is_file() && folder.join("defines.asm").is_file()
}

/// Assembles `files` (plain file names, no folders) starting at `entry`, next to the project's
/// `defines.asm`, with the project's `asar.dll`.
#[tauri::command]
pub fn asar_check(
  gps_folder: String,
  files: HashMap<String, String>,
  entry: String,
) -> Result<AsarReport, String> {
  let gps = Path::new(&gps_folder);
  if !gps_folder_ok(gps_folder.clone()) {
    return Err(format!("{gps_folder} has no asar.dll and defines.asm"));
  }
  let dir = std::env::temp_dir().join(format!(
    "blockcreator-check-{}-{}",
    std::process::id(),
    CHECK_NUMBER.fetch_add(1, Ordering::Relaxed)
  ));
  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  let result = prepare(&dir, gps, &files).and_then(|()| run(&gps.join("asar.dll"), &dir.join(&entry)));
  let _ = std::fs::remove_dir_all(&dir);
  result
}

fn prepare(dir: &Path, gps: &Path, files: &HashMap<String, String>) -> Result<(), String> {
  std::fs::copy(gps.join("defines.asm"), dir.join("defines.asm")).map_err(|e| e.to_string())?;
  for (name, text) in files {
    let plain = !name.is_empty() && !name.contains(['/', '\\', ':']) && name != "..";
    if !plain {
      return Err(format!("not a plain file name: {name}"));
    }
    std::fs::write(dir.join(name), text).map_err(|e| e.to_string())?;
  }
  Ok(())
}

fn run(dll: &PathBuf, entry: &Path) -> Result<AsarReport, String> {
  let _one_at_a_time = ASAR.lock().map_err(|e| e.to_string())?;
  let path = CString::new(entry.to_string_lossy().as_bytes()).map_err(|e| e.to_string())?;
  // SAFETY: the symbols follow asardll.h of Asar 1.91; pointers returned by Asar stay valid
  // until the next call into it, and are copied out before the library is closed.
  unsafe {
    let lib = Library::new(dll).map_err(|e| format!("cannot load {}: {e}", dll.display()))?;
    let max_rom_size: Symbol<unsafe extern "C" fn() -> c_int> = symbol(&lib, b"asar_maxromsize")?;
    let patch: Symbol<unsafe extern "C" fn(*const c_char, *mut u8, c_int, *mut c_int) -> bool> =
      symbol(&lib, b"asar_patch")?;
    let errors: Symbol<unsafe extern "C" fn(*mut c_int) -> *const ErrorData> =
      symbol(&lib, b"asar_geterrors")?;
    let warnings: Symbol<unsafe extern "C" fn(*mut c_int) -> *const ErrorData> =
      symbol(&lib, b"asar_getwarnings")?;
    let close: Symbol<unsafe extern "C" fn()> = symbol(&lib, b"asar_close")?;

    let size = max_rom_size();
    let mut rom = vec![0u8; size.max(0) as usize];
    let mut rom_len: c_int = 0x80000;
    patch(path.as_ptr(), rom.as_mut_ptr(), size, &mut rom_len);
    let report = AsarReport { errors: messages(&errors), warnings: messages(&warnings) };
    close();
    Ok(report)
  }
}

unsafe fn symbol<'a, T>(lib: &'a Library, name: &[u8]) -> Result<Symbol<'a, T>, String> {
  lib.get(name).map_err(|e| format!("asar.dll has no {}: {e}", String::from_utf8_lossy(name)))
}

unsafe fn messages(get: &Symbol<unsafe extern "C" fn(*mut c_int) -> *const ErrorData>) -> Vec<AsarMessage> {
  let mut count: c_int = 0;
  let first = get(&mut count);
  if first.is_null() || count <= 0 {
    return Vec::new();
  }
  std::slice::from_raw_parts(first, count as usize)
    .iter()
    .map(|e| AsarMessage {
      file: Path::new(&text(e.filename))
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default(),
      line: e.line + 1,
      message: text(e.rawerrdata),
    })
    .collect()
}

unsafe fn text(pointer: *const c_char) -> String {
  if pointer.is_null() {
    String::new()
  } else {
    CStr::from_ptr(pointer).to_string_lossy().into_owned()
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  /// The GPS folder next to this repo (as the TS integration test uses); skipped without it.
  fn gps() -> Option<String> {
    let folder = std::env::var("BLOCKCREATOR_GPS")
      .unwrap_or_else(|_| concat!(env!("CARGO_MANIFEST_DIR"), "/../../GPS").to_string());
    gps_folder_ok(folder.clone()).then_some(folder)
  }

  fn check(block: &str) -> AsarReport {
    let harness = "lorom\nincsrc \"defines.asm\"\norg $108000\nincsrc \"block.asm\"\n";
    let files = HashMap::from([
      ("harness.asm".to_string(), harness.to_string()),
      ("block.asm".to_string(), block.to_string()),
    ]);
    asar_check(gps().unwrap(), files, "harness.asm".to_string()).unwrap()
  }

  #[test]
  fn assembles_a_golden_block_and_reports_a_typo_with_its_line() {
    if gps().is_none() {
      eprintln!("skipped: no GPS folder");
      return;
    }
    let golden = include_str!("../../core/generator/golden/onoff_cement.asm");
    assert!(check(golden).errors.is_empty());

    let typo = golden.replace("\tLDA #$30\n", "\tLDAX #$30\n");
    let report = check(&typo);
    assert_eq!(report.errors.len(), 1);
    let error = &report.errors[0];
    assert_eq!(error.file, "block.asm");
    assert_eq!(typo.lines().nth(error.line as usize - 1), Some("\tLDAX #$30"));
  }

  #[test]
  fn rejects_file_names_with_folders() {
    if gps().is_none() {
      return;
    }
    let files = HashMap::from([("../x.asm".to_string(), String::new())]);
    assert!(asar_check(gps().unwrap(), files, "x.asm".to_string()).is_err());
  }
}
