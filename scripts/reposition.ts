// scripts/reposition.ts
//
// Repositions the DIEM LP from out-of-range [5000,5400] to in-range [5400,5600].
//
// Steps:
//   1. Close position 5119885  (decreaseLiquidity + collect)
//   2. Claim FeeLocker DIEM fees
//   3. Swap ~26% of total DIEM → WETH via Uniswap V3 SwapRouter02
//      (26% is the WETH value fraction needed for a [5400,5600] position at tick ~5545)
//   4. Mint new in-range position [5400,5600] with both WETH + DIEM
//
// Usage:
//   node --env-file=.env --import tsx scripts/reposition.ts            # live
//   node --env-file=.env --import tsx scripts/reposition.ts --dry-run  # simulate only
//
// Required env: PRIVY_APP_ID + PRIVY_APP_SECRET + PRIVY_WALLET_ID  (or AGENT_PRIVATE_KEY)
//               RPC_URL

import { createPublicClient, encodeFunctionData, http, formatUnits, type Address, type Hex } from 'viem';
import { base } from 'viem/chains';
import { appendFileSync, mkdirSync } from 'node:fs';
import {
  loadPrivyConfig, makeTxSenderFromPrivy,
  loadSignerFromEnv, makeTxSenderFromEnv,
  type TxSender,
} from '../harness/safety/wallet.js';
import { ADDRESSES, ETH_DIEM_V3 } from '../platform/constants.js';

// ── Target position ────────────────────────────────────────────────────

const TOKEN_ID   = 5119885n;
const LIQUIDITY  = 76479966455004343465n;  // from positions() read on 2026-05-14
// Current range [5000,5400] is IN RANGE as of 2026-05-16 (tick ~5354).
// Update these when the position goes out of range — target should bracket current tick
// with tickSpacing=200 multiples. At tick ~5354: [5200,5600] is a reasonable wide band.
const TICK_LOWER = 5200;
const TICK_UPPER = 5600;
const SWAP_PCT   = 26n;  // % of total DIEM to swap for WETH (value-weighted for new range)
const SLIPPAGE   = 3n;   // % slippage tolerance

const MAX_UINT128 = (2n ** 128n) - 1n;

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
  // claim(address feeOwner, address token) — both args required
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

// SwapRouter02 exactInputSingle — no deadline field (removed vs SwapRouter v1)
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

function deadline(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + 600);
}

function mkClient(rpcUrl: string) {
  return createPublicClient({ chain: base, transport: http(rpcUrl) });
}
type AppClient = ReturnType<typeof mkClient>;

async function readBalance(client: AppClient, token: Address, who: Address): Promise<bigint> {
  return client.readContract({ address: token, abi: ERC20_ABI, functionName: 'balanceOf', args: [who] });
}

// Parse new tokenId from NFPM Transfer event (ERC-721 mint from address(0))
function parseTokenId(logs: readonly { topics: readonly string[] }[]): bigint | null {
  const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  const ZERO_PADDED    = '0x0000000000000000000000000000000000000000000000000000000000000000';
  for (const log of logs) {
    if (
      log.topics[0]?.toLowerCase() === TRANSFER_TOPIC &&
      log.topics[1]?.toLowerCase() === ZERO_PADDED && // from=0 (mint)
      log.topics[3]
    ) {
      return BigInt(log.topics[3]);
    }
  }
  return null;
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const rpcUrl = process.env['RPC_URL'] ?? 'https://mainnet.base.org';

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

  console.log(`\nAgent:    ${agentAddress}`);
  console.log(`Dry-run:  ${dryRun}`);
  console.log(`Target:   [${TICK_LOWER}, ${TICK_UPPER}] (in-range, earning fees immediately)\n`);

  // ── Read current state ─────────────────────────────────────────────

  const [slot0, claimable, diemInit, wethInit] = await Promise.all([
    client.readContract({ address: ADDRESSES.ETH_DIEM_V3, abi: SLOT0_ABI, functionName: 'slot0' }),
    client.readContract({ address: ADDRESSES.FEE_LOCKER, abi: FEE_LOCKER_ABI, functionName: 'availableFees', args: [agentAddress, ADDRESSES.DIEM] }),
    readBalance(client, ADDRESSES.DIEM, agentAddress),
    readBalance(client, ADDRESSES.WETH, agentAddress),
  ]);

  const currentTick = slot0[1];
  const sqrtPriceX96 = slot0[0];
  const diemPerWeth = Number(sqrtPriceX96 ** 2n * (10n ** 18n) / (2n ** 192n)) / 1e18;

  console.log(`Pool tick:        ${currentTick}`);
  console.log(`DIEM/WETH price:  ${diemPerWeth.toFixed(6)}`);
  console.log(`FeeLocker:        ${formatUnits(claimable, 18)} DIEM claimable`);
  console.log(`Wallet DIEM:      ${formatUnits(diemInit, 18)}`);
  console.log(`Wallet WETH:      ${formatUnits(wethInit, 18)}\n`);

  if (currentTick <= TICK_LOWER || currentTick >= TICK_UPPER) {
    console.warn(`⚠  currentTick ${currentTick} is NOT in [${TICK_LOWER}, ${TICK_UPPER}] — mint would be single-sided`);
    console.warn(`   The reposition only makes sense when currentTick is in range. Aborting.`);
    process.exit(1);
  }

  if (dryRun) {
    const totalDiem = diemInit + claimable + (LIQUIDITY > 0n ? 2000000000000000000n : 0n); // rough estimate
    const swapAmt   = totalDiem * SWAP_PCT / 100n;
    console.log(`[dry-run] Would remove position ${TOKEN_ID}, claim ${formatUnits(claimable, 18)} DIEM`);
    console.log(`[dry-run] Would swap ~${formatUnits(swapAmt, 18)} DIEM → WETH`);
    console.log(`[dry-run] Would mint [${TICK_LOWER}, ${TICK_UPPER}] with remaining DIEM + WETH`);
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

  // ── 1. Close position 5119885 ──────────────────────────────────────

  console.log('Step 1: decreaseLiquidity + collect on position', TOKEN_ID.toString());

  await send('decreaseLiquidity', ADDRESSES.NFPM_V3, encodeFunctionData({
    abi: NFPM_DECREASE_ABI, functionName: 'decreaseLiquidity',
    args: [{ tokenId: TOKEN_ID, liquidity: LIQUIDITY, amount0Min: 0n, amount1Min: 0n, deadline: deadline() }],
  }));

  await send('collect', ADDRESSES.NFPM_V3, encodeFunctionData({
    abi: NFPM_COLLECT_ABI, functionName: 'collect',
    args: [{ tokenId: TOKEN_ID, recipient: agentAddress, amount0Max: MAX_UINT128, amount1Max: MAX_UINT128 }],
  }));

  // ── 2. Claim FeeLocker ─────────────────────────────────────────────

  if (claimable > 0n) {
    console.log(`\nStep 2: claim ${formatUnits(claimable, 18)} DIEM from FeeLocker`);
    await send('claim', ADDRESSES.FEE_LOCKER, encodeFunctionData({
      abi: FEE_LOCKER_ABI, functionName: 'claim',
      args: [agentAddress, ADDRESSES.DIEM],
    }));
  } else {
    console.log('\nStep 2: FeeLocker empty, skipping claim');
  }

  // ── 3. Read total DIEM, compute swap ──────────────────────────────

  const totalDiem = await readBalance(client, ADDRESSES.DIEM, agentAddress);
  const swapAmount = totalDiem * SWAP_PCT / 100n;
  const expectedWeth = BigInt(Math.floor(Number(swapAmount) / diemPerWeth));
  const amountOutMin = expectedWeth * (100n - SLIPPAGE) / 100n;

  console.log(`\nStep 3: total DIEM = ${formatUnits(totalDiem, 18)}`);
  console.log(`        swap ${SWAP_PCT}% = ${formatUnits(swapAmount, 18)} DIEM`);
  console.log(`        expected WETH out ≥ ${formatUnits(amountOutMin, 18)} (${SLIPPAGE}% slippage)`);

  // Approve DIEM to SwapRouter02
  await send('approve-diem-router', ADDRESSES.DIEM, encodeFunctionData({
    abi: ERC20_ABI, functionName: 'approve',
    args: [ADDRESSES.SWAP_ROUTER_V3, swapAmount],
  }));

  // Swap DIEM → WETH
  await send('exactInputSingle', ADDRESSES.SWAP_ROUTER_V3, encodeFunctionData({
    abi: SWAP_ROUTER_ABI, functionName: 'exactInputSingle',
    args: [{
      tokenIn:           ADDRESSES.DIEM,
      tokenOut:          ADDRESSES.WETH,
      fee:               ETH_DIEM_V3.FEE,
      recipient:         agentAddress,
      amountIn:          swapAmount,
      amountOutMinimum:  amountOutMin,
      sqrtPriceLimitX96: 0n,
    }],
  }));

  // ── 4. Mint in-range position [5400, 5600] ─────────────────────────

  const [diemForMint, wethForMint] = await Promise.all([
    readBalance(client, ADDRESSES.DIEM, agentAddress),
    readBalance(client, ADDRESSES.WETH, agentAddress),
  ]);

  console.log(`\nStep 4: mint [${TICK_LOWER}, ${TICK_UPPER}]`);
  console.log(`        WETH: ${formatUnits(wethForMint, 18)}`);
  console.log(`        DIEM: ${formatUnits(diemForMint, 18)}`);

  // Approve both tokens to NFPM
  await send('approve-diem-nfpm', ADDRESSES.DIEM, encodeFunctionData({
    abi: ERC20_ABI, functionName: 'approve',
    args: [ADDRESSES.NFPM_V3, diemForMint],
  }));

  await send('approve-weth-nfpm', ADDRESSES.WETH, encodeFunctionData({
    abi: ERC20_ABI, functionName: 'approve',
    args: [ADDRESSES.NFPM_V3, wethForMint],
  }));

  // Mint
  const mintReceipt = await send('mint', ADDRESSES.NFPM_V3, encodeFunctionData({
    abi: NFPM_MINT_ABI, functionName: 'mint',
    args: [{
      token0:         ADDRESSES.WETH,
      token1:         ADDRESSES.DIEM,
      fee:            ETH_DIEM_V3.FEE,
      tickLower:      TICK_LOWER,
      tickUpper:      TICK_UPPER,
      amount0Desired: wethForMint,
      amount1Desired: diemForMint,
      amount0Min:     wethForMint * (100n - SLIPPAGE) / 100n,
      amount1Min:     diemForMint * (100n - SLIPPAGE) / 100n,
      recipient:      agentAddress,
      deadline:       deadline(),
    }],
  }));

  const newTokenId = parseTokenId(mintReceipt.logs);
  console.log(`\n✓ Repositioned. New tokenId: ${newTokenId?.toString() ?? 'parse-failed — check receipt'}`);

  // ── 5. Record in memory ────────────────────────────────────────────

  if (newTokenId !== null) {
    mkdirSync('memory', { recursive: true });
    const entry = JSON.stringify({
      tokenId:         newTokenId.toString(),
      pool:            'ETH/DIEM v3 1%',
      poolAddress:     ADDRESSES.ETH_DIEM_V3,
      mintedAt:        new Date().toISOString(),
      tickLower:       TICK_LOWER,
      tickUpper:       TICK_UPPER,
      currentTickAtMint: currentTick,
      wethDeposited:   wethForMint.toString(),
      diemDeposited:   diemForMint.toString(),
      nfpm:            ADDRESSES.NFPM_V3,
      replacedTokenId: TOKEN_ID.toString(),
    });
    appendFileSync('memory/lp-positions.jsonl', entry + '\n');
    console.log(`\nSaved to memory/lp-positions.jsonl`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
