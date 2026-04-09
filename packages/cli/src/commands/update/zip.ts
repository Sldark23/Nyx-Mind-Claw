import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import http from 'http';
import { execSync } from 'child_process';
import { Stream } from 'stream';

export function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const protocol = url.startsWith('https') ? https : http;

    const doDownload = (downloadUrl: string) => {
      protocol.get(downloadUrl, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            file.close(() => doDownload(redirectUrl));
            return;
          }
        }
        const s: Stream = response.pipe(file);
        s.on('finish', () => resolve());
        s.on('error', reject);
      }).on('error', (err) => {
        try { fs.unlinkSync(dest); } catch {}
        reject(err);
      });
    };

    doDownload(url);
  });
}

export async function extractZip(zipPath: string, destDir: string): Promise<void> {
  fs.mkdirSync(destDir, { recursive: true });
  if (process.platform === 'win32') {
    execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, {
      stdio: 'pipe',
    });
  } else {
    execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { stdio: 'pipe' });
  }
}

export async function updateViaZip(branch = 'main'): Promise<void> {
  const zipUrl = `https://github.com/Sldark23/Nyx-Mind-Claw/archive/refs/heads/${branch}.zip`;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nyxmind-update-'));
  const zipPath = path.join(tmpDir, 'update.zip');

  console.log('→ Downloading latest version...');
  await downloadFile(zipUrl, zipPath);

  console.log('→ Extracting...');
  const extractDir = path.join(tmpDir, 'extract');
  await extractZip(zipPath, extractDir);

  const entries = fs.readdirSync(extractDir);
  const extractedRoot = path.join(extractDir, entries[0]);

  console.log('→ Replacing files...');
  const projectRoot = process.cwd();
  const files = fs.readdirSync(extractedRoot);

  for (const file of files) {
    if (file === '.git') continue;
    const src = path.join(extractedRoot, file);
    const dest = path.join(projectRoot, file);
    fs.rmSync(dest, { recursive: true, force: true });
    fs.renameSync(src, dest);
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('✅ Update complete!');
}
