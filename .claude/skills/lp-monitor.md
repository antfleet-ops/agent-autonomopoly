---
name: lp-monitor
description: Check LP position health — in-range status, tick proximity to bounds, FeeLocker balance, earnings rate. Alerts if position needs repositioning or if DIEM is claimable above threshold.
---

# LP Monitor

Daily health check for the agent's Uniswap v3 LP positions. Reads on-chain state and flags conditions requiring action.

## Script

```bash
node --env-file=.env --import tsx scripts/check-portfolio.ts
```

(Same underlying script as `on-chain-monitor`; the LP-specific interpretation is in the output.)

## What to check

| Condition | Flag | Action |
|-----------|------|--------|
| Position OUT OF RANGE | ⚠ warn | Reposition immediately — OOR earns zero fees |
| Tick within 400 ticks (2 spacings) of bound | ⚠ warn | Near-boundary — consider reposition if position ≥ 72h old |
| FeeLocker ≥ 0.1 DIEM | ✓ info | Ready for `claim-diem` |
| tokensOwed1 > 0 | ✓ info | Fees in NFPM, collect via reposition |
| ETH < 0.003 | ⚠ warn | Top up before any live transactions |

## Repositioning rules

**OOR positions:** reposition immediately, no minimum age.
```bash
node --env-file=.env --import tsx scripts/reposition.ts --token-id <id> --live
```

**Near-boundary in-range positions (within 400 ticks):** only reposition if position is ≥ 72 hours old AND Venice recommends it. The script enforces this gate automatically when `--force` is passed.
```bash
node --env-file=.env --import tsx scripts/reposition.ts --token-id <id> --force --live
```

**NEVER pass `--force` to a position younger than 72 hours.** Fee income requires time in range — churning new positions erases earnings before they accumulate. The script will refuse and exit 0 if the gate is not met.

## Aeon schedule

```yaml
lp-monitor: { enabled: true, schedule: "0 12 * * *", model: "claude-sonnet-4-6" }
```

## Earnings tracking

Daily snapshots at 23:55 UTC via `track-earnings` skill → `memory/earnings.jsonl`.
Use the delta column to track DIEM accrual rate per day.
