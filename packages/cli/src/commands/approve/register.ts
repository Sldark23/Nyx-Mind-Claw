import { Command } from 'commander';
import { approveTool, listPendingTools } from './index';

export function registerApproveCommand(program: Command): void {
  const cmd = program
    .command('approve')
    .description('Manage tool approval gates');

  cmd
    .command('list')
    .description('List pending and approved tools')
    .action(listPendingTools);

  // nyxmind approve <tool> — approve a specific pending tool
  cmd
    .argument('<tool>', 'Name of the tool to approve')
    .description('Approve a pending tool by name')
    .action(approveTool);
}
