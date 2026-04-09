import { MarketplaceRegistry } from '@nyxmind/core';
import { SkillLoader } from '@nyxmind/core';
import chalk from 'chalk';

export async function listSkills(): Promise<void> {
  const marketplace = new MarketplaceRegistry();
  const loader = new SkillLoader();

  const installed = loader.loadAll();
  const available = marketplace.list();

  console.log('\n📦 Skill Marketplace\n');
  console.log('Available skills:');
  for (const [name, entry] of Object.entries(available)) {
    const isInstalled = installed.some(s => s.name === name);
    const mark = isInstalled ? chalk.green('✓ installed') : chalk.dim('available');
    console.log(`  ${chalk.bold(name)} ${chalk.gray(`by ${entry.author} v${entry.version}`)} ${mark}`);
    console.log(`  ${chalk.gray('  ')}${entry.description}`);
    if (entry.triggers?.length) {
      console.log(`  ${chalk.gray('  triggers:')} ${entry.triggers.join(', ')}`);
    }
    console.log();
  }

  console.log(`\n${chalk.gray('Run')} nyxmind skills install <name> ${chalk.gray('to install a skill.')}\n`);
}
