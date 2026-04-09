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
    if (fs.existsSync(this.envPath)) {
      const raw = dotenv.parse(fs.readFileSync(this.envPath, 'utf-8'));
      this.values = { ...raw };
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
