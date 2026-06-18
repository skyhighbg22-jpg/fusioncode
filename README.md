# FusionCode

> The peak open-source AI coding agent CLI — combining OpenClaude multi-provider routing, MiMo persistent memory, Aider git ergonomics, Kilo agent modes, Continue CI checks, and OpenCode TUI ideas into one hackable TypeScript CLI.

## Features

### 🧠 Multi-Provider Intelligence
- **Universal Model Support**: OpenAI, DeepSeek, Groq, Mistral, OpenRouter, Together, Cohere, and any OpenAI-compatible endpoint (Ollama, LM Studio, local servers)
- **Provider Presets**: Sensible base URLs and default models for 10 providers out of the box
- **Environment Overrides**: Set API keys and switch providers/models via environment variables

### 💾 Persistent Memory
- **SQLite FTS5-backed memory**: Full-text search across past interactions
- **Context Retrieval**: Automatically injects relevant past context into prompts (token-budgeted)
- **Task Tracking**: Built-in todo list that persists across sessions

### 🎯 Specialized Agent Modes
- **`build`**: Implement features, fix bugs, refactor code (full access; auto-commits if enabled)
- **`debug`**: Root-cause analysis and fix generation
- **`review`**: Code quality analysis with actionable suggestions (read-only)
- **`plan`**: High-level architecture and implementation roadmap (read-only)
- **`check`**: Run CI-style checks (typecheck, lint, tests)

### 🔧 Git-Native Workflow
- **Auto-commit**: Optionally commit changes with AI-generated messages
- **Diff Analysis**: Understand changes before/after edits
- **Branch Awareness**: Context-aware operations

### 🛠️ Cross-Platform Tooling
- **bash**: Runs shell commands (bash on Unix, cmd.exe on Windows)
- **grep**: Native recursive search (no system `grep` binary needed)
- **File ops**: read_file, write_file, edit_file, list_dir, glob_files
- **Web**: web_fetch, web_search

## Installation

```bash
npm install -g fusioncode
```

## Quick Start

### 1. Set your API key

```bash
# Pick the provider you want to use
export OPENAI_API_KEY=sk-...
#   DEEPSEEK_API_KEY | GROQ_API_KEY | MISTRAL_API_KEY
#   OPENROUTER_API_KEY | TOGETHER_API_KEY | COHERE_API_KEY
```

Local providers (Ollama, LM Studio) need no key — just a running server.

### 2. Initialize configuration (optional)

```bash
fusion init
```

This writes a `fusioncode.json` in your project with the default providers and settings. You can edit it to set your default provider/model.

### 3. Run the agent

```bash
# Default (build) mode
fusion run "Add error handling to the login function"

# Pick a mode
fusion run --mode review "src/api/handlers.ts"
fusion run --mode debug "TypeError: Cannot read properties of undefined"
fusion run --mode plan "Database migration strategy"

# Pick a provider/model
fusion run --provider groq --model llama-3.3-70b-versatile "Refactor utils"
```

### 4. Run CI checks directly

```bash
fusion check
```

Runs TypeScript typechecking, ESLint, and the test suite — no API key required.

## Usage

### Commands

| Command | Description |
|---------|-------------|
| `fusion run [prompt...]` | Run an agent with a prompt. Options: `--mode`, `--provider`, `--model`, `--auto` |
| `fusion init` | Create a `fusioncode.json` in the current project |
| `fusion config` | Show or edit configuration (`--list`, `--set-provider <name>`, `--set-model <model>`) |
| `fusion check` | Run typecheck, lint, and tests |

### Agent Modes

- **`build`** (default): Full read/write access. Implements features and applies fixes directly with tools. On completion, optionally auto-commits and stores a memory checkpoint.
- **`debug`**: Full access. Traces root causes and applies minimal fixes.
- **`review`** (read-only): Identifies security, performance, and style issues with severity ratings.
- **`plan`** (read-only): Analyzes the codebase and produces architecture/implementation plans.
- **`check`**: Runs the project's quality checks via the bash tool and reports a pass/warn/fail summary.

### Configuration

The config file is `fusioncode.json` (local: `./fusioncode.json` or `./.fusion/fusioncode.json`; global: `~/.fusioncode/fusioncode.json`). Merge precedence: **defaults < global < local < environment**.

```json
{
  "defaultAgent": "build",
  "defaultProvider": "openai",
  "providers": {
    "openai": { "baseUrl": "https://api.openai.com/v1", "apiKey": "sk-...", "model": "gpt-4o" },
    "groq":   { "baseUrl": "https://api.groq.com/openai/v1", "apiKey": "gsk_...", "model": "llama-3.3-70b-versatile" },
    "ollama": { "baseUrl": "http://localhost:11434/v1", "apiKey": "ollama", "model": "llama3.2" }
  },
  "memory": { "enabled": true, "dir": ".fusion/memory", "maxTokensBudget": 2000, "autoCheckpoint": true, "checkpointInterval": 10 },
  "git":    { "autoCommit": false, "commitMessagePrefix": "fusioncode:", "showDiff": true, "requireClean": false }
}
```

Environment overrides:

| Variable | Effect |
|----------|--------|
| `<PROVIDER>_API_KEY` | Sets the API key for that provider (e.g. `OPENAI_API_KEY`) |
| `FUSION_PROVIDER` | Override the default provider |
| `FUSION_MODEL` | Override the default provider's model |
| `FUSION_LOG_LEVEL` | `debug` \| `info` (default) \| `warn` \| `error` \| `silent` |

> Note: FusionCode reads environment variables directly from the shell; it does not auto-load `.env` files. See `.env.example` for the full list.

## Architecture

```
fusioncode/
└── src/
    ├── cli/              # Commander entry point (bin: fusion)
    │   └── index.ts
    ├── agents/           # Agent runner + mode strategies + swarm
    │   ├── index.ts      # AgentRunner (single streaming + tool-call loop)
    │   ├── swarm.ts      # (in index.ts) parallel agents with concurrency cap
    │   └── modes/        # ModeStrategy implementations
    │       ├── base.ts   # ModeStrategy interface
    │       ├── build.ts  plan.ts  debug.ts  review.ts  check.ts
    │       └── index.ts  # registry: getMode(name)
    ├── providers/        # LLM provider abstraction
    │   ├── base.ts       # BaseProvider + registry
    │   └── openai-compatible.ts
    ├── tools/            # Agent tools
    │   ├── bash.ts       # cross-platform shell
    │   ├── files.ts      # read/write/edit/list/glob
    │   ├── search.ts     # native JS grep
    │   ├── web.ts        # web_fetch / web_search
    │   └── index.ts      # barrel + executeTool + schema mapping
    ├── memory/           # SQLite FTS5 persistent memory
    │   └── index.ts
    ├── git/              # Git integration
    │   └── index.ts
    ├── config/           # Config load/save + zod validation
    │   ├── defaults.ts
    │   ├── schema.ts
    │   └── index.ts
    ├── runtime/          # RuntimeContext (per-run config + stores)
    │   └── context.ts
    ├── logger/           # Leveled logger (stderr)
    ├── utils/            # error helpers
    ├── types/            # shared TypeScript types
    └── index.ts          # library barrel export
```

### Key design points

- **One agent loop, pluggable modes.** `AgentRunner` owns the single streaming + tool-call loop. Each mode is a `ModeStrategy` that supplies the system prompt, declares read-only access and an iteration cap, and optionally runs start/complete hooks (e.g. build auto-commits). There is no per-mode orchestration pipeline.
- **No global mutable singletons in the hot path.** `RuntimeContext` holds per-run config and lazily-created git/memory stores, which makes the agent testable and lets swarm agents run in isolation.
- **Config is validated.** `fusioncode.json` is validated against a zod schema; a malformed config produces a clear warning and falls back to defaults instead of a broken runtime.

## Development

### Setup

```bash
git clone https://github.com/skyhighbg22-jpg/fusioncode.git
cd fusioncode
npm install
npm run build
npm link
```

### Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Run the CLI in watch mode with tsx |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run the compiled CLI |
| `npm test` | Run the vitest suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run lint` | Run ESLint (flat config) |
| `npm run format` | Format source with Prettier |
| `npm run format:check` | Check formatting without writing |
| `npm run typecheck` | Type-check without emitting |
| `npm run clean` | Remove `dist/` and `coverage/` |

### Requirements

- Node.js >= 20

## Roadmap

- [ ] Ink-powered interactive TUI (dependencies already present)
- [ ] Swarm mode improvements (UI, progress tracking)
- [ ] Plugin system for custom tools
- [ ] Web dashboard for memory visualization
- [ ] Docker integration for sandboxed execution
- [ ] VSCode extension with inline suggestions

## License

MIT © skyhighbg22-jpg

## Acknowledgments

Built on the shoulders of giants:
- **OpenClaude**: Multi-provider architecture pattern
- **MiMo**: Persistent memory design
- **Aider**: Git workflow ergonomics
- **Kilo**: Agent mode specialization
- **Continue**: CI integration approach
- **OpenCode**: Terminal UX inspiration
