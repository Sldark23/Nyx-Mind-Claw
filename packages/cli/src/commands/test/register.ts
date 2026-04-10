import { Command } from 'commander';
import { TestRunner, printTestResults } from '@nyxmind/core/testing';

export function registerTestCommand(program: Command): void {
  program
    .command('test [skill-name]')
    .description('Run SKILL.md-based tests for a skill or all skills')
    .option('-a, --all', 'Run tests for all skills', false)
    .action(async (skillName?: string, options?: { all?: boolean }) => {
      const runner = new TestRunner();

      if (!skillName && !options?.all) {
        console.log('Available skills:');
        const skills = runner.listSkills();
        if (skills.length === 0) {
          console.log('  (no skills found)');
        } else {
          skills.forEach(s => console.log(`  - ${s}`));
        }
        console.log('\nRun: nyxmind test <skill-name>  or  nyxmind test --all');
        return;
      }

      if (options?.all) {
        // Run all skills
        const skills = runner.listSkills();
        if (skills.length === 0) {
          console.log('No skills found.');
          return;
        }

        console.log(`Running tests for ${skills.length} skill(s)...`);
        let totalPassed = 0;
        let totalFailed = 0;

        for (const name of skills) {
          const result = await runner.runSkillTests(name);
          printTestResults(result);
          totalPassed += result.passed;
          totalFailed += result.failed;
        }

        console.log(`\n=== TOTAL: ${totalPassed} passed, ${totalFailed} failed ===`);
        if (totalFailed > 0) process.exit(1);
      } else if (skillName) {
        // Run single skill
        const result = await runner.runSkillTests(skillName);
        printTestResults(result);
        if (result.failed > 0) process.exit(1);
      }
    });
}
