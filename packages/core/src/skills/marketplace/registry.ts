/**
 * MarketplaceRegistry — the list of available skills.
 *
 * Skills are fetched from GitHub raw content.
 * Default registry: github.com/Sldark23/skills-nyxmindclaw
 *
 * Format:
 *   {
 *     "skill-name": {
 *       "url": "https://raw.githubusercontent.com/Sldark23/skills-nyxmindclaw/main/skill-name/SKILL.md",
 *       "description": "What the skill does",
 *       "author": "nyxmind",
 *       "version": "1.0.0",
 *       "triggers": ["trigger", "words"]
 *     }
 *   }
 */

export interface MarketplaceEntry {
  url: string;
  description: string;
  author: string;
  version: string;
  triggers?: string[];
}

export type Marketplace = Record<string, MarketplaceEntry>;

const GITHUB_RAW = 'https://raw.githubusercontent.com/Sldark23/skills-nyxmindclaw/main';
const AUTHOR = 'nyxmind';
const VERSION = '1.0.0';

const DEFAULT_MARKETPLACE: Marketplace = {
  // === Official NyxMindClaw Skills ===
  'code-review': {
    url: `${GITHUB_RAW}/code-review/SKILL.md`,
    description: 'Comprehensive code review for PRs, branches and files. Detects bugs, vulnerabilities, code smells and suggests improvements.',
    author: AUTHOR,
    version: VERSION,
    triggers: ['code review', 'review', 'pr', 'pull request', 'diff', 'merge', 'analisar codigo', 'revisar'],
  },
  'git-helper': {
    url: `${GITHUB_RAW}/git-helper/SKILL.md`,
    description: 'Execute complex Git operations — interactive rebase, bisect, stash, reset, cherry-pick, hooks. Recover lost code and manage branches.',
    author: AUTHOR,
    version: VERSION,
    triggers: ['git', 'branch', 'commit', 'rebase', 'cherry-pick', 'stash', 'reset', 'log', 'blame', 'hook', 'reverter', 'undo'],
  },
  'deploy-bot': {
    url: `${GITHUB_RAW}/deploy-bot/SKILL.md`,
    description: 'Orchestrates deployment workflows — Docker, Kubernetes, Vercel, Fly.io, Railway, GitHub Actions. Notifies on success/failure with rollback support.',
    author: AUTHOR,
    version: VERSION,
    triggers: ['deploy', 'deployar', 'release', 'rollback', 'build', 'production', 'stage', 'kubernetes', 'docker', 'vercel', 'fly.io'],
  },
  'readme-generator': {
    url: `${GITHUB_RAW}/readme-generator/SKILL.md`,
    description: 'Generates comprehensive README.md for repositories — badges, installation, usage, examples, contributing guide. Analyzes project structure.',
    author: AUTHOR,
    version: VERSION,
    triggers: ['readme', 'README', 'documentacao', 'docs', 'badge', 'instalacao', 'setup', 'guia', 'comandos'],
  },
  'dependency-audit': {
    url: `${GITHUB_RAW}/dependency-audit/SKILL.md`,
    description: 'Audit npm/pip/go dependencies — checks vulnerabilities, outdated packages, incompatible licenses, unused deps. Generates security report.',
    author: AUTHOR,
    version: VERSION,
    triggers: ['depend', 'audit', 'security', 'vulner', 'npm', 'pip', 'go.mod', 'package.json', 'requirements', 'seguranca'],
  },
  'test-generator': {
    url: `${GITHUB_RAW}/test-generator/SKILL.md`,
    description: 'Generates unit and integration tests automatically — Vitest, Jest, pytest, Go testing. Analyzes source code and creates comprehensive test cases.',
    author: AUTHOR,
    version: VERSION,
    triggers: ['test', 'testar', 'spec', 'jest', 'vitest', 'pytest', 'unittest', 'suite', 'coverage'],
  },
  'api-doc-maker': {
    url: `${GITHUB_RAW}/api-doc-maker/SKILL.md`,
    description: 'Generates REST API documentation — OpenAPI/Swagger spec, Postman collection, markdown endpoints guide. Analyzes route files.',
    author: AUTHOR,
    version: VERSION,
    triggers: ['api', 'doc', 'swagger', 'openapi', 'endpoint', 'rest', 'postman', 'collection', 'routes', 'spec'],
  },
  'slide-deck': {
    url: `${GITHUB_RAW}/slide-deck/SKILL.md`,
    description: 'Generates presentation slide decks — supports HTML reveal.js, Marp, python-pptx. Creates professional presentations for demos, talks, reports.',
    author: AUTHOR,
    version: VERSION,
    triggers: ['slide', 'slides', 'presentation', 'powerpoint', 'pptx', 'marp', 'reveal', 'apresentacao', 'demo', 'pitch'],
  },

  // === Legacy openclaw skills (still available) ===
  'brain-sync': {
    url: 'https://raw.githubusercontent.com/Sldark23/Nyx-Mind-Claw/main/skills/brain-sync/SKILL.md',
    description: 'Sync notes between Obsidian vault and external services',
    author: 'openclaw',
    version: '1.0.0',
    triggers: ['sync', 'vault', 'obsidian'],
  },
  'autoresearch': {
    url: 'https://raw.githubusercontent.com/Sldark23/Nyx-Mind-Claw/main/skills/autoresearch/SKILL.md',
    description: 'Deep research on any topic using web search and summarization',
    author: 'openclaw',
    version: '1.0.0',
    triggers: ['research', 'search', 'investigate'],
  },
  'proactivity': {
    url: 'https://raw.githubusercontent.com/Sldark23/Nyx-Mind-Claw/main/skills/proactivity/SKILL.md',
    description: 'Anticipates needs, keeps work moving, improves throughput',
    author: 'openclaw',
    version: '1.0.0',
    triggers: ['proactive', 'automate', 'improve'],
  },
  'article-builder-news': {
    url: 'https://raw.githubusercontent.com/Sldark23/Nyx-Mind-Claw/main/skills/article-builder-news/SKILL.md',
    description: 'Generate and publish news articles to WordPress',
    author: 'openclaw',
    version: '1.0.0',
    triggers: ['article', 'blog', 'news', 'wordpress'],
  },
  'humanizer': {
    url: 'https://raw.githubusercontent.com/Sldark23/Nyx-Mind-Claw/main/skills/humanizer/SKILL.md',
    description: 'Remove signs of AI-generated writing from text',
    author: 'openclaw',
    version: '1.0.0',
    triggers: ['humanize', 'ai-text', 'writing'],
  },
};

export class MarketplaceRegistry {
  private registry: Marketplace;

  constructor(registryUrl?: string) {
    this.registry = { ...DEFAULT_MARKETPLACE };
    // Future: load from registryUrl if provided
  }

  list(): Marketplace {
    return { ...this.registry };
  }

  get(name: string): MarketplaceEntry | undefined {
    return this.registry[name];
  }

  add(name: string, entry: MarketplaceEntry): void {
    this.registry[name] = entry;
  }
}
