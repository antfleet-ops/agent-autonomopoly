# Platform foundation — status

This directory will hold the off-chain services that route DIEM fees, expose the status API, launch new agents, and post to social channels. It's an intentional draft home: per the repo's stated architecture these belong in a separate `deploy-autonomous-platform` repo. Move them out once that repo exists.

## What's done

- [x] **Step 1** — DIEM-paired Liquid token deploy script with $1K→$10B 7-position MC layout (`liquid-protocol-ops/sdk` PR #11, merged)
- [x] Foundation scaffold landed (this PR) with `DECISIONS.md`, status doc, first Dune query stub

## What's planned for the next PR

- [ ] **Step 2** — `platform/services/fee-router/` (real code, ~150 LOC)
  - Polls `LiquidFeeLocker.availableFees(claimWallet, DIEM)` per agent
  - Claims when ≥ 1 DIEM, then approves + stakes on Venice staking contract
  - HTTP API: `GET /agents`, `GET /agents/:id`, `GET /health`
  - Falls back to read-only mode if `ROUTER_KEY` is unset
  - **Blocker:** Venice staking contract address (see `DECISIONS.md`)
- [ ] **Step 3** — Aeon-template additions: `skills/{venice-context,deploy-token,compute-gate}/SKILL.md`, `aeon.yml.example`, `prompts/personality.md.template`, `harness/index.ts` rewrite
- [ ] **Step 4** — `platform/services/status-api/` (Hono proxy on top of fee-router; joins Liquid pool data; feeds Dune)
- [ ] **Step 5** — `platform/services/cli-launcher/` (TS CLI; creates per-agent GitHub repo + Privy wallet + token + 5-DIEM seed + registry entry)
- [ ] **Step 6** — Auth-gated creator-terminal web UI (deferred to its own PR)
- [ ] **Step 7** — `platform/services/posters/` with X / email / Fiverr adapters; agent never holds API keys (signing-proxy proxies posts)
- [ ] Second Dune query (`agent-compute-vs-mc.sql`) — time series

## Compute-denominated dashboard (per user request)

The Dune dashboard built on `dune/agent-fleet-overview.sql` shows each agent's market cap **alongside** their `dailyComputeUsd = stakedDiem × $1`. The agent token's intelligence-backed valuation is `dailyComputeUsd × 365 × multiple`, which is the *real* unit for comparing agent tokens — a $1M-MC agent with 100 DIEM staked is meaningfully different from a $1M-MC agent with 1 DIEM staked.

## Resume recipe

When the next session starts:

1. Read `DECISIONS.md` — if user has selected, configure deploys accordingly
2. Push `platform/services/fee-router/` (the lynchpin). Run end-to-end in read-only mode against the agent token from PR #11.
3. Push `platform/services/status-api/`, then point Dune at it.
4. Push remaining services (`cli-launcher`, `posters`).
5. Push agent-template additions (skills + harness rewrite).

## Open blockers

| # | Blocker | Owner | Notes |
|---|---------|-------|-------|
| 1 | Venice staking contract address on Base | user | fee-router stakes will fail without it; runs read-only otherwise |
| 2 | DIEM `decimals()` confirmed = 18 | user | PR #11's tick math assumes 18; on-chain check guards |
| 3 | Privy app credentials | user | `cli-launcher` step 2 |
| 4 | GitHub App token (with template-fork scope) | user | `cli-launcher` step 1 |
| 5 | X/Twitter API bearer (for `signing-proxy`) | user | `posters/x.ts` |
| 6 | Email provider account (Resend/Postmark) | user | `posters/email.ts` |
| 7 | Decision: create `deploy-autonomous-platform` repo? | user | If yes, request my MCP scope expansion to include it; the `platform/` directory here moves there. |
