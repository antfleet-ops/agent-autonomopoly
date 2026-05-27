// One-shot: simulate collect for tokenId 5196500 and print the revert reason.
// Usage: node --env-file=.env.lp-monitor --import tsx scripts/collect-debug.ts
import { createPublicClient, encodeFunctionData, http, decodeFunctionData, decodeErrorResult, type Address, type Hex } from 'viem';
import { base } from 'viem/chains';
import { ADDRESSES } from '../platform/constants.js';

const MAX_UINT128 = (2n ** 128n) - 1n;
const TOKEN_ID = 5196500n;
const AGENT = '0x8767Df39eCeeaeB11554642237aC4E08660aB6A3' as Address;

const COLLECT_ABI = [{
  name: 'collect', type: 'function', stateMutability: 'payable',
  inputs: [{ name: 'params', type: 'tuple', components: [
    { name: 'tokenId',    type: 'uint256' },
    { name: 'recipient',  type: 'address' },
    { name: 'amount0Max', type: 'uint128' },
    { name: 'amount1Max', type: 'uint128' },
  ]}],
  outputs: [{ name: 'amount0', type: 'uint256' }, { name: 'amount1', type: 'uint256' }],
}] as const;

const rpcUrl = process.env['RPC_URL'] ?? 'https://mainnet.base.org';
const client = createPublicClient({ chain: base, transport: http(rpcUrl) });

async function main() {
  console.log('Simulating collect for tokenId', TOKEN_ID);

  // First, check current tokensOwed
  const POSITIONS_ABI = [{
    name: 'positions', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'nonce', type: 'uint96' },
      { name: 'operator', type: 'address' },
      { name: 'token0', type: 'address' },
      { name: 'token1', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'tickLower', type: 'int24' },
      { name: 'tickUpper', type: 'int24' },
      { name: 'liquidity', type: 'uint128' },
      { name: 'feeGrowthInside0LastX128', type: 'uint256' },
      { name: 'feeGrowthInside1LastX128', type: 'uint256' },
      { name: 'tokensOwed0', type: 'uint128' },
      { name: 'tokensOwed1', type: 'uint128' },
    ],
  }] as const;

  const pos = await client.readContract({
    address: ADDRESSES.NFPM_V3, abi: POSITIONS_ABI, functionName: 'positions', args: [TOKEN_ID],
  });
  const [,, t0, t1,, tickLow, tickHigh, liq,,,owed0, owed1] = pos;
  console.log(`Position: token0=${t0} token1=${t1}`);
  console.log(`Range: [${tickLow}, ${tickHigh}] liquidity=${liq}`);
  console.log(`tokensOwed0=${owed0} (${Number(owed0) / 1e18} WETH)`);
  console.log(`tokensOwed1=${owed1} (${Number(owed1) / 1e18} DIEM)`);

  // Simulate collect via eth_call
  const callData = encodeFunctionData({
    abi: COLLECT_ABI,
    functionName: 'collect',
    args: [{ tokenId: TOKEN_ID, recipient: AGENT, amount0Max: MAX_UINT128, amount1Max: MAX_UINT128 }],
  });

  try {
    const result = await client.call({
      to: ADDRESSES.NFPM_V3,
      data: callData,
      account: AGENT,
    });
    console.log('\nSimulation SUCCESS — would return:', result.data);
  } catch (err: unknown) {
    console.log('\nSimulation REVERTED');
    if (err && typeof err === 'object') {
      const e = err as Record<string, unknown>;
      if (e['shortMessage']) console.log('Short message:', e['shortMessage']);
      if (e['message']) console.log('Message:', String(e['message']).slice(0, 500));
      if (e['cause']) console.log('Cause:', String(e['cause']).slice(0, 500));
      if (e['data']) console.log('Revert data:', e['data']);
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
