import { Command } from 'commander';
import { configShow, configGet, configSet } from './commands';

export function registerConfigCommand(program: Command): void {
  const cmd = program
    .command('config')
    .description('Manage nyxmind configuration');

  cmd
    .command('show')
    .description('Show all configuration keys and values')
    .action(configShow);

  cmd
    .command('get <key>')
    .description('Get a configuration value')
    .action(configGet);

  cmd
    .command('set <key> <value>')
    .description('Set a configuration value')
    .action(configSet);
}
