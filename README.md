# Nyx-Mind-Claw

Your personal AI agent framework — extensible, multi-provider, skill-driven.

## Quick Start

```bash
npm install
npm run build
nyxmind onboard    # Interactive first-time setup
nyxmind run        # Start the agent
```

## Key Features

- **Multi-LLM Provider**: OpenAI, Groq, Anthropic, Gemini, DeepSeek, Ollama, MiniMax, Grok
- **Skill System**: Bundled skills auto-load; external skills go through verification before use
- **Channels**: Telegram, Discord, WhatsApp
- **CLI-first**: `nyxmind onboard`, `nyxmind run`, `nyxmind skills`, `nyxmind doctor`
- **Config**: `nyxmind-claw.json` (priority) or `.env` fallback

## Commands

| Command | Description |
|---|---|
| `nyxmind onboard` | Interactive first-time setup |
| `nyxmind run` | Start the agent |
| `nyxmind skills` | List installed skills |
| `nyxmind skills install <name>` | Install a skill from marketplace |
| `nyxmind doctor` | Run health checks |
| `nyxmind --help` | Show all commands |

## Architecture

```
nyxmind-claw/
├── packages/
│   ├── cli/          # nyxmind command-line interface
│   └── core/         # Agent loop, LLM factory, memory, skills, config
├── .agents/skills/   # Installed skills (SKILL.md files)
├── nyxmind-claw.json # Config file (or use .env)
└── install.sh        # Auto-install script
```

## Skills

Bundled skills (pre-approved):
- `brain-sync` — Sync notes between Obsidian vault and external services
- `proactivity` — Anticipates needs, keeps work moving
- `autoresearch` — Deep research on any topic
- `article-builder-news` — Generate and publish news articles to WordPress
- `humanizer` — Remove AI writing patterns from text

External skills are verified for credential leaks and safety before activation.

## Config (`nyxmind-claw.json`)

```json
{
  "llm": { "provider": "openai", "apiKey": "", "model": "gpt-4o" },
  "iterations": 5,
  "memoryWindow": 20,
  "dirs": { "data": "./data", "tmp": "./tmp", "skills": ".agents/skills" },
  "limits": { "maxFileSizeMb": 20, "rateLimitPerMinute": 20, "allowedUserIds": [] },
  "channels": { "telegram": { "botToken": "", "allowedIds": [] }, "discord": { "token": "" } }
}
```

Or use `.env` — `nyxmind-claw.json` takes priority.

## Contributing

1. Fork the repo
2. Create a branch: `git checkout -b feature/my-feature`
3. Commit: `git commit -m 'feat: add my feature'`
4. Push: `git push origin feature/my-feature`
5. Open a PR
