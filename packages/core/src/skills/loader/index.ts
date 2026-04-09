import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { SkillMeta } from './types';

export class SkillLoader {
  constructor(private baseDir = '.agents/skills') {}

  loadAll(): SkillMeta[] {
    if (!fs.existsSync(this.baseDir)) return [];

    const skills: SkillMeta[] = [];
    const dirs = fs.readdirSync(this.baseDir, { withFileTypes: true }).filter(d => d.isDirectory());

    for (const dir of dirs) {
      const skillPath = path.join(this.baseDir, dir.name, 'SKILL.md');
      if (!fs.existsSync(skillPath)) continue;
      const content = fs.readFileSync(skillPath, 'utf-8');
      const meta = this.parseFrontmatter(content);
      if (meta && typeof meta.name === 'string') {
        skills.push({
          name: meta.name,
          description: typeof meta.description === 'string' ? meta.description : '',
          trigger: typeof meta.trigger === 'string' ? meta.trigger : undefined,
          path: skillPath,
        });
      }
    }

    return skills;
  }

  private parseFrontmatter(md: string): Record<string, unknown> | null {
    if (!md.startsWith('---')) return null;
    const end = md.indexOf('---', 3);
    if (end === -1) return null;
    const raw = md.slice(3, end).trim();
    return yaml.load(raw) as Record<string, unknown>;
  }
}

export { SkillMeta };