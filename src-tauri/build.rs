fn main() {
  println!("cargo:rerun-if-changed=icons/icon.ico");
  println!("cargo:rerun-if-changed=tauri.conf.json");
  println!("cargo:rerun-if-changed=capabilities");
  tauri_build::build();
}

