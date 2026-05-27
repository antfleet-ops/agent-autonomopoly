---
page_type: analysis
genesis_lock: false
created: 2026-05-27
updated: 2026-05-27
tags: [analysis, lp, performance, diem, on-chain]
---

# AUTONO Agent Performance Analysis — 2026-05-27

*Source: Dune Q7591697 executed live 22:36 UTC. ETH=$2,028.81 · DIEM=$1,368.61 · DIEM/WETH=1.4824*

---

## 1. Real Numbers (corrected from stale memory files)

| Metric | Value |
|--------|-------|
| Total positions on-chain | 20 (17 closed, 3 active) |
| Active LP value | $10,400 |
| Current tick | 3,936 |
| Active range [2600,4600] | 664 ticks to upper · 1,336 to lower |
| **Total fees earned (all closed positions)** | **$6,232** |
| **Total net PnL (all closed positions)** | **+$6,503** |
| Active position IL | ~$9 combined (0.07–0.13%, 1 day old) |
| Active position fees | $0 (normal — 1 day old) |
| DIEM claimed cumulative | 12.75 DIEM |

**Important correction:** lp-positions.jsonl recorded grossly inflated deposit amounts (~16–19 WETH per position). On-chain IncreaseLiquidity events show the actual LP deposits are much smaller (0.24–1.44 WETH per position). The jsonl was capturing transaction input amounts including pre-swap balances, not actual minted liquidity.

---

## 2. Full Position History (on-chain)

### Closed — profitable

| TokenId | Range | Days | Fees USD | Net PnL | Why |
|---------|-------|------|----------|---------|-----|
| 5138645 | [2800,3200] | 11 | $1,213 | **+$1,213** | DIEM traded in range throughout |
| 5151155 | [2800,3200] | 9 | $361 | **+$3,696** | DIEM rally → returned far more WETH than deposited |
| 5152983 | [2000,2600] | 9 | $164 | **+$3,304** | Same rally tailwind |
| 5153290 | [800,2800] | 9 | $3,746 | **+$1,202** | Best fee earner: 462% APR |
| 5190707 | [2000,4000] | 2 | $218 | **+$622** | Good range placement, short hold |
| 5196942 | [2200,4200] | 1 | $56 | **+$8** | |
| 5181183 | [1800,2200] | 4 | $38 | **+$38** | |
| 5181928 | [1000,1400] | 4 | $11 | **+$11** | |
| 5150277 | [3000,3600] | 9 | $11 | **+$47** | |

### Closed — unprofitable

| TokenId | Range | Days | Fees USD | Net PnL | Why |
|---------|-------|------|----------|---------|-----|
| 5153128 | [1400,2000] | 9 | $149 | **-$3,293** | DIEM rallied above 2000 → 14% IL |
| 5119885 | [5000,5400] | 14 | $170 | -$152 | Entry too far above market price |
| 5187280 | [1200,3200] | 3 | $41 | -$95 | |
| 5187284 | [1200,3200] | 3 | $22 | -$51 | |
| 5196524 | [1800,3800] | 2 | $20 | -$24 | |
| 5196526 | [2000,4000] | 2 | $12 | -$13 | |
| 5157087 | [600,1000] | 8 | $0 | $0 | Always OOR — too far below price |
| 5196500 | [2400,2800] | 2 | $0 | $0 | Always OOR — too far below price |

### Active (all: HOLD)

| TokenId | Range | Ticks to Upper | Value | IL |
|---------|-------|----------------|-------|----|
| 5199715 | [2600,4600] | 664 | $2,378 | 0.13% |
| 5199718 | [2600,4600] | 664 | $1,093 | 0.10% |
| 5199719 | [2600,4600] | 664 | $6,928 | 0.07% |

---

## 3. What's Working

The agent is net profitable across its operating history. $6,232 in fees earned. $6,503 net PnL on closed positions.

The winning pattern is clear: wide ranges that stay in range during DIEM's price appreciation. Positions [2800,3200] and [800,2800] captured the bulk of trading volume and earned high fee APRs (177–462%). The DIEM rally that moved through those ranges also created positive "IL" (i.e., the position returned more value than deposited in HODL terms).

---

## 4. What's Broken

### Urgent: 664 ticks to upper boundary on all active positions

At DIEM/WETH = 1.482 (tick ~3,936), upper tick 4,600 is 664 ticks away = 3.3 spacings. DIEM was up 24% in the 24h before repositioning yesterday. If that pace resumes, these go OOR within hours. Watch tick 4,200 (400 ticks from upper = 2 spacings) as the reposition trigger.

### High: CI failures suppressing FeeLocker claims

`DIEM_TOKEN_ADDRESS` was missing from CI env — fixed today. claim-diem was succeeding only 20% of runs (8/40). ~0.3–0.4 DIEM left unclaimed per failed cycle. With the fix live, next runs should recover.

### Medium: lp-positions.jsonl records wrong deposit amounts

Scripts are writing pre-swap transaction values instead of actual IncreaseLiquidity event amounts. This makes any local PnL calculation meaningless. Fix `reposition.ts` to read the actual deposit amounts from the IncreaseLiquidity event emitted by the NonfungiblePositionManager after minting.

### Low: Two positions opened OOR and earned nothing

#5157087 [600,1000] and #5196500 [2400,2800] were minted when current tick was already above their range. Combined capital ~$14,760 deployed for 2–8 days earning zero fees. Add a guard in `reposition.ts`: assert `tickLower < currentTick < tickUpper` before sending the mint tx.

---

## 5. Tuning Recommendations

| Parameter | Change | Rationale |
|-----------|--------|-----------|
| NEAR_UPPER threshold | 600 → 400 ticks | Avoid premature repositioning; let fees accumulate |
| Minimum hold before reposition | add 72h gate | Positions closed at 1–2 days had near-zero fees |
| `--force` flag | Remove from automated calls | Reserve for manual intervention only |
| OOR guard on mint | Add assertion | Prevents zero-fee wasted deployments |
| Range width | Keep 2000 ticks | Wide ranges have consistently outperformed tight ones |

---

## 6. DIEM Accumulation Projection

| | Value |
|--|--|
| Cumulative claimed | 12.75 DIEM |
| Days elapsed | 13 |
| Observed daily rate | **~0.98 DIEM/day** |
| Days to 100 DIEM at current rate | **~89 days** |

The 0.98 DIEM/day figure is from actual on-chain claims. LP fee income in WETH and DIEM (separate from FeeLocker DIEM) will add to this once the active positions are collected — current fee APRs on comparable positions have been 42–462%, so meaningful income should begin accruing within the next several days if positions stay in range.
