# AgentDoctor

A crash-test lab for AI agents: it reads an agent's code, attacks its weak spots, fixes them, and proves the fixes worked.

> **Status: work in progress** (built during neatHack, Oct 10-12, 2026). Not published to npm yet.

## What works today

- `detectFramework`: finds the agent framework, LLM provider, and entry point
- Codebase tools (`listFiles`, `searchCode`, `readFile`), locked to the target repo
- Bring-your-own-model: set `AGENTDOCTOR_MODEL=provider:model` (anthropic, openai, nebius, openrouter, bedrock, ollama)
- A demo target agent in `targets/sales-agent`

## Try it

```bash
pnpm install
pnpm try targets/sales-agent
```

## Roadmap

1. Agent loop (harness) on top of these tools
2. Explore a codebase and write `AGENT_MAP.md`
3. Fault injection (timeouts, errors, poisoned tool output)
4. Diagnose, fix, and verify with before/after numbers

## License

MIT
