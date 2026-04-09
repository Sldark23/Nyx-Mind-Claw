import * as readline from 'readline/promises';
import { Command } from 'commander';
import { createControllerFromEnv } from '../../lib/controller';

export function registerReplCommand(program: Command): void {
  program
    .command('repl')
    .description('Interactive REPL — chat with the agent locally')
    .action(async () => {
      const controller = createControllerFromEnv();
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

      try {
        console.log('🧩 NyxMindClaw REPL\nDigite sua mensagem ou :exit para sair\n');

        while (true) {
          const input = await rl.question('\n👤 > ');

          if (!input.trim() || input === ':exit' || input === ':quit') {
            console.log('Tchau!');
            break;
          }

          if (input.startsWith(':')) {
            console.log('Comandos disponíveis: :exit, :quit');
            continue;
          }

          process.stdout.write('\n🤖 ');

          try {
            const { output } = await controller.handle('local-user', 'cli', input);
            console.log(output);
          } catch (error) {
            console.error('Error:', error);
          }
        }
      } finally {
        rl.close();
      }
    });
}
