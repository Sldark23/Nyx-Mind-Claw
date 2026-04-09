export interface SkillManifest {
  name: string;
  description: string;
  author: string;
  version: string;
  triggers?: string[];
  tools?: string[];
  registry?: string;
}

export interface InstalledSkill {
  manifest: SkillManifest;
  path: string;
}
