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
  } catch {
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
 */
export function submitSkill(
  skillMeta: SkillMeta,
  author: 'user' | 'agent' = 'agent'
): MarketplaceSubmission {
  const submissions = loadSubmissions();
  
  const submission: MarketplaceSubmission = {
    name: skillMeta.name,
    description: skillMeta.description,
    author,
    submittedAt: new Date().toISOString(),
    trigger: skillMeta.trigger,
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
 * Integration helper: submit skill after auto-approval
 * Returns submission if successful, undefined otherwise
 */
export async function submitOnAutoApproval(
  skillPath: string,
  skillMeta: SkillMeta
): Promise<MarketplaceSubmission | undefined> {
  try {
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