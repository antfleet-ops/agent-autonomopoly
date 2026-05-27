// Collect tokensOwed from a zero-liquidity NFPM position (after decreaseLiquidity).
// Usage: node --env-file=.env --import tsx scripts/collect-position.ts --token-id 5196500
import { createPublicClient, encodeFunctionData, formatUnits, http, type Address, type Hex } from 'viem';
import { base } from 'viem/chains';
import {
  loadPrivyConfig, makeTxSenderFromPrivy,
  loadSignerFromEnv, makeTxSenderFromEnv,
  type TxSender,
} from '../harness/safety/wallet.js';
import { ADDRESSES } from '../platform/constants.js';

const MAX_UINT128 = (2n ** 128n) - 1n;

const POSITIONS_ABI = [{
  name: 'positions', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'tokenId', type: 'uint256' }],
  outputs: [
    { name: 'nonce', type: 'uint96' }, { name: 'operator', type: 'address' },
    { name: 'token0', type: 'address' }, { name: 'token1', type: 'address' },
    { name: 'fee', type: 'uint24' }, { name: 'tickLower', type: 'int24' },
    { name: 'tickUpper', type: 'int24' }, { name: 'liquidity', type: 'uint128' },
    { name: 'fgi0', type: 'uint256' }, { name: 'fgi1', type: 'uint256' },
    { name: 'tokensOwed0', type: 'uint128' }, { name: 'tokensOwed1', type: 'uint128' },
  ],
}] as const;

const COLLECT_ABI = [{
  name: 'collect', type: 'function', stateMutability: 'payable',
  inputs: [{ name: 'params', type: 'tuple', components: [
    { name: 'tokenId', type: 'uint256' },
    { name: 'recipient', type: 'address' },
    { name: 'amount0Max', type: 'uint128' },
    { name: 'amount1Max', type: 'uint128' },
  ]}],
  outputs: [{ name: 'amount0', type: 'uint256' }, { name: 'amount1', type: 'uint256' }],
}] as const;

async function main() {
  const argv = process.argv.slice(2);
  const tidIdx = argv.indexOf('--token-id');
  if (tidIdx === -1 || !argv[tidIdx + 1]) {
    console.error('Usage: collect-position.ts --token-id <id>');
    process.exit(1);
  }
  const tokenId = BigInt(argv[tidIdx + 1]!);
  const rpcUrl = process.env['RPC_URL'] ?? 'https://mainnet.base.org';
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

  const pos = await client.readContract({
    address: ADDRESSES.NFPM_V3, abi: POSITIONS_ABI, functionName: 'positions', args: [tokenId],
  });
  const [,,,,,,, liq,,,owed0, owed1] = pos;

  console.log(`Agent:       ${agentAddress}`);
  console.log(`TokenId:     ${tokenId}`);
  console.log(`Liquidity:   ${liq}`);
  console.log(`tokensOwed0: ${formatUnits(owed0, 18)} WETH`);
  console.log(`tokensOwed1: ${formatUnits(owed1, 18)} DIEM`);

  if (owed0 === 0n && owed1 === 0n) {
    console.log('Nothing to collect — both tokensOwed are 0.');
    process.exit(0);
  }

  const data = encodeFunctionData({
    abi: COLLECT_ABI,
    functionName: 'collect',
    args: [{ tokenId, recipient: agentAddress, amount0Max: MAX_UINT128, amount1Max: MAX_UINT128 }],
  });

  console.log('\n[collect] sending...');
  const hash = await txSender({ to: ADDRESSES.NFPM_V3, data: data as Hex });
  console.log(`[collect] hash: ${hash}`);
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status === 'reverted') {
    throw new Error(`[collect] tx reverted: ${hash}`);
  }
  console.log(`[collect] confirmed (block ${receipt.blockNumber})`);
  console.log(`Collected: ${formatUnits(owed0, 18)} WETH + ${formatUnits(owed1, 18)} DIEM`);
}

main().catch(err => { console.error(err); process.exit(1); });
