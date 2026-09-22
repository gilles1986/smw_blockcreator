// Makes a BlockCreator release: raises the version, builds the desktop app and BlockCreator.zip,
// builds the web app and optionally uploads both via SFTP. Started by release.bat.
//
//   release.bat                    asks for the new version
//   release.bat patch|minor|major  raises that part of the version
//   release.bat keep               same version again (rebuild and upload)
//   release.bat 1.2.3              sets exactly this version
//   --dry-run                      shows what would happen and changes nothing
//   --no-upload                    builds everything, uploads nothing
//   --yes                          does not ask for a confirmation before it starts

import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { unzipSync } from 'fflate';
import SftpClient from 'ssh2-sftp-client';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Optional website project directory (can be set via SAPHROS_WEBSITE_DIR or WEBSITE_DIR) */
const WEBSITE_DIR = process.env.SAPHROS_WEBSITE_DIR || process.env.WEBSITE_DIR || '';
const SITE_URL = process.env.SITE_URL || 'https://saphros.de';
const ZIP_NAME = 'BlockCreator.zip';
const ZIP_DIR = 'resource-files/downloads';
const WEB_URL = `${SITE_URL}/blockcreator/web/`;

// ---------------------------------------------------------------------------------------------
// Versions

/** Where the version lives. Every pattern keeps the text around it (groups 1 and 2). */
export const VERSION_FILES = [
  { file: 'package.json', patterns: [/("version":\s*")[^"]+(")/] },
  {
    file: 'package-lock.json',
    patterns: [
      /^(\{\s*"name":\s*"blockcreator",\s*"version":\s*")[^"]+(")/,
      /("packages":\s*\{\s*"":\s*\{\s*"name":\s*"blockcreator",\s*"version":\s*")[^"]+(")/,
    ],
  },
  { file: 'src-tauri/tauri.conf.json', patterns: [/("version":\s*")[^"]+(")/] },
  { file: 'src-tauri/Cargo.toml', patterns: [/^(version = ")[^"]+(")/m] },
  {
    file: 'src-tauri/Cargo.lock',
    patterns: [/(\[\[package\]\]\r?\nname = "blockcreator"\r?\nversion = ")[^"]+(")/],
  },
];

export function parseVersion(text) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(text.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
}

export function compareVersions(a, b) {
  const [x, y] = [parseVersion(a), parseVersion(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
}

export function bumpVersion(current, kind) {
  const v = parseVersion(current);
  if (!v) throw new Error(`Not a version: ${current}`);
  if (kind === 'major') return `${v[0] + 1}.0.0`;
  if (kind === 'minor') return `${v[0]}.${v[1] + 1}.0`;
  if (kind === 'patch') return `${v[0]}.${v[1]}.${v[2] + 1}`;
  throw new Error(`Unknown kind of bump: ${kind}`);
}

/** "patch", "p", "1.2.3", "" (keep) ... to a version; undefined when it makes no sense. */
export function versionFromAnswer(answer, current) {
  const text = answer.trim().toLowerCase();
  if (text === '' || text === 'keep' || text === 'k') return current;
  if (text === 'patch' || text === 'p') return bumpVersion(current, 'patch');
  if (text === 'minor' || text === 'm') return bumpVersion(current, 'minor');
  if (text === 'major' || text === 'j') return bumpVersion(current, 'major');
  return parseVersion(text) ? text : undefined;
}

/** The new text of a file with the version set; throws when the file does not look as expected. */
export function withVersion(text, { file, patterns }, version) {
  let result = text;
  for (const pattern of patterns) {
    if (!pattern.test(result)) throw new Error(`Cannot find the version in ${file}`);
    result = result.replace(pattern, `$1${version}$2`);
  }
  return result;
}

// ---------------------------------------------------------------------------------------------
// Steps

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith('--')));
const dryRun = flags.has('--dry-run');
const noUpload = flags.has('--no-upload');
const assumeYes = flags.has('--yes');
const versionArg = args.find((arg) => !arg.startsWith('--'));

const stepTotal = 6;
let stepNumber = 0;
const step = (text) => console.log(`\n[${++stepNumber}/${stepTotal}] ${text}`);
const note = (text) => console.log(`      ${text}`);

/** Runs a program in the project folder with its output on screen; throws when it fails. */
function run(command, commandArgs) {
  note(`> ${command} ${commandArgs.join(' ')}`);
  if (dryRun) return;
  const result = spawnSync(command, commandArgs, { cwd: root, stdio: 'inherit', shell: true });
  if (result.status !== 0) throw new Error(`${command} ${commandArgs[0] ?? ''} failed`);
}

function readCurrentVersion() {
  return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
}

async function askVersion(current) {
  if (versionArg !== undefined) {
    const chosen = versionFromAnswer(versionArg, current);
    if (!chosen) throw new Error(`"${versionArg}" is not patch, minor, major, keep or a version.`);
    return chosen;
  }
  console.log(`Current version: ${current}`);
  console.log(`  p  patch   -> ${bumpVersion(current, 'patch')}`);
  console.log(`  m  minor   -> ${bumpVersion(current, 'minor')}`);
  console.log(`  j  major   -> ${bumpVersion(current, 'major')}`);
  console.log('  or type a version, for example 1.0.0');
  console.log(`  Enter      keep ${current} (build and upload it again)`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (;;) {
      const chosen = versionFromAnswer(await rl.question('New version: '), current);
      if (chosen) return chosen;
      console.log('That is not p, m, j, a version like 1.2.3, or Enter.');
    }
  } finally {
    rl.close();
  }
}

async function confirm(question) {
  if (assumeYes || dryRun) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(`${question} [y/N] `)).trim().toLowerCase().startsWith('y');
  } finally {
    rl.close();
  }
}

function loadSite() {
  const localCandidates = [
    join(root, 'deploy.config.json'),
    join(root, 'config.json'),
  ];
  if (process.env.DEPLOY_CONFIG_PATH) {
    localCandidates.unshift(process.env.DEPLOY_CONFIG_PATH);
  }
  if (WEBSITE_DIR) {
    localCandidates.push(join(WEBSITE_DIR, 'config.json'));
  }
  for (const configPath of localCandidates) {
    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, 'utf8'));
      return config.sftp ?? config;
    }
  }
  throw new Error(
    'SFTP configuration not found. Please create deploy.config.json (see deploy.config.example.json).',
  );
}

function preflight() {
  const problems = [];
  if (spawnSync('cargo', ['--version'], { shell: true }).status !== 0) {
    problems.push('cargo (Rust) is not available: the desktop app cannot be built.');
  }
  if (!existsSync(join(root, 'release', 'package.ps1')))
    problems.push('release/package.ps1 is missing.');
  if (!existsSync(join(root, 'scripts', 'deploy.mjs')))
    problems.push('scripts/deploy.mjs is missing.');
  if (!existsSync(join(root, 'node_modules')))
    problems.push('node_modules is missing: run npm install.');
  if (WEBSITE_DIR && !existsSync(join(WEBSITE_DIR, 'static')))
    problems.push(`Website project not found: ${WEBSITE_DIR}`);
  if (!noUpload) {
    try {
      const site = loadSite();
      for (const key of ['host', 'username', 'password', 'remotePath']) {
        if (!site[key]) problems.push(`The SFTP config has no sftp.${key}.`);
      }
    } catch (error) {
      problems.push(error.message);
    }
  }
  return problems;
}

function setVersion(version) {
  const originals = new Map();
  for (const spec of VERSION_FILES) {
    const path = join(root, spec.file);
    const text = readFileSync(path, 'utf8');
    const updated = withVersion(text, spec, version);
    note(`${spec.file}${updated === text ? ' (already ' + version + ')' : ''}`);
    originals.set(path, text);
    if (!dryRun && updated !== text) writeFileSync(path, updated);
  }
  return originals;
}

function restoreVersionFiles(originals) {
  for (const [path, text] of originals) writeFileSync(path, text);
  console.log('\nThe version files are back to what they were.');
}

/** Stops the release when the zip is not the release package (once it was the dist folder). */
function checkZip(zipPath, version) {
  const names = [];
  unzipSync(readFileSync(zipPath), {
    filter(file) {
      names.push(file.name);
      return false;
    },
  });
  const need = [
    'BlockCreator.exe',
    'README.txt',
    'AGENTS.md',
    'docs/piece-authoring.md',
    'docs/piece-authoring-for-ai.md',
    'core/library/piece.schema.json',
  ];
  const problems = need.filter((name) => !names.includes(name)).map((name) => `${name} is missing`);
  if (!names.some((name) => name.startsWith('library/actions/')))
    problems.push('library/actions is missing');
  if (!names.some((name) => name.startsWith('library/presets/')))
    problems.push('library/presets is missing');
  for (const name of ['index.html', 'assets/']) {
    if (names.includes(name))
      problems.push(`${name} does not belong in the release zip (is it the dist folder?)`);
  }
  const readme = unzipSync(readFileSync(zipPath), { filter: (file) => file.name === 'README.txt' })[
    'README.txt'
  ];
  const heading = readme ? new TextDecoder().decode(readme).split(/\r?\n/, 1)[0] : '';
  if (heading.trim() !== `BlockCreator ${version}`)
    problems.push(`README.txt says "${heading}", not "BlockCreator ${version}"`);
  if (problems.length > 0)
    throw new Error(`BlockCreator.zip is not right:\n  - ${problems.join('\n  - ')}`);
  note(
    `${names.filter((name) => !name.endsWith('/')).length} files, README says "${heading.trim()}"`,
  );
}

function checkExeVersion(version) {
  const exe = join(root, 'src-tauri', 'target', 'release', 'blockcreator.exe');
  const result = spawnSync(
    'powershell',
    ['-NoProfile', '-Command', `(Get-Item -LiteralPath '${exe}').VersionInfo.FileVersion`],
    { encoding: 'utf8' },
  );
  const built = result.stdout.trim();
  if (!built.startsWith(version)) {
    throw new Error(
      `blockcreator.exe says version "${built}", not ${version}: the build is out of date.`,
    );
  }
  note(`blockcreator.exe is ${built}`);
}

async function uploadZip(zipPath, site) {
  const sftp = new SftpClient();
  await sftp.connect({
    host: site.host,
    port: site.port || 22,
    username: site.username,
    password: site.password,
  });
  try {
    const dir = `${site.remotePath}/${ZIP_DIR}`;
    if (!(await sftp.exists(dir))) await sftp.mkdir(dir, true);
    const target = `${dir}/${ZIP_NAME}`;
    const temp = `${target}.uploading`;
    let lastPercent = -10;
    await sftp.fastPut(zipPath, temp, {
      step: (done, _chunk, total) => {
        const percent = Math.floor((done / total) * 100);
        if (percent >= lastPercent + 10) {
          lastPercent = percent;
          note(`${percent}%`);
        }
      },
    });
    // Renamed at the end, so nobody downloads a half-written zip.
    try {
      await sftp.posixRename(temp, target);
    } catch {
      if (await sftp.exists(target)) await sftp.delete(target);
      await sftp.rename(temp, target);
    }
  } finally {
    await sftp.end();
  }
}

async function verifyOnline(zipSize) {
  const zipUrl = `${SITE_URL}/${ZIP_DIR}/${ZIP_NAME}`;
  const zip = await fetch(zipUrl, { method: 'HEAD', cache: 'no-store' });
  const online = Number(zip.headers.get('content-length'));
  if (!zip.ok || online !== zipSize) {
    throw new Error(`${zipUrl} answers ${zip.status} with ${online} bytes, expected ${zipSize}.`);
  }
  note(`${zipUrl} is online (${zipSize} bytes)`);
  const web = await fetch(WEB_URL, { cache: 'no-store' });
  if (!web.ok) throw new Error(`${WEB_URL} answers ${web.status}.`);
  note(`${WEB_URL} is online`);
}

async function main() {
  console.log('BlockCreator release' + (dryRun ? ' (dry run: nothing is changed)' : ''));
  const current = readCurrentVersion();
  const version = await askVersion(current);
  if (
    compareVersions(version, current) < 0 &&
    !(await confirm(`${version} is lower than ${current}. Continue?`))
  ) {
    console.log('Cancelled.');
    return;
  }

  const problems = preflight();
  if (problems.length > 0) throw new Error(`Cannot start:\n  - ${problems.join('\n  - ')}`);

  console.log(`\nThis makes BlockCreator ${version}:`);
  console.log(
    '  - sets the version in package.json, package-lock.json, tauri.conf.json, Cargo.toml, Cargo.lock',
  );
  console.log('  - builds the desktop app and packs BlockCreator.zip');
  if (WEBSITE_DIR) {
    console.log(`  - copies the zip into ${join(WEBSITE_DIR, 'static', ZIP_DIR)}`);
  }
  console.log(
    noUpload
      ? '  - uploads nothing (--no-upload)'
      : `  - uploads the zip and the web app to ${SITE_URL}`,
  );
  if (!(await confirm('Start?'))) {
    console.log('Cancelled.');
    return;
  }

  const zipPath = join(root, ZIP_NAME);
  const startedAt = Date.now();
  let originals;
  try {
    step(`Set the version to ${version}`);
    originals = setVersion(version);

    step('Build the desktop app (this takes a few minutes)');
    run('npx', ['tauri', 'build', '--no-bundle']);
    if (!dryRun) checkExeVersion(version);

    step('Pack BlockCreator.zip');
    run('powershell', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      'release\\package.ps1',
    ]);
    if (!dryRun) {
      checkZip(zipPath, version);
      const distIndex = join(root, 'dist', 'index.html');
      if (!existsSync(distIndex) || statSync(distIndex).mtimeMs < startedAt) {
        throw new Error('The web app in dist/ was not built by this release.');
      }
    }
  } catch (error) {
    if (originals && !dryRun) restoreVersionFiles(originals);
    throw error;
  }

  if (WEBSITE_DIR) {
    step('Copy the zip into the website project');
    const target = join(WEBSITE_DIR, 'static', ZIP_DIR, ZIP_NAME);
    note(target);
    if (!dryRun) {
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(zipPath, target);
    }
  }

  if (noUpload) {
    console.log('\nNot uploaded (--no-upload). Built and ready: ' + zipPath);
    return;
  }

  step('Upload BlockCreator.zip');
  if (dryRun) note(`-> ${SITE_URL}/${ZIP_DIR}/${ZIP_NAME}`);
  else await uploadZip(zipPath, loadSite());

  step('Upload the web app');
  run('node', ['scripts/deploy.mjs', '--skip-build']);

  if (!dryRun) {
    console.log('\nChecking what is online...');
    await verifyOnline(statSync(zipPath).size);
  }

  console.log(`\nBlockCreator ${version} is ${dryRun ? 'ready to be released' : 'released'}.`);
  console.log('Still to do by hand: commit the version bump (package.json, package-lock.json,');
  console.log('src-tauri/tauri.conf.json, src-tauri/Cargo.toml, src-tauri/Cargo.lock).');
}

// Only when started directly, so the version helpers above can be imported by tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`\nRelease stopped: ${error.message}`);
    process.exitCode = 1;
  });
}
