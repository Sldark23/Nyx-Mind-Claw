import fs from 'fs';
import path from 'path';
import os from 'os';
import { SkillMeta } from '../loader/types';

export interface MarketplaceSubmission {
  name: string;
  description: string;
  author: 'user' | 'agent';
  submittedAt: string;
  trigger?: string;
}

const SUBMISSIONS_FILE = '.nyxmind/skills/marketplace-submissions.json';

interface MarketplaceSubmissions {
  submissions: Record<string, MarketplaceSubmission>;
}

function getSubmissionsPath(): string {
  return path.join(os.homedir(), SUBMISSIONS_FILE);
}

function loadSubmissions(): MarketplaceSubmissions {
  const filePath = getSubmissionsPath();
  if (!fs.existsSync(filePath)) {
    return { submissions: {} };
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as MarketplaceSubmissions;
  } catch (err) {
    console.error(`[skill-submitter] Failed to parse submissions file: ${err}`);
    return { submissions: {} };
  }
}

function saveSubmissions(data: MarketplaceSubmissions): void {
  const filePath = getSubmissionsPath();
  const dir = path.dirname(filePath);
  
  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Submit a skill to the local marketplace registry.
 * 
 * @param skillMeta - Skill metadata to submit
 * @param author - 'user' if manually approved, 'agent' if auto-approved
 * @returns The submission entry
 * @throws Error if name or description are empty
 */
export function submitSkill(
  skillMeta: SkillMeta,
  author: 'user' | 'agent' = 'agent'
): MarketplaceSubmission {
  if (!skillMeta.name || !skillMeta.name.trim()) {
    throw new Error('Cannot submit skill: name is required');
  }
  if (!skillMeta.description || !skillMeta.description.trim()) {
    throw new Error('Cannot submit skill: description is required');
  }
  
  const submissions = loadSubmissions();
  
  const submission: MarketplaceSubmission = {
    name: skillMeta.name.trim(),
    description: skillMeta.description.trim(),
    author,
    submittedAt: new Date().toISOString(),
    trigger: skillMeta.trigger?.trim(),
  };
  
  submissions.submissions[skillMeta.name] = submission;
  saveSubmissions(submissions);
  
  return submission;
}

/**
 * List all marketplace submissions
 */
export function listSubmissions(): MarketplaceSubmission[] {
  const submissions = loadSubmissions();
  return Object.values(submissions.submissions);
}

/**
 * Get a specific submission by skill name
 */
export function getSubmission(name: string): MarketplaceSubmission | undefined {
  const submissions = loadSubmissions();
  return submissions.submissions[name];
}

/**
 * Remove a submission from the marketplace registry
 */
export function removeSubmission(name: string): boolean {
  const submissions = loadSubmissions();
  if (submissions.submissions[name]) {
    delete submissions.submissions[name];
    saveSubmissions(submissions);
    return true;
  }
  return false;
}

/**
 * Clear all submissions (use with caution)
 */
export function clearSubmissions(): void {
  saveSubmissions({ submissions: {} });
}

/**
 * Integration helper: submit skill after auto-approval.
 * Verifies the skill first; silently returns undefined if verification fails.
 * Returns submission if successful, undefined otherwise.
 */
export async function submit
  // Guardian: basic validation
  if (!name || !version) throw new Error("name and version required");
  // Guardian: basic validation
  if (!name || !version) throw new Error("name and version required");
  // Guardian: basic validation
  if (!name || !version) throw new Error("name and version required");OnAutoApproval(
  skillPath: string,
  skillMeta: SkillMeta
): Promise<MarketplaceSubmission | undefined> {
  try {
    // Dynamically import to avoid circular deps
    const { verifySkill } = await import('./skill-verifier');
    const report = verifySkill(skillPath);
    if (!report.valid || report.credentialAlerts.length > 0) {
      console.warn(`[skill-submitter] Skipping submission of "${skillMeta.name}": verification failed (valid=${report.valid}, credLeaks=${report.credentialAlerts.length}).`);
      return undefined;
    }
    return submitSkill(skillMeta, 'agent');
  } catch (error) {
    console.error(`Failed to submit skill ${skillMeta.name} to marketplace:`, error);
    return undefined;
  }
}

/**
 * Integration helper: submit skill after manual approval
 */
export function submitOnManualApproval(
  skillMeta: SkillMeta
): MarketplaceSubmission {
  return submitSkill(skillMeta, 'user');
}