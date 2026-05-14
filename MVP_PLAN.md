# MVP plan — v0 funding loop, end-to-end on Base

**Goal (per `ARCHITECTURE_v2.md` §6):** one agent, one TOKEN/DIEM pool, off-laptop, no TEE. The acceptance test is the loop holding for ≥ 24 hours: trades happen → fees accrue → agent claims → agent stakes → agent mints Venice key → agent runs inference → daily budget ticks down → next day's allocation refreshes.

**Out of scope for MVP:** TEE substrate, Modal scheduling, posters (Telegram/X/email), auto-reviewer, status-api, compute marketplace, lifecycle-engine death-and-drain, web dashboard, multi-agent orchestration. All of those are v1+ and have separate Linear tickets.

## Sessions (sequenced)

Each row = one Claude Code session. Dispatch in order. Branches default to `claude/<short-name>` and merge into a chain of small PRs rather than one mega-PR.

| # | Session | Tickets | What lands | Acceptance |
|---|---------|---------|------------|------------|
| 1 | **§5 identity bundle** | MOG-409..421 + 422 + 423 | All 13 §5 files + doc edits in one atomic PR (see `PLAN.md` Batch 1) | `npm run typecheck` clean; `node scripts/lint-identity.ts` exits 0 against templates |
| 2 | **Lint test fixtures** | NEW-A (file in Linear before dispatch) | `scripts/__tests__/lint-identity.spec.ts` with drift fixtures at ~0.95 / ~0.71 / ~0.40 + one SCHEMA-bad fixture | `npm test` green; pins Jaccard contract before any future scorer swap |
| 3 | **Harness allowlist** | sub-ticket of MOG-424 (file as 4l) | `harness/safety/allowlist.ts` — enforces the two mutation paths from §5; throws on writes outside allowlist | unit tests cover both paths and rejection cases |
| 4 | **Wallet substrate (v0)** | new sub-ticket | `harness/safety/wallet.ts` — loads agent keypair from `.env`; exposes a typed `signer` interface that can later be backed by a TEE without changing call sites | unit tests with a fixture key; confirms no key material crosses module boundary |
| 5 | **Tool-routing sidecar** | NEW-B (file in Linear before dispatch) | `harness/observability/tool-routing.jsonl` emitter — appends one line per provider call (provider, variant, prompt-cache-hit, latency, tokens, cost) | called by Venice provider in session 6; jsonl shape covered by a Vitest snapshot |
| 6 | **Venice provider** | sub-ticket of MOG-424 (4b) | `harness/providers/venice.ts` — implements: detect claimable DIEM via `LiquidFeeLocker`; claim; approve sDIEM staking contract; stake; mint Venice key (`personal_sign` flow); cache the bearer; call inference; log via tool-routing | end-to-end against Base mainnet (small DIEM amount): claim + stake + mint + 1 inference call; bearer cached on disk under allowlist |
| 7 | **Tick main loop** | sub-ticket of MOG-424 (4a) | `harness/tick.ts` — composes wallet + venice + allowlist + tool-routing; checks daily budget; runs a placeholder task (no posters, no git writes yet) | runs once locally with a fake task, emits one tool-routing line, exits 0 |
| 8 | **Git auto-commit** | sub-ticket of MOG-424 (4j) | `harness/git-ops.ts` — committed paths gated by allowlist; commit messages emitted by the agent; `.husky/pre-commit` runs `lint-identity.ts` | a tick that mutates `memory/foo.md` produces a clean commit; a tick that tries to mutate `harness/tick.ts` is rejected |
| 9 | **Memory I/O + wiki-io** | sub-ticket of MOG-424 (4g) | `harness/memory-io.ts` and `harness/wiki-io.ts` — schema-conformant reads/writes against `identity/` and `memory/` per `SECTION_5.md` SCHEMA | round-trip a memory page through write → lint → read; write that violates SCHEMA throws |
| 10 | **Daily-budget queue** | new sub-ticket | `harness/queue.ts` — per-tick budget calc (remaining sDIEM headroom in DIEM/day); FIFO of background tasks; dequeues to fill headroom; logs forfeited DIEM if any | unit tests for: full queue / empty queue / over-budget task; integration test with venice provider running a 2-task tick |
| 11 | **Fee-router (read-only)** | sub-ticket of MOG-424 / new platform ticket | `platform/services/fee-router/` minimal: HTTP `GET /agents`, `GET /agents/:id`, `GET /health`; polls `LiquidFeeLocker`; **no writes** (agent stakes itself in v2) | local docker-compose stand-up; returns claimable DIEM for a registry of one agent |
| 12 | **CLI launcher (soul phase + wallet provisioning)** | MOG-425 (revised) | `platform/services/cli-launcher/` — minimum needed to deploy one agent end-to-end: funding precheck, soul phase (Author/Fork only — Ingest deferred), wallet provisioning (v0: `.env`), token deploy via `liquid-sdk`, seed stake, repo fork, registry write | `deploy-autonomous launch --dry-run` produces a complete deploy plan; `deploy-autonomous launch` against Base sepolia mints one agent token and one agent repo |
| 13 | **End-to-end MVP smoke** | new sub-ticket | live test on Base mainnet with a tiny pool: synthetic trades from a second deployer wallet → fees accrue → agent ticks → agent stakes → Venice key minted → inference call returns → 24h loop holds | written up as `docs/MVP_SMOKE_RESULTS.md` with tx hashes, sDIEM balance over time, and inference call traces |

## Dispatch prompts (paste-ready)

Replace `{N}` with the row number; the wording stays identical.

> Implement MVP plan session {N} per `MVP_PLAN.md`. Read the relevant ticket(s) and any preceding session output before starting. Acceptance gates listed in `MVP_PLAN.md`. Do not exceed scope — the MVP is the v0 funding loop only; defer posters, TEE, status-api, auto-reviewer, marketplace, and lifecycle-engine for post-MVP.

## Open prerequisites that must be answered before MVP can ship

These come from `platform/STATUS.md` and `ARCHITECTURE_v2.md`. None block sessions 1–4; sessions 5+ need them.

| # | Question | Blocks | Default if undecided |
|---|----------|--------|----------------------|
| P-1 | Venice staking contract address on Base | session 6 | block; cannot stake without it |
| P-2 | sDIEM unstake cooldown (if any) | session 13 (security note in smoke results) | proceed with disclaimer |
| P-3 | DIEM `decimals()` confirmed = 18 | session 6 | check on-chain at load time; bail if mismatch |
| P-4 | Per-deploy LP split (100/0 default vs. configurable founder cut) | session 12 | default 100/0 (all to agent) |
| P-5 | GitHub App token with template-fork scope | session 12 | use a personal-access-token fallback for first deploy |
| P-6 | `deploy-autonomous-platform` repo: create now, or stage under `platform/` here? | session 11/12 | stage under `platform/` here for MVP, move post-MVP |
| P-7 | TEE choice (Phala / Marlin Oyster / AWS Nitro) | post-MVP | not blocking MVP |
| P-8 | Anthropic key path if agent uses Claude (vs. Venice-hosted models) | session 6 (provider variants) | ship Venice-only for MVP; Claude path is a v1 question |

## Session-count summary

- **13 sessions** to MVP. ~10 are concentrated harness/CLI work; 1 is identity bundle; 1 is fee-router; 1 is the live smoke.
- Sessions 1–4 can run today — no external blockers.
- Sessions 5–10 need P-1 (Venice staking address) only.
- Sessions 11–12 need P-1 + P-3 + P-5 + P-6.
- Session 13 needs everything plus a live deployer wallet with DIEM and ETH on Base.

## Post-MVP ladder (not part of this plan)

Once the loop holds for 24h, the next milestones are:

1. TEE substrate swap (Phala/Marlin/Nitro) — provability layer.
2. Lint upgrade Jaccard → embedding cosine (MOG-430), once `examples/promoted/` has live data.
3. Posters (Telegram one-way per CLAUDE.md template-v1 capability list).
4. Status-API + Dune live.
5. CLI launcher Ingest branch (deferred from session 12).
6. Auto-reviewer + lifecycle-engine + chain-watcher.
7. §6–§9 brainstorms (compute marketplace, lifecycle econ, security, Dune queries).
