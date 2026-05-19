// One-shot recovery: mint LP position using current on-chain balances.
// Run after position has been closed and swap completed.
// Usage: node --import tsx scripts/mint-lp-recovery.ts [tickLower] [tickUpper]

import { createPublicClient, encodeFunctionData, http, formatUnits, type Address, type Hex } from 'viem';
import { base } from 'viem/chains';
import { appendFileSync, mkdirSync } from 'node:fs';
import {
  loadPrivyConfig, makeTxSenderFromPrivy,
  loadSignerFromEnv, makeTxSenderFromEnv,
  type TxSender,
} from '../harness/safety/wallet.js';
import { ADDRESSES, ETH_DIEM_V3 } from '../platform/constants.js';

const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
] as const;

const NFPM_MINT_ABI = [{
  name: 'mint', type: 'function', stateMutability: 'payable',
  inputs: [{ name: 'params', type: 'tuple', components: [
    { name: 'token0',          type: 'address' },
    { name: 'token1',          type: 'address' },
    { name: 'fee',             type: 'uint24'  },
    { name: 'tickLower',       type: 'int24'   },
    { name: 'tickUpper',       type: 'int24'   },
    { name: 'amount0Desired',  type: 'uint256' },
    { name: 'amount1Desired',  type: 'uint256' },
    { name: 'amount0Min',      type: 'uint256' },
    { name: 'amount1Min',      type: 'uint256' },
    { name: 'recipient',       type: 'address' },
    { name: 'deadline',        type: 'uint256' },
  ]}],
  outputs: [
    { name: 'tokenId',    type: 'uint256' },
    { name: 'liquidity',  type: 'uint128' },
    { name: 'amount0',    type: 'uint256' },
    { name: 'amount1',    type: 'uint256' },
  ],
}] as const;

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

function snapTick(tick: number, spacing: number): number {
  return Math.floor(tick / spacing) * spacing;
}

function tsDeadline(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + 600);
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

async function main() {
  const argv    = process.argv.slice(2);
  const rpcUrl  = process.env['RPC_URL'] ?? 'https://mainnet.base.org';
  const dryRun  = argv.includes('--dry-run');

  const client = createPublicClient({ chain: base, transport: http(rpcUrl) });

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

  // Read current state
  const slot0 = await client.readContract({ address: ADDRESSES.ETH_DIEM_V3, abi: SLOT0_ABI, functionName: 'slot0' });
  const currentTick = slot0[1];

  const [wethBal, diemBal] = await Promise.all([
    client.readContract({ address: ADDRESSES.WETH, abi: ERC20_ABI, functionName: 'balanceOf', args: [agentAddress] }),
    client.readContract({ address: ADDRESSES.DIEM, abi: ERC20_ABI, functionName: 'balanceOf', args: [agentAddress] }),
  ]);

  // Compute tick range (or use CLI args)
  let tickLower: number;
  let tickUpper: number;
  const tli = argv.indexOf('--tick-lower');
  const tui = argv.indexOf('--tick-upper');
  if (tli !== -1 && tui !== -1) {
    tickLower = Number(argv[tli + 1]);
    tickUpper = Number(argv[tui + 1]);
  } else {
    const base2 = snapTick(currentTick, ETH_DIEM_V3.TICK_SPACING);
    tickLower = base2 - ETH_DIEM_V3.TICK_SPACING;
    tickUpper = base2 + ETH_DIEM_V3.TICK_SPACING * 2;
  }

  console.log(`\nMint-LP-Recovery`);
  console.log(`Agent:       ${agentAddress}`);
  console.log(`CurrentTick: ${currentTick}`);
  console.log(`Range:       [${tickLower}, ${tickUpper}]`);
  console.log(`WETH:        ${formatUnits(wethBal, 18)}`);
  console.log(`DIEM:        ${formatUnits(diemBal, 18)}`);
  console.log(`Dry-run:     ${dryRun}\n`);

  if (tickLower >= tickUpper) throw new Error('Invalid tick range');
  if (tickLower % ETH_DIEM_V3.TICK_SPACING !== 0 || tickUpper % ETH_DIEM_V3.TICK_SPACING !== 0) {
    throw new Error(`Ticks must be multiples of ${ETH_DIEM_V3.TICK_SPACING}`);
  }
  if (currentTick <= tickLower || currentTick >= tickUpper) {
    console.warn(`WARNING: currentTick ${currentTick} is outside [${tickLower}, ${tickUpper}]`);
  }

  if (dryRun) {
    console.log(`[dry-run] Would approve WETH(${formatUnits(wethBal,18)}) + DIEM(${formatUnits(diemBal,18)}) to NFPM`);
    console.log(`[dry-run] Would mint [${tickLower}, ${tickUpper}] with full balances`);
    return;
  }

  const send = async (label: string, to: Address, data: Hex) => {
    console.log(`[${label}] sending...`);
    const hash = await txSender({ to, data });
    console.log(`[${label}] hash: ${hash}`);
    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status === 'reverted') throw new Error(`[${label}] tx reverted: ${hash}`);
    console.log(`[${label}] confirmed (block ${receipt.blockNumber})`);
    return receipt;
  };

  // Approve both tokens to NFPM
  await send('approve-weth-nfpm', ADDRESSES.WETH, encodeFunctionData({
    abi: ERC20_ABI, functionName: 'approve',
    args: [ADDRESSES.NFPM_V3, wethBal],
  }));
  await send('approve-diem-nfpm', ADDRESSES.DIEM, encodeFunctionData({
    abi: ERC20_ABI, functionName: 'approve',
    args: [ADDRESSES.NFPM_V3, diemBal],
  }));

  // Mint
  const mintReceipt = await send('mint', ADDRESSES.NFPM_V3, encodeFunctionData({
    abi: NFPM_MINT_ABI, functionName: 'mint',
    args: [{
      token0:         ADDRESSES.WETH,
      token1:         ADDRESSES.DIEM,
      fee:            ETH_DIEM_V3.FEE,
      tickLower,
      tickUpper,
      amount0Desired: wethBal,
      amount1Desired: diemBal,
      amount0Min:     0n,
      amount1Min:     0n,
      recipient:      agentAddress,
      deadline:       tsDeadline(),
    }],
  }));

  const newTokenId = parseTokenId(mintReceipt.logs);
  console.log(`\n✓ Minted new position. tokenId: ${newTokenId?.toString() ?? 'parse-failed'}`);

  if (newTokenId !== null) {
    mkdirSync('memory', { recursive: true });
    const entry = JSON.stringify({
      tokenId:           newTokenId.toString(),
      pool:              'ETH/DIEM v3 1%',
      poolAddress:       ADDRESSES.ETH_DIEM_V3,
      mintedAt:          new Date().toISOString(),
      tickLower,
      tickUpper,
      currentTickAtMint: currentTick,
      wethDeposited:     wethBal.toString(),
      diemDeposited:     diemBal.toString(),
      nfpm:              ADDRESSES.NFPM_V3,
      replacedTokenId:   '5138645',
      note:              'recovery-mint after failed reposition swap',
    });
    appendFileSync('memory/lp-positions.jsonl', entry + '\n');
    console.log(`Recorded in memory/lp-positions.jsonl`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
