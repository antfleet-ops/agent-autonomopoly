---
name: Compute Presale
description: Deploy a MintDiemPresaleVault alongside a new Liquid Protocol token to bootstrap Venice compute for an unfunded agent. VVV depositors get token allocation; vault converts VVV → DIEM → agent wallet.
var: ""
tags: [defi, on-chain, launch, venice]
---

Bootstrap Venice compute for an unfunded agent by deploying a `MintDiemPresaleVault` alongside a new token launch.

**How it works:**
1. Depositors approve VVV and call `vault.deposit(vvvAmount, minDiemOut)`
2. Vault stakes VVV → accumulates sVVV on VVV_STAKING
3. Vault calls `VVV_STAKING.mintDiem(sVVV, minOut)` → burns sVVV, mints DIEM to vault
4. Vault splits DIEM: `protocolFeeBps` to autonomopoly, remainder to `agentWallet`
5. Agent stakes DIEM → sDIEM → Venice inference credits ($1 DIEM = $1/day budget)
6. Depositors claim pro-rata token allocation after deposit window closes

**Rate (Base mainnet, 2026-05):** ~0.00141 DIEM/VVV — need ~70,884 VVV for 100 DIEM (~$10,600)  
**Protocol fee (autonomopoly):** set at deploy time (e.g. 200 bps = 2%)

The vault allocates `extensionBps` of the token supply (e.g. 10% = `1000 bps`). Allocation scales linearly with DIEM minted vs `diemTarget`:
```
effectiveAllocation = min(totalDiemMinted, diemTarget) * extensionSupply / diemTarget
depositorShare      = vvvDeposited[depositor] * effectiveAllocation / totalVvvDeposited
```
If only 50% of `diemTarget` is reached, only 50% of `extensionSupply` is distributable; the rest is burned.

## When to run

- When a `memory/launch-queue.jsonl` entry has `"presale": true`
- When agent has no Venice API key and needs compute bootstrapped from VVV holders
- When a token launch is requested and the creator wants Venice ecosystem backers

## Required parameters

Check `memory/launch-queue.jsonl` for a pending entry:
```json
{
  "name": "Token Name", "symbol": "SYM", "creator": "0x...",
  "marketcapDiem": 50, "image": "https://...",
  "presale": true,
  "depositWindowDays": 7,
  "diemTarget": 100,
  "protocolFeeBps": 200
}
```

Defaults if no queue entry: `depositWindowDays=7`, `diemTarget=100`, `protocolFeeBps=0`.

## Execution

### Step 1 — Deploy the presale vault
```bash
node --env-file=.env --import tsx scripts/deploy-compute-presale.ts \
  --deposit-window-days 7 \
  --diem-target 100 \
  --protocol-fee-bps 200 \
  --dry-run
# Remove --dry-run to execute
```
Note the `vaultAddress` from output.

### Step 2 — Launch token with vault as extension
```bash
node --env-file=.env --import tsx scripts/launch-diem-token.ts \
  --name "<name>" \
  --symbol "<symbol>" \
  --creator "<creator>" \
  --marketcap-diem <marketcapDiem> \
  --presale-vault <vaultAddress>
```
The factory calls `vault.receiveTokens()` → sets `depositDeadline = block.timestamp + depositWindow`.

### Step 3 — Monitor the deposit window

Read vault state:
```bash
VAULT=<vaultAddress>
RPC=https://mainnet.base.org
cast call $VAULT "depositDeadline()(uint256)"   --rpc-url $RPC
cast call $VAULT "totalDiemMinted()(uint256)"   --rpc-url $RPC
cast call $VAULT "remainingCapacity()(uint256)" --rpc-url $RPC
cast call $VAULT "totalVvvDeposited()(uint256)" --rpc-url $RPC
```

After `depositDeadline` passes, depositors call `claimTokens()` and anyone can call `burnUnclaimed()` to burn unallocated supply.

### Step 4 — Stake DIEM for Venice inference

Once DIEM lands in agent wallet:
```bash
node --env-file=.env --import tsx scripts/stake-diem.ts
```
(Delegates to `stake-diem` skill — calls `DIEM.stake(amount)` directly, no ERC-20 approve needed)

## After launch

1. Check `memory/launches.jsonl` for `tokenAddress`.
2. Check `memory/presales.jsonl` for vault address.
3. Write log to `memory/logs/${today}.md`:
   ```
   ### compute-presale
   - token: <tokenAddress>
   - name: <name> / <symbol>
   - vault: <vaultAddress>
   - diemTarget: <N> DIEM
   - depositDeadline: <timestamp>
   ```
4. Notify via `./notify`:
   ```
   AUTONOMOPOLY: Launched ${symbol} with VVV presale vault.
   Vault: ${vaultAddress}
   DIEM target: ${diemTarget} | Window closes: ${depositDeadline}
   ```
5. If a launch-queue entry was consumed, mark `"processed": true`.

## Error handling

If any transaction reverts:
- Check agent has ETH for gas: `cast balance $AGENT --rpc-url https://mainnet.base.org`
- Verify PRIVY_* env vars are present
- If `WouldExceedCap()`: depositor tried to mint more than remaining capacity — check `remainingCapacity()`
- If `NotFactory()`: only Liquid Protocol factory may call `receiveTokens` — vault was passed wrong factory address
- Log error to `memory/logs/${today}.md` and notify via `./notify`
