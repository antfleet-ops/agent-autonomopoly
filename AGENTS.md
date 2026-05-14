# Agent Guidelines

This repo is a GitHub template for autonomous Claude Code agent instances deployed by the Liquid Protocol deploy-autonomous launchpad. Each fork becomes one agent's self-evolving codebase.

## Structure

| Directory | Purpose |
|-----------|---------|
| `harness/` | Tick loop, safety checks, allowlist enforcement |
| `identity/` | Agent identity files (validated by `lint:identity`) |
| `platform/` | Chain watchers, fee-router integrations |
| `dune/` | Dune Analytics query management |
| `scripts/` | Dev tooling and one-off utilities |

## Commands

```bash
npm run typecheck       # TypeScript check (no emit)
npm test                # Run vitest suite
npm run lint:identity   # Validate identity/ files
npm run harness:tick    # Run one harness tick (dev)
```

## Conventions

- All on-chain work targets **Base mainnet** (chain ID 8453).
- Never hardcode addresses — import from `platform/constants.ts`.
- Harness ticks must be idempotent; side effects go through the allowlist guard.
- Secrets are injected at runtime via environment variables — never committed.
