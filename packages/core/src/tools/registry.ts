import { exec } from 'child_process';
import fs from 'fs/promises';
import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, any>;
}

const BLOCKED_COMMANDS = ['rm -rf', 'shutdown', 'reboot', 'mkfs', 'dd', ':(){ :|:& };:'];

const BUILT_IN_TOOLS: Array<{ name: string; fn: (args: Record<string, unknown>) => Promise<string> }> = [];

export class ToolRegistry {
  private tools = new Map<string, (args: Record<string, unknown>) => Promise<string>>();

  constructor() {
    this.registerBuiltin();
  }

  private registerBuiltin(): void {
    this.tools.set('shell', async ({ command }) => {
      if (BLOCKED_COMMANDS.some(b => String(command).toLowerCase().includes(b))) {
        return `Blocked command detected: ${command}`;
      }
      return new Promise<string>((resolve, reject) => {
        exec(String(command), { timeout: 30000 }, (err, stdout, stderr) => {
          if (err) return reject(new Error(stderr || err.message));
          resolve(stdout || '');
        });
      });
    });

    this.tools.set('read_file', async ({ path }) => {
      const content = await fs.readFile(String(path), 'utf-8');
      return content.slice(0, 50000);
    });

    this.tools.set('write_file', async ({ path, content }) => {
      await fs.writeFile(String(path), String(content), 'utf-8');
      return 'ok';
    });

    this.tools.set('web_search', async ({ query }) => {
      try {
        const res = await axios.post(
          'https://html.duckduckgo.com/html/',
          new URLSearchParams({ q: String(query) }),
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
      } catch (err: any) {
        return `Search failed: ${err.message}`;
      }
    });

    this.tools.set('web_fetch', async ({ url }) => {
      try {
        const res = await axios.get(String(url), { timeout: 15000 });
        const $ = cheerio.load(res.data);
        return $('body').text().replace(/\s+/g, ' ').slice(0, 20000);
      } catch (err: any) {
        return `Fetch failed: ${err.message}`;
      }
    });
  }

  register(name: string, fn: (args: Record<string, unknown>) => Promise<string>): void {
    this.tools.set(name, fn);
  }

  getDefinitions(): ToolDefinition[] {
    const defs: Record<string, ToolDefinition> = {
      shell: {
        name: 'shell',
        description: 'Execute a shell command on the local system. Returns stdout/stderr.',
        input_schema: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
      },
      read_file: {
        name: 'read_file',
        description: 'Read the contents of a file from the local filesystem.',
        input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
      },
      write_file: {
        name: 'write_file',
        description: 'Write content to a file. Creates or overwrites.',
        input_schema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] },
      },
      web_search: {
        name: 'web_search',
        description: 'Search the web using DuckDuckGo. Returns top 5 results.',
        input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      },
      web_fetch: {
        name: 'web_fetch',
        description: 'Fetch and parse a web page, returning its text content (first 20k chars).',
        input_schema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
      },
    };

    return [...this.tools.keys()]
      .filter(name => defs[name])
      .map(name => defs[name]);
  }

  buildSystemPrompt(): string {
    const defs = this.getDefinitions();
    return `You have access to the following tools. Use them by outputting JSON with "tool" and "args":\n\n${defs.map(d => `## ${d.name}\n${d.description}\nInput: ${JSON.stringify(d.input_schema)}`).join('\n\n')}`;
  }

  async execute(toolName: string, args: Record<string, unknown>): Promise<string> {
    const fn = this.tools.get(toolName);
    if (!fn) throw new Error(`Unknown tool: ${toolName}`);
    return fn(args);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Return a new registry containing only the specified tool names.
   */
  filter(names: string[]): ToolRegistry {
    const allowed = new Set(names);
    const filtered = new ToolRegistry();
    for (const [name, fn] of this.tools) {
      if (allowed.has(name)) filtered.tools.set(name, fn);
    }
    return filtered;
  }
}
