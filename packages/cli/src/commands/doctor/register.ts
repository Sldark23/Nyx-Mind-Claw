import { Command } from 'commander';
import {
  checkNodeVersion,
  checkNpmDeps,
  checkEnvFile,
  checkMongoDB,
  checkLlmConnection,
  checkSkillsDir,
  checkDirs,
  checkChannelTokens,
  checkGitRepo,
  checkPlatform,
  runChecks,
} from './checks';

function divider() {
  process.stdout.write('\n' + '─'.repeat(50) + '\n');
}

async function cmdDoctor() {
  divider();
  process.stdout.write('  🔍 NyxMindClaw Doctor\n');
  process.stdout.write('  Runnings diagnostics...\n');
  divider();

  const checks = [
    checkNodeVersion,
    checkNpmDeps,
    checkEnvFile,
    checkDirs,
    checkMongoDB,
    checkLlmConnection,
    checkSkillsDir,
    checkChannelTokens,
    checkGitRepo,
    checkPlatform,
  ];

  const { results, passed, warnings, failed } = await runChecks(checks);

  divider();

  for (const result of results) {
    process.stdout.write(result.message + '\n');
    divider();
  }

  process.stdout.write(
    `\n  Summary: ${passed} passed  |  ${warnings} warnings  |  ${failed} failed\n`
  );

  if (failed > 0) {
    process.stdout.write('\n  Fix the failed items above before continuing.\n');
    process.exit(1);
  }

  if (warnings > 0) {
    process.stdout.write('\n  All critical checks passed. Warnings can be ignored for now.\n');
  } else {
    process.stdout.write('\n  Everything looks good! 🎉\n');
  }
}

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Run environment health checks')
    .action(cmdDoctor);
}
