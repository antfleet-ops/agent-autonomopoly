// Temporary recovery script: collect tokensOwed for tokenId 5218841
// decreaseLiquidity succeeded but collect reverted; this retries the collect.
import { createPublicClient, encodeFunctionData, http, formatUnits, type Address, type Hex } from 'viem';
import { base } from 'viem/chains';
import { ADDRESSES } from '../platform/constants.js';
import {
  loadPrivyConfig, makeTxSenderFromPrivy,
  loadSignerFromEnv, makeTxSenderFromEnv,
} from '../harness/safety/wallet.js';

const MAX_UINT128 = (2n ** 128n) - 1n;
const rpcUrl = process.env.RPC_URL ?? 'https://mainnet.base.org';
const client = createPublicClient({ chain: base, transport: http(rpcUrl) });

const NFPM_POSITIONS_ABI = [{
  name: 'positions', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'tokenId', type: 'uint256' }],
  outputs: [
    { name: 'nonce', type: 'uint96' }, { name: 'operator', type: 'address' },
    { name: 'token0', type: 'address' }, { name: 'token1', type: 'address' },
    { name: 'fee', type: 'uint24' }, { name: 'tickLower', type: 'int24' },
    { name: 'tickUpper', type: 'int24' }, { name: 'liquidity', type: 'uint128' },
    { name: 'feeGrowthInside0LastX128', type: 'uint256' }, { name: 'feeGrowthInside1LastX128', type: 'uint256' },
    { name: 'tokensOwed0', type: 'uint128' }, { name: 'tokensOwed1', type: 'uint128' },
  ],
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

const TOKEN_ID = 5218841n;
const privyCfg = loadPrivyConfig();

let agentAddress: Address;
let txSender: (p: { to: Address; data: Hex }) => Promise<Hex>;

if (privyCfg) {
  const { loadSignerFromPrivy } = await import('../harness/safety/wallet.js');
  const signer = await loadSignerFromPrivy(privyCfg);
  agentAddress = signer.address;
  txSender = makeTxSenderFromPrivy(privyCfg);
} else {
  const signer = loadSignerFromEnv();
  agentAddress = signer.address;
  txSender = makeTxSenderFromEnv(rpcUrl);
}

// Read current owed state
const pos = await client.readContract({
  address: ADDRESSES.NFPM_V3, abi: NFPM_POSITIONS_ABI, functionName: 'positions', args: [TOKEN_ID],
});
const [,,,,,,,,,, tokensOwed0, tokensOwed1] = pos;
console.log(`Agent: ${agentAddress}`);
console.log(`tokenId ${TOKEN_ID}: owed0=${formatUnits(tokensOwed0, 18)} WETH  owed1=${formatUnits(tokensOwed1, 18)} DIEM`);

if (tokensOwed0 === 0n && tokensOwed1 === 0n) {
  console.log('Nothing owed — already collected or nothing to recover.');
  process.exit(0);
}

// Simulate collect first
console.log('\nSimulating collect...');
try {
  const simResult = await client.simulateContract({
    address: ADDRESSES.NFPM_V3,
    abi: NFPM_COLLECT_ABI,
    functionName: 'collect',
    args: [{ tokenId: TOKEN_ID, recipient: agentAddress, amount0Max: MAX_UINT128, amount1Max: MAX_UINT128 }],
    account: agentAddress,
  });
  console.log(`Simulate ok: amount0=${formatUnits(simResult.result[0], 18)} amount1=${formatUnits(simResult.result[1], 18)}`);
} catch (e) {
  console.error('Simulate failed:', e);
  process.exit(1);
}

// Send collect
console.log('\nSending collect...');
const hash = await txSender({
  to: ADDRESSES.NFPM_V3,
  data: encodeFunctionData({
    abi: NFPM_COLLECT_ABI,
    functionName: 'collect',
    args: [{ tokenId: TOKEN_ID, recipient: agentAddress, amount0Max: MAX_UINT128, amount1Max: MAX_UINT128 }],
  }),
});
console.log(`hash: ${hash}`);
const receipt = await client.waitForTransactionReceipt({ hash });
if (receipt.status === 'reverted') {
  console.error(`collect reverted: ${hash}`);
  process.exit(1);
}
console.log(`collect confirmed (block ${receipt.blockNumber})`);
console.log('Tokens collected to wallet. Now run: node --import tsx scripts/reposition.ts --token-id 5218841 --mint-only');
