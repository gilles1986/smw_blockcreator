import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import SftpClient from 'ssh2-sftp-client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const distPath = join(projectRoot, 'dist');

// Target directory on server (overridden by deploy.config.json or DEPLOY_REMOTE_PATH)
const DEFAULT_REMOTE_PATH = process.env.DEPLOY_REMOTE_PATH || '/var/www/blockcreator/web';

function loadConfig() {
  // 1. Local deploy.config.json or config.json
  const localConfigPaths = [
    join(projectRoot, 'deploy.config.json'),
    join(projectRoot, 'config.json'),
  ];
  if (process.env.DEPLOY_CONFIG_PATH) {
    localConfigPaths.unshift(process.env.DEPLOY_CONFIG_PATH);
  }
  if (process.env.SAPHROS_WEBSITE_DIR) {
    localConfigPaths.push(join(process.env.SAPHROS_WEBSITE_DIR, 'config.json'));
  }
  for (const p of localConfigPaths) {
    if (existsSync(p)) {
      console.log(`📄 Using config from: ${p}`);
      return JSON.parse(readFileSync(p, 'utf-8'));
    }
  }

  throw new Error(
    'No SFTP config found. Please create deploy.config.json (see deploy.config.example.json).',
  );
}

function getLocalFilesAndDirs(localDir, relativePath = '') {
  const currentLocalPath = relativePath ? join(localDir, relativePath) : localDir;
  let files = [];
  let dirs = new Set();

  dirs.add(relativePath.replace(/\\/g, '/'));

  const items = readdirSync(currentLocalPath, { withFileTypes: true });
  for (const item of items) {
    const itemRelativePath = relativePath ? `${relativePath}/${item.name}` : item.name;
    const normalizedRelative = itemRelativePath.replace(/\\/g, '/');

    if (item.isDirectory()) {
      const subResult = getLocalFilesAndDirs(localDir, itemRelativePath);
      files = files.concat(subResult.files);
      for (const d of subResult.dirs) {
        dirs.add(d);
      }
    } else {
      files.push(normalizedRelative);
    }
  }
  return { files, dirs };
}

async function deploy() {
  // release.mjs has just built dist/ (the desktop build makes the same bundle), so it skips this.
  if (process.argv.includes('--skip-build')) {
    console.log('📦 Using the existing dist/ (--skip-build)');
  } else {
    console.log('📦 Building static production bundle...');
    execSync('npm run build', { cwd: projectRoot, stdio: 'inherit' });
  }

  if (!existsSync(join(distPath, 'index.html'))) {
    throw new Error(`Build failed: ${join(distPath, 'index.html')} does not exist.`);
  }

  const config = loadConfig();
  const sftpConfig = config.sftp || config;
  const remotePath = config.blockcreatorRemotePath || DEFAULT_REMOTE_PATH;

  console.log('🚀 Starting SFTP upload...');
  console.log(`📁 Local dist: ${distPath}`);
  console.log(`🌐 Remote path: ${remotePath}`);

  const sftp = new SftpClient();

  try {
    await sftp.connect({
      host: sftpConfig.host,
      port: sftpConfig.port || 22,
      username: sftpConfig.username,
      password: sftpConfig.password,
    });

    console.log('✅ Connected to SFTP server');

    const exists = await sftp.exists(remotePath);
    if (!exists) {
      console.log(`📁 Creating remote directory ${remotePath}...`);
      await sftp.mkdir(remotePath, true);
    }

    console.log('🔍 Analyzing local files...');
    const localResult = getLocalFilesAndDirs(distPath);
    console.log(
      `ℹ️ Local build has ${localResult.files.length} files in ${localResult.dirs.size} folders.`,
    );

    console.log('🔍 Checking remote file timestamps to skip unchanged files...');
    const remoteFileMap = new Map();

    for (const relativeDir of localResult.dirs) {
      const remoteDirPath = relativeDir ? `${remotePath}/${relativeDir}` : remotePath;
      try {
        const items = await sftp.list(remoteDirPath);
        for (const item of items) {
          if (item.type !== 'd') {
            const fileRelativePath = relativeDir ? `${relativeDir}/${item.name}` : item.name;
            remoteFileMap.set(fileRelativePath, {
              size: item.size,
              modifyTime: item.modifyTime,
            });
          }
        }
      } catch {
        // Remote folder might not exist yet; ignore
      }
    }

    let uploadedCount = 0;
    let skippedCount = 0;

    await sftp.uploadDir(distPath, remotePath, {
      filter: (localFilePath, isDirectory) => {
        if (isDirectory) return true;

        const rel = relative(distPath, localFilePath).replace(/\\/g, '/');
        const remoteFile = remoteFileMap.get(rel);

        if (!remoteFile) {
          uploadedCount++;
          return true;
        }

        const localStat = statSync(localFilePath);
        const isModified = localStat.size !== remoteFile.size || localStat.mtimeMs > remoteFile.modifyTime;

        if (isModified) {
          uploadedCount++;
          return true;
        } else {
          skippedCount++;
          return false;
        }
      },
    });

    console.log('\n🎉 Deploy completed successfully!');
    console.log(`📊 Uploaded/Updated: ${uploadedCount} | Unchanged (skipped): ${skippedCount}`);
    console.log(`🔗 Web URL: https://saphros.de/blockcreator/web/\n`);
  } catch (error) {
    console.error('❌ Deploy failed:', error.message);
    process.exitCode = 1;
  } finally {
    await sftp.end();
  }
}

deploy();
