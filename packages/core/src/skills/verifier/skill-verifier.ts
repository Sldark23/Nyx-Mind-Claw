import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export interface VerificationReport {
  valid: boolean;
  score: number; // 0-100
  warnings: string[];
  credentialAlerts: { file: string; pattern: string; context: string }[];
}

interface FrontmatterMeta {
  name?: unknown;
  description?: unknown;
  [key: string]: unknown;
}

// Credential detection patterns
const CREDENTIAL_PATTERNS = [
  /(api[_-]?key|token|secret|password|auth|credential)[^]{0,50}(\$|env|process\.env)/gi,
  /['"](sk-|pk-|token_|secret_)[a-zA-Z0-9]{20,}['"]/gi,
  /['"][a-f0-9]{32,}['"]/gi, // Generic hex strings that might be keys/tokens
];

function scanForCredentials(filePath: string): { pattern: string; context: string }[] {
  if (!fs.existsSync(filePath)) return [];
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const alerts: { pattern: string; context: string }[] = [];
  
  for (const pattern of CREDENTIAL_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(content)) !== null) {
      // Get surrounding context (50 chars before and after)
      const start = Math.max(0, match.index - 50);
      const end = Math.min(content.length, match.index + match[0].length + 50);
      const context = content.slice(start, end);
      alerts.push({
        pattern: match[0],
        context: `...${context}...`,
      });
    }
  }
  
  return alerts;
}

function parseFrontmatter(content: string): FrontmatterMeta | null {
  if (!content.startsWith('---')) return null;
  const end = content.indexOf('---', 3);
  if (end === -1) return null;
  const raw = content.slice(3, end).trim();
  try {
    return yaml.load(raw) as FrontmatterMeta;
  } catch {
    return null;
  }
}

function validateFrontmatter(meta: FrontmatterMeta | null): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  if (!meta) {
    return { valid: false, warnings: ['SKILL.md missing or invalid frontmatter'] };
  }
  
  if (typeof meta.name !== 'string' || meta.name.trim() === '') {
    warnings.push('Frontmatter missing or empty "name" field');
  }
  
  if (typeof meta.description !== 'string' || meta.description.trim() === '') {
    warnings.push('Frontmatter missing or empty "description" field');
  }
  
  const valid = typeof meta.name === 'string' && meta.name.trim() !== '';
  return { valid, warnings };
}

export class SkillVerifier {
  constructor(private baseDir = '.agents/skills') {}

  async verify(skillPath: string): Promise<VerificationReport> {
    const warnings: string[] = [];
    const credentialAlerts: { file: string; pattern: string; context: string }[] = [];
    
    // Normalize skill path - could be a directory or full path to SKILL.md
    let skillDir = skillPath;
    if (!fs.existsSync(skillDir)) {
      return {
        valid: false,
        score: 0,
        warnings: [`Skill path does not exist: ${skillPath}`],
        credentialAlerts: [],
      };
    }
    
    if (fs.statSync(skillDir).isFile()) {
      // Provided path is the SKILL.md file itself
      skillDir = path.dirname(skillDir);
    }
    
    const skillMdPath = path.join(skillDir, 'SKILL.md');
    
    // Check SKILL.md exists
    if (!fs.existsSync(skillMdPath)) {
      return {
        valid: false,
        score: 0,
        warnings: [`SKILL.md not found in ${skillDir}`],
        credentialAlerts: [],
      };
    }
    
    // Read and parse SKILL.md
    const skillContent = fs.readFileSync(skillMdPath, 'utf-8');
    const meta = parseFrontmatter(skillContent);
    const frontmatterResult = validateFrontmatter(meta);
    warnings.push(...frontmatterResult.warnings);
    
    // Scan skill files for credentials
    const scanDirs = [skillDir];
    const skillsDir = path.join(this.baseDir, path.basename(skillDir));
    if (fs.existsSync(skillsDir) && skillsDir !== skillDir) {
      scanDirs.push(skillsDir);
    }
    
    for (const dir of scanDirs) {
      this.scanDirectory(dir, credentialAlerts);
    }
    
    // Calculate score
    let score = 100;
    
    // Deduct for missing frontmatter fields
    if (!meta?.name) score -= 20;
    if (!meta?.description) score -= 15;
    
    // Deduct for warnings
    score -= warnings.length * 5;
    
    // Deduct heavily for credential leaks (security critical)
    score -= credentialAlerts.length * 25;
    score = Math.max(0, score);
    
    // Valid if score >= 50 and no critical issues
    const valid = score >= 50 && credentialAlerts.length === 0 && frontmatterResult.valid;
    
    return {
      valid,
      score,
      warnings,
      credentialAlerts,
    };
  }
  
  private scanDirectory(dir: string, alerts: { file: string; pattern: string; context: string }[]): void {
    if (!fs.existsSync(dir)) return;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules, .git, etc.
        if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
          this.scanDirectory(fullPath, alerts);
        }
      } else if (entry.isFile()) {
        // Only scan text-based files
        const ext = path.extname(entry.name).toLowerCase();
        if (['.ts', '.js', '.md', '.json', '.yaml', '.yml', '.txt', '.sh'].includes(ext)) {
          const fileAlerts = scanForCredentials(fullPath);
          for (const alert of fileAlerts) {
            alerts.push({ file: fullPath, pattern: alert.pattern, context: alert.context });
          }
        }
      }
    }
  }
  
  verifySync(skillPath: string): VerificationReport {
    return this.verify(skillPath) as any;
  }
}

// Synchronous version for backward compatibility
export function verifySkill(skillPath: string, baseDir = '.agents/skills'): VerificationReport {
  const verifier = new SkillVerifier(baseDir);
  return verifier.verifySync(skillPath);
}