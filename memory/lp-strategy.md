---
name: lp-strategy
description: Autonomopoly LP optimization goals, accumulation targets, and positioning rules for the WETH/DIEM 1% Uniswap V3 pool
metadata:
  type: project
---

# LP Strategy & Accumulation Goals

**Primary goal:** Accumulate WETH and DIEM via LP fee income from the WETH/DIEM 1% Uniswap V3 pool on Base mainnet.

## Accumulation Targets
- Compound all collected fees (WETH + DIEM) back into new LP positions or hold as treasury
- FeeLocker DIEM claims are separate income — do not conflate with LP fees
- Track WETH and DIEM balances separately; both are valuable treasury assets

## Profitability Rule
Fee APR must exceed IL rate (annualized) for LP to be worth more than just holding.
- Fee APR = `(fees_collected / capital_deployed) / days_held * 365`
- IL rate = `(hodl_value - lp_value) / hodl_value / days_held * 365`
- **Target:** fee_apr_pct > il_apr_pct on each active position

## Review Cadence
Each tick, `scripts/analyze-lp.ts` must:
1. Fetch Q7582815 (IL vs Fees) to get current fee_apr and il_apr per position
2. Fetch Q7582569 (Per-Position Full Breakdown) for historical context
3. Compute net_pnl = fees_earned_usd − il_usd for each position
4. Query Venice AI with the full metrics + these goals
5. Write findings to `memory/lp-analysis-YYYY-MM-DD.md`
6. Update Dune strategy log (Q7582817) via REST API PATCH

## Positioning Rules
- Wide ranges (1200-3200, 2000-4000 ticks) are safe for staying in range but dilute fee concentration
- Tighter ranges earn more fees per unit of capital BUT go out of range more often — IL spikes when OOR
- **Reposition trigger:** If current tick is within 2 spacings (400 ticks) of a range boundary, flag for reposition
- Tick spacing for 1% pool = 200; always snap range boundaries to multiples of 200
- After repositioning, deploy to the range that historically produced the best fee_apy_pct

## Current Active Positions (as of 2026-05-26)
- 5187280: [1200, 3200] — wide range, low IL concentration
- 5187284: [1200, 3200] — wide range, low IL concentration  
- 5190707: [2000, 4000] — medium range, current tick ~2967
- All in range at tick ~2967; no fees collected yet (25 days old)
- Total IL: ~$168 (0.5% of capital) — acceptable, within normal V3 range

## Dune Queries for Agent Review
- Q7582815: IL vs Fees per active position (refresh each tick)
- Q7582817: Strategy Log (PATCH with new review row each tick)
- Q7582569: Per-Position Full Breakdown (historical + active)
- Dashboard: https://dune.com/mogcapital/autonomopoly-agent-portfolio-lp-tracker

**Why:** Fee APR data isn't available yet (no collects in 25 days). Once collect events appear, this strategy can be calibrated against actual fee income. Until then, hold positions and let fees accrue.
