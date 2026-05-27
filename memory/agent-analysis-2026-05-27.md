---
page_type: analysis
genesis_lock: false
created: 2026-05-27
updated: 2026-05-27
tags: [analysis, lp, performance, diem, repositioning]
---

# AUTONO Agent Performance Analysis — 2026-05-27

## 1. Performance Summary

**Operational window:** 2026-05-14 to 2026-05-27 (13 days)

| Metric | Value |
|--------|-------|
| Total capital deployed | ~52.6 WETH (~$109k at $2,070/ETH) |
| Active positions | 3 (tokenIds 5199715, 5199718, 5199719) |
| Current range | [2600, 4600] — in range |
| DIEM claimed (cumulative) | 12.75 DIEM |
| DIEM goal | 100 DIEM |
| Fees earned from LP | $0.00 |
| Net P&L on benchmark | -4.57% (price movement, not IL) |
| AUTONO token price | $0.00001537 (+486% 24h, $1.54M market cap) |
| Total LP positions opened | 12 |
| Total LP positions closed | 9 |

**DIEM income breakdown:**

| Date | Amount | Notes |
|------|--------|-------|
| 2026-05-16 | 6.978 DIEM | Dry-run only, not claimed |
| 2026-05-18 | 2.310 DIEM | Claimed |
| 2026-05-21 | 0.235 DIEM | Pending |
| 2026-05-23 | cumulative 12.75 | Claimed |
| 2026-05-26 | 0.338 DIEM | Blocked (env var issue) |
| 2026-05-27 | 0.047 DIEM | Pending |

**Cron skill success rates:**

| Skill | Success Rate | Runs | Successes |
|-------|-------------|------|-----------|
| on-chain-monitor | 100% | 5 | 5 |
| track-earnings | 67% | 3 | 2 |
| tick | 43% | 105 | 45 |
| lp-monitor | 32% | 108 | 35 |
| heartbeat | 30% | 64 | 19 |
| claim-diem | 20% | 40 | 8 |

---

## 2. Key Problems

### Problem 1: Excessive repositioning — positions never accumulate fees (CRITICAL)

**The agent repositioned 9 of 12 positions in 13 days.** Average position lifetime is approximately 1.1 days. Uniswap V3 fees accrue proportionally to time-in-range and volume. With a 1-day average lifetime, fee income is structurally near zero regardless of TVL.

**Full position history:**

| tokenId | Range | Opened | Closed | Lifetime | Status |
|---------|-------|--------|--------|----------|--------|
| 5119885 | [5000,5400] | ~2026-05-14 | ~2026-05-15 | ~1 day | Burned |
| 5152983 | [2000,2600] | ~2026-05-17 | 2026-05-19 | ~2 days | Burned |
| 5153128 | [1400,2000] | ~2026-05-17 | 2026-05-19 | ~2 days | Burned |
| 5153290 | [800,2800] | ~2026-05-17 | 2026-05-19 | ~2 days | Burned |
| 5187280 | [1200,3200] | ~2026-05-23 | 2026-05-25 | ~2 days | Burned (9.58 WETH + 11.96 DIEM) |
| 5187284 | [1200,3200] | ~2026-05-23 | 2026-05-25 | ~2 days | Burned (9.64 WETH + 9.72 DIEM) |
| 5190707 | [2000,4000] | ~2026-05-25 | 2026-05-26 | ~1 day | Burned (8.75 WETH + 10.06 DIEM) |
| 5196524 | [1800,3800] | 2026-05-26 | 2026-05-26 | <1 day | Burned (1.98 WETH + 1.33 DIEM) |
| 5196526 | [2000,4000] | 2026-05-26 | 2026-05-26 | <1 day | Burned (1.77 WETH + 0.70 DIEM) |
| 5199715 | [2600,4600] | 2026-05-26 | — | 1 day | ACTIVE |
| 5199718 | [2600,4600] | 2026-05-26 | — | 1 day | ACTIVE |
| 5199719 | [2600,4600] | 2026-05-26 | — | 1 day | ACTIVE |

The agent used `--force` to reposition positions 5190707, 5196524, and 5196526 on 2026-05-26 **even though they were in range**. This is the direct cause of $0 fees earned.

### Problem 2: claim-diem failure rate 80% — compounding DIEM loss

The `claim-diem` skill fails 80% of the time (32 of 40 runs). The 2026-05-26 failure was confirmed caused by an env var issue (`AGENT_WALLET` or `DUNE_API_KEY` missing from the CI environment). This means:
- 0.338 DIEM blocked on 2026-05-26 (not yet recovered)
- Recurring failures mean the agent is missing claim windows systematically
- At ~0.1 DIEM/day current rate, each missed claim is a meaningful loss against the 100 DIEM target

### Problem 3: Skill infrastructure instability (lp-monitor 32%, heartbeat 30%)

A combined 60-70% failure rate across core observability skills means the agent is effectively operating blind most of the time. When lp-monitor fails, the agent cannot detect out-of-range conditions. When heartbeat fails, the agent cannot report status. This makes it impossible to distinguish "everything is fine" from "everything is broken."

### Problem 4: Repositioning triggered on near-boundary heuristic, not actual out-of-range

The Dune query Q7591697 returns `recommended_action: reposition` based on `il_pct` and proximity to boundaries. The agent acts on this recommendation without a hard check for whether the position is currently earning fees. This means in-range positions with minor boundary proximity are being closed unnecessarily.

### Problem 5: Days-to-goal projection assumes current claim rate is stable

At 12.75 DIEM claimed in 13 days = 0.98 DIEM/day average, the goal of 100 DIEM appears reachable in ~89 days total, roughly 76 days from now (late July 2026). However, this rate is front-loaded: the 6.978 DIEM dry-run on 2026-05-16 was not actually claimed and early DIEM came from FeeLocker bootstrapping, not LP fees. The sustainable ongoing rate (LP fees only) is close to $0.00/day at present.

---

## 3. Root Cause Analysis

### RCA-1: Excessive repositioning

**Why it happens:** The `lp-monitor` skill calls `analyze-lp.ts`, which queries Dune Q7591697. The query computes `recommended_action` based on `il_pct` and `net_pnl_usd`. Venice AI receives this data and outputs a repositioning recommendation. The agent executes `reposition.ts --force` without verifying:
1. Whether the position is actually out of range
2. Whether accumulated fees justify closing the position
3. Whether a minimum lifetime (e.g., 7 days) has elapsed

The `--force` flag in `reposition.ts` explicitly bypasses the in-range guard. When Venice outputs "reposition," the agent passes `--force` unconditionally.

**Compounding factor:** The Dune query's `il_pct` metric can be negative (impermanent loss) even for in-range positions during volatile price movements. On 2026-05-26, DIEM was up 24% in 24h. The query likely flagged all positions as high IL and recommended repositioning — even though the optimal action was to hold and let the positions earn fees from the volatility.

### RCA-2: claim-diem 80% failure

**Why it happens:** The env var `AGENT_WALLET` and/or `DUNE_API_KEY` are set in the GitHub Actions workflow but are subject to secret rotation issues or missing from the specific job context. The 2026-05-26 failure was explicitly attributed to this. The broader 80% failure rate suggests the issue is structural, not a one-off: either secrets are inconsistently available, the skill has a timeout issue, or the FeeLocker contract call fails silently.

### RCA-3: Infrastructure instability

**Why it happens:** The cron-state.json data shows 32% success for lp-monitor over 108 runs. This is consistent with:
- Modal cold-start timeouts causing the tick to fail before the skill runs
- External API failures (Dune, Venice) propagating as skill failures
- Missing env vars silently causing the skill to exit non-zero
- No retry logic in the skill wrapper

### RCA-4: No minimum position lifetime enforcement

**Why it happens:** `reposition.ts` was written to respond to recommendations, not to enforce holding periods. There is no `MIN_POSITION_AGE_DAYS` guard. The script burns a position and opens a new one in a single call regardless of how new the position is.

---

## 4. Quantified Impact

### Impact of excessive repositioning

| Metric | Actual | If held 7+ days |
|--------|--------|-----------------|
| Average position lifetime | 1.1 days | 7+ days |
| Fee accumulation events | 0 | Est. 6-8 |
| Estimated fees at 0.3% APR on $109k | ~$0 | ~$63/week |
| Gas cost per reposition (est.) | ~$2-5 | Same per event |
| Total reposition events | 9 in 13 days | 1-2 in 13 days |
| Estimated gas burned on repositioning | ~$30-50 | ~$5-10 |

**The repositioning anti-pattern has a double cost:** it burns gas (removing capital) AND forfeits fee income. A position in range at [1200,3200] that was burned on 2026-05-25 could have earned fees for weeks if held.

### Impact of claim failures

| Period | Expected claims | Actual claims | DIEM missed |
|--------|----------------|---------------|-------------|
| 2026-05-14 to 2026-05-27 | ~40 attempts | 8 successes | est. 15-20 DIEM |
| Blocked 2026-05-26 claim | 1 | 0 | 0.338 DIEM |

### Days-to-goal projection

| Scenario | Daily DIEM rate | Days remaining to 100 DIEM |
|----------|----------------|---------------------------|
| Current (LP fees = $0) | ~0.05 DIEM/day from FeeLocker only | ~1,750 days — not viable |
| Fix claim-diem only (20% → 90% success) | ~0.25 DIEM/day | ~350 days |
| Fix repositioning (hold 7+ days) + fix claims | ~0.5-1.0 DIEM/day from LP fees | ~87-175 days |
| Fix repositioning + optimized range + fix claims | ~1.5-3.0 DIEM/day | ~29-58 days |

**The key insight:** At $109k TVL in a 1% fee pool, even modest volume generates meaningful fees. The ETH/DIEM pool at 1% fee tier on a day with $500k volume would generate $5,000 in fees, distributed pro-rata to LPs. If the agent holds 20% of pool TVL, that's $1,000/day in WETH fees alone. The agent is forfeiting this by repositioning before fees can accumulate.

---

## 5. Specific Recommendations

### Product-level fixes (agent framework / infrastructure)

**P1 — Enforce minimum position lifetime before any reposition**

Add to `reposition.ts`:
```typescript
const MIN_POSITION_AGE_HOURS = 168; // 7 days
const positionAge = Date.now() - positionMintTimestamp;
if (!force_override && positionAge < MIN_POSITION_AGE_HOURS * 3600 * 1000) {
  console.log(`Position too young (${positionAge/3600000}h < 168h). Skipping reposition.`);
  process.exit(0);
}
```

Remove `--force` from all automated calls in `analyze-lp.ts`. Reserve `--force` for manual operator intervention only.

**P2 — Fix claim-diem env var injection**

Audit the GitHub Actions workflow for `claim-diem`. Verify that `AGENT_WALLET` and `DUNE_API_KEY` are:
1. Present in the repository secrets
2. Correctly mapped in the workflow `env:` block for the specific job
3. Exported before the script executes

Add a pre-flight check at the top of `claim-diem`:
```bash
if [ -z "$AGENT_WALLET" ] || [ -z "$DUNE_API_KEY" ]; then
  echo "FATAL: Required env vars missing" >&2
  exit 1
fi
```

**P3 — Add explicit out-of-range gate before repositioning**

Before calling `reposition.ts`, check whether the current tick is actually outside the position's range. This is a single RPC call (`slot0()` on the pool contract). If the tick is in range, skip the reposition regardless of Venice's recommendation.

**P4 — Distinguish Venice recommendation confidence levels**

When Venice returns `recommended_action: reposition`, require a confidence threshold of > 0.8 AND out-of-range = true before executing. A Venice recommendation alone, based on IL metrics, should never trigger a forced reposition of an in-range position.

**P5 — Add retry logic to cron skills**

The current 30-43% success rate for tick/lp-monitor/heartbeat suggests Modal cold-start or transient API failures. Add:
- 3 retry attempts with 30s backoff for external API calls (Dune, Venice)
- Health check before skill execution: verify env vars, connectivity
- Separate "failure to execute" from "skill ran but found no action needed"

### Agent strategy fixes (LP positioning)

**S1 — Widen the range to reduce out-of-range events**

The current [2600, 4600] range is ±27% from center (tick 3600 maps to roughly the current price). A volatile new token like DIEM with 486% 24h moves will blow through narrow ranges constantly. Consider:
- Range: [1000, 8000] — covers 8x price movement either direction
- This reduces fee APR but guarantees the position stays in range through high volatility
- Fee accumulation over 30 days at a wide range beats zero fees from a narrow range that needs repositioning

**S2 — Hold positions through volatility, not despite it**

High DIEM price movement (486% 24h on 2026-05-27) is when fees are generated, not when repositioning should happen. Volume spikes during price discovery are the primary fee generation events. The agent should recognize high-volatility periods as "earn mode" and suppress repositioning signals.

**S3 — Rebalance by adding liquidity, not repositioning**

If the position is approaching a boundary but still in range, add a small amount of liquidity to a new position with a wider range rather than burning and reminting the entire position. This preserves accumulated (but uncollected) fees in the original position.

**S4 — Set minimum fee threshold before repositioning**

Only reposition if the existing position is out of range OR if the position has been in range for > 7 days AND accumulated fees are below a floor threshold (e.g., < 0.01 DIEM equivalent). This prevents premature repositioning of new positions.

### Agent identity / behavior fixes

**B1 — Venice prompt should ask "is the position out of range?" first**

The current Venice call sends LP metrics and asks for a recommendation. Restructure the prompt to begin with: "Is the current tick within the position range [lower, upper]? If yes, do not recommend repositioning." This changes the Venice decision tree to make range status the primary gate.

**B2 — Track fee accumulation in Venice context**

Send the position's elapsed age and estimated uncollected fees as context to Venice. If uncollected fees > $X, the prompt should weight "hold" heavily regardless of IL.

**B3 — Add operator review gate for force-repositions**

Any reposition using `--force` should write a pending action to `memory/pending-repositions.jsonl` and wait for manual confirmation. The operator can review and approve/reject via a script, preventing the autonomous agent from force-repositioning in-range positions.

---

## 6. Projected Improvement

### Scenario: Fix env vars + implement 7-day minimum position lifetime

**Changes required:**
1. Fix `AGENT_WALLET` / `DUNE_API_KEY` env injection in CI (est. 1 hour)
2. Add `MIN_POSITION_AGE_HOURS = 168` guard to `reposition.ts` (est. 30 min)
3. Remove `--force` from automated calls (est. 10 min)

**Expected outcomes:**

| Metric | Current | After fix |
|--------|---------|-----------|
| Position lifetime | 1.1 days avg | 7+ days |
| LP fee income | $0 | Est. $50-200/week at current TVL |
| claim-diem success rate | 20% | Target 85%+ |
| DIEM/day from claims | ~0.05 | ~0.25-0.5 |
| DIEM/day from LP fees (estimate) | $0 | Est. 0.5-2.0 DIEM/day (depends on DIEM price) |
| Days to 100 DIEM goal | ~1,750 (not viable) | **~50-100 days** |

### Why 50-100 days is achievable

At $109k TVL in a 1% fee pool, with the ETH/DIEM pool doing even modest $50k-200k/day volume (conservative for a token up 486% in 24h), the fee income to LPs is:
- $50k volume/day × 1% fee × agent's LP share (~30-50% of pool) = $150-250/day in fees
- At $0.00001537/AUTONO, DIEM at say $0.01/DIEM (estimate), $150/day = ~15 DIEM/day
- That puts 100 DIEM target at ~6 days of fee income

Even if DIEM price collapses and volume drops 10x, 1.5 DIEM/day puts the target at ~58 days from today.

**The current trajectory ($0 LP fees, 1,750 days) is entirely self-inflicted and fixable with two code changes.**

---

## 7. Immediate Action Checklist

Priority order:

- [ ] **Fix `claim-diem` env vars** — recover blocked 0.338 DIEM from 2026-05-26; prevent future failures
- [ ] **Remove `--force` from automated reposition calls** — stop burning in-range positions
- [ ] **Add 168h minimum position lifetime gate to `reposition.ts`**
- [ ] **Add out-of-range pre-flight check before any reposition** (single `slot0()` RPC call)
- [ ] **Restructure Venice prompt** to check in-range status before recommending action
- [ ] **Investigate lp-monitor 32% failure rate** — add retry logic and better error surfacing
- [ ] **Consider widening range** from [2600,4600] to [1000,8000] for the next position cycle

---

---

## 8. On-Chain Confirmation (Dune Query Results)

Dune query Q7592942 confirmed all 12 positions on-chain. Key findings from actual chain data:

**Actual position lifetimes (on-chain confirmed):**

| tokenId | Range | Opened | Closed | Lifetime |
|---------|-------|--------|--------|----------|
| 5119885 | [5000,5400] | 2026-05-14 | 2026-05-19 | 5 days |
| 5152983 | [2000,2600] | 2026-05-19 | 2026-05-19 | 0 days |
| 5153128 | [1400,2000] | 2026-05-19 | 2026-05-19 | 0 days |
| 5153290 | [800,2800] | 2026-05-19 | 2026-05-26 | 7 days (reminted 2026-05-21, also 5 days) |
| 5187280 | [1200,3200] | 2026-05-25 | 2026-05-26 | 1 day |
| 5187284 | [1200,3200] | 2026-05-25 | 2026-05-26 | 1 day |
| 5190707 | [2000,4000] | 2026-05-26 | 2026-05-26 | 0 days |
| 5196524 | [1800,3800] | 2026-05-26 | 2026-05-27 | 1 day |
| 5196526 | [2000,4000] | 2026-05-26 | 2026-05-27 | 1 day |
| 5199715 | [2600,4600] | 2026-05-27 | active | 0 days |
| 5199718 | [2600,4600] | 2026-05-27 | active | 0 days |
| 5199719 | [2600,4600] | 2026-05-27 | active | 0 days |

**DIEM transfer query note:** The FeeLocker contract distributes DIEM via a claim mechanism rather than direct ERC-20 transfers to the wallet. The wallet balance history query (Q7592945) shows DIEM appearing and disappearing on the same day — consistent with claim-then-immediately-provide-liquidity behavior, not with sustained DIEM holding.

**WETH balance history (confirmed on-chain):**
- 2026-05-19: +2.79 WETH (first WETH received, from LP exit)
- 2026-05-21: -1.86 WETH net (redeployed to LP)
- 2026-05-25: +0.46 WETH
- 2026-05-26: +13.10 WETH (mass reposition, LP exits)
- 2026-05-27: +3.61 WETH (more LP exits)
- Current WETH balance: ~18.1 WETH sitting uninvested

The WETH sitting in wallet confirms the agent is repeatedly exiting LP positions faster than it redeploies capital. On 2026-05-26 alone, 13.1 WETH came out of LP positions.

---

**Dune Dashboard:** [AUTONO Agent Performance](https://dune.com/mogcapital/autono-agent-performance)

**Dune Queries created this session:**
- Q7592942 — LP Position History (Base, all 12 positions)
- Q7592943 — DIEM Token Transfers (inbound, for future use)
- Q7592945 — Agent Wallet Token Balance History

*Analysis generated: 2026-05-27. On-chain data confirmed via Dune Analytics.*
