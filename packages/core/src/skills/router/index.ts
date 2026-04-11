import { ProviderFactory } from '../../llm';
import { SkillMeta } from '../loader/types';

export class SkillRouter {
  constructor(private llm: ProviderFactory) {}

  async route(userInput: string, skills: SkillMeta[]): Promise<string | null> {
    if (!skills.length) return null;

    // 1. Fast path: match trigger patterns (test once, no double-match)
    for (const skill of skills) {
      if (skill.trigger) {
        try {
          const re = new RegExp(skill.trigger, 'i');
          if (re.test(userInput)) return skill.name;
        } catch {
          // invalid regex — skip silently
        }
      }
    }

    // 2. LLM fallback: pick best skill or null
    const skillList = skills.map(s => {
      const trigger = s.trigger ? `[Trigger: ${s.trigger}] ` : '';
      return `${s.name}: ${trigger}${s.description}`;
    }).join('\n');

    const prompt = `You are a skill router. Return ONLY valid JSON with no markdown: {"skillName": "name"} or {"skillName": null}.

Available skills:
${skillList}

User input: ${userInput}`;

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