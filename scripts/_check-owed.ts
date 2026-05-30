// Temporary: check tokensOwed for tokenId 5218841 after partial reposition
import { createPublicClient, http, formatUnits } from 'viem';
import { base } from 'viem/chains';
import { ADDRESSES } from '../platform/constants.js';

const client = createPublicClient({ chain: base, transport: http(process.env.RPC_URL) });

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

const pos = await client.readContract({
  address: ADDRESSES.NFPM_V3,
  abi: NFPM_POSITIONS_ABI,
  functionName: 'positions',
  args: [5218841n],
});
const [,,,,,tickLower, tickUpper, liquidity,,,tokensOwed0, tokensOwed1] = pos;
console.log('tokenId 5218841:');
console.log(`  liquidity   : ${liquidity}`);
console.log(`  tokensOwed0 : ${formatUnits(tokensOwed0, 18)} WETH`);
console.log(`  tokensOwed1 : ${formatUnits(tokensOwed1, 18)} DIEM`);
console.log(`  range       : [${tickLower}, ${tickUpper}]`);
