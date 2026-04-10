/**
 * Individual health checks for `nyxmind doctor`.
 * Each check returns { ok, message, fix? }.
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { testLlmConnection } from '../../lib/llm-test';
import { ProviderConfig, getConfig, getLlmConfig } from '@nyxmind/core';

export interface CheckResult {
  ok: boolean;
  label: string;
  message: string;
  fix?: string;
}

const GREEN = '✅';
const RED = '❌';
const YELLOW = '⚠️';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const DIM = '\x1b[2m';

function pass(label: string, msg: string): CheckResult {
  return { ok: true, label, message: `${GREEN} ${label}\n   ${DIM}${msg}${RESET}`, fix: undefined };
}
function fail(label: string, msg: string, fix?: string): CheckResult {
  return { ok: false, label, message: `${RED} ${label}\n   ${msg}${fix ? '\n   ' + fix : ''}`, fix };
}
function warn(label: string, msg: string, fix?: string): CheckResult {
  return { ok: true, label, message: `${YELLOW} ${label}\n   ${msg}${fix ? '\n   ' + fix : ''}`, fix };
}

// ── 1. Node.js version ────────────────────────────────────────────────────────

export function checkNodeVersion(): CheckResult {
  const version = process.version; // e.g. "v20.11.0"
  const major = parseInt(version.slice(1), 10);
  if (major >= 18) {
    return pass('Node.js', `${version} (>= 18 required)`);
  }
  return fail('Node.js', `Version ${version} is too old. Need Node.js 18+`, 'nvm install 20');
}

// ── 2. npm dependencies ───────────────────────────────────────────────────────

export function checkNpmDeps(): CheckResult {
  try {
    execSync('npm ls --depth=0', { stdio: 'pipe', cwd: process.cwd() });
    return pass('npm deps', 'All dependencies installed');
  } catch {
    return fail(
      'npm deps',
      'Missing dependencies — npm ls failed',
      'npm install'
    );
  }
}

// ── 3. Config file (nyxmind-claw.json / .env) ─────────────────────────────────

const REQUIRED_ENV_VARS = ['LLM_PROVIDER', 'LLM_API_KEY'];

export function checkEnvFile(): CheckResult {
  // Check for nyxmind-claw.json
  const jsonPath = path.join(process.cwd(), 'nyxmind-claw.json');
  const jsonExists = fs.existsSync(jsonPath);

  const envPath = path.join(process.cwd(), '.env');
  const envExists = fs.existsSync(envPath);

  if (!jsonExists && !envExists) {
    return fail('Config', 'Neither nyxmind-claw.json nor .env found', 'cp nyxmind-claw.json.example nyxmind-claw.json  OR  cp .env.example .env');
  }

  if (jsonExists) {
    try {
      const content = fs.readFileSync(jsonPath, 'utf-8');
      const cfg = JSON.parse(content);
      const missing: string[] = [];
      if (!cfg.llm?.provider) missing.push('llm.provider');
      if (!cfg.llm?.apiKey) missing.push('llm.apiKey');
      if (missing.length > 0) {
        return fail('Config', `nyxmind-claw.json missing: ${missing.join(', ')}`, 'Edit nyxmind-claw.json and fill in the missing fields');
      }
      return pass('Config', `nyxmind-claw.json found — ${cfg.llm.provider} provider configured`);
    } catch {
      return fail('Config', 'nyxmind-claw.json is invalid JSON', 'Fix JSON syntax in nyxmind-claw.json');
    }
  }

  // Fall back to .env check
  const content = fs.readFileSync(envPath, 'utf-8');
  const missing: string[] = [];

  for (const key of REQUIRED_ENV_VARS) {
    const pattern = new RegExp(`^${key}=`, 'm');
    if (!pattern.test(content)) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    return fail('.env vars', `Missing required vars: ${missing.join(', ')}`, 'Edit .env and add the missing variables');
  }

  const lines = content.split('\n').filter(l => !l.startsWith('#') && l.includes('='));
  const total = lines.length;
  const set = lines.filter(l => l.split('=')[1]?.trim().length > 0).length;
  return pass('.env file', `${set}/${total} variables set`);
}

// ── 4. MongoDB connectivity ───────────────────────────────────────────────────

export function checkMongoDB(): CheckResult {
  const cfg = getConfig();
  const mongoUri = cfg.database?.url || process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    return warn('MongoDB', 'database.url not set in nyxmind-claw.json', 'Add database.url to nyxmind-claw.json (nyxmind onboard can help)');
  }

  try {
    execSync(
      `node -e "const {MongoClient}=require('mongodb');new MongoClient('${mongoUri}').connect().then(c=>{console.log('ok');c.close()}).catch(e=>{console.error(e.message);process.exit(1)})"`,
      { stdio: 'pipe', timeout: 8000 }
    );
    return pass('MongoDB', 'Connection successful');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return fail('MongoDB', `Connection failed: ${msg}`, 'Check database.url in nyxmind-claw.json and ensure MongoDB is running');
  }
}

// ── 5. LLM API key ────────────────────────────────────────────────────────────

export async function checkLlmConnection(): Promise<CheckResult> {
  const llmConfig = getLlmConfig();

  if (!llmConfig.provider || !llmConfig.apiKey) {
    return warn('LLM provider', 'llm.provider or llm.apiKey not set in nyxmind-claw.json', 'nyxmind onboard');
  }

  const cfg: ProviderConfig = {
    provider: llmConfig.provider,
    apiKey: llmConfig.apiKey,
    baseUrl: llmConfig.baseUrl,
    model: llmConfig.model,
  };

  const { ok, error } = await testLlmConnection(cfg);
  if (ok) return pass('LLM provider', `${llmConfig.provider} — connection OK`);
  return fail('LLM provider', `Connection failed: ${error}`, 'Check llm.apiKey in nyxmind-claw.json');
}

// ── 6. Skills directory ───────────────────────────────────────────────────────

export function checkSkillsDir(): CheckResult {
  const cfg = getConfig();
  const skillsDir = cfg.dirs.skills;
  if (!fs.existsSync(skillsDir)) {
    return warn('Skills dir', `${skillsDir} does not exist`, 'mkdir -p .agents/skills');
  }
  const files = fs.readdirSync(skillsDir).filter(f => f.endsWith('.md'));
  return pass('Skills dir', `${files.length} skill(s) found in ${skillsDir}`);
}

// ── 7. Data/tmp directories ─────────────────────────────────────────────────

export function checkDirs(): CheckResult {
  const cfg = getConfig();
  const dataDir = cfg.dirs.data;
  const tmpDir = cfg.dirs.tmp;
  const missing: string[] = [];

  if (!fs.existsSync(dataDir)) missing.push(dataDir);
  if (!fs.existsSync(tmpDir)) missing.push(tmpDir);

  if (missing.length > 0) {
    return warn('Directories', `${missing.join(', ')} missing`, `mkdir -p ${missing.join(' ')}`);
  }
  return pass('Directories', 'data and tmp directories exist');
}

// ── 8. Channel tokens ────────────────────────────────────────────────────────

export function checkChannelTokens(): CheckResult {
  const cfg = getConfig();
  const channels = cfg.channels;

  const configured: string[] = [];
  if (channels.discord?.token) configured.push('Discord');
  if (channels.telegram?.botToken) configured.push('Telegram');
  if (channels.whatsapp?.enabled) configured.push('WhatsApp');

  if (configured.length === 0) {
    return warn('Channel tokens', 'No channel configured — bot will run in CLI-only mode');
  }
  return pass('Channel tokens', `Configured: ${configured.join(', ')}`);
}

// ── 9. Git repo ───────────────────────────────────────────────────────────────

export function checkGitRepo(): CheckResult {
  const gitDir = path.join(process.cwd(), '.git');
  if (!fs.existsSync(gitDir)) {
    return warn('Git repo', 'Not a git repository — cannot use nyxmind update');
  }
  try {
    const branch = execSync('git branch --show-current', { encoding: 'utf8', stdio: 'pipe' }).trim();
    const version = execSync('git describe --tags 2>/dev/null || echo "no tags"', { encoding: 'utf8', stdio: 'pipe' }).trim();
    return pass('Git repo', `Branch: ${branch}  |  Tag: ${version}`);
  } catch {
    return pass('Git repo', 'Git directory exists but git commands failed');
  }
}

// ── 10. OS platform ─────────────────────────────────────────────────────────

export function checkPlatform(): CheckResult {
  const platform = process.platform;
  const icon = platform === 'win32' ? '🪟' : platform === 'darwin' ? '🍎' : '🐧';
  return pass('OS', `${icon} ${platform} — all features supported`);
}

// ── Run all checks ─────────────────────────────────────────────────────────────

export type CheckFn = () => CheckResult | Promise<CheckResult>;

export async function runChecks(checks: CheckFn[]): Promise<{ results: CheckResult[]; passed: number; failed: number; warnings: number }> {
  const results: CheckResult[] = [];

  for (const check of checks) {
    results.push(await check());
  }

  const passed = results.filter(r => r.ok && !r.message.includes('⚠️')).length;
  const warnings = results.filter(r => r.message.includes('⚠️')).length;
  const failed = results.filter(r => !r.ok).length;

  return { results, passed, warnings, failed };
}
