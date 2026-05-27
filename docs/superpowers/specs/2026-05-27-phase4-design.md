# Phase 4 Design — Presale Dashboard UI + E2E Integration Test

**Date:** 2026-05-27  
**Status:** Approved  
**Scope:** Two remaining items from the Venice Agent Launchpad Phase 4:
1. Interactive presale dashboard (`dashboard/app/`) — replaces the originally planned Telegram monitor
2. E2E integration test (`ComputePresaleIntegration.t.sol`) — Base mainnet fork via Forge

`ComputePresaleFactory.sol` was confirmed already complete (13/13 tests passing) — not in scope here.

---

## Item 1 — Presale Dashboard

### What it is

A Vite + React + Privy SPA in `dashboard/app/` that lets any wallet holder monitor and interact with deployed `ComputePresaleVault` contracts. Replaces the originally planned presale monitor Telegram service; the UI is the monitor.

### Stack

Mirrors `liquid-website-april-10` patterns exactly:
- `vite` + `react` + `typescript`
- `@privy-io/react-auth` for wallet connection
- `viem` for on-chain reads (`createPublicClient`) and writes (`createWalletClient` from Privy provider)
- `tailwindcss` for styling

### Pages

**`/` — Presale index**
- Reads `public/presales.json` (a static file generated from `memory/presales.jsonl` at build time by a `scripts/export-presales.ts` helper)
- Lists all presales: token name, vault address, mode (VVV / DIEM), deposit deadline countdown, total deposited, status badge (OPEN / CLOSED / FINALIZED)
- Each row links to `/vault/[address]`
- If `presales.jsonl` is empty, the index shows a "No presales deployed yet" empty state with a link to the launch flow on the main site

**`/vault/[address]` — Vault detail**
All state read on-chain via `readContract` on `ComputePresaleVault` ABI:
- `depositDeadline`, `lockExpiry`, `totalDeposited`, `totalTokenSupply`, `token`, `initialized`
- Connected wallet: `deposited[address]`, `tokensClaimed[address]`, `depositTokenWithdrawn[address]`

Actions (gated by vault state + wallet connection):
| Action | Available when |
|--------|---------------|
| **Deposit** | Window open, not yet deposited (or top-up) |
| **Claim tokens** | Window closed, tokens not yet claimed, user deposited > 0 |
| **Finalize VVV** | VVV mode, window closed, called by anyone (permissionless) |
| **Withdraw DIEM** | DIEM mode, lock expired, user deposited > 0, not withdrawn |

Write flow: `wallet.getEthereumProvider()` → `createWalletClient` → `writeContract` — same pattern as `/launch/confirm/page.tsx` in liquid-website.

ERC-20 approve step shown before deposit if allowance is insufficient.

### Data flow

```
memory/presales.jsonl
        ↓
scripts/export-presales.ts  (build-time)
        ↓
dashboard/app/public/presales.json
        ↓
Vite build → dashboard/app/dist/
        ↓
GitHub Pages (gh-pages branch)
```

On-chain reads happen directly from the browser via viem public client (Base mainnet RPC).

### File layout

```
dashboard/
  app/
    src/
      main.tsx          App entry + PrivyProvider
      App.tsx           Router (index / vault/:address)
      pages/
        Index.tsx       Presale list
        VaultDetail.tsx Vault state + actions
      components/
        VaultCard.tsx   Condensed row used on Index
        ActionPanel.tsx Deposit / Claim / Finalize / Withdraw buttons
        Countdown.tsx   Deadline countdown
      lib/
        contracts.ts    ABI fragments + readContract helpers
        wallet.ts       Privy provider → WalletClient factory
      types.ts          PresaleEntry type (from presales.json)
    public/
      presales.json     Static presale list (regenerated at build time)
    index.html
    vite.config.ts
    tsconfig.json
    package.json
  README.md
scripts/
  export-presales.ts    Reads memory/presales.jsonl → public/presales.json
```

### Deploy

GitHub Actions workflow `dashboard.yml`:
1. `node --import tsx scripts/export-presales.ts`
2. `cd dashboard/app && npm ci && npm run build`
3. Deploy `dist/` to `gh-pages` branch via `peaceiris/actions-gh-pages`

Triggered on push to `main` when `dashboard/**` or `memory/presales.jsonl` changes.

### Environment

Privy App ID is public (safe to embed in frontend). No secrets in the dashboard build. Base mainnet RPC calls go directly from the browser — no backend.

---

## Item 2 — E2E Integration Test

### What it is

`test/ComputePresaleIntegration.t.sol` — a Forge integration test that runs against a live Base mainnet fork. Exercises the full presale lifecycle for both vault modes without spending real gas.

### Approach

`forge test --fork-url $BASE_RPC_URL --match-contract ComputePresaleIntegration`

Uses `vm.prank` to impersonate real holders (VVV whale from on-chain, agent wallet), `vm.warp` to advance past deadlines, and `deal`/`vm.deal` for ETH.

### Test flow — VVV irrevocable mode

```
1. Deploy ComputePresaleFactory
2. salt = factory.buildSalt(deployer, 0)
3. vaultAddr = factory.computeAddress(salt, LIQUID_FACTORY, VVV, agentWallet, 0, 7 days)
4. factory.deployVault(salt, ...) → assert vaultAddr matches
5. vm.prank(LIQUID_FACTORY) → vault.receiveTokens(..., 10B tokens, ...) → depositDeadline set
6. vm.prank(VVV_WHALE) → IERC20(VVV).approve(vault, 1e18)
7. vm.prank(VVV_WHALE) → vault.deposit(1e18) → assert totalDeposited == 1e18
8. vm.warp(depositDeadline + 1)
9. vm.prank(agentWallet) → vault.finalizeVVV() → assert VVV balance of agentWallet == 1e18
10. vm.prank(VVV_WHALE) → vault.claimTokens() → assert token balance of VVV_WHALE == totalTokenSupply
11. Verify: vault.tokensClaimed[VVV_WHALE] == true
```

### Test flow — DIEM time-lock mode

```
1. Deploy vault: lockDuration=30 days, depositToken=DIEM
2. receiveTokens → window open
3. DIEM_WHALE approves + deposits 100 DIEM
4. vm.warp(depositDeadline + 1) — window closed
5. Verify: deposit() reverts with DepositWindowClosed
6. vm.warp(lockExpiry + 1)
7. DIEM_WHALE calls withdrawDepositToken() → DIEM returned in full
8. DIEM_WHALE calls claimTokens() → tokens received
```

### Additional cases

- `finalizeVVV` reverts in DIEM mode (`WrongMode`)
- `withdrawDepositToken` reverts in VVV mode (`WrongMode`)  
- `withdrawDepositToken` reverts before `lockExpiry` (`LockNotExpired`)
- Double-claim reverts (`AlreadyClaimed`)
- Double-withdraw reverts (`AlreadyWithdrawn`)
- Two depositors: correct pro-rata split

### Known addresses (Base mainnet fork)

```solidity
address LIQUID_FACTORY = 0x04F1a284168743759BE6554f607a10CEBdB77760;
address VVV            = 0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf;
address DIEM           = 0xF4d97F2da56e8c3098f3a8D538DB630A2606a024;
```

VVV_WHALE and DIEM_WHALE are hardcoded in `setUp()` as real on-chain holders identified via Basescan at `fork-block-number 46600000`. The implementation step looks up top holders of each token at that block and pins the addresses directly in the test — no runtime discovery.

### CI integration

Add to existing `pr.yml` or a new `integration.yml` workflow:
```yaml
- run: forge test --match-contract ComputePresaleIntegration --fork-url ${{ secrets.BASE_RPC_URL }} --fork-block-number 46600000
```

`BASE_RPC_URL` is already in repo secrets (used by other scripts).

---

## Out of scope

- ComputePresaleFactory.sol — already complete
- Telegram notifications — replaced by UI
- Presale deploy on Sepolia — Protocol not deployed there; mainnet fork covers it
- Dashboard wallet creation — Privy handles it; no custom wallet provisioning
