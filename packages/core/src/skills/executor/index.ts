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
    let content: string;
    try {
      content = await fs.readFile(skill.path, 'utf-8');
    } catch (err) {
      const fileErr = err as NodeJS.ErrnoException;
      if (fileErr?.code === 'ENOENT') {
        throw new Error(`Skill "${skill.name}" is missing at "${skill.path}". Reinstall or restore the skill file before retrying.`);
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to read skill file "${skill.path}" for skill "${skill.name}": ${msg}`);
    }
    return this.loop.run(userInput, content);
  }
}