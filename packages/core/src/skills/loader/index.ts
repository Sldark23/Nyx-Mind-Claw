import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { SkillMeta } from './types';
import { BUNDLED_SKILLS, getRegistry, SkillVerifier } from '../verifier';
import type { PendingSkill } from '../verifier';

export class SkillLoader {
  constructor(private baseDir = '.agents/skills') {}

  loadAll(): SkillMeta[] {
    if (!fs.existsSync(this.baseDir)) return [];

    const registry = getRegistry();
    const verifier = new SkillVerifier(this.baseDir);
    const skills: SkillMeta[] = [];
    const dirs = fs.readdirSync(this.baseDir, { withFileTypes: true }).filter(d => d.isDirectory());

    for (const dir of dirs) {
      const skillPath = path.join(this.baseDir, dir.name, 'SKILL.md');
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

  loadWithVerification(): { approvedSkills: SkillMeta[]; pendingSkills: PendingSkill[] } {
    if (!fs.existsSync(this.baseDir)) return { approvedSkills: [], pendingSkills: [] };

    const registry = getRegistry();
    const verifier = new SkillVerifier(this.baseDir);
    const approvedSkills: SkillMeta[] = [];
    const dirs = fs.readdirSync(this.baseDir, { withFileTypes: true }).filter(d => d.isDirectory());

    for (const dir of dirs) {
      const skillPath = path.join(this.baseDir, dir.name, 'SKILL.md');
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

    return { approvedSkills, pendingSkills: registry.listPending().map(p => ({ ...p, report: null as any, submittedAt: new Date() })) };
  }

  private parseFrontmatter(md: string): Record<string, unknown> | null {
    if (!md.startsWith('---')) return null;
    const end = md.indexOf('---', 3);
    if (end === -1) return null;
    const raw = md.slice(3, end).trim();
    return yaml.load(raw) as Record<string, unknown>;
  }

  private desc(meta: Record<string, unknown>): string {
    return typeof meta.description === 'string' ? meta.description : '';
  }

  private trigger(meta: Record<string, unknown>): string | undefined {
    return typeof meta.trigger === 'string' ? meta.trigger : undefined;
  }
}

export { SkillMeta };