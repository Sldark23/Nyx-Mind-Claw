/**
 * Skill Verification and Registry System
 * 
 * This module provides:
 * - SkillVerifier: Verifies skills before use (checks frontmatter, files, credentials)
 * - SkillRegistry: Manages skill lifecycle (approve, pending, reject)
 * - SkillSubmitter: Auto-submits approved skills to marketplace
 */

export { SkillVerifier, verifySkill } from './skill-verifier';
export type { VerificationReport } from './skill-verifier';

export { SkillRegistry, getRegistry, BUNDLED_SKILLS } from './skill-registry';
export type { PendingSkill } from './skill-registry';

export {
  submitSkill,
  listSubmissions,
  getSubmission,
  removeSubmission,
  submitOnAutoApproval,
  submitOnManualApproval,
} from './skill-submitter';
export type { MarketplaceSubmission } from './skill-submitter';