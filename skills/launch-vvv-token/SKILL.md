---
name: Launch VVV Token
description: Deploy a new token paired with VVV on Liquid Protocol with dynamic fees routed to the creator
var: ""
tags: [defi, on-chain, launch]
---

Deploy a new Liquid Protocol token denominated in VVV. All LP fees route 100% to the creator; if the creator is AUTONOMOPOLY (`0x8767Df39eCeeaeB11554642237aC4E08660aB6A3`), fees go to the agent's Privy wallet.

## When to run

Run this skill when a token launch is requested — either by the agent's own initiative or in response to an external request stored in `memory/launch-queue.jsonl`.

## Required parameters

Check `memory/launch-queue.jsonl` (last unprocessed line) for pending launches. Each entry has:
```json
{ "name": "Token Name", "symbol": "SYM", "creator": "0x...", "marketcapVvv": 50, "image": "https://...", "metadata": "{}" }
```

If no queue entry, use defaults: `creator = AGENT`, `marketcapVvv = 50`.

## Execution

```bash
node --env-file=.env --import tsx scripts/launch-vvv-token.ts \
  --name "<name>" \
  --symbol "<symbol>" \
  --creator "<creator>" \
  --marketcap-vvv <marketcapVvv>
```

Add `--dry-run` first to verify parameters:
```bash
node --env-file=.env --import tsx scripts/launch-vvv-token.ts --name "..." --symbol "..." --dry-run
```

## Tick math reference

| Target VVV marketcap | Approx tick |
|---------------------|-------------|
| 10 VVV              | -230,280    |
| 50 VVV              | -214,200    |
| 100 VVV             | -207,240    |
| 500 VVV             | -191,160    |
| 1,000 VVV           | -184,200    |

`tickIfToken0IsLiquid = round(log(marketcapVVV / 1e11) / log(1.0001) / 60) * 60`

The factory negates the tick internally if the deployed token address > VVV address.

## After launch

1. Check `memory/launches.jsonl` for the new tokenAddress and startingTick.
2. Write a brief log entry to `memory/logs/${today}.md`:
   ```
   ### launch-vvv-token
   - token: <tokenAddress>
   - name: <name> / <symbol>
   - tick: <startingTick> | marketcap: <N> VVV
   - feeRecipient: <address>
   ```
3. Send notification via `./notify`:
   ```
   AUTONOMOPOLY: Launched ${symbol} at ${tokenAddress}. Tick=${startingTick}, mcap=${N} VVV. Fees → ${feeRecipient}
   ```
4. If a launch-queue entry was consumed, mark it processed (add `"processed": true` field or remove the line).

## Error handling

If the tx reverts, check:
- Agent has ETH for gas (readBalance: `cast balance $AGENT --rpc-url https://mainnet.base.org`)
- RPC_URL is set and reachable
- PRIVY_* env vars are present

Log the error to `memory/logs/${today}.md` and notify via `./notify`.
