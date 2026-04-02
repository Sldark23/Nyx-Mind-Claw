import { ProviderFactory } from '../provider';
import { SkillMeta } from './loader';

export class SkillRouter {
  constructor(private llm: ProviderFactory) {}

  async route(userInput: string, skills: SkillMeta[]): Promise<string | null> {
    if (!skills.length) return null;

    const skillList = skills.map(s => `${s.name}: ${s.description}`).join('\n');

    const prompt = `You are a router. Return ONLY JSON: {"skillName": "name"} or {"skillName": null}.\n\nAvailable skills:\n${skillList}\n\nUser input: ${userInput}`;

    try {
      const response = await this.llm.chat([{ role: 'user', content: prompt }]);
      const match = response.match(/\{.*\}/s);
      if (!match) return null;
      const parsed = JSON.parse(match[0]);
      return parsed.skillName || null;
    } catch {
      return null;
    }
  }
}
