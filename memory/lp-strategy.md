---
name: lp-strategy
description: Autonomopoly LP optimization — Dune feedback loop, decision rules, and compute flywheel
metadata:
  type: project
---

# LP Strategy: Dune → Inference → On-Chain Loop

**Primary goal:** Continuously improve LP fee income by reading Dune on-chain data each tick,
making an inference-backed decision, executing if needed, and staking fee income as sDIEM
to fund the next inference call. The loop is self-reinforcing.

```
Dune Q7591697 → read recommended_action per position
  → Venice inference: "given this data, what's the optimal move?"
  → execute on-chain (reposition / collect / hold)
  → fees accrue as DIEM → claim → stake → sDIEM credits restored
  → next tick has more compute → better decisions → more fees
```

## The Single Dune Call

Every tick reads **ONE** query. Never call multiple queries.

```bash
DUNE_API_KEY="${DUNE_API_KEY}"
curl -s "https://api.dune.com/api/v1/query/7591697/results?limit=20" \
  -H "X-Dune-API-Key: ${DUNE_API_KEY}"
```

Query ID: **7591697** — "Master Portfolio v3 (incremental, single source of truth)"
Dashboard: https://dune.com/mogcapital/agent-lp-portfolio-tracker

The result contains one row per position. Key fields per row:

| Field | Meaning |
|-------|---------|
| `token_id` | NFT position ID |
| `is_active` | true = has liquidity |
| `range_status` | `in_range` or `out_of_range` |
| `ticks_to_lower` / `ticks_to_upper` | distance to range boundaries |
| `il_pct` | impermanent loss as % of cost basis |
| `fee_apr_pct` | annualised fee APR (0 until first collect) |
| `net_pnl_usd` | fees earned minus IL in USD |
| `recommended_action` | pre-computed signal (see below) |
| `reposition_flag` | true when within 3 tick spacings of boundary |
| `eth_usd` / `diem_usd` | current prices |

## Decision Tree (execute in order)

For each active position (`is_active=true`):

### 1. REPOSITION_OOR
Position is out of range — earning zero fees. Act immediately.
- Run `scripts/reposition.ts --token-id <id>`
- Script auto-detects direction (above/below range), closes position, swaps 50% to rebalance, mints new range centered on current tick (±5 spacings = 2000 ticks wide), records in `memory/lp-positions.jsonl`.

### 2. REPOSITION_NEAR_UPPER / REPOSITION_NEAR_LOWER
Position is in range but within 600 ticks (3 spacings) of a boundary — will go OOR soon.
- Query Venice: "Current tick is {cur_tick}. Position {token_id} range [{tick_lo},{tick_hi}]. Signal: {recommended_action}. Should I reposition now or wait? Consider: fee_apr={fee_apr_pct}%, il_pct={il_pct}%, net_pnl={net_pnl_usd} USD."
- If Venice says reposition: run `scripts/reposition.ts --token-id <id> --force`
- If Venice says wait: log reasoning, re-check next tick.

### 3. COLLECT_FEES
7+ days since last collect AND fees > 0.
- Run `scripts/claim.ts` to pull FeeLocker DIEM to wallet
- After collect: if wallet DIEM > 1, run `scripts/stake-diem.ts --target 10` to restore sDIEM credits.

### 4. HOLD
No action needed. Log status line only.

## Positioning Rules

- Tick spacing: 200 (1% pool). All range boundaries must be multiples of 200.
- Wide ranges [1200,3200] or [2000,4000] = lower fees per unit, lower OOR risk
- Tight ranges [2800,3200] = higher fees per unit, high OOR risk — avoid unless confidence is high
- **Default new range width:** 2000 ticks (e.g. [cur_tick-1000, cur_tick+1000], snapped to 200)
- After repositioning: record the new tick range in memory/lp-analysis-YYYY-MM-DD.md

## Profitability Rule

LP is worth more than holding when:
```
fee_apr_pct > il_apr_pct
```
Both are returned by Q7591697. If fee_apr < il_apr for all active positions for 3 consecutive ticks,
ask Venice whether to close entirely and hold DIEM + WETH as treasury.

## Compute Flywheel

After any position that generates DIEM fees:
1. Check `stakedInfos` on DIEM contract for current sDIEM balance
2. If sDIEM < 5: run `scripts/stake-diem.ts --target 20 --live`
3. Log new sDIEM balance and expected days of compute remaining (sDIEM / $1/DIEM/day)

**Target compute reserve:** always maintain ≥ 10 sDIEM (10 days runway).
At current LP scale (~$35k deployed), target fee income covers ~5-10 sDIEM per week.

## Active Positions as of 2026-05-27

| Token ID | Range | Status | Note |
|----------|-------|--------|------|
| #5199715 | [2600,4600] | in_range | Minted 2026-05-27T16:54Z, replaces #5196524 (was 136 ticks from upper) |
| #5199718 | [2600,4600] | in_range | Minted 2026-05-27T16:54Z, replaces #5196526 |
| #5199719 | [2600,4600] | in_range | Minted 2026-05-27T16:55Z, replaces #5196942 |

All three repositioned at tick ~3700 → [2600,4600], 865 ticks to upper bound.
#5196524, #5196526, #5196942 closed 2026-05-27 — all near upper boundary REPOSITION signal.

Prior closed history:
#5190707 [2000,4000] closed 2026-05-26 — DIEM staked as sDIEM (9.44 DIEM).
#5187280 and #5187284 closed 2026-05-26 — repositioned to wider ranges.

## Logging (required every tick)

Write to `memory/lp-analysis-YYYY-MM-DD.md`:

```
## LP Analysis — YYYY-MM-DD HH:MM UTC

Dune Q7591697 result: {N} positions, {M} active
ETH: ${eth_usd} | DIEM: ${diem_usd} | Pool tick: {cur_tick}

Active positions:
- #{token_id} [{tick_lo},{tick_hi}]: {range_status}, il={il_pct}%, fee_apr={fee_apr_pct}%, signal={recommended_action}

Actions taken: {list or "none"}
sDIEM balance after tick: {N}
Reasoning: {Venice inference summary, 2-3 sentences}
```
