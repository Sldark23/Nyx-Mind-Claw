/**
 * Minimal tar.gz extractor using only Node.js built-ins.
 * POSIX ustar format — regular files, directories, symlinks.
 */
import { createReadStream, createWriteStream, mkdirSync, unlinkSync } from 'fs';
import { dirname } from 'path';
import { createGunzip } from 'zlib';

const BLOCK = 512;

function isAllZeros(buf: Buffer): boolean {
  for (let i = 0; i < buf.length; i++) { if (buf[i] !== 0) return false; }
  return true;
}

function nullTerm(str: Buffer): string {
  const nul = str.indexOf(0);
  return nul >= 0 ? str.slice(0, nul).toString('utf8') : str.toString('utf8');
}

function octal(str: Buffer, off: number, len: number): number {
  let v = 0;
  for (let i = off; i < off + len; i++) {
    const c = str[i];
    if (c >= 48 && c <= 55) v = v * 8 + (c - 48);
    else if (c === 0 || c === 32) break; // null or space
  }
  return v;
}

async function extractTarGz(tarballPath: string, destDir: string): Promise<void> {
  const stream = createReadStream(tarballPath);

  // Collect all decompressed data into a buffer
  const chunks: Buffer[] = [];
  for await (const chunk of stream.pipe(createGunzip())) {
    chunks.push(chunk);
  }
  const data = Buffer.concat(chunks);

  let pos = 0;

  while (pos + BLOCK <= data.length) {
    // Two null blocks = end of archive
    if (isAllZeros(data.slice(pos, pos + BLOCK))) {
      const next = pos + BLOCK;
      if (next + BLOCK <= data.length && isAllZeros(data.slice(next, next + BLOCK))) break;
    }

    const header = data.slice(pos, pos + BLOCK);
    pos += BLOCK;

    const name = nullTerm(header.slice(0, 100));
    const mode = octal(header, 100, 8);
    const size = octal(header, 124, 12);
    const typeChar = header[156];

    if (!name || name === '') break;

    const filePath = destDir + '/' + name.replace(/^\.\//, '');

    if (typeChar === 53) {
      // directory
      mkdirSync(filePath, { recursive: true, mode: mode || 0o755 });
    } else if (typeChar === 48 || typeChar === 0) {
      // regular file
      mkdirSync(dirname(filePath), { recursive: true });
      const contentSize = Math.ceil(size / BLOCK) * BLOCK;
      const content = data.slice(pos, pos + contentSize).slice(0, size);
      pos += contentSize;
      const ws = createWriteStream(filePath, { mode: mode || 0o644 });
      ws.write(content);
      ws.end();
    } else if (typeChar === 50) {
      // symlink
      const linkName = nullTerm(header.slice(157, 257));
      try { unlinkSync(filePath); } catch {}
      try { mkdirSync(dirname(filePath), { recursive: true }); } catch {}
      // skip symlinks during update
    } else {
      // unknown type — skip content
      pos += Math.ceil(size / BLOCK) * BLOCK;
    }
  }
}

export { extractTarGz };
