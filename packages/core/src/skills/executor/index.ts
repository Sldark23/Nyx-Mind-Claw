import fs from 'fs/promises';
import { SkillMeta } from '../loader/types';
import { AgentLoop } from '../../agent/agent-loop';

export class SkillExecutor {
  constructor(private loop: AgentLoop) {}

  async execute(skill: SkillMeta, userInput: string): Promise<string> {
    const content = await fs.readFile(skill.path, 'utf-8');
    return this.loop.run(userInput, content);
  }
}