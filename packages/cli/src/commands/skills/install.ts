import { MarketplaceRegistry } from '@nyxmind/core';
import { SkillLoader } from '@nyxmind/core';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import chalk from 'chalk';

const SKILLS_DIR = process.env.SKILLS_DIR || '.agents/skills';

function fetch(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetch(res.headers.location!).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

export async function installSkill(name: string): Promise<void> {
  const marketplace = new MarketplaceRegistry();
  const entry = marketplace.get(name);

  if (!entry) {
    console.error(`${chalk.red('✗')} Skill "${name}" not found in marketplace.`);
    console.error(`${chalk.gray('Run')} nyxmind skills list ${chalk.gray('to see available skills.')}`);
    process.exit(1);
  }

  const loader = new SkillLoader(SKILLS_DIR);
  const installed = loader.loadAll();
  if (installed.some(s => s.name === name)) {
    console.log(`${chalk.yellow('⚠')} Skill "${name}" is already installed.`);
    return;
  }

  const skillDir = path.join(SKILLS_DIR, name);
  if (!fs.existsSync(SKILLS_DIR)) {
    fs.mkdirSync(SKILLS_DIR, { recursive: true });
  }
  if (!fs.existsSync(skillDir)) {
    fs.mkdirSync(skillDir, { recursive: true });
  }

  console.log(`${chalk.blue('↓')} Installing ${chalk.bold(name)}...`);

  const content = await fetch(entry.url);
  const skillPath = path.join(skillDir, 'SKILL.md');
  fs.writeFileSync(skillPath, content, 'utf-8');

  console.log(`${chalk.green('✓')} Installed "${name}" → ${skillPath}`);
}
