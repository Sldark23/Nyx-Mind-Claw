import { Command } from 'commander';
import * as fs from 'fs';
import { ENV_TEMPLATE } from '../../lib/env-template';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Create .env template')
    .action(() => {
      if (fs.existsSync('.env')) {
        console.log('⚠️  .env already exists');
        return;
      }

      fs.writeFileSync('.env', ENV_TEMPLATE);
      console.log('✅ .env created');
    });
}
