/**
 * Update command — works on every OS:
 * - git pull (if git repo + git available)
 * - tar.gz download + extract (all Unix/macOS)
 * - zip download + extract (Windows fallback)
 */
import { Command } from 'commander';
import fs from 'fs';
import { execSync } from 'child_process';
import { getOriginUrl, isFork, getCurrentBranch, gitFetch, gitPull } from './git';
import { updateViaTarball, updateViaZip } from './archive';

const ROOT = process.cwd();

function say(msg: string) { process.stdout.write(msg + '\n'); }
function ok(msg: string) { say('✅ ' + msg); }
function warn(msg: string) { say('⚠ ' + msg); }
function fail(msg: string) { say('❌ ' + msg); process.exit(1); }

async function runUpdate() {
  const platform = process.platform; // linux/darwin/win32

  say('\n🔄 NyxMindClaw Update\n');

  // ── No git? Go straight to archive download ──────────────────────────
  if (!fs.existsSync(ROOT + '/.git')) {
    warn('Not a git repository — downloading latest release.');
    await updateViaTarball();
    return;
  }

  // ── Fork or no writable git remote? Use archive ─────────────────────
  const originUrl = getOriginUrl(ROOT);
  if (isFork(originUrl)) {
    warn('Fork detected — using archive update: ' + originUrl);
    await updateViaTarball();
    return;
  }

  // ── Try git pull ─────────────────────────────────────────────────────
  try {
    say('→ Fetching from origin...');
    gitFetch(ROOT);
    const branch = getCurrentBranch(ROOT);
    say(`→ Pulling on branch "${branch}"...`);
    gitPull(ROOT);
    ok('Updated via git pull.');
    say('\n→ Run "npm install" if dependencies changed.\n');
    return;
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : String(e);

    if (err.includes('Could not resolve host') || err.includes('unable to access')) {
      fail('Network error — cannot reach GitHub. Try: nyxmind update --offline');
    }
    if (err.includes('Authentication failed') || err.includes('could not read Username')) {
      fail('Git authentication failed — check your SSH key or git credentials.');
    }
    if (err.includes('could not find Merge base') || err.includes('fast-forward')) {
      fail('Local changes conflict with remote. Commit your changes or run: git reset --hard origin/' + getCurrentBranch(ROOT));
    }

    warn('git pull failed — falling back to archive download...');
    try {
      await updateViaTarball();
    } catch {
      await updateViaZip();
    }
  }
}

export function registerUpdateCommand(program: Command): void {
  program
    .command('update')
    .description('Update NyxMindClaw to the latest version (all OS supported)')
    .option('--branch <name>', 'branch to update from', 'main')
    .action(async (opts) => {
      try {
        if (opts.branch !== 'main') {
          await updateViaTarball(opts.branch);
        } else {
          await runUpdate();
        }
      } catch (e: unknown) {
        fail('Update failed: ' + (e instanceof Error ? e.message : String(e)));
      }
    });
}
