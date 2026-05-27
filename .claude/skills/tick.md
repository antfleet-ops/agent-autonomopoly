---
name: tick
description: Run one agent tick — claim FeeLocker fees, LP DIEM, run maintenance inference. The core hourly heartbeat of the agent funding loop.
---

# Agent Tick

Runs the full agent funding loop: check balances → claim DIEM → LP → Venice inference.

## Script

The tick skill maps to `harness/tick.ts`:

```bash
node --env-file=.env --import tsx harness/tick.ts
```

## What it does

1. **Check balances** — reads DIEM in wallet, FeeLocker claimable, ETH gas reserve
2. **Claim DIEM** — calls `FeeLocker.claim(feeOwner, token)` if claimable ≥ threshold (0.1 DIEM)
3. **Reinvest to LP** — calls `reinvestToLP(rpcUrl, agentAddress, diemAmount, range, txSender)` in accumulate mode
4. **Venice inference** — routes a maintenance call through Venice if DIEM staked ≥ threshold

## Env vars required

| Var | Purpose |
|-----|---------|
| `AGENT_WALLET` | Agent wallet address |
| `RPC_URL` | Base mainnet RPC |
| `PRIVY_APP_ID` | Privy application ID |
| `PRIVY_APP_SECRET` | Privy app secret — authenticates to Privy API (Basic auth). Store in GitHub Actions secrets, never in `.env`. |
| `PRIVY_WALLET_ID` | ID of the agent's Privy server wallet |
| `AGENT_MODE` | `accumulate` (default) or `build` |

**Wallet model:** The agent never holds a private key. All signing goes through Privy's server wallet API (`/wallets/{id}/rpc`). `AGENT_PRIVATE_KEY` is removed from production — it was a test-only fallback and must not be set in GitHub Actions secrets.

## Aeon schedule

```yaml
tick: { enabled: true, schedule: "0 * * * *" }  # every hour UTC
```

## DRY-RUN RULE

`harness/tick.ts` executes live by default. For testing without transactions:
```bash
DRY_RUN=true node --env-file=.env --import tsx harness/tick.ts
```

## Code path

`harness/tick.ts` → `harness/providers/venice.ts` (claim + staking gate) → `harness/providers/liquidity.ts` (reinvestToLP) → `memory/tool-routing.jsonl` (inference log)
