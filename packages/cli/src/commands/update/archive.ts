/**
 * Update via downloaded archive.
 * Primary: tar.gz (works everywhere via built-in zlib)
 * Fallback: zip (Windows without git)
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import http from 'http';
import { createWriteStream } from 'fs';
import { execSync } from 'child_process';

const OWNER = 'Sldark23';
const REPO = 'Nyx-Mind-Claw';

async function download(url: string, dest: string): Promise<void> {
  const protocol = url.startsWith('https') ? https : http;
  const file = createWriteStream(dest);

  await new Promise<void>((resolve, reject) => {
    protocol.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        const loc = res.headers.location;
        if (loc) { file.close(); download(loc, dest).then(resolve).catch(reject); return; }
      }
      res.pipe(file);
      file.on('finish', () => resolve());
      res.on('error', reject);
    }).on('error', (err) => {
      try { file.destroy(); } catch {}
      reject(err);
    });
  });
}

function isCommandAvailable(cmd: string): boolean {
  try { execSync(`which ${cmd}`, { stdio: 'pipe' }); return true; } catch { return false; }
}

async function updateViaTarball(branch = 'main'): Promise<void> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nyxmind-'));
  const tarball = path.join(tmpDir, 'update.tar.gz');

  console.log('→ Downloading latest version...');
  await download(
    `https://github.com/${OWNER}/${REPO}/archive/refs/heads/${branch}.tar.gz`,
    tarball
  );

  console.log('→ Extracting...');
  const extractDir = path.join(tmpDir, 'extract');
  fs.mkdirSync(extractDir, { recursive: true });

  const { extractTarGz } = await import('./tar');
  await extractTarGz(tarball, extractDir);

  const entries = fs.readdirSync(extractDir);
  if (!entries.length) throw new Error('Empty archive');
  const src = path.join(extractDir, entries[0]);

  console.log('→ Replacing files...');
  const root = process.cwd();
  for (const file of fs.readdirSync(src)) {
    if (file === '.git') continue;
    const s = path.join(src, file);
    const d = path.join(root, file);
    fs.rmSync(d, { recursive: true, force: true });
    fs.renameSync(s, d);
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('✅ Update complete!');
}

async function updateViaZip(branch = 'main'): Promise<void> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nyxmind-'));
  const zipPath = path.join(tmpDir, 'update.zip');

  console.log('→ Downloading latest version (ZIP)...');
  await download(`https://github.com/${OWNER}/${REPO}/archive/refs/heads/${branch}.zip`, zipPath);

  console.log('→ Extracting...');
  const extractDir = path.join(tmpDir, 'extract');
  fs.mkdirSync(extractDir, { recursive: true });

  if (process.platform === 'win32') {
    execSync(
      `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force"`,
      { stdio: 'pipe' }
    );
  } else if (isCommandAvailable('unzip')) {
    execSync(`unzip -o "${zipPath}" -d "${extractDir}"`, { stdio: 'pipe' });
  } else {
    throw new Error('No extraction tool available. Install unzip or use git update.');
  }

  const entries = fs.readdirSync(extractDir);
  const src = path.join(extractDir, entries[0]);

  console.log('→ Replacing files...');
  const root = process.cwd();
  for (const file of fs.readdirSync(src)) {
    if (file === '.git') continue;
    const s = path.join(src, file);
    const d = path.join(root, file);
    fs.rmSync(d, { recursive: true, force: true });
    fs.renameSync(s, d);
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('✅ Update complete!');
}

export { updateViaTarball, updateViaZip };
