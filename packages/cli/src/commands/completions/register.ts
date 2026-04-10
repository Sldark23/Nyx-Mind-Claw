import { Command } from 'commander';
import * as fs from 'fs';
import { installCompletion, Shell, getCompletionPath } from './shell';

const SUPPORTED_SHELLS: Shell[] = ['bash', 'zsh', 'fish', 'powershell'];

function printInstallHelp(shell: Shell) {
  const { path } = installCompletion(shell);
  switch (shell) {
    case 'bash':
      console.log(`  # Add to ~/.bashrc or ~/.bash_profile:`);
      console.log(`  source ${path}`);
      break;
    case 'zsh':
      console.log(`  # Already installed to ${path}`);
      console.log(`  # If not loaded, add to ~/.zshrc:`);
      console.log(`  fpath+=(~/.zsh/completions)`);
      break;
    case 'fish':
      console.log(`  # Already installed to ${path}`);
      console.log(`  # Fish loads completions automatically from ~/.config/fish/completions/`);
      break;
    case 'powershell':
      console.log(`  # Add to your PowerShell profile (~/.config/powershell/Microsoft.PowerShell_profile.ps1):`);
      console.log(`  . ${path}`);
      break;
  }
}

export function registerCompletionsCommand(program: Command): void {
  const cmd = program
    .command('completions')
    .description('Generate and install shell completions for bash, zsh, fish, or powershell');

  // nyxmind completions (generate script to stdout or file)
  cmd
    .command('generate <shell>')
    .description(`Generate completion script for a shell: ${SUPPORTED_SHELLS.join(', ')}`)
    .option('-o, --output <file>', 'Write to file instead of stdout')
    .action((shell: string, opts: { output?: string }) => {
      const s = shell.toLowerCase() as Shell;
      if (!SUPPORTED_SHELLS.includes(s)) {
        console.error(`Unsupported shell: ${shell}`);
        console.error(`Supported: ${SUPPORTED_SHELLS.join(', ')}`);
        process.exit(1);
      }

      const { content } = installCompletion(s);

      if (opts.output) {
        fs.writeFileSync(opts.output, content, { mode: 0o755 });
        console.log(`✅ Written to ${opts.output}`);
      } else {
        console.log(content);
      }
    });

  // nyxmind completions install (interactive install)
  cmd
    .command('install [shell]')
    .description(`Install completions for a shell (interactive if none specified)`)
    .action((shell?: string) => {
      if (!shell) {
        // Interactive selection
        console.log('Select a shell:');
        SUPPORTED_SHELLS.forEach((s, i) => console.log(`  ${i + 1}) ${s}`));
        console.log();
        const readline = require('readline/promises');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question('Shell number: ').then((answer: string) => {
          const idx = Math.max(0, Math.min(SUPPORTED_SHELLS.length - 1, parseInt(answer, 10) || 1) - 1);
          const selected = SUPPORTED_SHELLS[idx];
          installForShell(selected);
          rl.close();
        });
        return;
      }

      const s = shell.toLowerCase() as Shell;
      if (!SUPPORTED_SHELLS.includes(s)) {
        console.error(`Unsupported shell: ${shell}`);
        process.exit(1);
      }
      installForShell(s);
    });

  // nyxmind completions list
  cmd
    .command('list')
    .description('List supported shells and their install paths')
    .action(() => {
      console.log('Supported shells:');
      SUPPORTED_SHELLS.forEach(s => {
        const { path } = installCompletion(s);
        console.log(`  ${s.padEnd(12)} → ${path}`);
      });
    });
}

function installForShell(shell: Shell) {
  const { path, content } = installCompletion(shell);
  fs.writeFileSync(path, content, { mode: 0o644 });
  console.log(`✅ Installed ${shell} completions to ${path}`);
  console.log();
  printInstallHelp(shell);
}
