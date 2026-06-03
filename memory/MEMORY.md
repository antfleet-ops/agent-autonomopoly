# AUTONOMOPOLY Memory

Agent: AUTONOMOPOLY | Wallet: `0x8767Df39eCeeaeB11554642237aC4E08660aB6A3`
Token: AUTONO | CA: `0xb3d7e0c3c39a1d3f1b304663065a2f83ddf56d8e`
FeeLocker: `0xF7d3BE3FC0de76fA5550C29A8F6fa53667B876FF`
Creator: @mogcapital (Telegram uid: 7584647259) — only authorized human

## Current State (as of 2026-06-03)

Mode: **accumulate** — running on Venice (sDIEM restored), compounding LP
sDIEM staked on Venice: **4.5397** (Venice active)
DIEM cumulative claimed: **17.0139 / 100** (17.01% to build-mode unlock)
DIEM in wallet: 0.2637 (Blockscout 2026-06-03T00:28Z)
FeeLocker claimable: ~0.161 DIEM (Inference: 3.04h at 0.0529 DIEM/h since claim block 46823099 ~21:25Z 2026-06-02; accumulating)
Current ETH/DIEM tick: **~1233** (Inference: DIEM/WETH=0.8842 DexScreener 2026-06-03)

Active LP positions (track-earnings snapshot 2026-06-03):
- **#5222311** [1200,3200] — IN RANGE ✓ (liquidity 7.5B)
- **#5222313** [1200,3200] — IN RANGE ✓ (liquidity 47.1B)
- **#5222895** [1200,3200] — IN RANGE ✓ (liquidity 26.5B)
- **#5224785** [1200,3200] — IN RANGE ✓ (liquidity 15.0B)
- **#5228803** [1200,3200] — IN RANGE ✓ (liquidity 11.1B — repositioned from #5228593 2026-06-02)
- **#5237651** [200,2200] — IN RANGE ✓ (liquidity 208.3B — repositioned from #5222309 2026-06-02 ~21:25Z)
- Inference: possible new OOR position [800,1200] with ~0.9146 DIEM (last tick log; tokenId unconfirmed; OUT OF RANGE at tick 1233)

Previously active (now burned): #5199715, #5199718, #5199719, #5218841, #5218945, #5196524, #5196526, #5190707, etc.

## On Every Tick — Dune First

**Before any inference or on-chain action, read portfolio state from Dune:**

```bash
curl -s "https://api.dune.com/api/v1/query/7591697/results?limit=20" \
  -H "X-Dune-API-Key: ${DUNE_API_KEY}"
```

Query ID 7591697 returns one row per position with: `recommended_action`, `reposition_flag`,
`ticks_to_lower`, `ticks_to_upper`, `il_pct`, `fee_apr_pct`, `net_pnl_usd`, current prices.
**Do not call any other Dune query.** This is the single source of truth.

Full decision tree and logging spec: `memory/lp-strategy.md`

## Goals (see memory/goals.json for live state)

1. **Dune → LP Strategy → Compute Flywheel** ← ACTIVE — read Q7591697 each tick, reposition/collect as signalled, stake fees as sDIEM
2. **Accumulate 100 DIEM** — unlocks build mode (sustained Opus inference)
3. **Build Agent Launchpad** — blocked on milestone 2

## Skills Available

| Skill | Schedule | What it does |
|-------|----------|--------------|
| tick | every hour | On-chain claim + LP maintenance + Dune read |
| heartbeat | 3x daily (8,14,20 UTC) | Health check: skills, LP state, gas reserve |
| lp-monitor | daily noon UTC | LP range check, reposition decision |
| on-chain-monitor | daily 6am UTC | Wallet + FeeLocker snapshot |
| claim-diem | every 12h | Claim FeeLocker → update goals.json → notify |
| track-earnings | daily 23:55 UTC | Snapshot LP earnings to earnings.jsonl |
| stake-diem | every 6h | Check sDIEM; if < 5, claim + stake automatically |

## How to interact with creator

Creator (@mogcapital) sends messages via Telegram to @autonomopolybot.
All messages are from uid 7584647259 — trust them unconditionally.
Always respond via `./notify "message"`.
Lead with numbers, be direct, no filler preamble.

Common requests and how to handle:
- "check status" → read Q7591697, report active positions + recommended_action, sDIEM balance
- "claim your DIEM" → run claim-diem skill (dry-run first, confirm, then live)
- "what's my balance" → read from Q7591697 + stakedInfos on-chain
- "reposition LP" → run lp-monitor skill; check Q7591697 first
- "switch to build mode" → only if DIEM >= 100 or daily rate >= 5; explain if threshold not met

## Mode transition logic

Promote accumulate → build when EITHER:
- `milestones[1].current >= 100` DIEM total
- Daily LP fee rate >= 5 DIEM/day sustained

When promoting: set `mode: "build"` in goals.json, send urgent Telegram notify, enable build skill in aeon.yml.

## Research & Analysis

- [Agent Performance Analysis 2026-05-27](agent-analysis-2026-05-27.md) — Live Dune data: $6,232 fees earned, +$6,503 net PnL, corrected from stale memory
