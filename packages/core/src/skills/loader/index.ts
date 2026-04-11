import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { SkillMeta } from './types';
import { BUNDLED_SKILLS, getRegistry } from '../verifier/skill-registry';
import { SkillVerifier } from '../verifier/skill-verifier';
import { getDirs } from '../../config';

export class SkillLoader {
  private readonly skillsDir: string;

  constructor(baseDir?: string) {
    // Use provided path, fallback to config dir, fallback to default
    this.skillsDir = baseDir ?? getDirs().skills ?? '.agents/skills';
  }

  loadAll(): SkillMeta[] {
    if (!fs.existsSync(this.skillsDir)) return [];

    const registry = getRegistry();
    const verifier = new SkillVerifier(this.skillsDir);
    const skills: SkillMeta[] = [];
    const dirs = fs.readdirSync(this.skillsDir, { withFileTypes: true }).filter(d => d.isDirectory());

    for (const dir of dirs) {
      const skillPath = path.join(this.skillsDir, dir.name, 'SKILL.md');
      if (!fs.existsSync(skillPath)) continue;
      const content = fs.readFileSync(skillPath, 'utf-8');
      const meta = this.parseFrontmatter(content);
      if (!meta || typeof meta.name !== 'string') continue;

      const skillName = meta.name as string;

      // Bundled skills bypass verification (pre-approved)
      if (BUNDLED_SKILLS.has(skillName)) {
        skills.push({ name: skillName, description: this.desc(meta), trigger: this.trigger(meta), path: skillPath });
        continue;
      }

      // Non-bundled: verify and register
      registry.verifyAndRegister(skillPath, verifier);
      if (registry.isApproved(skillName)) {
        skills.push({ name: skillName, description: this.desc(meta), trigger: this.trigger(meta), path: skillPath });
      }
    }

    return skills;
  }

  loadWithVerification(): { approvedSkills: SkillMeta[]; pendingSkills: { name: string; reason: string; score: number }[] } {
    if (!fs.existsSync(this.skillsDir)) return { approvedSkills: [], pendingSkills: [] };

    const registry = getRegistry();
    const verifier = new SkillVerifier(this.skillsDir);
    const approvedSkills: SkillMeta[] = [];
    const dirs = fs.readdirSync(this.skillsDir, { withFileTypes: true }).filter(d => d.isDirectory());

    for (const dir of dirs) {
      const skillPath = path.join(this.skillsDir, dir.name, 'SKILL.md');
      if (!fs.existsSync(skillPath)) continue;
      const content = fs.readFileSync(skillPath, 'utf-8');
      const meta = this.parseFrontmatter(content);
      if (!meta || typeof meta.name !== 'string') continue;

      const skillName = meta.name as string;

      if (BUNDLED_SKILLS.has(skillName)) {
        approvedSkills.push({ name: skillName, description: this.desc(meta), trigger: this.trigger(meta), path: skillPath });
      } else {
        registry.verifyAndRegister(skillPath, verifier);
        if (registry.isApproved(skillName)) {
          approvedSkills.push({ name: skillName, description: this.desc(meta), trigger: this.trigger(meta), path: skillPath });
        }
      }
    }

    // listPending() returns simplified objects { name, reason, score }
    const pendingSkills = registry.listPending();

    return { approvedSkills, pendingSkills };
  }

  private parseFrontmatter(md: string): Record<string, unknown> | null {
    if (!md.startsWith('---')) return null;
    const end = md.indexOf('---', 3);
    if (end === -1) return null;
    const raw = md.slice(3, end).trim();
    try {
      return yaml.load(raw, { filename: 'SKILL.md' }) as Record<string, unknown>; // Safe YAML parsing
    } catch {
      return null;
    }
  }

  private desc(meta: Record<string, unknown>): string {
    return typeof meta.description === 'string' ? meta.description : '';
  }

  private trigger(meta: Record<string, unknown>): string | undefined {
    return typeof meta.trigger === 'string' ? meta.trigger : undefined;
  }
}

export { SkillMeta };
