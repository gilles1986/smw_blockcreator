# Makes BlockCreator.zip: the program, README.txt, AGENTS.md and, for an AI that writes Pieces, the
# guides, the schema and the built-in Library as examples, all with the paths the guides use.
# Called by build.bat after the release build; -Exe and -Zip are there for trying it out.

param(
  [string]$Exe = 'src-tauri\target\release\blockcreator.exe',
  [string]$Zip = 'BlockCreator.zip'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = Split-Path -Parent $PSScriptRoot
if (-not [IO.Path]::IsPathRooted($Exe)) { $Exe = Join-Path $root $Exe }
if (-not [IO.Path]::IsPathRooted($Zip)) { $Zip = Join-Path $root $Zip }
if (-not (Test-Path $Exe)) { throw "The program is not built: $Exe" }

$version = (Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
$stage = Join-Path ([IO.Path]::GetTempPath()) "blockcreator-release-$PID"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null

try {
  function Stage-File($from, $to) {
    $target = Join-Path $stage $to
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
    Copy-Item -LiteralPath (Join-Path $root $from) -Destination $target
  }

  function Stage-Folder($from, $to) {
    $target = Join-Path $stage $to
    New-Item -ItemType Directory -Force -Path $target | Out-Null
    Copy-Item -Path (Join-Path $root "$from\*") -Destination $target -Recurse -Exclude '.gitkeep'
  }

  Copy-Item -LiteralPath $Exe -Destination (Join-Path $stage 'BlockCreator.exe')

  # Notepad of older Windows versions wants CRLF; the version is the one of package.json.
  $readme = (Get-Content (Join-Path $root 'release\README.txt') -Raw) -replace '@VERSION@', $version
  $readme = $readme -replace "`r?`n", "`r`n"
  [IO.File]::WriteAllText((Join-Path $stage 'README.txt'), $readme, (New-Object Text.UTF8Encoding $false))

  Stage-File 'release\AGENTS.md' 'AGENTS.md'
  Stage-File 'CONTEXT.md' 'CONTEXT.md'
  Stage-File 'docs\piece-authoring.md' 'docs\piece-authoring.md'
  Stage-File 'docs\piece-authoring-for-ai.md' 'docs\piece-authoring-for-ai.md'
  Stage-Folder 'docs\examples' 'docs\examples'
  Stage-Folder 'docs\adr' 'docs\adr'
  Stage-File 'core\library\piece.schema.json' 'core\library\piece.schema.json'
  Stage-Folder 'library' 'library'

  # Entries with `/` in their paths: the ZipFile of Windows PowerShell 5.1 would write `\`.
  if (Test-Path $Zip) { Remove-Item $Zip -Force }
  $archive = [IO.Compression.ZipFile]::Open($Zip, 'Create')
  try {
    Get-ChildItem $stage -Recurse -File | ForEach-Object {
      $name = $_.FullName.Substring($stage.Length + 1).Replace('\', '/')
      [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $name, 'Optimal') | Out-Null
    }
  }
  finally {
    $archive.Dispose()
  }
  Write-Host "Made $Zip (BlockCreator $version)"
}
finally {
  Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
}
