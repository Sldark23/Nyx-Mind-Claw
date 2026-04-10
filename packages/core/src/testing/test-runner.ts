import fs from 'fs';
import path from 'path';
import { SkillMeta } from '../skills/loader/types';
import { SkillExecutor } from '../skills/executor';
import { AgentLoop } from '../agent/agent-loop';
import { ProviderFactory } from '../llm';
import { ToolRegistry } from '../tools';

export interface TestCase {
  input: string;
  expected: string;
}

export interface TestResult {
  name: string;
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
  error?: string;
}

export interface TestSuiteResult {
  skillName: string;
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}

/**
 * Parses ```test: { input: '...', expected: '...' }``` blocks from SKILL.md content.
 */
function parseTestBlocks(content: string): TestCase[] {
  const tests: TestCase[] = [];
  // Match markdown code blocks containing "test:" YAML/object
  const blockRegex = /```(?:test|yaml)?\s*\n([\s\S]*?)\n```/g;
  let match;

  while ((match = blockRegex.exec(content)) !== null) {
    const block = match[1];
    // Look for input/expected patterns
    const inputMatch = /input:\s*['"]([^'"]*)['"]/.exec(block);
    const expectedMatch = /expected:\s*['"]([^'"]*)['"]/.exec(block);
    if (inputMatch && expectedMatch) {
      tests.push({ input: inputMatch[1], expected: expectedMatch[1] });
    }
  }
  return tests;
}

/**
 * Checks if actual output satisfies an expected condition.
 * Supports: 'contains:substring', 'equals:text', 'regex:pattern'
 */
function checkExpected(actual: string, expected: string): boolean {
  const trimmed = expected.trim();

  if (trimmed.startsWith('contains:')) {
    const needle = trimmed.slice(9).trim();
    return actual.includes(needle);
  }

  if (trimmed.startsWith('regex:')) {
    const pattern = trimmed.slice(6).trim();
    try {
      return new RegExp(pattern).test(actual);
    } catch {
      return false;
    }
  }

  if (trimmed.startsWith('equals:')) {
    const text = trimmed.slice(7).trim();
    return actual.trim() === text;
  }

  // Default: contains
  return actual.includes(trimmed);
}

export class TestRunner {
  private readonly skillsBaseDir: string;
  private readonly agentLoop: AgentLoop;

  constructor(skillsBaseDir = '.agents/skills') {
    this.skillsBaseDir = skillsBaseDir;
    const llm = new ProviderFactory();
    const tools = new ToolRegistry();
    this.agentLoop = new AgentLoop({ llm, tools, maxIterations: 5 });
  }

  /**
   * Runs tests for a skill by name.
   * Looks up the skill's SKILL.md and extracts test blocks.
   */
  async runSkillTests(skillName: string): Promise<TestSuiteResult> {
    const skillPath = path.join(this.skillsBaseDir, skillName, 'SKILL.md');

    if (!fs.existsSync(skillPath)) {
      return {
        skillName,
        total: 0,
        passed: 0,
        failed: 0,
        results: [],
      };
    }

    const content = fs.readFileSync(skillPath, 'utf-8');
    const testCases = parseTestBlocks(content);

    if (testCases.length === 0) {
      return { skillName, total: 0, passed: 0, failed: 0, results: [] };
    }

    const executor = new SkillExecutor(this.agentLoop);
    const skillMeta: SkillMeta = { name: skillName, description: '', path: skillPath };
    const results: TestResult[] = [];

    for (const tc of testCases) {
      try {
        const actual = await executor.execute(skillMeta, tc.input);
        const passed = checkExpected(actual, tc.expected);
        results.push({ name: skillName, input: tc.input, expected: tc.expected, actual, passed });
      } catch (err) {
        results.push({
          name: skillName,
          input: tc.input,
          expected: tc.expected,
          actual: '',
          passed: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    return { skillName, total: results.length, passed, failed, results };
  }

  /**
   * Lists available skill names from the skills directory.
   */
  listSkills(): string[] {
    if (!fs.existsSync(this.skillsBaseDir)) return [];
    return fs.readdirSync(this.skillsBaseDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
  }
}

/**
 * Formats and prints a TestSuiteResult to the console.
 */
export function printTestResults(result: TestSuiteResult): void {
  if (result.total === 0) {
    console.log(`\n Skill: ${result.skillName}`);
    console.log('   No tests found.');
    return;
  }

  console.log(`\n Skill: ${result.skillName}  (${result.passed}/${result.total} passed)`);

  for (const r of result.results) {
    const icon = r.passed ? '✓' : '✗';
    const label = r.passed ? 'PASS' : 'FAIL';

    if (r.passed) {
      console.log(`   ${icon} ${label} — input: "${r.input}"`);
    } else {
      console.log(`   ${icon} ${label} — input: "${r.input}"`);
      console.log(`     Expected: ${r.expected}`);
      if (r.error) {
        console.log(`     Error: ${r.error}`);
      } else {
        console.log(`     Actual: ${r.actual.slice(0, 200)}${r.actual.length > 200 ? '...' : ''}`);
      }
    }
  }
}
