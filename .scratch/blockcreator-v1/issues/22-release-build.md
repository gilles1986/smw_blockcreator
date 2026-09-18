# Windows release build

Status: open
Blocked by: 18, 20
Spec: ../spec.md

Tauri bundler config, app icon, version in generated headers, bundled built-in Library and locales; the release build produces an installer / portable exe. Document the download size.

**Done when**
- The release build installs on a clean Windows 11 machine and opens, validates and saves a preset into a GPS project.

**Notes from 03 (library loader)**
- `core/library` validates manifests with Ajv, which compiles schemas via `new Function`. If the Tauri CSP is tightened (currently `csp: null`), either allow `unsafe-eval` or switch to Ajv standalone (precompiled) validation.
