---
name: LP Monitor
description: Check ETH/DIEM LP position health, FeeLocker balance, and capital allocation
var: ""
tags: [defi, on-chain]
---

Monitor the AUTONOMOPOLY agent's LP position and FeeLocker state.

Agent wallet: `0x8767Df39eCeeaeB11554642237aC4E08660aB6A3`

## On-chain reads

Run each of these and record the results:

```bash
AGENT=0x8767Df39eCeeaeB11554642237aC4E08660aB6A3
DIEM=0xF4d97F2da56e8c3098f3a8D538DB630A2606a024
NFPM=0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1
POOL=0x80d995189ecc593672aD4703b250a5e82672EB1D
FEE_LOCKER=0xF7d3BE3FC0de76fA5550C29A8F6fa53667B876FF

# 1. FeeLocker claimable
cast call $FEE_LOCKER "availableFees(address,address)(uint256)" $AGENT $DIEM --rpc-url https://mainnet.base.org

# 2. Wallet DIEM balance
cast call $DIEM "balanceOf(address)(uint256)" $AGENT --rpc-url https://mainnet.base.org

# 3. Pool current tick and sqrtPrice
cast call $POOL "slot0()(uint160,int24,uint16,uint16,uint16,uint8,bool)" --rpc-url https://mainnet.base.org
```

Read the current tokenId from `memory/lp-positions.jsonl` (last line). Then:

```bash
# 4. LP position state (use the tokenId from memory)
cast call $NFPM "positions(uint256)(uint96,address,address,address,uint24,int24,int24,uint128,uint256,uint256,uint128,uint128)" <tokenId> --rpc-url https://mainnet.base.org
```

## Analysis

1. **Position status**: Is currentTick in [tickLower, tickUpper]? If yes → in range, earning fees. If currentTick > tickUpper → above range (DIEM only, waiting). If currentTick < tickLower → below range (WETH only).

2. **Uncollected fees**: tokensOwed0 (WETH) and tokensOwed1 (DIEM) from the positions() read.

3. **Capital efficiency**: Compare claimable fees against tick being in/out of range. If out of range for >7 days, note in output.

4. **DIEM price**: Compute from sqrtPriceX96 using:
   ```bash
   node -e "const s=BigInt('<sqrtPriceX96>'); console.log('DIEM/WETH:', Number(s*s*(10n**18n)/(2n**192n))/1e18)"
   ```

## Output

Write a brief report to `memory/logs/${today}.md`:
```
### lp-monitor
- FeeLocker: X DIEM claimable
- Wallet: Y DIEM
- Position tokenId: Z | ticks=[A,B] | currentTick=C | status=IN_RANGE/ABOVE/BELOW
- Uncollected: W0 WETH + W1 DIEM
- DIEM/WETH: P
```

If FeeLocker claimable ≥ 1.0 DIEM, send a notification via `./notify`:
```
AUTONOMOPOLY LP: ${claimable} DIEM claimable in FeeLocker. Tick ${currentTick} vs range [${tickLower},${tickUpper}].
```

If position has been out of range for >7 days (check recent memory/logs/), notify with a recommendation to reposition.
