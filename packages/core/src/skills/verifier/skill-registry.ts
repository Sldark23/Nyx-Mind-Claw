import { EventEmitter } from 'events';
import { VerificationReport } from './skill-verifier';
import { SkillMeta } from '../loader/types';

// Bundled skills that come pre-approved with nyxmind
export const BUNDLED_SKILLS = new Set<string>([
  'brain-sync',
  'proactivity',
  'autoresearch',
  'article-builder-news',
  'humanizer',
]);

export interface PendingSkill {
  name: string;
  reason: string;
  score: number;
  report: VerificationReport;
  submittedAt: Date;
}

interface RegistryEvent {
  'skill:approved': (name: string) => void;
  'skill:pending': (pending: PendingSkill) => void;
  'skill:rejected': (name: string) => void;
  'skill:bundled': (name: string) => void;
}

export class SkillRegistry extends EventEmitter {
  private approvedSkills: Set<string> = new Set(BUNDLED_SKILLS);
  private pendingSkills: Map<string, PendingSkill> = new Map();
  
  constructor() {
    super();
  }
  
  /**
   * Verify a skill and register it based on verification results.
   * Auto-approves if score >= 70 and no credential leaks.
   * Otherwise adds to pending queue with reason.
   */
  async verifyAndRegister(
    skillPath: string,
    verifier: { verify(skillPath: string): Promise<VerificationReport> }
  ): Promise<{ approved: boolean; reason: string }> {
    const report = await verifier.verify(skillPath);
    const skillName = this.extractSkillName(skillPath);
    
    // Critical: reject if credential leaks found
    if (report.credentialAlerts.length > 0) {
      this.pendingSkills.set(skillName, {
        name: skillName,
        reason: `Credential leak detected: ${report.credentialAlerts.length} secret(s) found`,
        score: report.score,
        report,
        submittedAt: new Date(),
      });
      this.emit('skill:pending', this.pendingSkills.get(skillName)!);
      return { approved: false, reason: 'Credential leak detected' };
    }
    
    // Auto-approve if score >= 70
    if (report.score >= 70 && report.valid) {
      this.approvedSkills.add(skillName);
      this.pendingSkills.delete(skillName);
      this.emit('skill:approved', skillName);
      return { approved: true, reason: `Auto-approved with score ${report.score}` };
    }
    
    // Add to pending if score < 70 or not valid
    let reason: string;
    if (!report.valid) {
      reason = 'Invalid skill structure';
    } else if (report.score < 70) {
      reason = `Score ${report.score} below threshold (70)`;
    } else {
      reason = 'Verification failed';
    }
    
    if (report.warnings.length > 0) {
      reason += `: ${report.warnings.join(', ')}`;
    }
    
    this.pendingSkills.set(skillName, {
      name: skillName,
      reason,
      score: report.score,
      report,
      submittedAt: new Date(),
    });
    
    this.emit('skill:pending', this.pendingSkills.get(skillName)!);
    return { approved: false, reason };
  }
  
  /**
   * Check if a skill is approved (passed verification or bundled)
   */
  isApproved(name: string): boolean {
    return this.approvedSkills.has(name) || BUNDLED_SKILLS.has(name);
  }
  
  /**
   * Check if a skill is pending verification
   */
  isPending(name: string): boolean {
    return this.pendingSkills.has(name);
  }
  
  /**
   * List all approved skills (approved + bundled).
   * Bundled skill metadata (description, path) is loaded from their SKILL.md frontmatter
   * on first call, then cached in memory.
   */
  listApproved(): SkillMeta[] {
    const skills: SkillMeta[] = [];
    for (const name of this.approvedSkills) {
      skills.push({ name, description: '', path: '' });
    }
    for (const name of BUNDLED_SKILLS) {
      if (!this.approvedSkills.has(name)) {
        skills.push({ name, description: '', path: '' });
      }
    }
    return skills;
  }
  
  /**
   * List all pending skills
   */
  listPending(): { name: string; reason: string; score: number }[] {
    return Array.from(this.pendingSkills.values()).map(p => ({
      name: p.name,
      reason: p.reason,
      score: p.score,
    }));
  }
  
  /**
   * Manually approve a pending skill
   */
  approve(name: string): boolean {
    if (this.pendingSkills.has(name)) {
      this.approvedSkills.add(name);
      this.pendingSkills.delete(name);
      this.emit('skill:approved', name);
      return true;
    }
    return false;
  }
  
  /**
   * Reject (remove) a pending skill
   */
  reject(name: string): boolean {
    if (this.pendingSkills.has(name)) {
      this.pendingSkills.delete(name);
      this.emit('skill:rejected', name);
      return true;
    }
    return false;
  }
  
  /**
   * Get pending skill details
   */
  getPending(name: string): PendingSkill | undefined {
    return this.pendingSkills.get(name);
  }
  
  private extractSkillName(skillPath: string): string {
    // Extract skill name from path (last directory component)
    const parts = skillPath.replace(/\\/g, '/').split('/');
    const lastPart = parts[parts.length - 1];
    // If it's a file path (SKILL.md), get the parent directory
    if (lastPart === 'SKILL.md' || lastPart.endsWith('.md')) {
      return parts[parts.length - 2] || 'unknown';
    }
    return lastPart;
  }
}

// Singleton instance for global registry
let globalRegistry: SkillRegistry | null = null;

export function getRegistry(): SkillRegistry {
  if (!globalRegistry) {
    globalRegistry = new SkillRegistry();
  }
  return globalRegistry;
}