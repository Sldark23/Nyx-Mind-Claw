/**
 * ConfigManager — read/write nyxmind config.
 *
 * Reads from .env file (via dotenv) and environment variables.
 * nyxmind config get <key> — show a value
 * nyxmind config set <key> <value> — write to .env
 * nyxmind config show — display all config with sources
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

export class ConfigManager {
  private envPath: string;
  private values: Record<string, string> = {};

  constructor(envPath = '.env') {
    this.envPath = envPath;
    this.load();
  }

  private load(): void {
    const result = dotenv.config({ path: this.envPath });
    if (result.parsed) {
      this.values = { ...result.parsed };
    }
    // env vars override .env file
    for (const key of Object.keys(process.env)) {
      if (process.env[key]) {
        this.values[key] = process.env[key]!;
      }
    }
  }

  get(key: string): string | undefined {
    return this.values[key];
  }

  set(key: string, value: string): void {
    this.values[key] = value;
    this.save();
  }

  delete(key: string): void {
    delete this.values[key];
    this.save();
  }

  all(): Record<string, string> {
    return { ...this.values };
  }

  private save(): void {
    const lines = Object.entries(this.values)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${k}=${v}`);
    fs.writeFileSync(this.envPath, lines.join('\n') + '\n', 'utf-8');
  }

  static comment = `# nyxmind config — edit with: nyxmind config set <key> <value>
`;
}

// ── Approval state ─────────────────────────────────────────────────────────

export interface ApprovalState {
  pendingTools: string[];
  approvedTools: string[];
}

function findDataDir(): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, 'data');
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function approvalStatePath(): string {
  return path.join(findDataDir(), 'approval-state.json');
}

const DEFAULT_APPROVAL_STATE: ApprovalState = {
  pendingTools: [],
  approvedTools: [],
};

export class ApprovalManager {
  private state: ApprovalState;

  constructor() {
    this.state = this.load();
  }

  private load(): ApprovalState {
    const filePath = approvalStatePath();
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<ApprovalState>;
        return {
          pendingTools: parsed.pendingTools ?? [],
          approvedTools: parsed.approvedTools ?? [],
        };
      } catch {
        return { ...DEFAULT_APPROVAL_STATE };
      }
    }
    return { ...DEFAULT_APPROVAL_STATE };
  }

  private save(): void {
    const filePath = approvalStatePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(this.state, null, 2), 'utf-8');
  }

  getState(): ApprovalState {
    return { ...this.state };
  }

  isApproved(toolName: string): boolean {
    return this.state.approvedTools.includes(toolName);
  }

  isPending(toolName: string): boolean {
    return this.state.pendingTools.includes(toolName);
  }

  addPending(toolName: string): void {
    if (!this.state.pendingTools.includes(toolName)) {
      this.state.pendingTools.push(toolName);
      this.save();
    }
  }

  approve(toolName: string): boolean {
    const idx = this.state.pendingTools.indexOf(toolName);
    if (idx === -1) return false;
    this.state.pendingTools.splice(idx, 1);
    if (!this.state.approvedTools.includes(toolName)) {
      this.state.approvedTools.push(toolName);
    }
    this.save();
    return true;
  }

  revoke(toolName: string): void {
    this.state.pendingTools = this.state.pendingTools.filter(t => t !== toolName);
    this.state.approvedTools = this.state.approvedTools.filter(t => t !== toolName);
    this.save();
  }

  clearPending(): void {
    this.state.pendingTools = [];
    this.save();
  }
}
