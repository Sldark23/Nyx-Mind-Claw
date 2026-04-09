import { Command } from 'commander';
import { getOriginUrl, isFork, getCurrentBranch, gitFetch, gitPull } from './git';
import { updateViaZip } from './zip';

const PROJECT_ROOT = process.cwd();

function c(msg: string) {
  process.stdout.write(msg + '\n');
}

function info(msg: string) { c('  ' + msg); }
function warn(msg: string) { c('⚠ ' + msg); }
function ok(msg: string) { c('✅ ' + msg); }
function fail(msg: string) { c('❌ ' + msg); }

async function cmdUpdate(_args: unknown) {
  const isWin32 = process.platform === 'win32';

  c('\n🔄 NyxMindClaw Update\n');

  // Check git
  const gitDir = PROJECT_ROOT + '/.git';
  if (!require('fs').existsSync(gitDir)) {
    if (isWin32) {
      await updateViaZip();
      return;
    }
    fail('Not a git repository. Please reinstall.');
    c('  curl -fsSL https://raw.githubusercontent.com/Sldark23/Nyx-Mind-Claw/main/scripts/install.sh | bash');
    process.exit(1);
  }

  // Fork detection
  const originUrl = getOriginUrl(PROJECT_ROOT);
  const fork = isFork(originUrl);
  if (fork) {
    warn('Updating from fork: ' + originUrl);
    c('');
  }

  // Windows: configure git workaround
  if (isWin32) {
    require('child_process').execSync(
      'git -c windows.appendAtomically=false config windows.appendAtomically false',
      { cwd: PROJECT_ROOT }
    );
  }

  // Fetch
  try {
    c('→ Fetching updates...');
    gitFetch(PROJECT_ROOT, { win32: isWin32 });
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : String(e);
    if (err.includes('Could not resolve host') || err.includes('unable to access')) {
      fail('Network error — cannot reach the remote repository.');
      process.exit(1);
    }
    if (err.includes('Authentication failed') || err.includes('could not read Username')) {
      fail('Authentication failed — check your git credentials or SSH key.');
      process.exit(1);
    }
    fail('Failed to fetch updates from origin.');
    process.exit(1);
  }

  // Pull
  const branch = getCurrentBranch(PROJECT_ROOT);
  try {
    c(`→ Pulling on branch "${branch}"...`);
    gitPull(PROJECT_ROOT, { win32: isWin32 });
    ok('NyxMindClaw updated successfully!');
    c('\n→ Run "npm install" if dependencies changed.\n');
  } catch {
    warn('git pull failed. Trying ZIP update...');
    await updateViaZip();
  }
}

export function registerUpdateCommand(program: Command): void {
  program
    .command('update')
    .description('Update NyxMindClaw to the latest version')
    .action(cmdUpdate);
}
