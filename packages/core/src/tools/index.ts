import { exec } from 'child_process';
import fs from 'fs/promises';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { ToolDefinition } from './types';
import { BLOCKED_COMMANDS } from './blocked';

export { ToolDefinition } from './types';

export class ToolRegistry {

  getDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'shell',
        description: 'Execute a shell command on the local system. Returns stdout/stderr.',
        input_schema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'The shell command to execute' },
          },
          required: ['command'],
        },
      },
      {
        name: 'read_file',
        description: 'Read the contents of a file from the local filesystem.',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Absolute or relative path to the file' },
          },
          required: ['path'],
        },
      },
      {
        name: 'write_file',
        description: 'Write content to a file. Creates or overwrites the file.',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to the file' },
            content: { type: 'string', description: 'Content to write' },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'web_search',
        description: 'Search the web using DuckDuckGo. Returns top 5 results with titles and URLs.',
        input_schema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'The search query' },
          },
          required: ['query'],
        },
      },
      {
        name: 'web_fetch',
        description: 'Fetch and parse a web page, returning its text content (first 20k chars).',
        input_schema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'The URL to fetch' },
          },
          required: ['url'],
        },
      },
    ];
  }

  buildSystemPrompt(): string {
    const defs = this.getDefinitions();
    return `You have access to the following tools. Use them by outputting JSON with "tool" and "args":\n\n${defs.map(d => `## ${d.name}\n${d.description}\nInput: ${JSON.stringify(d.input_schema)}`).join('\n\n')}`;
  }

  async shell(command: string): Promise<string> {
    if (BLOCKED_COMMANDS.some(b => command.toLowerCase().includes(b))) {
      return `Blocked command detected: ${command}`;
    }
    return new Promise<string>((resolve, reject) => {
      exec(command, { timeout: 30000 }, (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        resolve(stdout || '');
      });
    });
  }

  async readFile(path: string): Promise<string> {
    const content = await fs.readFile(path, 'utf-8');
    return content.slice(0, 50000);
  }

  async writeFile(path: string, content: string): Promise<string> {
    await fs.writeFile(path, content, 'utf-8');
    return 'ok';
  }

  async searchWeb(query: string): Promise<string> {
    try {
      const res = await axios.post(
        'https://html.duckduckgo.com/html/',
        new URLSearchParams({ q: query }),
        { timeout: 10000 }
      );
      const $ = cheerio.load(res.data);
      const results: string[] = [];
      $('.result').slice(0, 5).each((_, el) => {
        const title = $(el).find('.result__title').text().trim();
        const link = $(el).find('.result__url').text().trim();
        if (title && link) results.push(`${title} — ${link}`);
      });
      return results.join('\n') || 'No results found.';
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return `Search failed: ${message}`;
    }
  }

  async fetchUrl(url: string): Promise<string> {
    try {
      const res = await axios.get(url, { timeout: 15000 });
      const $ = cheerio.load(res.data);
      return $('body').text().replace(/\s+/g, ' ').slice(0, 20000);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return `Fetch failed: ${message}`;
    }
  }
}
