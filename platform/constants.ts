// On-chain addresses for Base mainnet (chain ID 8453).
// Keep in sync with liquid-protocol-ops/sdk/src/constants.ts — these are
// the agent-template's read-only copy so harness modules don't need an SDK dep.

import type { Address } from 'viem';

export const ADDRESSES = {
  FEE_LOCKER: '0xF7d3BE3FC0de76fA5550C29A8F6fa53667B876FF' as Address,
} as const;
