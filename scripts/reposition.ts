// scripts/reposition.ts
//
// Closes an out-of-range LP position, claims FeeLocker fees, and reinvests
// into a new in-range position bracketing the current tick.
//
// Handles both cases:
//   below range (position is all WETH) → swap WETH→DIEM, mint/increaseLiquidity
//   above range (position is all DIEM) → swap DIEM→WETH, mint/increaseLiquidity
//
// Usage:
//   node --env-file=.env --import tsx scripts/reposition.ts --token-id 5119885
//   node --env-file=.env --import tsx scripts/reposition.ts --token-id 5119885 --dry-run
//   node --env-file=.env --import tsx scripts/reposition.ts --dry-run   # auto-detect from lp-positions.jsonl
//
// Required env: PRIVY_APP_ID + PRIVY_APP_SECRET + PRIVY_WALLET_ID  (or AGENT_PRIVATE_KEY)
//               RPC_URL

import { createPublicClient, encodeFunctionData, http, formatUnits, type Address, type Hex } from 'viem';
import { base } from 'viem/chains';
import { appendFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import {
  loadPrivyConfig, makeTxSenderFromPrivy,
  loadSignerFromEnv, makeTxSenderFromEnv,
  type TxSender,
} from '../harness/safety/wallet.js';
import { ADDRESSES, ETH_DIEM_V3 } from '../platform/constants.js';

const SLIPPAGE     = 3n;   // % slippage tolerance on swaps and mints
const MAX_UINT128  = (2n ** 128n) - 1n;

// ── ABIs ───────────────────────────────────────────────────────────────

const SLOT0_ABI = [{
  name: 'slot0', type: 'function', stateMutability: 'view',
  inputs: [],
  outputs: [
    { name: 'sqrtPriceX96', type: 'uint160' },
    { name: 'tick',         type: 'int24'   },
    { name: 'observationIndex',           type: 'uint16' },
    { name: 'observationCardinality',     type: 'uint16' },
    { name: 'observationCardinalityNext', type: 'uint16' },
    { name: 'feeProtocol', type: 'uint8'  },
    { name: 'unlocked',    type: 'bool'   },
  ],
}] as const;

const NFPM_POSITIONS_ABI = [{
  name: 'positions', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'tokenId', type: 'uint256' }],
  outputs: [
    { name: 'nonce',                       type: 'uint96'  },
    { name: 'operator',                    type: 'address' },
    { name: 'token0',                      type: 'address' },
    { name: 'token1',                      type: 'address' },
    { name: 'fee',                         type: 'uint24'  },
    { name: 'tickLower',                   type: 'int24'   },
    { name: 'tickUpper',                   type: 'int24'   },
    { name: 'liquidity',                   type: 'uint128' },
    { name: 'feeGrowthInside0LastX128',    type: 'uint256' },
    { name: 'feeGrowthInside1LastX128',    type: 'uint256' },
    { name: 'tokensOwed0',                 type: 'uint128' },
    { name: 'tokensOwed1',                 type: 'uint128' },
  ],
}] as const;

const ERC20_ABI = [{
  name: 'balanceOf', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'account', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }],
}, {
  name: 'approve', type: 'function', stateMutability: 'nonpayable',
  inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
  outputs: [{ name: '', type: 'bool' }],
}] as const;

const FEE_LOCKER_ABI = [{
  name: 'availableFees', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'feeOwner', type: 'address' }, { name: 'token', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }],
}, {
  name: 'claim', type: 'function', stateMutability: 'nonpayable',
  inputs: [{ name: 'feeOwner', type: 'address' }, { name: 'token', type: 'address' }],
  outputs: [],
}] as const;

const NFPM_DECREASE_ABI = [{
  name: 'decreaseLiquidity', type: 'function', stateMutability: 'payable',
  inputs: [{ name: 'params', type: 'tuple', components: [
    { name: 'tokenId',    type: 'uint256' },
    { name: 'liquidity',  type: 'uint128' },
    { name: 'amount0Min', type: 'uint256' },
    { name: 'amount1Min', type: 'uint256' },
    { name: 'deadline',   type: 'uint256' },
  ]}],
  outputs: [{ name: 'amount0', type: 'uint256' }, { name: 'amount1', type: 'uint256' }],
}] as const;

const NFPM_COLLECT_ABI = [{
  name: 'collect', type: 'function', stateMutability: 'payable',
  inputs: [{ name: 'params', type: 'tuple', components: [
    { name: 'tokenId',    type: 'uint256' },
    { name: 'recipient',  type: 'address' },
    { name: 'amount0Max', type: 'uint128' },
    { name: 'amount1Max', type: 'uint128' },
  ]}],
  outputs: [{ name: 'amount0', type: 'uint256' }, { name: 'amount1', type: 'uint256' }],
}] as const;

const NFPM_MINT_ABI = [{
  name: 'mint', type: 'function', stateMutability: 'payable',
  inputs: [{ name: 'params', type: 'tuple', components: [
    { name: 'token0',         type: 'address' },
    { name: 'token1',         type: 'address' },
    { name: 'fee',            type: 'uint24'  },
    { name: 'tickLower',      type: 'int24'   },
    { name: 'tickUpper',      type: 'int24'   },
    { name: 'amount0Desired', type: 'uint256' },
    { name: 'amount1Desired', type: 'uint256' },
    { name: 'amount0Min',     type: 'uint256' },
    { name: 'amount1Min',     type: 'uint256' },
    { name: 'recipient',      type: 'address' },
    { name: 'deadline',       type: 'uint256' },
  ]}],
  outputs: [
    { name: 'tokenId',   type: 'uint256' },
    { name: 'liquidity', type: 'uint128' },
    { name: 'amount0',   type: 'uint256' },
    { name: 'amount1',   type: 'uint256' },
  ],
}] as const;

const SWAP_ROUTER_ABI = [{
  name: 'exactInputSingle', type: 'function', stateMutability: 'payable',
  inputs: [{ name: 'params', type: 'tuple', components: [
    { name: 'tokenIn',           type: 'address' },
    { name: 'tokenOut',          type: 'address' },
    { name: 'fee',               type: 'uint24'  },
    { name: 'recipient',         type: 'address' },
    { name: 'amountIn',          type: 'uint256' },
    { name: 'amountOutMinimum',  type: 'uint256' },
    { name: 'sqrtPriceLimitX96', type: 'uint160' },
  ]}],
  outputs: [{ name: 'amountOut', type: 'uint256' }],
}] as const;

// ── Helpers ────────────────────────────────────────────────────────────

function tsDeadline(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + 600);
}

function mkClient(rpcUrl: string) {
  return createPublicClient({ chain: base, transport: http(rpcUrl) });
}
type AppClient = ReturnType<typeof mkClient>;

async function readBalance(client: AppClient, token: Address, who: Address): Promise<bigint> {
  return client.readContract({ address: token, abi: ERC20_ABI, functionName: 'balanceOf', args: [who] });
}

function parseTokenId(logs: readonly { topics: readonly string[] }[]): bigint | null {
  const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  const ZERO_PADDED    = '0x0000000000000000000000000000000000000000000000000000000000000000';
  for (const log of logs) {
    if (
      log.topics[0]?.toLowerCase() === TRANSFER_TOPIC &&
      log.topics[1]?.toLowerCase() === ZERO_PADDED &&
      log.topics[3]
    ) {
      return BigInt(log.topics[3]);
    }
  }
  return null;
}

// Snap tick down to the nearest tickSpacing multiple.
function snapTick(tick: number, spacing: number): number {
  return Math.floor(tick / spacing) * spacing;
}

// New tick range centred on currentTick: two spacings wide on each side.
function computeNewRange(currentTick: number, spacing: number): [number, number] {
  const base = snapTick(currentTick, spacing);
  return [base - spacing, base + spacing * 2];
}

// Last tokenId in lp-positions.jsonl that isn't the one we're closing.
function latestOtherPosition(closingId: bigint): bigint | null {
  const path = 'memory/lp-positions.jsonl';
  if (!existsSync(path)) return null;
  const lines = readFileSync(path, 'utf8').trim().split('\n').filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const rec = JSON.parse(lines[i]!) as { tokenId: string };
      const id = BigInt(rec.tokenId);
      if (id !== closingId) return id;
    } catch { /* skip */ }
  }
  return null;
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  const argv    = process.argv.slice(2);
  const dryRun  = argv.includes('--dry-run');
  const rpcUrl  = process.env['RPC_URL'] ?? 'https://mainnet.base.org';

  // Resolve tokenId: --token-id flag or last entry in lp-positions.jsonl
  let tokenId: bigint;
  const tidIdx = argv.indexOf('--token-id');
  if (tidIdx !== -1 && argv[tidIdx + 1]) {
    tokenId = BigInt(argv[tidIdx + 1]!);
  } else {
    const path = 'memory/lp-positions.jsonl';
    if (!existsSync(path)) {
      console.error('No --token-id provided and memory/lp-positions.jsonl not found');
      process.exit(1);
    }
    const lines = readFileSync(path, 'utf8').trim().split('\n').filter(Boolean);
    const last  = JSON.parse(lines[lines.length - 1]!) as { tokenId: string };
    tokenId = BigInt(last.tokenId);
  }

  const client = mkClient(rpcUrl);

  // Wallet
  let txSender: TxSender;
  let agentAddress: Address;
  if (process.env['PRIVY_APP_ID']) {
    const cfg = loadPrivyConfig();
    const { loadSignerFromPrivy } = await import('../harness/safety/wallet.js');
    const signer = await loadSignerFromPrivy(cfg);
    agentAddress = signer.address;
    txSender = makeTxSenderFromPrivy(cfg);
  } else {
    const signer = loadSignerFromEnv();
    agentAddress = signer.address;
    txSender = makeTxSenderFromEnv(rpcUrl);
  }

  console.log(`\nAgent:      ${agentAddress}`);
  console.log(`TokenId:    ${tokenId}`);
  console.log(`Dry-run:    ${dryRun}\n`);

  // ── Read position from NFPM ────────────────────────────────────────

  const pos = await client.readContract({
    address: ADDRESSES.NFPM_V3,
    abi: NFPM_POSITIONS_ABI,
    functionName: 'positions',
    args: [tokenId],
  });
  const [,, , , , tickLower, tickUpper, liquidity] = pos;

  console.log(`Position:   [${tickLower}, ${tickUpper}]  liquidity=${liquidity}`);

  if (liquidity === 0n) {
    console.log('Liquidity is 0 — position already closed. Nothing to do.');
    process.exit(0);
  }

  // ── Pool state ─────────────────────────────────────────────────────

  const [slot0, claimable] = await Promise.all([
    client.readContract({ address: ADDRESSES.ETH_DIEM_V3, abi: SLOT0_ABI, functionName: 'slot0' }),
    client.readContract({ address: ADDRESSES.FEE_LOCKER, abi: FEE_LOCKER_ABI, functionName: 'availableFees', args: [agentAddress, ADDRESSES.DIEM] }),
  ]);
  const currentTick   = slot0[1];
  const sqrtPriceX96  = slot0[0];
  const diemPerWeth   = Number(sqrtPriceX96 ** 2n * (10n ** 18n) / (2n ** 192n)) / 1e18;

  // Position state relative to current tick
  const belowRange = currentTick < tickLower;  // all WETH when withdrawn
  const aboveRange = currentTick > tickUpper;  // all DIEM when withdrawn
  const inRange    = !belowRange && !aboveRange;

  console.log(`Current tick: ${currentTick}  DIEM/WETH: ${diemPerWeth.toFixed(6)}`);
  console.log(`Position status: ${belowRange ? 'BELOW RANGE (all WETH)' : aboveRange ? 'ABOVE RANGE (all DIEM)' : 'IN RANGE'}`);
  console.log(`FeeLocker:    ${formatUnits(claimable, 18)} DIEM claimable\n`);

  if (inRange) {
    console.log('Position is in range — no reposition needed. Run lp-monitor to re-evaluate.');
    process.exit(0);
  }

  // New tick range bracketing current tick
  const [newTickLower, newTickUpper] = computeNewRange(currentTick, ETH_DIEM_V3.TICK_SPACING);
  console.log(`New range:    [${newTickLower}, ${newTickUpper}]\n`);

  if (dryRun) {
    console.log(`[dry-run] Would close tokenId ${tokenId} (liquidity ${liquidity})`);
    console.log(`[dry-run] Would claim ${formatUnits(claimable, 18)} DIEM from FeeLocker`);
    if (belowRange) {
      console.log(`[dry-run] Below range → collect WETH, swap WETH→DIEM, mint [${newTickLower}, ${newTickUpper}]`);
    } else {
      console.log(`[dry-run] Above range → collect DIEM, swap some DIEM→WETH, mint [${newTickLower}, ${newTickUpper}]`);
    }
    return;
  }

  const send = async (label: string, to: Address, data: Hex) => {
    console.log(`[${label}] sending...`);
    const hash = await txSender({ to, data });
    console.log(`[${label}] hash: ${hash}`);
    const receipt = await client.waitForTransactionReceipt({ hash });
    console.log(`[${label}] confirmed (block ${receipt.blockNumber})`);
    return receipt;
  };

  // ── 1. Close out-of-range position ────────────────────────────────

  console.log(`Step 1: close position ${tokenId}`);

  await send('decreaseLiquidity', ADDRESSES.NFPM_V3, encodeFunctionData({
    abi: NFPM_DECREASE_ABI, functionName: 'decreaseLiquidity',
    args: [{ tokenId, liquidity, amount0Min: 0n, amount1Min: 0n, deadline: tsDeadline() }],
  }));

  await send('collect', ADDRESSES.NFPM_V3, encodeFunctionData({
    abi: NFPM_COLLECT_ABI, functionName: 'collect',
    args: [{ tokenId, recipient: agentAddress, amount0Max: MAX_UINT128, amount1Max: MAX_UINT128 }],
  }));

  // ── 2. Claim FeeLocker fees ────────────────────────────────────────

  if (claimable > 0n) {
    console.log(`\nStep 2: claim ${formatUnits(claimable, 18)} DIEM from FeeLocker`);
    await send('claim', ADDRESSES.FEE_LOCKER, encodeFunctionData({
      abi: FEE_LOCKER_ABI, functionName: 'claim',
      args: [agentAddress, ADDRESSES.DIEM],
    }));
  } else {
    console.log('\nStep 2: FeeLocker empty, skipping');
  }

  // ── 3. Read balances post-withdrawal, compute swap ─────────────────

  const [wethBal, diemBal] = await Promise.all([
    readBalance(client, ADDRESSES.WETH, agentAddress),
    readBalance(client, ADDRESSES.DIEM, agentAddress),
  ]);

  console.log(`\nStep 3: balances — WETH: ${formatUnits(wethBal, 18)}  DIEM: ${formatUnits(diemBal, 18)}`);

  // Determine swap direction and amount.
  // Target: ~50/50 value split for the new position (simple heuristic; Uniswap refunds excess).
  // Below range: have WETH, need DIEM → swap 50% of WETH → DIEM
  // Above range: have DIEM, need WETH → swap 50% of DIEM → WETH
  let swapAmountIn: bigint;
  let tokenIn: Address;
  let tokenOut: Address;
  let approxOut: bigint;

  if (belowRange) {
    swapAmountIn = wethBal / 2n;
    tokenIn      = ADDRESSES.WETH;
    tokenOut     = ADDRESSES.DIEM;
    approxOut    = BigInt(Math.floor(Number(swapAmountIn) * diemPerWeth));
    console.log(`        swap ${formatUnits(swapAmountIn, 18)} WETH → DIEM (50% of WETH balance)`);
  } else {
    // above range: have DIEM, need WETH
    swapAmountIn = diemBal / 2n;
    tokenIn      = ADDRESSES.DIEM;
    tokenOut     = ADDRESSES.WETH;
    approxOut    = BigInt(Math.floor(Number(swapAmountIn) / diemPerWeth));
    console.log(`        swap ${formatUnits(swapAmountIn, 18)} DIEM → WETH (50% of DIEM balance)`);
  }

  const amountOutMin = approxOut * (100n - SLIPPAGE) / 100n;

  // Approve tokenIn to SwapRouter
  await send(`approve-${belowRange ? 'weth' : 'diem'}-router`, belowRange ? ADDRESSES.WETH : ADDRESSES.DIEM, encodeFunctionData({
    abi: ERC20_ABI, functionName: 'approve',
    args: [ADDRESSES.SWAP_ROUTER_V3, swapAmountIn],
  }));

  await send('exactInputSingle', ADDRESSES.SWAP_ROUTER_V3, encodeFunctionData({
    abi: SWAP_ROUTER_ABI, functionName: 'exactInputSingle',
    args: [{
      tokenIn,
      tokenOut,
      fee:               ETH_DIEM_V3.FEE,
      recipient:         agentAddress,
      amountIn:          swapAmountIn,
      amountOutMinimum:  amountOutMin,
      sqrtPriceLimitX96: 0n,
    }],
  }));

  // ── 4. Mint new in-range position ─────────────────────────────────

  const [wethForMint, diemForMint] = await Promise.all([
    readBalance(client, ADDRESSES.WETH, agentAddress),
    readBalance(client, ADDRESSES.DIEM, agentAddress),
  ]);

  console.log(`\nStep 4: mint [${newTickLower}, ${newTickUpper}]`);
  console.log(`        WETH: ${formatUnits(wethForMint, 18)}`);
  console.log(`        DIEM: ${formatUnits(diemForMint, 18)}`);

  await send('approve-weth-nfpm', ADDRESSES.WETH, encodeFunctionData({
    abi: ERC20_ABI, functionName: 'approve',
    args: [ADDRESSES.NFPM_V3, wethForMint],
  }));
  await send('approve-diem-nfpm', ADDRESSES.DIEM, encodeFunctionData({
    abi: ERC20_ABI, functionName: 'approve',
    args: [ADDRESSES.NFPM_V3, diemForMint],
  }));

  const mintReceipt = await send('mint', ADDRESSES.NFPM_V3, encodeFunctionData({
    abi: NFPM_MINT_ABI, functionName: 'mint',
    args: [{
      token0:         ADDRESSES.WETH,
      token1:         ADDRESSES.DIEM,
      fee:            ETH_DIEM_V3.FEE,
      tickLower:      newTickLower,
      tickUpper:      newTickUpper,
      amount0Desired: wethForMint,
      amount1Desired: diemForMint,
      amount0Min:     wethForMint * (100n - SLIPPAGE) / 100n,
      amount1Min:     diemForMint * (100n - SLIPPAGE) / 100n,
      recipient:      agentAddress,
      deadline:       tsDeadline(),
    }],
  }));

  const newTokenId = parseTokenId(mintReceipt.logs);
  console.log(`\n✓ Repositioned. New tokenId: ${newTokenId?.toString() ?? 'parse-failed — check receipt'}`);

  // ── 5. Record in memory ────────────────────────────────────────────

  if (newTokenId !== null) {
    mkdirSync('memory', { recursive: true });
    const entry = JSON.stringify({
      tokenId:           newTokenId.toString(),
      pool:              'ETH/DIEM v3 1%',
      poolAddress:       ADDRESSES.ETH_DIEM_V3,
      mintedAt:          new Date().toISOString(),
      tickLower:         newTickLower,
      tickUpper:         newTickUpper,
      currentTickAtMint: currentTick,
      wethDeposited:     wethForMint.toString(),
      diemDeposited:     diemForMint.toString(),
      nfpm:              ADDRESSES.NFPM_V3,
      replacedTokenId:   tokenId.toString(),
    });
    appendFileSync('memory/lp-positions.jsonl', entry + '\n');
    console.log(`Saved to memory/lp-positions.jsonl`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
