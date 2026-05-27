# Phase 4 Implementation Plan — Presale Dashboard + E2E Integration Test

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive Vite+React+Privy presale dashboard in `dashboard/app/` and a Forge fork-test suite that exercises `ComputePresaleVault` with real VVV/DIEM tokens against a Base mainnet fork.

**Architecture:** Part A (Tasks 1–5) lives entirely in `liquid-protocol-v0/` — a Forge integration test plus CI workflow. Part B (Tasks 6–16) lives in `agent-autonomopoly/` — a standalone Vite SPA with HashRouter, Privy wallet connection, and viem on-chain reads/writes. The two parts are fully independent and can be executed in parallel.

**Tech Stack:** Solidity 0.8.28 / Forge for Part A; Vite 6, React 19, `@privy-io/react-auth` 3.27, viem 2.47, Tailwind CSS 3, react-router-dom 7 for Part B.

---

## File Map

### Part A — `liquid-protocol-v0/`
```
test/ComputePresaleIntegration.t.sol   NEW — fork integration tests (VVV + DIEM flows)
.github/workflows/integration.yml      NEW — CI job: install Foundry, run fork tests
```

### Part B — `agent-autonomopoly/`
```
dashboard/app/package.json             NEW — Vite SPA dependencies
dashboard/app/vite.config.ts           NEW — base='./', react plugin
dashboard/app/tsconfig.json            NEW — strict TS, DOM lib
dashboard/app/tsconfig.node.json       NEW — node config for vite.config.ts
dashboard/app/postcss.config.cjs       NEW — autoprefixer + tailwindcss
dashboard/app/tailwind.config.ts       NEW — content glob
dashboard/app/index.html               NEW — Vite entry HTML
dashboard/app/src/index.css            NEW — Tailwind directives
dashboard/app/src/main.tsx             NEW — PrivyProvider root
dashboard/app/src/App.tsx              NEW — HashRouter + routes
dashboard/app/src/types.ts             NEW — PresaleEntry, VaultState
dashboard/app/src/lib/chain.ts         NEW — makePublicClient()
dashboard/app/src/lib/contracts.ts     NEW — ABIs + readVaultState()
dashboard/app/src/lib/wallet.ts        NEW — makeWalletClient(wallet)
dashboard/app/src/components/Countdown.tsx   NEW — live countdown timer
dashboard/app/src/components/VaultCard.tsx   NEW — index row card
dashboard/app/src/components/ActionPanel.tsx NEW — deposit/claim/finalize/withdraw
dashboard/app/src/pages/Index.tsx      NEW — presale list
dashboard/app/src/pages/VaultDetail.tsx NEW — vault detail + actions
dashboard/app/public/presales.json     NEW — generated from presales.jsonl
scripts/export-presales.ts             NEW — jsonl → presales.json converter
.github/workflows/dashboard.yml        NEW — build + GitHub Pages deploy
```

---

## PART A — E2E Integration Test

### Task 1: Write ComputePresaleIntegration.t.sol — setup + VVV flow

**Files:**
- Create: `liquid-protocol-v0/test/ComputePresaleIntegration.t.sol`

- [ ] **Step 1: Create the test file with setup and VVV irrevocable full-flow test**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ComputePresaleFactory} from "../src/extensions/ComputePresaleFactory.sol";
import {ComputePresaleVault} from "../src/extensions/ComputePresaleVault.sol";
import {ILiquid} from "../src/interfaces/ILiquid.sol";
import {ILiquidExtension} from "../src/interfaces/ILiquidExtension.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";

/// @dev Minimal ERC-20 for the launched agent token; only used in tests.
contract AgentToken is ERC20 {
    constructor() ERC20("AgentToken", "AGT") {
        _mint(msg.sender, 100_000_000_000e18);
    }
}

contract ComputePresaleIntegrationTest is Test {
    // ── Base mainnet addresses (available in fork) ──────────────────────
    address constant VVV  = 0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf;
    address constant DIEM = 0xF4d97F2da56e8c3098f3a8D538DB630A2606a024;

    // ── Test actors ────────────────────────────────────────────────────
    ComputePresaleFactory presaleFactory;
    AgentToken agentToken;

    address deployer    = makeAddr("deployer");
    address agentWallet = makeAddr("agentWallet");
    address alice       = makeAddr("alice");
    address bob         = makeAddr("bob");
    // mockFactory simulates the Liquid Protocol factory calling receiveTokens
    address mockFactory = makeAddr("mockFactory");

    // ── Constants ──────────────────────────────────────────────────────
    uint256 constant DEPOSIT_WINDOW = 7 days;
    uint256 constant LOCK_DURATION  = 30 days;
    uint256 constant TOKEN_SUPPLY   = 10_000_000_000e18; // 10B (10% of 100B)
    uint256 constant VVV_AMOUNT     = 10e18;
    uint256 constant DIEM_AMOUNT    = 100e18;

    // ── Setup ──────────────────────────────────────────────────────────

    function setUp() public {
        presaleFactory = new ComputePresaleFactory();
        agentToken     = new AgentToken(); // minted to address(this)

        // Fund depositors with real on-chain VVV and DIEM via stdcheats deal()
        deal(VVV,  alice, VVV_AMOUNT);
        deal(DIEM, alice, DIEM_AMOUNT);
        deal(DIEM, bob,   DIEM_AMOUNT);

        vm.label(VVV,  "VVV");
        vm.label(DIEM, "DIEM");
    }

    // ── Helpers ────────────────────────────────────────────────────────

    function _deployVvvVault() internal returns (ComputePresaleVault) {
        bytes32 salt = presaleFactory.buildSalt(deployer, 0);
        vm.prank(deployer);
        return ComputePresaleVault(
            presaleFactory.deployVault(salt, mockFactory, VVV, agentWallet, 0, DEPOSIT_WINDOW)
        );
    }

    function _deployDiemVault() internal returns (ComputePresaleVault) {
        bytes32 salt = presaleFactory.buildSalt(deployer, 1);
        vm.prank(deployer);
        return ComputePresaleVault(
            presaleFactory.deployVault(salt, mockFactory, DIEM, agentWallet, LOCK_DURATION, DEPOSIT_WINDOW)
        );
    }

    /// @dev Simulates Liquid Factory calling receiveTokens (factory holds and transfers agent tokens).
    function _initVault(ComputePresaleVault vault) internal {
        agentToken.transfer(mockFactory, TOKEN_SUPPLY);
        ILiquid.DeploymentConfig memory cfg;
        PoolKey memory key;
        vm.startPrank(mockFactory);
        IERC20(address(agentToken)).approve(address(vault), TOKEN_SUPPLY);
        vault.receiveTokens(cfg, key, address(agentToken), TOKEN_SUPPLY, 0);
        vm.stopPrank();
    }

    // ── VVV irrevocable: full lifecycle ────────────────────────────────

    function test_vvv_fullFlow() public {
        ComputePresaleVault vault = _deployVvvVault();
        _initVault(vault);

        // Assert vault is initialized
        assertTrue(vault.initialized());
        assertEq(vault.totalTokenSupply(), TOKEN_SUPPLY);
        assertEq(vault.lockDuration(), 0);

        // Alice deposits VVV
        vm.startPrank(alice);
        IERC20(VVV).approve(address(vault), VVV_AMOUNT);
        vault.deposit(VVV_AMOUNT);
        vm.stopPrank();

        assertEq(vault.deposited(alice), VVV_AMOUNT);
        assertEq(vault.totalDeposited(), VVV_AMOUNT);
        assertEq(IERC20(VVV).balanceOf(address(vault)), VVV_AMOUNT);

        // Advance past deposit window
        vm.warp(vault.depositDeadline() + 1);

        // Anyone can call finalizeVVV
        vault.finalizeVVV();
        assertEq(IERC20(VVV).balanceOf(agentWallet), VVV_AMOUNT);
        assertEq(IERC20(VVV).balanceOf(address(vault)), 0);

        // Alice claims tokens
        vm.prank(alice);
        vault.claimTokens();
        assertEq(IERC20(address(agentToken)).balanceOf(alice), TOKEN_SUPPLY);
        assertTrue(vault.tokensClaimed(alice));
    }

    function test_vvv_twoDepositors_proRata() public {
        ComputePresaleVault vault = _deployVvvVault();
        _initVault(vault);

        // Give bob some VVV
        deal(VVV, bob, VVV_AMOUNT);

        vm.startPrank(alice);
        IERC20(VVV).approve(address(vault), VVV_AMOUNT);
        vault.deposit(VVV_AMOUNT); // alice deposits 10 VVV
        vm.stopPrank();

        vm.startPrank(bob);
        IERC20(VVV).approve(address(vault), VVV_AMOUNT);
        vault.deposit(VVV_AMOUNT); // bob deposits 10 VVV
        vm.stopPrank();

        vm.warp(vault.depositDeadline() + 1);

        vm.prank(alice);
        vault.claimTokens();
        vm.prank(bob);
        vault.claimTokens();

        // Both deposited equally → 50/50 split
        uint256 aliceBal = IERC20(address(agentToken)).balanceOf(alice);
        uint256 bobBal   = IERC20(address(agentToken)).balanceOf(bob);
        assertEq(aliceBal, TOKEN_SUPPLY / 2);
        assertEq(bobBal,   TOKEN_SUPPLY / 2);
    }
}
```

- [ ] **Step 2: Run the test to verify it passes (requires `BASE_RPC_URL` in shell)**

```bash
cd ~/Documents/Mog-Capital/Liquid/protocol/liquid-protocol-v0
forge test --match-test "test_vvv" --fork-url "$RPC_URL" --fork-block-number 46600000 -v
```

Expected: `[PASS] test_vvv_fullFlow()` and `[PASS] test_vvv_twoDepositors_proRata()`

- [ ] **Step 3: Commit**

```bash
cd ~/Documents/Mog-Capital/Liquid/protocol/liquid-protocol-v0
git add test/ComputePresaleIntegration.t.sol
git commit -m "test: add ComputePresaleIntegration — VVV full-flow + pro-rata fork test"
```

---

### Task 2: Add DIEM time-lock tests + edge cases

**Files:**
- Modify: `liquid-protocol-v0/test/ComputePresaleIntegration.t.sol` (append to end of contract)

- [ ] **Step 1: Append DIEM tests and cross-mode revert tests to the contract**

Add the following methods inside `ComputePresaleIntegrationTest`:

```solidity
    // ── VVV irrevocable: revert cases ──────────────────────────────────

    function test_vvv_doubleClaim_reverts() public {
        ComputePresaleVault vault = _deployVvvVault();
        _initVault(vault);

        vm.startPrank(alice);
        IERC20(VVV).approve(address(vault), VVV_AMOUNT);
        vault.deposit(VVV_AMOUNT);
        vm.stopPrank();

        vm.warp(vault.depositDeadline() + 1);
        vm.prank(alice);
        vault.claimTokens();

        vm.expectRevert(ComputePresaleVault.AlreadyClaimed.selector);
        vm.prank(alice);
        vault.claimTokens();
    }

    function test_vvv_depositAfterDeadline_reverts() public {
        ComputePresaleVault vault = _deployVvvVault();
        _initVault(vault);

        vm.warp(vault.depositDeadline() + 1);

        deal(VVV, alice, VVV_AMOUNT);
        vm.startPrank(alice);
        IERC20(VVV).approve(address(vault), VVV_AMOUNT);
        vm.expectRevert(ComputePresaleVault.DepositWindowClosed.selector);
        vault.deposit(VVV_AMOUNT);
        vm.stopPrank();
    }

    function test_vvv_withdrawDiem_reverts_wrongMode() public {
        ComputePresaleVault vault = _deployVvvVault();
        _initVault(vault);

        vm.startPrank(alice);
        IERC20(VVV).approve(address(vault), VVV_AMOUNT);
        vault.deposit(VVV_AMOUNT);
        vm.stopPrank();

        vm.warp(vault.depositDeadline() + 1);
        vm.expectRevert(ComputePresaleVault.WrongMode.selector);
        vm.prank(alice);
        vault.withdrawDepositToken();
    }

    // ── DIEM time-lock: full lifecycle ─────────────────────────────────

    function test_diem_fullFlow() public {
        ComputePresaleVault vault = _deployDiemVault();
        _initVault(vault);

        assertEq(vault.lockDuration(), LOCK_DURATION);

        vm.startPrank(alice);
        IERC20(DIEM).approve(address(vault), DIEM_AMOUNT);
        vault.deposit(DIEM_AMOUNT);
        vm.stopPrank();

        assertEq(vault.deposited(alice), DIEM_AMOUNT);

        // After window closes, claimTokens available
        vm.warp(vault.depositDeadline() + 1);
        vm.prank(alice);
        vault.claimTokens();
        assertEq(IERC20(address(agentToken)).balanceOf(alice), TOKEN_SUPPLY);

        // Before lockExpiry, withdrawDepositToken reverts
        vm.expectRevert(ComputePresaleVault.LockNotExpired.selector);
        vm.prank(alice);
        vault.withdrawDepositToken();

        // After lockExpiry, DIEM is returned
        vm.warp(vault.lockExpiry() + 1);
        vm.prank(alice);
        vault.withdrawDepositToken();
        assertEq(IERC20(DIEM).balanceOf(alice), DIEM_AMOUNT);
        assertTrue(vault.depositTokenWithdrawn(alice));
    }

    function test_diem_doubleWithdraw_reverts() public {
        ComputePresaleVault vault = _deployDiemVault();
        _initVault(vault);

        vm.startPrank(alice);
        IERC20(DIEM).approve(address(vault), DIEM_AMOUNT);
        vault.deposit(DIEM_AMOUNT);
        vm.stopPrank();

        vm.warp(vault.lockExpiry() + 1);
        vm.prank(alice);
        vault.withdrawDepositToken();

        vm.expectRevert(ComputePresaleVault.AlreadyWithdrawn.selector);
        vm.prank(alice);
        vault.withdrawDepositToken();
    }

    function test_diem_finalizeVvv_reverts_wrongMode() public {
        ComputePresaleVault vault = _deployDiemVault();
        _initVault(vault);

        vm.warp(vault.depositDeadline() + 1);
        vm.expectRevert(ComputePresaleVault.WrongMode.selector);
        vault.finalizeVVV();
    }

    // ── Factory CREATE2: address prediction matches deployment ──────────

    function test_factory_computeAddress_matchesDeployed_fork() public {
        bytes32 salt = presaleFactory.buildSalt(deployer, 42);
        address predicted = presaleFactory.computeAddress(
            salt, mockFactory, VVV, agentWallet, 0, DEPOSIT_WINDOW
        );
        vm.prank(deployer);
        address deployed = presaleFactory.deployVault(
            salt, mockFactory, VVV, agentWallet, 0, DEPOSIT_WINDOW
        );
        assertEq(predicted, deployed);
    }
```

- [ ] **Step 2: Run all integration tests**

```bash
cd ~/Documents/Mog-Capital/Liquid/protocol/liquid-protocol-v0
forge test --match-contract ComputePresaleIntegration --fork-url "$RPC_URL" --fork-block-number 46600000 -v
```

Expected output (10 tests):
```
[PASS] test_diem_doubleWithdraw_reverts()
[PASS] test_diem_finalizeVvv_reverts_wrongMode()
[PASS] test_diem_fullFlow()
[PASS] test_factory_computeAddress_matchesDeployed_fork()
[PASS] test_vvv_depositAfterDeadline_reverts()
[PASS] test_vvv_doubleClaim_reverts()
[PASS] test_vvv_fullFlow()
[PASS] test_vvv_twoDepositors_proRata()
[PASS] test_vvv_withdrawDiem_reverts_wrongMode()
```

- [ ] **Step 3: Commit**

```bash
git add test/ComputePresaleIntegration.t.sol
git commit -m "test: add DIEM time-lock + edge-case fork integration tests"
```

---

### Task 3: Add CI workflow to liquid-protocol-v0

**Files:**
- Create: `liquid-protocol-v0/.github/workflows/integration.yml`

- [ ] **Step 1: Create the workflow directory and file**

```bash
mkdir -p ~/Documents/Mog-Capital/Liquid/protocol/liquid-protocol-v0/.github/workflows
```

Write `.github/workflows/integration.yml`:

```yaml
name: Integration Tests (fork)

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ${{ github.workflow }}-${{ github.head_ref || github.run_id }}
  cancel-in-progress: true

jobs:
  fork-tests:
    name: Forge fork tests (Base mainnet)
    runs-on: ubuntu-latest
    # Skip on forks that don't have RPC_URL secret
    if: ${{ secrets.RPC_URL != '' || github.event_name != 'pull_request' }}
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive

      - name: Install Foundry
        uses: foundry-rs/foundry-toolchain@v1
        with:
          version: stable

      - name: Run integration tests
        run: |
          forge test \
            --match-contract ComputePresaleIntegration \
            --fork-url "$RPC_URL" \
            --fork-block-number 46600000 \
            -v
        env:
          RPC_URL: ${{ secrets.RPC_URL }}
```

- [ ] **Step 2: Commit**

```bash
cd ~/Documents/Mog-Capital/Liquid/protocol/liquid-protocol-v0
git add .github/workflows/integration.yml
git commit -m "ci: add Forge fork integration test workflow"
```

**Note:** Add `RPC_URL` to `liquid-protocol-v0` repository secrets in GitHub (Settings → Secrets → New secret). Use the same Alchemy/QuickNode Base mainnet URL as in agent-autonomopoly.

---

## PART B — Presale Dashboard

### Task 4: Scaffold dashboard/app package

**Files:**
- Create: `dashboard/app/package.json`
- Create: `dashboard/app/vite.config.ts`
- Create: `dashboard/app/tsconfig.json`
- Create: `dashboard/app/tsconfig.node.json`
- Create: `dashboard/app/index.html`
- Create: `dashboard/app/postcss.config.cjs`
- Create: `dashboard/app/tailwind.config.ts`

- [ ] **Step 1: Create `dashboard/app/package.json`**

```json
{
  "name": "agent-presale-dashboard",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "typecheck": "tsc --noEmit",
    "preview": "vite preview"
  },
  "dependencies": {
    "@privy-io/react-auth": "^3.27.1",
    "react": "^19.2.6",
    "react-dom": "^19.2.6",
    "react-router-dom": "^7.0.0",
    "viem": "^2.47.6"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.5.0",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.2",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create `dashboard/app/vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
});
```

- [ ] **Step 3: Create `dashboard/app/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: Create `dashboard/app/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: Create `dashboard/app/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Agent Presales</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `dashboard/app/postcss.config.cjs`**

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 7: Create `dashboard/app/tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 8: Install dependencies**

```bash
cd dashboard/app && npm install
```

Expected: `node_modules/` populated, no errors.

- [ ] **Step 9: Commit scaffold**

```bash
cd ../..
git add dashboard/app/
git commit -m "feat(dashboard): scaffold Vite+React+Privy+Tailwind app"
```

---

### Task 5: Write types.ts, lib/chain.ts, and src/index.css

**Files:**
- Create: `dashboard/app/src/types.ts`
- Create: `dashboard/app/src/lib/chain.ts`
- Create: `dashboard/app/src/index.css`

- [ ] **Step 1: Create `dashboard/app/src/types.ts`**

```ts
export interface PresaleEntry {
  vaultAddress: string;
  deployedAt: string;
  agentWallet?: string;
  contract?: string;
}

export interface VaultState {
  address: `0x${string}`;
  depositToken: `0x${string}`;
  depositTokenSymbol: 'VVV' | 'DIEM';
  lockDuration: bigint;
  totalDeposited: bigint;
  totalTokenSupply: bigint;
  depositDeadline: bigint;
  lockExpiry: bigint;
  initialized: boolean;
  agentWallet: `0x${string}`;
  token: `0x${string}`;
  myDeposited?: bigint;
  myClaimed?: boolean;
  myWithdrawn?: boolean;
  myShare?: bigint;
  myBalance?: bigint;
  myAllowance?: bigint;
}
```

- [ ] **Step 2: Create `dashboard/app/src/lib/chain.ts`**

```ts
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

export function makePublicClient() {
  return createPublicClient({ chain: base, transport: http() });
}
```

- [ ] **Step 3: Create `dashboard/app/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/app/src/
git commit -m "feat(dashboard): add types, chain client, CSS"
```

---

### Task 6: Write lib/contracts.ts

**Files:**
- Create: `dashboard/app/src/lib/contracts.ts`

- [ ] **Step 1: Create `dashboard/app/src/lib/contracts.ts`**

```ts
import { type Address } from 'viem';
import { makePublicClient } from './chain';
import type { VaultState } from '../types';

export const VVV_ADDRESS  = '0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf' as const;
export const DIEM_ADDRESS = '0xF4d97F2da56e8c3098f3a8D538DB630A2606a024' as const;

export const VAULT_READ_ABI = [
  { name: 'depositDeadline',        type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'lockExpiry',             type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'lockDuration',           type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalDeposited',         type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalTokenSupply',       type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'initialized',            type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { name: 'depositToken',           type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'agentWallet',            type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'token',                  type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'deposited',              type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'tokensClaimed',          type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'bool' }] },
  { name: 'depositTokenWithdrawn',  type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'bool' }] },
  { name: 'getShare',               type: 'function', stateMutability: 'view', inputs: [{ name: 'who', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const;

export const VAULT_WRITE_ABI = [
  { name: 'deposit',              type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'claimTokens',         type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'withdrawDepositToken',type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'finalizeVVV',         type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
] as const;

export const ERC20_ABI = [
  { name: 'approve',   type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view',       inputs: [{ name: 'owner',   type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view',       inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const;

export async function readVaultState(
  vaultAddress: Address,
  userAddress?: Address,
): Promise<VaultState> {
  const client = makePublicClient();

  const rc = <T>(fn: string, args?: unknown[]) =>
    client.readContract({
      address: vaultAddress,
      abi: VAULT_READ_ABI,
      functionName: fn as never,
      args: (args ?? []) as never,
    }) as Promise<T>;

  const erc = <T>(fn: string, tokenAddr: Address, args: unknown[]) =>
    client.readContract({
      address: tokenAddr,
      abi: ERC20_ABI,
      functionName: fn as never,
      args: args as never,
    }) as Promise<T>;

  const [depositToken, lockDuration, totalDeposited, totalTokenSupply,
         depositDeadline, lockExpiry, initialized, agentWallet, token] =
    await Promise.all([
      rc<Address>('depositToken'),
      rc<bigint>('lockDuration'),
      rc<bigint>('totalDeposited'),
      rc<bigint>('totalTokenSupply'),
      rc<bigint>('depositDeadline'),
      rc<bigint>('lockExpiry'),
      rc<boolean>('initialized'),
      rc<Address>('agentWallet'),
      rc<Address>('token').catch(() => '0x0000000000000000000000000000000000000000' as Address),
    ]);

  const isVvv = depositToken.toLowerCase() === VVV_ADDRESS.toLowerCase();

  let myDeposited: bigint | undefined;
  let myClaimed:   boolean | undefined;
  let myWithdrawn: boolean | undefined;
  let myShare:     bigint | undefined;
  let myBalance:   bigint | undefined;
  let myAllowance: bigint | undefined;

  if (userAddress) {
    [myDeposited, myClaimed, myWithdrawn, myShare, myBalance, myAllowance] = await Promise.all([
      rc<bigint>('deposited',             [userAddress]),
      rc<boolean>('tokensClaimed',        [userAddress]),
      rc<boolean>('depositTokenWithdrawn',[userAddress]),
      rc<bigint>('getShare',              [userAddress]),
      erc<bigint>('balanceOf', depositToken, [userAddress]),
      erc<bigint>('allowance', depositToken, [userAddress, vaultAddress]),
    ]);
  }

  return {
    address: vaultAddress,
    depositToken,
    depositTokenSymbol: isVvv ? 'VVV' : 'DIEM',
    lockDuration,
    totalDeposited,
    totalTokenSupply,
    depositDeadline,
    lockExpiry,
    initialized,
    agentWallet,
    token: token as Address,
    myDeposited,
    myClaimed,
    myWithdrawn,
    myShare,
    myBalance,
    myAllowance,
  };
}
```

- [ ] **Step 2: Typecheck**

```bash
cd dashboard/app && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd ../.. && git add dashboard/app/src/lib/contracts.ts
git commit -m "feat(dashboard): add vault ABI + readVaultState()"
```

---

### Task 7: Write lib/wallet.ts

**Files:**
- Create: `dashboard/app/src/lib/wallet.ts`

- [ ] **Step 1: Create `dashboard/app/src/lib/wallet.ts`**

```ts
import { createPublicClient, createWalletClient, custom, http, type WalletClient } from 'viem';
import { base } from 'viem/chains';
import type { ConnectedWallet } from '@privy-io/react-auth';

export async function makeWalletClient(wallet: ConnectedWallet): Promise<WalletClient> {
  const provider = await wallet.getEthereumProvider();
  return createWalletClient({
    account: wallet.address as `0x${string}`,
    chain: base,
    transport: custom(provider as Parameters<typeof custom>[0]),
  });
}

export function makePublicClientForReceipt() {
  return createPublicClient({ chain: base, transport: http() });
}

export async function sendAndWait(
  wallet: ConnectedWallet,
  to: `0x${string}`,
  data: `0x${string}`,
  onStatus: (msg: string) => void,
): Promise<`0x${string}`> {
  const wc = await makeWalletClient(wallet);
  const hash = await wc.sendTransaction({
    account: wallet.address as `0x${string}`,
    to,
    data,
    chain: base,
  });
  onStatus(`tx: ${hash.slice(0, 14)}… confirming`);
  const client = makePublicClientForReceipt();
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('Transaction reverted');
  return hash;
}
```

- [ ] **Step 2: Typecheck**

```bash
cd dashboard/app && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd ../.. && git add dashboard/app/src/lib/wallet.ts
git commit -m "feat(dashboard): add Privy wallet client + sendAndWait helper"
```

---

### Task 8: Write Countdown.tsx and VaultCard.tsx

**Files:**
- Create: `dashboard/app/src/components/Countdown.tsx`
- Create: `dashboard/app/src/components/VaultCard.tsx`

- [ ] **Step 1: Create `dashboard/app/src/components/Countdown.tsx`**

```tsx
import { useEffect, useState } from 'react';

interface CountdownProps {
  targetUnix: bigint; // seconds
  label: string;
}

function formatRemaining(seconds: number): string {
  if (seconds <= 0) return 'Ended';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export default function Countdown({ targetUnix, label }: CountdownProps) {
  const [remaining, setRemaining] = useState<number>(
    Number(targetUnix) - Math.floor(Date.now() / 1000),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Number(targetUnix) - Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [targetUnix]);

  return (
    <span className="tabular-nums text-sm">
      {label}: <span className={remaining <= 0 ? 'text-gray-400' : 'text-green-400'}>{formatRemaining(remaining)}</span>
    </span>
  );
}
```

- [ ] **Step 2: Create `dashboard/app/src/components/VaultCard.tsx`**

```tsx
import { Link } from 'react-router-dom';
import { formatUnits } from 'viem';
import Countdown from './Countdown';
import type { VaultState } from '../types';

interface VaultCardProps {
  vaultAddress: string;
  state: VaultState | null;
  loading: boolean;
}

function statusBadge(state: VaultState): string {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (!state.initialized) return 'NOT STARTED';
  if (now < state.depositDeadline) return 'OPEN';
  if (state.lockDuration === 0n) return 'FINALIZED';
  if (now < state.lockExpiry) return 'CLOSED';
  return 'UNLOCKED';
}

function badgeColor(badge: string): string {
  if (badge === 'OPEN') return 'bg-green-900 text-green-300';
  if (badge === 'FINALIZED') return 'bg-blue-900 text-blue-300';
  if (badge === 'UNLOCKED') return 'bg-purple-900 text-purple-300';
  return 'bg-gray-800 text-gray-400';
}

export default function VaultCard({ vaultAddress, state, loading }: VaultCardProps) {
  const short = `${vaultAddress.slice(0, 6)}…${vaultAddress.slice(-4)}`;

  if (loading) {
    return (
      <div className="border border-gray-700 rounded p-4 animate-pulse bg-gray-900">
        <div className="h-4 bg-gray-700 rounded w-32 mb-2" />
        <div className="h-3 bg-gray-700 rounded w-24" />
      </div>
    );
  }

  if (!state) {
    return (
      <div className="border border-gray-700 rounded p-4 bg-gray-900">
        <p className="text-gray-500 text-sm font-mono">{short}</p>
        <p className="text-red-400 text-xs mt-1">Failed to load</p>
      </div>
    );
  }

  const badge = statusBadge(state);

  return (
    <Link
      to={`/vault/${vaultAddress}`}
      className="block border border-gray-700 hover:border-gray-500 rounded p-4 bg-gray-900 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-sm text-gray-300">{short}</span>
        <span className={`text-xs px-2 py-0.5 rounded font-mono ${badgeColor(badge)}`}>{badge}</span>
      </div>
      <div className="flex gap-4 text-xs text-gray-400 flex-wrap">
        <span>Mode: {state.depositTokenSymbol}</span>
        <span>Deposited: {formatUnits(state.totalDeposited, 18)} {state.depositTokenSymbol}</span>
        {state.initialized && state.depositDeadline > 0n && (
          <Countdown targetUnix={state.depositDeadline} label="Window" />
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
cd dashboard/app && npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd ../.. && git add dashboard/app/src/components/
git commit -m "feat(dashboard): add Countdown and VaultCard components"
```

---

### Task 9: Write ActionPanel.tsx

**Files:**
- Create: `dashboard/app/src/components/ActionPanel.tsx`

- [ ] **Step 1: Create `dashboard/app/src/components/ActionPanel.tsx`**

```tsx
import { useState } from 'react';
import { encodeFunctionData, parseUnits, formatUnits, type Address } from 'viem';
import type { ConnectedWallet } from '@privy-io/react-auth';
import { sendAndWait } from '../lib/wallet';
import { VAULT_WRITE_ABI, ERC20_ABI } from '../lib/contracts';
import type { VaultState } from '../types';

interface ActionPanelProps {
  vault: VaultState;
  wallet: ConnectedWallet | null;
  onDone: () => void; // caller refreshes vault state after tx
}

export default function ActionPanel({ vault, wallet, onDone }: ActionPanelProps) {
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const now = BigInt(Math.floor(Date.now() / 1000));
  const windowOpen = vault.initialized && now < vault.depositDeadline;
  const windowClosed = vault.initialized && now >= vault.depositDeadline;
  const lockExpired = vault.lockDuration > 0n && now >= vault.lockExpiry;

  const isVvvMode = vault.lockDuration === 0n;

  const canDeposit = windowOpen;
  const canClaim = windowClosed && vault.myDeposited !== undefined && vault.myDeposited > 0n && !vault.myClaimed;
  const canFinalize = isVvvMode && windowClosed;
  const canWithdraw = !isVvvMode && lockExpired && vault.myDeposited !== undefined && vault.myDeposited > 0n && !vault.myWithdrawn;

  async function run(buildData: () => `0x${string}`, to: Address, label: string) {
    if (!wallet) return;
    setError(null);
    setStatus(`${label}…`);
    try {
      const data = buildData();
      await sendAndWait(wallet, to, data, setStatus);
      setStatus(`${label} confirmed`);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus(null);
    }
  }

  async function handleApprove() {
    const amountWei = parseUnits(amount || '0', 18);
    if (amountWei === 0n) return;
    await run(
      () => encodeFunctionData({ abi: ERC20_ABI, functionName: 'approve', args: [vault.address, amountWei] }),
      vault.depositToken,
      'Approve',
    );
  }

  async function handleDeposit() {
    const amountWei = parseUnits(amount || '0', 18);
    if (amountWei === 0n) return;
    await run(
      () => encodeFunctionData({ abi: VAULT_WRITE_ABI, functionName: 'deposit', args: [amountWei] }),
      vault.address,
      'Deposit',
    );
  }

  async function handleClaim() {
    await run(
      () => encodeFunctionData({ abi: VAULT_WRITE_ABI, functionName: 'claimTokens', args: [] }),
      vault.address,
      'Claim tokens',
    );
  }

  async function handleFinalize() {
    await run(
      () => encodeFunctionData({ abi: VAULT_WRITE_ABI, functionName: 'finalizeVVV', args: [] }),
      vault.address,
      'Finalize VVV',
    );
  }

  async function handleWithdraw() {
    await run(
      () => encodeFunctionData({ abi: VAULT_WRITE_ABI, functionName: 'withdrawDepositToken', args: [] }),
      vault.address,
      'Withdraw',
    );
  }

  if (!wallet) {
    return <p className="text-gray-400 text-sm">Connect wallet to interact.</p>;
  }

  const amountWei = amount ? parseUnits(amount, 18) : 0n;
  const needsApproval = canDeposit && amountWei > 0n && (vault.myAllowance ?? 0n) < amountWei;

  return (
    <div className="space-y-3">
      {canDeposit && (
        <div className="space-y-2">
          <label className="text-xs text-gray-400">
            Deposit amount ({vault.depositTokenSymbol})
            {vault.myBalance !== undefined && (
              <span className="ml-2 text-gray-500">
                Balance: {formatUnits(vault.myBalance, 18)}
              </span>
            )}
          </label>
          <input
            type="number"
            min="0"
            step="any"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.0"
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-gray-400"
          />
          <div className="flex gap-2">
            {needsApproval && (
              <button
                onClick={handleApprove}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm py-2 px-4 rounded font-mono"
              >
                [ APPROVE ]
              </button>
            )}
            <button
              onClick={handleDeposit}
              disabled={needsApproval || amountWei === 0n}
              className="flex-1 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm py-2 px-4 rounded font-mono"
            >
              [ DEPOSIT ]
            </button>
          </div>
        </div>
      )}

      {canClaim && (
        <button
          onClick={handleClaim}
          className="w-full bg-green-700 hover:bg-green-600 text-white text-sm py-2 px-4 rounded font-mono"
        >
          [ CLAIM TOKENS ]
          {vault.myShare !== undefined && vault.myShare > 0n && (
            <span className="ml-2 text-green-300 text-xs">
              ({formatUnits(vault.myShare, 18)})
            </span>
          )}
        </button>
      )}

      {canFinalize && (
        <button
          onClick={handleFinalize}
          className="w-full bg-yellow-700 hover:bg-yellow-600 text-white text-sm py-2 px-4 rounded font-mono"
        >
          [ FINALIZE VVV → AGENT ]
        </button>
      )}

      {canWithdraw && (
        <button
          onClick={handleWithdraw}
          className="w-full bg-purple-700 hover:bg-purple-600 text-white text-sm py-2 px-4 rounded font-mono"
        >
          [ WITHDRAW {vault.depositTokenSymbol} ]
          {vault.myDeposited !== undefined && (
            <span className="ml-2 text-purple-300 text-xs">
              ({formatUnits(vault.myDeposited, 18)})
            </span>
          )}
        </button>
      )}

      {status && <p className="text-xs text-blue-300 font-mono">{status}</p>}
      {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd dashboard/app && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd ../.. && git add dashboard/app/src/components/ActionPanel.tsx
git commit -m "feat(dashboard): add ActionPanel — deposit/approve/claim/finalize/withdraw"
```

---

### Task 10: Write pages/Index.tsx

**Files:**
- Create: `dashboard/app/public/presales.json` (empty seed)
- Create: `dashboard/app/src/pages/Index.tsx`

- [ ] **Step 1: Create seed `dashboard/app/public/presales.json`**

```json
[]
```

- [ ] **Step 2: Create `dashboard/app/src/pages/Index.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { isAddress } from 'viem';
import VaultCard from '../components/VaultCard';
import { readVaultState } from '../lib/contracts';
import type { PresaleEntry, VaultState } from '../types';

export default function Index() {
  const [entries, setEntries] = useState<PresaleEntry[]>([]);
  const [states, setStates] = useState<Record<string, VaultState | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('./presales.json')
      .then(r => r.json())
      .then((data: PresaleEntry[]) => {
        setEntries(data);
        setLoading(false);
        // Fetch each vault state concurrently
        data.forEach(entry => {
          if (!isAddress(entry.vaultAddress)) return;
          readVaultState(entry.vaultAddress as `0x${string}`)
            .then(state => setStates(prev => ({ ...prev, [entry.vaultAddress]: state })))
            .catch(() => setStates(prev => ({ ...prev, [entry.vaultAddress]: null })));
        });
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 font-mono">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-bold mb-1">Agent Presales</h1>
        <p className="text-gray-400 text-sm mb-6">
          Venice Agent Launchpad — active and historical presale vaults.
        </p>

        {loading && (
          <div className="space-y-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="border border-gray-700 rounded p-4 animate-pulse bg-gray-900 h-16" />
            ))}
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div className="border border-gray-700 rounded p-6 text-center text-gray-500">
            <p>No presales deployed yet.</p>
            <a
              href="https://app.liquidprotocol.org/launch/presale"
              className="text-blue-400 hover:underline text-sm mt-2 block"
            >
              Launch an agent with presale →
            </a>
          </div>
        )}

        <div className="space-y-3">
          {entries.map(entry => (
            <VaultCard
              key={entry.vaultAddress}
              vaultAddress={entry.vaultAddress}
              state={states[entry.vaultAddress] ?? null}
              loading={!(entry.vaultAddress in states)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
cd dashboard/app && npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd ../.. && git add dashboard/app/public/presales.json dashboard/app/src/pages/Index.tsx
git commit -m "feat(dashboard): add Index page — presale list with live vault state"
```

---

### Task 11: Write pages/VaultDetail.tsx

**Files:**
- Create: `dashboard/app/src/pages/VaultDetail.tsx`

- [ ] **Step 1: Create `dashboard/app/src/pages/VaultDetail.tsx`**

```tsx
import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { isAddress, formatUnits } from 'viem';
import { useWallets } from '@privy-io/react-auth';
import { readVaultState } from '../lib/contracts';
import ActionPanel from '../components/ActionPanel';
import Countdown from '../components/Countdown';
import type { VaultState } from '../types';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-gray-800 py-2 text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-100 font-mono text-right break-all max-w-[60%]">{value}</span>
    </div>
  );
}

export default function VaultDetail() {
  const { address } = useParams<{ address: string }>();
  const { wallets } = useWallets();
  const wallet = wallets.find(w => w.walletClientType !== 'privy') ?? wallets[0] ?? null;

  const [state, setState] = useState<VaultState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!address || !isAddress(address)) {
      setError('Invalid vault address');
      setLoading(false);
      return;
    }
    setLoading(true);
    readVaultState(
      address as `0x${string}`,
      wallet?.address as `0x${string}` | undefined,
    )
      .then(s => { setState(s); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [address, wallet?.address]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-6 font-mono">
        <div className="max-w-2xl mx-auto animate-pulse space-y-3">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-6 bg-gray-800 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-6 font-mono">
        <div className="max-w-2xl mx-auto">
          <Link to="/" className="text-blue-400 text-sm hover:underline">← back</Link>
          <p className="text-red-400 mt-4">{error ?? 'Vault not found'}</p>
        </div>
      </div>
    );
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  const mode = state.lockDuration === 0n ? 'VVV irrevocable' : `DIEM time-lock (${Number(state.lockDuration) / 86400}d)`;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 font-mono">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="text-blue-400 text-sm hover:underline">← all presales</Link>

        <h1 className="text-lg font-bold mt-4 mb-1 break-all">{address}</h1>
        <p className="text-gray-400 text-sm mb-6">Presale vault on Base</p>

        <div className="border border-gray-700 rounded p-4 mb-6 space-y-0">
          <Row label="Mode" value={mode} />
          <Row label="Deposit token" value={state.depositTokenSymbol} />
          <Row label="Total deposited" value={`${formatUnits(state.totalDeposited, 18)} ${state.depositTokenSymbol}`} />
          <Row label="Token supply" value={`${formatUnits(state.totalTokenSupply, 18)} tokens`} />
          <Row label="Agent wallet" value={state.agentWallet} />
          {state.initialized && state.depositDeadline > 0n && (
            <div className="flex justify-between border-b border-gray-800 py-2 text-sm">
              <span className="text-gray-400">Deposit window</span>
              <Countdown targetUnix={state.depositDeadline} label="closes" />
            </div>
          )}
          {state.lockDuration > 0n && state.lockExpiry > 0n && (
            <div className="flex justify-between border-b border-gray-800 py-2 text-sm">
              <span className="text-gray-400">Lock expiry</span>
              <Countdown targetUnix={state.lockExpiry} label="unlocks" />
            </div>
          )}
        </div>

        {wallet && state.myDeposited !== undefined && (
          <div className="border border-gray-700 rounded p-4 mb-6 space-y-0">
            <h2 className="text-sm text-gray-300 mb-2">Your position</h2>
            <Row label="Deposited" value={`${formatUnits(state.myDeposited, 18)} ${state.depositTokenSymbol}`} />
            <Row label="Tokens claimable" value={state.myShare !== undefined ? formatUnits(state.myShare, 18) : '—'} />
            <Row label="Tokens claimed" value={state.myClaimed ? 'Yes' : 'No'} />
            {state.lockDuration > 0n && (
              <Row label="Deposit withdrawn" value={state.myWithdrawn ? 'Yes' : 'No'} />
            )}
          </div>
        )}

        <div className="border border-gray-700 rounded p-4">
          <h2 className="text-sm text-gray-300 mb-3">Actions</h2>
          <ActionPanel vault={state} wallet={wallet} onDone={load} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd dashboard/app && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd ../.. && git add dashboard/app/src/pages/VaultDetail.tsx
git commit -m "feat(dashboard): add VaultDetail page — vault state + action panel"
```

---

### Task 12: Wire App.tsx, main.tsx

**Files:**
- Create: `dashboard/app/src/App.tsx`
- Create: `dashboard/app/src/main.tsx`

- [ ] **Step 1: Create `dashboard/app/src/App.tsx`**

```tsx
import { HashRouter, Routes, Route } from 'react-router-dom';
import Index from './pages/Index';
import VaultDetail from './pages/VaultDetail';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/vault/:address" element={<VaultDetail />} />
      </Routes>
    </HashRouter>
  );
}
```

- [ ] **Step 2: Create `dashboard/app/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PrivyProvider } from '@privy-io/react-auth';
import { base } from 'viem/chains';
import App from './App';
import './index.css';

const appId = import.meta.env['VITE_PRIVY_APP_ID'] as string;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrivyProvider
      appId={appId}
      config={{
        defaultChain: base,
        supportedChains: [base],
        appearance: { theme: 'dark' },
        loginMethods: ['wallet'],
        embeddedWallets: { ethereum: { createOnLogin: 'off' } },
      }}
    >
      <App />
    </PrivyProvider>
  </StrictMode>,
);
```

- [ ] **Step 3: Typecheck + build**

```bash
cd dashboard/app
npm run typecheck
VITE_PRIVY_APP_ID=placeholder npm run build
```

Expected: `dist/` directory created, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
cd ../.. && git add dashboard/app/src/App.tsx dashboard/app/src/main.tsx
git commit -m "feat(dashboard): wire App router and PrivyProvider entry"
```

---

### Task 13: Write scripts/export-presales.ts

**Files:**
- Create: `scripts/export-presales.ts`

- [ ] **Step 1: Create `scripts/export-presales.ts`**

```ts
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PresaleEntry } from '../dashboard/app/src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const REPO_ROOT  = join(__dirname, '..');

const jsonlPath = join(REPO_ROOT, 'memory', 'presales.jsonl');
const outPath   = join(REPO_ROOT, 'dashboard', 'app', 'public', 'presales.json');

let entries: PresaleEntry[] = [];

if (existsSync(jsonlPath)) {
  const raw = readFileSync(jsonlPath, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean);

  entries = raw.map(line => {
    const r = JSON.parse(line) as Record<string, string>;
    return {
      vaultAddress: r['vaultAddress'] ?? '',
      deployedAt:   r['timestamp']    ?? '',
      agentWallet:  r['agentWallet'],
      contract:     r['contract'],
    };
  }).filter(e => e.vaultAddress.startsWith('0x'));
}

writeFileSync(outPath, JSON.stringify(entries, null, 2));
console.log(`Exported ${entries.length} presale(s) → ${outPath}`);
```

- [ ] **Step 2: Dry-run the script**

```bash
node --import tsx scripts/export-presales.ts
```

Expected: `Exported 0 presale(s) → …/dashboard/app/public/presales.json` (since presales.jsonl is empty).

- [ ] **Step 3: Commit**

```bash
git add scripts/export-presales.ts
git commit -m "feat(dashboard): add export-presales script (jsonl → public/presales.json)"
```

---

### Task 14: Write .github/workflows/dashboard.yml

**Files:**
- Create: `.github/workflows/dashboard.yml`

- [ ] **Step 1: Create `.github/workflows/dashboard.yml`**

```yaml
name: Presale Dashboard

on:
  push:
    branches: [main]
    paths:
      - 'dashboard/**'
      - 'memory/presales.jsonl'
      - 'scripts/export-presales.ts'
      - '.github/workflows/dashboard.yml'

concurrency:
  group: dashboard-deploy
  cancel-in-progress: true

jobs:
  deploy:
    name: Build and deploy to GitHub Pages
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install root deps (for tsx + export script)
        run: npm ci

      - name: Export presales.json
        run: node --import tsx scripts/export-presales.ts

      - name: Install dashboard deps
        working-directory: dashboard/app
        run: npm ci

      - name: Build dashboard
        working-directory: dashboard/app
        run: npm run build
        env:
          VITE_PRIVY_APP_ID: ${{ secrets.DASHBOARD_PRIVY_APP_ID }}

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: dashboard/app/dist
          destination_dir: presales
```

**Note:** Before this workflow runs in production:
1. Add `DASHBOARD_PRIVY_APP_ID` to repo secrets (Settings → Secrets → New secret). Use the Privy App ID from the agent-autonomopoly Privy application (or create a new app at `privy.io` with Base chain enabled).
2. Enable GitHub Pages in repo settings → Pages → Source: Deploy from a branch → `gh-pages`.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/dashboard.yml
git commit -m "ci: add dashboard build + GitHub Pages deploy workflow"
```

---

### Task 15: Final typecheck, build verification, and push

- [ ] **Step 1: Run full typecheck on root**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 2: Run dashboard typecheck and build**

```bash
cd dashboard/app
npm run typecheck
VITE_PRIVY_APP_ID=placeholder npm run build
```

Expected: `dist/` directory with `index.html`, JS, and CSS bundles.

- [ ] **Step 3: Verify presales.json is served in preview**

```bash
VITE_PRIVY_APP_ID=placeholder npm run preview &
sleep 2
curl -s http://localhost:4173/presales.json | python3 -c "import json,sys; print(json.load(sys.stdin))"
# Expected: []
kill %1
```

- [ ] **Step 4: Update CLAUDE.md dashboard README**

Create `dashboard/README.md`:

```markdown
# Agent Presale Dashboard

Interactive presale vault UI for Venice Agent Launchpad.

## Development

```bash
cd dashboard/app
npm install
VITE_PRIVY_APP_ID=your-privy-app-id npm run dev
```

## Build

From repo root:
```bash
node --import tsx scripts/export-presales.ts  # regenerate presales.json
cd dashboard/app && npm run build
```

## Deploy

Push to main — the `dashboard.yml` workflow builds and deploys to GitHub Pages at `/<repo>/presales/`.

## Environment

- `VITE_PRIVY_APP_ID` — Privy App ID (required). Set in GitHub secrets as `DASHBOARD_PRIVY_APP_ID`.
```

- [ ] **Step 5: Final commit**

```bash
cd /path/to/agent-autonomopoly
git add dashboard/README.md
git commit -m "docs: add dashboard README"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Task |
|---|---|
| Interactive deposit/claim/finalize/withdraw | Task 9 (ActionPanel) |
| Privy wallet connection | Task 12 (main.tsx) |
| Vault detail page with all state | Task 11 (VaultDetail) |
| Index page listing all presales | Task 10 (Index) |
| Countdown timer | Task 8 (Countdown) |
| Empty-state on index | Task 10 (Index — "No presales" block) |
| presales.jsonl → presales.json export | Task 13 (export-presales.ts) |
| GitHub Pages deploy workflow | Task 14 |
| VVV irrevocable full flow | Task 1 |
| DIEM time-lock full flow | Task 2 |
| Pro-rata split verification | Task 1 (two-depositors test) |
| All revert edge cases | Task 2 |
| Fork CI workflow | Task 3 |

All spec requirements covered.

### Placeholder scan

No TBDs or incomplete sections found.

### Type consistency

- `PresaleEntry` defined in `types.ts` (Task 5), used in `Index.tsx` (Task 10) and `export-presales.ts` (Task 13) — consistent.
- `VaultState` defined in `types.ts` (Task 5), used in `contracts.ts` (Task 6), `VaultCard` (Task 8), `ActionPanel` (Task 9), `VaultDetail` (Task 11) — consistent.
- `VAULT_WRITE_ABI`, `ERC20_ABI` defined in `contracts.ts` (Task 6), used in `ActionPanel.tsx` (Task 9) — consistent.
- `sendAndWait` defined in `wallet.ts` (Task 7), used in `ActionPanel.tsx` (Task 9) — consistent.
- `makePublicClient` defined in `chain.ts` (Task 5), used in `contracts.ts` (Task 6) — consistent.
