import fs from 'fs/promises';
import { SkillMeta } from '../loader/types';
import { AgentLoop } from '../../agent/agent-loop';
import { getRegistry } from '../verifier';

export class SkillExecutor {
  constructor(private loop: AgentLoop) {}

  async execute(skill: SkillMeta, userInput: string): Promise<string> {
    const registry = getRegistry();
    if (!registry.isApproved(skill.name)) {
      throw new Error(`Skill "${skill.name}" is not approved. Run verification first.`);
    }
    const content = await fs.readFile(skill.path, 'utf-8');
    return this.loop.run(userInput, content);
  }
}