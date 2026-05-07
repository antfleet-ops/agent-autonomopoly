// On-chain addresses for Base mainnet (chain ID 8453).
// Keep in sync with liquid-protocol-ops/sdk/src/constants.ts — these are
// the agent-template's read-only copy so harness modules don't need an SDK dep.

import type { Address } from 'viem';

export const ADDRESSES = {
  FEE_LOCKER: '0xF7d3BE3FC0de76fA5550C29A8F6fa53667B876FF' as Address,
  // DIEM is both the ERC-20 token and the staking contract — call stake(uint256) directly on this address.
  DIEM: '0xF4d97F2da56e8c3098f3a8D538DB630A2606a024' as Address,
} as const;
