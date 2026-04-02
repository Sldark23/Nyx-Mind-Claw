import { exec } from 'child_process';
import fs from 'fs/promises';
import axios from 'axios';
import * as cheerio from 'cheerio';

export class ToolRegistry {
  async shell(command: string) {
    const blocked = ['rm -rf', 'shutdown', 'reboot', 'mkfs', 'dd'];
    if (blocked.some(b => command.toLowerCase().includes(b))) {
      return `Blocked command: ${command}`;
    }
    return new Promise<string>((resolve, reject) => {
      exec(command, { timeout: 30000 }, (err, stdout, stderr) => {
        if (err) return reject(stderr || err.message);
        resolve(stdout || '');
      });
    });
  }

  async readFile(path: string) {
    return fs.readFile(path, 'utf-8');
  }

  async writeFile(path: string, content: string) {
    await fs.writeFile(path, content, 'utf-8');
    return 'ok';
  }

  async searchWeb(query: string) {
    const res = await axios.post('https://html.duckduckgo.com/html/', new URLSearchParams({ q: query }));
    const $ = cheerio.load(res.data);
    const results: string[] = [];
    $('.result').slice(0, 5).each((_, el) => {
      const title = $(el).find('.result__title').text().trim();
      const link = $(el).find('.result__url').text().trim();
      if (title && link) results.push(`${title} - ${link}`);
    });
    return results.join('\n') || 'No results';
  }

  async fetchUrl(url: string) {
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);
    return $('body').text().slice(0, 20000);
  }
}
