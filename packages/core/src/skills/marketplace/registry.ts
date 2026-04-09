/**
 * MarketplaceRegistry — the list of available skills.
 *
 * Stored as a JSON file that maps skill-name → git URL.
 * Currently points to the @openclaw skills repo on GitHub.
 * Can be extended to hit a real API/website later.
 *
 * Format:
 *   {
 *     "skill-name": {
 *       "url": "https://raw.githubusercontent.com/openclaw/skills/main/skill-name/SKILL.md",
 *       "description": "What the skill does",
 *       "author": "openclaw",
 *       "version": "1.0.0"
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

// Default marketplace — openclaw community skills
const DEFAULT_MARKETPLACE: Marketplace = {
  'brain-sync': {
    url: 'https://raw.githubusercontent.com/openclaw/skills/main/brain-sync/SKILL.md',
    description: 'Sync notes between Obsidian vault and external services',
    author: 'openclaw',
    version: '1.0.0',
    triggers: ['sync', 'vault', 'obsidian'],
  },
  'autoresearch': {
    url: 'https://raw.githubusercontent.com/openclaw/skills/main/autoresearch/SKILL.md',
    description: 'Deep research on any topic using web search and summarization',
    author: 'openclaw',
    version: '1.0.0',
    triggers: ['research', 'search', 'investigate'],
  },
  'proactivity': {
    url: 'https://raw.githubusercontent.com/openclaw/skills/main/proactivity/SKILL.md',
    description: 'Anticipates needs, keeps work moving, improves throughput',
    author: 'openclaw',
    version: '1.0.0',
    triggers: ['proactive', 'automate', 'improve'],
  },
  'article-builder-news': {
    url: 'https://raw.githubusercontent.com/openclaw/skills/main/article-builder-news/SKILL.md',
    description: 'Generate and publish news articles to WordPress',
    author: 'openclaw',
    version: '1.0.0',
    triggers: ['article', 'blog', 'news', 'wordpress'],
  },
  'humanizer': {
    url: 'https://raw.githubusercontent.com/openclaw/skills/main/humanizer/SKILL.md',
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
