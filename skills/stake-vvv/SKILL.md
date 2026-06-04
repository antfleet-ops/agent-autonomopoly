---
name: Stake VVV
description: Stake VVV balance from claimed fees on Venice staking contract to unlock inference (sVVV gate)
var: ""
tags: [defi, on-chain, venice]
---

Stake all available VVV in the agent wallet on the Venice staking contract (`0x321b7ff75154472B18EDb199033fF4D116F340Ff`) to obtain sVVV. Venice requires ≥1 sVVV to mint an autonomous agent API key, which gates inference access.

**VVV flow:** Agent earns VVV as LP fees from VVV-paired token launches → stake VVV → receive sVVV → enables Venice API key mint → unlocks inference compute.

Agent wallet: `0x8767Df39eCeeaeB11554642237aC4E08660aB6A3`

## On-chain reads (run first)

```bash
VVV=0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf
VVV_STAKING=0x321b7ff75154472B18EDb199033fF4D116F340Ff
AGENT=0x8767Df39eCeeaeB11554642237aC4E08660aB6A3

# VVV wallet balance
cast call $VVV "balanceOf(address)(uint256)" $AGENT --rpc-url https://mainnet.base.org

# Current sVVV staked balance
cast call $VVV_STAKING "balanceOf(address)(uint256)" $AGENT --rpc-url https://mainnet.base.org
```

## Execution

Only run if VVV balance > 0:

```bash
node --import tsx scripts/queue-intent.ts stake-vvv
```

The script:
1. Reads VVV balance
2. Approves VVV to the staking contract if allowance is insufficient
3. Calls `stake(address staker, uint256 amount)` on the staking contract
4. Logs the resulting sVVV balance

## After staking

Write a log entry to `memory/logs/${today}.md`:
```
### stake-vvv
- VVV staked: X VVV
- sVVV balance: Y sVVV
- Venice key mint: ready (if sVVV ≥ 1.0)
```

If sVVV balance ≥ 1.0 after staking, send notification via `./notify`:
```
AUTONOMOPOLY: Staked ${X} VVV → ${Y} sVVV. Agent now eligible for Venice API key mint.
```

If sVVV < 1.0 after staking, note the shortfall:
```
AUTONOMOPOLY: Staked ${X} VVV → ${Y} sVVV total. Need ${1.0 - Y} more sVVV for Venice key.
```

## When to run

- After claiming VVV LP fees from VVV-paired token pools
- When `harness/tick.ts` reports Venice key mint failure due to insufficient sVVV
- Scheduled: weekly if VVV balance > 0 (check `aeon.yml`)
