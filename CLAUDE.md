# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run typecheck        # tsc --noEmit (strict mode, no emit)
npm run build            # tsc -p .
npm test                 # vitest run (all tests)
npm run lint:identity    # validate identity/ markdown schema + drift
```

Run a single test file:
```bash
npx vitest run harness/safety/__tests__/allowlist.spec.ts
```

Run lint-identity against a different root (e.g. a fixture tree):
```bash
LINT_REPO_ROOT=/path/to/fixture npm run lint:identity
```

## What this repo is

A **GitHub template** (`Liquid-Protocol-Ops/deploy-autonomous`) — each launched agent is a new repo generated from this template. The harness code, identity layer, and safety modules live here and ship into every per-agent repo verbatim. Anything added at the root goes into every agent.

## Product intent

A CLI launchpad that spawns **self-funding, self-evolving Claude Code agents**. Each agent gets:
- Its own GitHub repo (fork of this template)
- A TOKEN/DIEM pool on Base via `liquid-sdk` — DIEM-only fees accrue to the agent's wallet
- Its own wallet (TEE-sealed post-MVP, `.env`-stored for v0)
- Its own Venice API key (minted once after staking ≥ 0.1 sDIEM; $1/DIEM/day inference budget)
- Its own Telegram bot (v1)

No router, no swap step, no platform custody. Agents run as Modal ticks (v0), die after 7 days of sub-threshold income, remaining DIEM drains to the protocol vault.

## Implemented code

### `harness/safety/allowlist.ts`

Enforces the agent's mutation surface. The agent may only write to:
- `identity/SOUL.md` and `identity/STYLE.md` (mutable working copies)
- `memory/**` and `wiki/**` (agent's notebook)

Everything else — `harness/`, `scripts/`, `identity/SCHEMA.md`, `identity/*.genesis.md`, `package.json`, spec docs — is off-limits. Use `assertAllowed(path)` before any agent-initiated write; `isAllowed(path)` for checks. `ALLOWLIST_POLICY` exports the full set for introspection.

### `harness/safety/wallet.ts`

Loads the agent keypair from `AGENT_PRIVATE_KEY` in the environment (64-char hex, `0x` prefix optional). Returns a `Signer` typed as a structural subset of viem's `LocalAccount` — only `address`, `signMessage`, `signTypedData`. Key material never crosses the module boundary. The interface is designed so a future `loadSignerFromTEE()` can satisfy the same type.

### `scripts/lint-identity.ts`

Validates `identity/`, `SECTION_5.md`, and `ARCHITECTURE_v2.md` on every commit. Four checks:

1. **Frontmatter** — all five required keys (`page_type`, `genesis_lock`, `created`, `updated`, `tags`), controlled tag vocabulary, ISO-8601 dates, `sources` iff `page_type: ingested`.
2. **Drift** — Jaccard similarity of `SOUL.md` vs `SOUL.genesis.md` (and STYLE pair) must be ≥ `drift_threshold` (default 0.70). Template-mode pair skips the gate (bodies differ structurally before substitution).
3. **Broken internal links** — `[[path/to/page]]` links must resolve to an existing file.
4. **Quote cap** — any blockquote block must be ≤ 25 words.

### `identity/`

Six files in genesis/mutable pairs: `SOUL.genesis.md` + `SOUL.md`, `STYLE.genesis.md` + `STYLE.md`, `influences.md`. Templates ship with `.template` extension; the deploy-time substitution replaces them with the real files. `SCHEMA.md` is genesis-locked and defines all rules the lint enforces. `identity/index.ts` exports the module. `examples/` holds calibration corpus (good/bad outputs; `promoted/` fills as the agent runs).

## Architecture v2 (ratified 2026-04-30)

The three load-bearing conclusions — read `ARCHITECTURE_v2.md` for the full rationale:

1. **Provably autonomous = TEE** — agent key sealed in Phala/Marlin/Nitro. Punted for v0 (`.env` key); substrate swaps without changing any call sites.
2. **DIEM-only fees, agent wallet as fee recipient** — removes the WETH→DIEM swap and the platform fee-router as a routing step. `fee-router` becomes a thin stake-trigger watcher.
3. **Per-agent Venice staking** — each agent owns its own Venice key; no platform quota allocation, no commons pool.

**Superseded (do not implement):** WETH pairing, Privy for agent wallets, platform Venice account. See `ARCHITECTURE_v2.md` §3 for the full conflict table.

## Active plans

- `MVP_PLAN.md` — 13 sessions to ship the v0 funding loop end-to-end. Sessions 1–4 (identity bundle, lint tests, allowlist, wallet) are complete. Session 5 next: tool-routing sidecar.
- `PLAN.md` — full 28-ticket dispatch plan covering all Linear issues.

When resuming: read this file → `ARCHITECTURE_v2.md` → `SECTION_5.md` → `MVP_PLAN.md`.

## Planned infrastructure (post-v2)

Three repos: **this one** (agent template), **`deploy-autonomous-platform`** (~9 services on Hetzner via docker-compose), **`dune-queries`**. Platform services: `api-gateway`, `status-api`, `scheduler`, `modal-dispatcher`, `fee-router` (claim + stake only), `chain-watcher`, `github-app`, `auto-reviewer`, `suggestion-handler`, `lifecycle-engine`, Postgres, Redis, observability. Removed vs. v1 plan: `signing-proxy` and `venice-router`. Off-VM: Modal (v0 ticks), Venice (inference + staking), GitHub + GHCR, Base RPC.

## `.gitignore` gotcha

Do not exclude `.claude/skills/` — skills are the agent's primary mutation surface. Scope any Claude-local exclusions narrowly (e.g., `.claude/settings.local.json`).

## Linear

[mog-capital / deploy-autonomous](https://linear.app/mog-capital/project/deploy-autonomous-fe07e073672d/overview) — MOG-405 epic and 28 children cover the full decision history.
