import chalk from 'chalk';
import { ApprovalManager } from '@nyxmind/core';

export async function approveTool(toolName: string): Promise<void> {
  const manager = new ApprovalManager();

  if (!manager.isPending(toolName)) {
    console.log(`${chalk.yellow('⚠')} Tool "${chalk.bold(toolName)}" is not pending approval.`);
    const state = manager.getState();
    if (state.pendingTools.length > 0) {
      console.log(`\n  Pending tools: ${state.pendingTools.map(t => chalk.bold(t)).join(', ')}`);
    } else {
      console.log(`\n  No tools are currently pending approval.`);
    }
    return;
  }

  const approved = manager.approve(toolName);
  if (approved) {
    console.log(`${chalk.green('✓')} Tool "${chalk.bold(toolName)}" approved.`);
  } else {
    console.log(`${chalk.red('✗')} Failed to approve tool "${chalk.bold(toolName)}".`);
  }
}

export async function listPendingTools(): Promise<void> {
  const manager = new ApprovalManager();
  const state = manager.getState();

  if (state.pendingTools.length === 0) {
    console.log(`\n${chalk.gray('No tools are currently pending approval.')}\n`);
    return;
  }

  console.log(`\n${chalk.bold('Pending approval:')}`);
  for (const tool of state.pendingTools) {
    console.log(`  ${chalk.yellow('○')} ${tool}`);
  }
  console.log();

  if (state.approvedTools.length > 0) {
    console.log(`${chalk.bold('Approved:')}`);
    for (const tool of state.approvedTools) {
      console.log(`  ${chalk.green('✓')} ${tool}`);
    }
    console.log();
  }
}
