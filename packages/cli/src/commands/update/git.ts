import { execSync } from 'child_process';
import path from 'path';

export interface GitRemoteInfo {
  url: string;
  isFork: boolean;
  branch: string;
}

export function getOriginUrl(cwd: string): string {
  try {
    return execSync('git remote get-url origin', { cwd, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

export function isFork(originUrl: string): boolean {
  if (!originUrl) return false;
  return (
    originUrl.includes('Sldark23/Nyx-Mind-Claw') ||
    originUrl.includes('github.com/NousResearch/Nyx-Mind-Claw')
  ) === false && originUrl.includes('github.com');
}

export function getCurrentBranch(cwd: string): string {
  try {
    const branch = execSync('git branch --show-current', { cwd, encoding: 'utf8' }).trim();
    return branch || 'HEAD';
  } catch {
    return 'HEAD';
  }
}

export function gitFetch(cwd: string, options: { win32?: boolean } = {}): void {
  const gitCmd = options.win32 ? ['git', '-c', 'windows.appendAtomically=false'] : ['git'];
  execSync([...gitCmd, 'fetch', 'origin'].join(' '), { cwd, stdio: 'pipe' });
}

export function gitPull(cwd: string, options: { win32?: boolean } = {}): void {
  const gitCmd = options.win32 ? ['git', '-c', 'windows.appendAtomically=false'] : ['git'];
  const branch = getCurrentBranch(cwd);
  execSync([...gitCmd, 'pull', '--ff-only', 'origin', branch].join(' '), { cwd, stdio: 'pipe' });
}

export function getGitRoot(cwd: string): string {
  try {
    return execSync('git rev-parse --show-toplevel', { cwd, encoding: 'utf8' }).trim();
  } catch {
    return cwd;
  }
}
