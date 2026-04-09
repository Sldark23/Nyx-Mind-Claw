import { Command } from 'commander';
import { listSkills } from './list';
import { installSkill } from './install';

export function registerSkillsCommand(program: Command): void {
  const cmd = program
    .command('skills')
    .description('Manage skills — list, install, remove');

  cmd
    .command('list')
    .description('List available and installed skills')
    .action(listSkills);

  cmd
    .command('install <name>')
    .description('Install a skill from the marketplace')
    .action(async (name: string) => {
      try {
        await installSkill(name);
      } catch (err) {
        console.error(`${'✗'} Failed to install skill:`, err instanceof Error ? err.message : err);
        process.exit(1);
      }
    });
}
