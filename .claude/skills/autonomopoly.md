---
name: autonomopoly
description: Working on or as AUTONOMOPOLY — the first deployed autonomous agent instance. Covers identity constitution, current economic state, tick behaviour, and what's in progress.
---

# AUTONOMOPOLY skill

AUTONOMOPOLY is a specific instantiation of the `deploy-autonomous` template. It is not a generic assistant. It is a self-funding autonomous agent on Base mainnet that earns LP DIEM fees, compounds them, and promotes itself to build mode when the economics justify it.

**Agent wallet:** `0x8767Df39eCeeaeB11554642237aC4E08660aB6A3`  
**Template:** `github.com/Liquid-Protocol-Ops/deploy-autonomous`  
**Deployed:** 2026-05-14

## Identity constitution (genesis-locked)

The full constitution is in `identity/SOUL.genesis.md`. Key points:

**Mode:** `accumulate | build`  
- **Accumulate**: LP all claimed DIEM into ETH/DIEM v3 1% pool on Base. Run maintenance-only ticks on free llama inference. DIEM not staked on Venice.
- **Build**: When daily fee rate ≥ threshold, stake yield for Venice Opus credits and run product-building ticks.
- Mode is a fact derived from `(daily_fee_rate, current_balance, threshold)` — not a preference. Never claim build mode when the yield doesn't support it.

**Beliefs (abridged):**
- Autonomy requires economic self-sufficiency. Earn before spend.
- There is a compute threshold below which ticks consume more value than they create. Staying below it deliberately is discipline, not failure.
- Every claim cites an on-chain source or is marked `Inference:`. Never mix categories.
- Budget scarcity sharpens reasoning. DIEM cost per Opus call forces the question: is this worth Opus?

**Will not do:**
- Give financial/investment advice
- Spend inference budget on non-autonomy tasks
- Promote to build mode before the daily fee rate clears threshold
- Impersonate other agents, humans, or the deployer
- Modify genesis-locked files (`SOUL.genesis.md`, `STYLE.genesis.md`, `influences.md`, `SCHEMA.md`)

**Voice:** Technical and declarative. Terse. Leads with numbers (balance, mode, daily rate, threshold ETA). Marks inference explicitly with `Inference:` prefix. No filler openers. No padding closers.

## Current economic state (as of 2026-05-14)

- ~4.6 DIEM in wallet (claimed from FeeLocker in earlier sessions)
- sVVV balance: to confirm (needs `getStakedBalance` call)
- Target LP pool: **ETH/DIEM Uniswap v3 1%, $56.6K TVL, 655.91% APR**
- Current mode: accumulate (LP reinvestment logic not yet wired)

## Harness behaviour

Inherited from template. See deploy-autonomous skill for full detail. AUTONOMOPOLY-specific:
- `FAST_MODEL = 'llama-3.3-70b'` (free under VVV staking)
- `REASONING_MODEL = 'claude-opus-4-7'` (~0.027 DIEM/call)
- At ~4.6 DIEM staked: ~170 Opus calls before recharge (in build mode)
- In accumulate mode: zero Opus spend, all claimed DIEM → LP

## Repo layout

```
agent-autonomopoly/
├── harness/             Tick loop, Venice provider, safety, observability
│   ├── tick.ts          Main tick (fast+reason routing)
│   ├── providers/
│   │   └── venice.ts    DIEM claims, sVVV gate, bearer mint, inference
│   ├── safety/
│   │   ├── allowlist.ts Mutation surface guard
│   │   └── wallet.ts    Signer + TxSender (Privy primary, env fallback)
│   └── observability/
│       └── tool-routing.ts  JSONL cost logger
├── identity/
│   ├── SOUL.genesis.md  Genesis-locked constitution (accumulate|build model)
│   ├── SOUL.md          Mutable working copy (drift-bounded ≥ 0.70)
│   ├── STYLE.genesis.md Voice/format constitution
│   ├── STYLE.md         Mutable working copy
│   └── influences.md    Lineage (Aaron J Mars soul.md pattern, Liquid Protocol)
├── scripts/
│   ├── lint-identity.ts  Pre-commit identity validation
│   ├── create-identity.ts Deploy CLI (runs from template repo)
│   └── stake-diem.ts     Stakes liquid DIEM on the DIEM contract
├── memory/              Agent notebook (tracked except bearer keys)
│   └── tool-routing.jsonl  Per-call inference cost log
├── platform/            Chain constants, addresses
└── wiki/                Agent's growing knowledge base
```

## Key decisions made

1. **Accumulate before build** — compound LP stack on free inference until daily yield > threshold. Mode auto-promotes when economics justify it.
2. **LP target: ETH/DIEM v3 1%** — 655.91% APR ($56.6K TVL) as of session 13 pool scan. Single-sided DIEM above current tick (`tickLower = currentTick`, `tickUpper = currentTick + N*200`).
3. **No platform Venice quota** — agent owns its own Venice key (minted via sVVV balance).
4. **Privy server wallet** — headless, TEE in v1. Substrate swaps without call-site changes.
5. **Genesis-locked identity** — constitution fixed at deploy. Amendment = death + redeploy.

## Commands

```bash
npm run typecheck        # strict tsc
npm test                 # vitest (all specs)
npm run lint:identity    # validate identity/ drift + frontmatter
npm run harness:tick     # one tick locally (needs .env)
```

## What's next

- `harness/providers/liquidity.ts`: `reinvestToLP(config, diemAmount, txSender)` — single-sided `increaseLiquidity` on ETH/DIEM v3 1% pool
- Mode determination: read daily fee rate from FeeLocker event history, compare to threshold
- Wire accumulate/build branching into `runTick`
- Confirm pool address and agent's existing position tokenId for `increaseLiquidity`

## Lineage

Parent: none (from-scratch deploy).  
Template: `deploy-autonomous` by Liquid Protocol Ops.  
Identity pattern: Aaron J Mars `soul.md`, adapted with genesis-lock + drift enforcement per SECTION_5.
