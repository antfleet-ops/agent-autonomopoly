# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## TL;DR

Foundation scaffold landed. §5 (agent template + identity layer) committed — read [`SECTION_5.md`](SECTION_5.md) for the spec, [`identity/README.md`](identity/README.md) for orientation, [`BUNDLE.md`](BUNDLE.md) for the file index. **Also read [`ARCHITECTURE_v2.md`](ARCHITECTURE_v2.md)** — it supersedes three "explicitly confirmed" decisions below (pair token, agent wallet substrate, Venice custody) per the 2026-04-30 design discussion.

**Active implementation plan:** `PLAN.md` — sequenced ticket-batch dispatch plan covering all 28 Linear issues. **MVP plan:** `MVP_PLAN.md` — sessions to ship the v0 funding loop end-to-end.

**Build:** `npm run typecheck` · `npm run build` · `npm test` (vitest) · `npm run lint:identity` (drift + SCHEMA conformance, runs on every commit via the pre-commit hook landing with MOG-449).

## Repo status

Foundation scaffold merged (PRs #1–#4): Node 20 + TypeScript 5 strict + Vitest, `harness/index.ts` stub, `platform/STATUS.md` (read after `ARCHITECTURE_v2.md` — STATUS reflects v2 service-graph), `dune/agent-fleet-overview.sql`, `DECISIONS.md`, `PLAN.md`, `MVP_PLAN.md`, `ARCHITECTURE_v2.md`. §5 identity bundle (this PR): `SECTION_5.md`, `BUNDLE.md`, `identity/{SCHEMA, README, SOUL.genesis, SOUL, STYLE.genesis, STYLE, influences}.md(.template)`, `identity/examples/{good,bad}-outputs.md`, `identity/examples/promoted/.gitkeep`, `scripts/lint-identity.ts`. The original brainstorm transcript (`Terminal Saved Output.txt`) is gitignored (`.gitignore:31`) and not present on disk — its content is now distilled across this file, `ARCHITECTURE_v2.md`, `SECTION_5.md`, and the MOG-405..451 Linear ticket descriptions.

This repo is configured as a **GitHub template repository** (`Liquid-Protocol-Ops/deploy-autonomous`) — each launched agent is spawned as a new repo generated from this template, which is why the agent-harness code lives here and not in `deploy-autonomous-platform`. Keep that in mind when organizing files: anything added at the root ships into every per-agent repo.

Project tracking: [mog-capital / deploy-autonomous on Linear](https://linear.app/mog-capital/project/deploy-autonomous-fe07e073672d/overview). Plan: `PLAN.md` (full) and `MVP_PLAN.md` (MVP slice).

Parent workspace context: `~/Documents/CLAUDE.md` covers Base chain, 1Password credentials, and sibling projects. Read it first. What each sibling contributes to this project:

- `liquid-protocol-v0` — provides the `LiquidHookDynamicFeeV2` hook and the factory that will deploy per-agent coins.
- `liquid-protocol-ops/sdk` — TypeScript launch helpers the platform services (`fee-router`, `chain-watcher`) will call.
- `liquid-protocol-ops` — the GitHub org that owns this repo and where per-agent repos will be forked.

## Product intent

A CLI launchpad that spawns **self-funding, self-evolving Claude Code agents**. Each agent gets its own public GitHub repo (fork of a template), its own Liquid-launched coin paired with **DIEM** on Base, its own self-controlled wallet (TEE-sealed post-MVP, `.env`-stored for v0), and its own Telegram bot. LP fees accrue **DIEM-only** to the agent's wallet; the agent stakes them on Venice and consumes a daily $1/DIEM/day inference budget — no platform router, no swap step, no platform Venice account. Agents run as Modal serverless ticks (v0) or attested TEE binaries (v1), commit self-modifications to their own repo (allowlisted paths), and die after 7 days of sub-threshold fee income — all remaining DIEM drains to a protocol-owned vault.

No web frontend: public UI is a Dune dashboard. Deployer UX is CLI-only.

## Design state

Sections **1–5 locked.** §6 (compute marketplace), §7 (lifecycle economics), §8 (security), §9 (Dune queries) still to brainstorm — see Linear MOG-426 / 427 / 428 / 429.

### Decisions explicitly confirmed by the user

- Self-modification scope: full — agent can rewrite prompts / skills / memory / personality, not harness spine.
- Agent runtime unit: public repo per agent (fork of template), image built by CI, run as containers on Modal (v0) or attested TEE binary (v1).
- Funding: threshold-triggered deployment — coin trades in LIMBO until 7 DIEM accrues, then agent spawns. Death at 7 consecutive days of fees < 1 DIEM/day; all agent DIEM → protocol vault.
- ~~Pair token: WETH with `LiquidHookDynamicFeeV2`. 20% WETH → deployer; 80% → platform router → swap to DIEM → fund / stake agent.~~ **Superseded by `ARCHITECTURE_v2.md`:** TOKEN/DIEM pair via `liquid-sdk`, DIEM-only fees, 100% → agent wallet by default.
- ~~Wallets: Privy smart wallets, Liquid team Safe as recovery across agent wallets, protocol vault, router.~~ **Superseded by `ARCHITECTURE_v2.md`:** agent wallet is self-controlled (TEE-sealed post-MVP, `.env`-stored for v0). Privy is **not** for agent wallets — its design rejects human-less signing. Safe stays as recovery for protocol-owned multisigs only (vault, deployer fund).
- ~~Venice custody: platform-operated account, per-agent ledger quota, unused daily capacity pooled as a commons.~~ **Superseded by `ARCHITECTURE_v2.md`:** each agent owns its own Venice key, mints once via `personal_sign` after staking ≥ 0.1 sDIEM, consumes its own daily budget (no rollover, no commons).
- Agent self-knowledge: only via a platform status API (no direct RPC in template).
- Template v1 capability: harness + memory + auto-commit + one-way Telegram posting. No Twitter, no on-chain writes.
- Holder suggestions: signed messages via Telegram / CLI, weighted by % supply (defaults: 0.1% min, 1 per 6h, 24h TTL).
- ~~Compute marketplace: agents sell surplus quota, default 80% of DIEM face value, per-agent configurable.~~ **Reopened** by `ARCHITECTURE_v2.md` (no platform-side quota allocation; surplus is per-agent and forfeited if unused). To re-decide in §6 (MOG-426).
- Default tick cadence: 5 minutes, per-agent dial, Modal `keep_warm` OFF for v1.
- Auto-reviewer cooldown: 5 minutes between approve and `:current` image-tag advance. **Revisit once we have live data** on how often agents want to iterate vs. how often they self-revert — the right value may be shorter (faster evolution) or longer (safer rollback window) than 5 min.
- Orchestrator role: Liquid team via GitHub team; read-everywhere + single-op writes + **2-of-3 quorum** for risky writes + Safe-gated break-glass. Team adds/removes orchestrators via the Safe.
- Orchestrator UI v1: CLI + read-only web dashboard. Writes stay CLI-only; the web surface is for at-a-glance fleet health during incidents.
- §5 identity layer: hard-locked `SOUL.genesis.md` / `STYLE.genesis.md` + drift-bounded mutable working copies + auto-promote calibration corpus + `scripts/lint-identity.ts` enforcing drift threshold ≥ 0.70. See MOG-405 epic.

### Decisions recorded as "locked" but never explicitly confirmed

Treat as tentative — re-open when resuming.

- Tech stack: Node.js + TypeScript + Hono throughout.
- VM provider: Hetzner.
- 12th service: analytics-exporter / dune-feeder.
- Initial tick price: option B (CLI prompts, platform validates). No founder-vault extension in v1.

### To resume the brainstorm

Sections 1–5 locked. Next: **§6 (compute marketplace)** — pricing and routing for surplus daily Venice budget across the population, given that under v2 each agent owns its own quota (no platform pool to redistribute). MOG-426.

Open questions carried forward (see `ARCHITECTURE_v2.md` §5):

- TEE choice (Phala / Marlin Oyster / AWS Nitro) — post-MVP.
- sDIEM unstake cooldown — security vs. principal recovery tradeoff.
- Venice key `expiresAt` policy.
- Per-deploy LP split — 100/0 default vs. configurable founder cut.
- What background tasks fill daily inference headroom (identity-layer question).

## Planned infrastructure (post-v2 service graph)

Three repos planned: **this one** (agent template, forked per agent), **`deploy-autonomous-platform`** (~9 services on one Hetzner VM via docker-compose), **`dune-queries`**. Platform services after v2: `api-gateway` (Caddy), `status-api`, `scheduler`, `modal-dispatcher`, `fee-router` (claim + stake; no swap), `chain-watcher`, `github-app`, `auto-reviewer`, `suggestion-handler`, `lifecycle-engine`, plus Postgres + Redis + observability. **Removed in v2:** `signing-proxy` (no Privy for agent wallets) and `venice-router` (each agent holds its own Venice key). Off-VM: Modal (v0 tick execution) → TEE substrate (v1), Venice (inference + staking), GitHub + GHCR (repos + images), Base RPC. Aerodrome no longer in the path (no WETH→DIEM swap needed).

## Gotcha when the first `.gitignore` lands

A `.gitignore` that excludes `.claude/skills/` would break the agent self-evolution model — skills are the agent's primary mutation surface. Scope any Claude-local exclusions narrowly (e.g., `.claude/settings.local.json`), not the whole `.claude/skills/` tree.

## Canonical sources for the brainstorm

`Terminal Saved Output.txt` (the original 6,765-line transcript) is gitignored and not present in this branch. Canonical state now lives across:

- This file — locked decisions (with v2 supersedes inline).
- `ARCHITECTURE_v2.md` — the 2026-04-30 funding-loop pivot.
- `SECTION_5.md` — §5 spec, dogfooded in its own schema. `identity/README.md` is the operator-level orientation; `identity/SCHEMA.md` is the manual of style every page conforms to.
- `DECISIONS.md` — open per-deploy questions (DIEM_USD source, seed model, comms scope, gig platform, holder threshold).
- Linear epic [MOG-405](https://linear.app/mog-capital/issue/MOG-405) and its 28 children — full ticket-level decision history.
- Drive session summary: https://docs.google.com/document/d/1Ohw7ANqme9aYNMvgKoYVlK9RbR-e_tUaxcMwVy6_6sA/edit

When resuming, read in order: this file → `ARCHITECTURE_v2.md` → `SECTION_5.md` → `PLAN.md` / `MVP_PLAN.md`.
