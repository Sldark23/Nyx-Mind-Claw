import fs from 'fs';
import { SkillMeta } from './loader';
import { AgentLoop } from '../agent-loop';

export class SkillExecutor {
  constructor(private loop: AgentLoop) {}

  execute(skill: SkillMeta, userInput: string) {
    const content = fs.readFileSync(skill.path, 'utf-8');
    return this.loop.run(userInput, content);
  }
}
