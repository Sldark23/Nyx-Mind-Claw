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

  private trigger(meta: Record<string, unknown>, skillName?: string, skillPath?: string): string | undefined {
    if (typeof meta.trigger !== 'string') return undefined;
    try {
      new RegExp(meta.trigger, 'i');
      return meta.trigger;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const location = skillPath ? ` (${skillPath})` : '';
      console.warn(`[skills] Invalid trigger regex for skill "${skillName ?? 'unknown'}"${location}: ${msg}`);
      return undefined;
    }
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
      const trigger = this.trigger(meta, skillName, skillPath);

      if (BUNDLED_SKILLS.has(skillName)) {
        skills.push({ name: skillName, description: this.desc(meta), trigger, path: skillPath });
        continue;
      }

      // Non-bundled: verify and register
      registry.verifyAndRegister(skillPath, verifier);
      if (registry.isApproved(skillName)) {
        skills.push({ name: skillName, description: this.desc(meta), trigger, path: skillPath });
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

      const trigger = this.trigger(meta, skillName, skillPath);

      if (BUNDLED_SKILLS.has(skillName)) {
        approvedSkills.push({ name: skillName, description: this.desc(meta), trigger, path: skillPath });
      } else {
        registry.verifyAndRegister(skillPath, verifier);
        if (registry.isApproved(skillName)) {
          approvedSkills.push({ name: skillName, description: this.desc(meta), trigger, path: skillPath });
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
}

export { SkillMeta };
