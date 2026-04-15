/**
 * Browser Use — MCP server wrapper for NyxMindClaw.
 *
 * Exposes browser-use as an optional MCP server for advanced browser automation.
 * Disabled by default — enable via config or CLI flag.
 *
 * Usage:
 *   nyxmind run --browser-use     # enable browser automation
 *   export NYXMIND_BROWSER_USE=1  # or via env
 *
 * When enabled, the agent can:
 *   - Navigate to URLs
 *   - Click elements
 *   - Fill forms
 *   - Extract content from JavaScript-rendered pages
 */
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getConfig } from '../config';

export interface BrowserUseConfig {
  enabled: boolean;
  chromePath?: string;
  headless?: boolean;
  viewport?: { width: number; height: number };
  MCP_PORT?: number;
}

const DEFAULT_CONFIG: BrowserUseConfig = {
  enabled: false,
  headless: true,
  viewport: { width: 1280, height: 720 },
  MCP_PORT: 3100,
};

export class BrowserUseServer {
  private process: ChildProcess | null = null;
  private config: BrowserUseConfig;
  private mcpPort: number;

  constructor(config?: Partial<BrowserUseConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.mcpPort = this.config.MCP_PORT ?? DEFAULT_CONFIG.MCP_PORT!;
  }

  isEnabled(): boolean {
    return this.config.enabled || process.env.NYXMIND_BROWSER_USE === '1';
  }

  getMCPUrl(): string {
    return `http://localhost:${this.mcpPort}/mcp`;
  }

  /**
   * Start the browser-use MCP server.
   * Returns the MCP URL once ready.
   */
  async start(): Promise<string> {
    if (!this.isEnabled()) {
      throw new Error('BrowserUse is not enabled. Set NYXMIND_BROWSER_USE=1 or pass --browser-use');
    }

    if (this.process) {
      return this.getMCPUrl();
    }

    // Check if browser-use is installed
    try {
      require('browser-use');
    } catch {
      console.warn('[BrowserUse] browser-use package not found. Run: pip install browser-use');
      console.warn('[BrowserUse] Or: npm install -g browser-use');
      throw new Error('browser-use not installed');
    }

    // Create a simple MCP wrapper script
    const scriptPath = path.join(process.cwd(), 'data', 'browser-use-mcp.js');
    const scriptDir = path.dirname(scriptPath);
    if (!fs.existsSync(scriptDir)) {
      fs.mkdirSync(scriptDir, { recursive: true });
    }

    const mcpScript = this.buildMCPScript();
    fs.writeFileSync(scriptPath, mcpScript, 'utf-8');

    // Start the MCP server
    this.process = spawn('node', [scriptPath], {
      stdio: 'pipe',
      env: {
        ...process.env,
        BROWSER_HEADLESS: this.config.headless ? '1' : '0',
        CHROME_PATH: this.config.chromePath ?? '',
      },
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      const line = data.toString().trim();
      if (line.includes('ready') || line.includes('listening')) {
        console.log('[BrowserUse] MCP server ready');
      }
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      console.warn('[BrowserUse]', data.toString().trim());
    });

    // Wait for server to be ready
    await this.waitForServer(5000);

    return this.getMCPUrl();
  }

  private buildMCPScript(): string {
    return `
// Browser-use MCP server wrapper
const { spawn } = require('child_process');
const http = require('http');

const PORT = ${this.mcpPort};
const HEADLESS = process.env.BROWSER_HEADLESS === '1';

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', browser: 'browser-use' }));
    return;
  }

  if (req.method === 'POST' && req.url === '/mcp') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON: ' + err.message }));
        return;
      }
      const { action, params } = parsed;

        // Import browser-use dynamically
        const { chromium } = require('browser-use');

        const browser = await chromium.launch({ headless: HEADLESS });
        const page = await browser.newPage();

        let result;
        try {
          switch (action) {
            case 'navigate': {
              let navResult;
              try {
                await page.goto(params.url, { waitUntil: 'networkidle2', timeout: 15000 });
                navResult = { url: page.url(), title: await page.title() };
              } catch (navErr) {
                const errMsg = navErr instanceof Error ? navErr.message : String(navErr);
                navResult = { error: 'Navigation failed: ' + errMsg };
              }
              result = navResult;
              break;
            }

            case 'click':
              await page.click(params.selector);
              result = { success: true };
              break;

            case 'fill':
              await page.fill(params.selector, params.value);
              result = { success: true };
              break;

            case 'extract':
              const content = await page.textContent(params.selector || 'body');
              result = { content };
              break;

            case 'screenshot':
              const screenshot = await page.screenshot({ encoding: 'base64' });
              result = { screenshot };
              break;

            default:
              result = { error: 'Unknown action' };
          }
        } catch (actionErr) {
          result = { error: actionErr.message };
        }

        try {
          await browser.close();
        } catch {
          // ignore close errors
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log('browser-use MCP server ready on port ' + PORT);
});
`;
  }

  private async waitForServer(timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`http://localhost:${this.mcpPort}/health`);
        if (res.ok) return;
      } catch {
        await new Promise(r => setTimeout(r, 200));
      }
    }
    throw new Error('BrowserUse MCP server failed to start');
  }

  stop(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}

/**
 * Load browser-use config from main config.
 */
export function loadBrowserUseConfig(): Partial<BrowserUseConfig> {
  try {
    const cfg = getConfig();
    // Look for plugins.browserUse or tools.web.browserUse
    const browserConfig = (cfg as any).plugins?.browserUse ?? (cfg as any).tools?.web?.browserUse;
    return browserConfig ?? {};
  } catch {
    return {};
  }
}