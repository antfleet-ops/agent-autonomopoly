import { createPublicClient, http, formatUnits } from '../node_modules/viem/_esm/index.js';
import { base } from '../node_modules/viem/_esm/chains/index.js';

const AGENT = '0x8767Df39eCeeaeB11554642237aC4E08660aB6A3';
const WETH = '0x4200000000000000000000000000000000000006';
const DIEM = '0xF4d97F2da56e8c3098f3a8D538DB630A2606a024';
const FEE_LOCKER = '0xF7d3BE3FC0de76fA5550C29A8F6fa53667B876FF';
const NFPM_V3 = '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1';
const ETH_DIEM_V3 = '0x80d995189ecc593672aD4703b250a5e82672EB1D';
const VVV_STAKING = '0x321b7ff75154472B18EDb199033fF4D116F340Ff';

const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
];
const FEE_LOCKER_ABI = [{
  name: 'availableFees', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'feeOwner', type: 'address' }, { name: 'token', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }],
}];
const NFPM_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'tokenOfOwnerByIndex', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'index', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }] },
  { name: 'positions', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'nonce', type: 'uint96' }, { name: 'operator', type: 'address' },
      { name: 'token0', type: 'address' }, { name: 'token1', type: 'address' },
      { name: 'fee', type: 'uint24' }, { name: 'tickLower', type: 'int24' },
      { name: 'tickUpper', type: 'int24' }, { name: 'liquidity', type: 'uint128' },
      { name: 'feeGrowthInside0LastX128', type: 'uint256' },
      { name: 'feeGrowthInside1LastX128', type: 'uint256' },
      { name: 'tokensOwed0', type: 'uint128' }, { name: 'tokensOwed1', type: 'uint128' },
    ]},
];
const POOL_ABI = [{
  name: 'slot0', type: 'function', stateMutability: 'view', inputs: [],
  outputs: [
    { name: 'sqrtPriceX96', type: 'uint160' }, { name: 'tick', type: 'int24' },
    { name: 'observationIndex', type: 'uint16' }, { name: 'observationCardinality', type: 'uint16' },
    { name: 'observationCardinalityNext', type: 'uint16' },
    { name: 'feeProtocol', type: 'uint8' }, { name: 'unlocked', type: 'bool' },
  ],
}];

const client = createPublicClient({ chain: base, transport: http('https://base-rpc.publicnode.com') });

const [ethWei, wethBal, diemBal, svvvBal, claimable, nfpmBal, slot0] = await Promise.all([
  client.getBalance({ address: AGENT }),
  client.readContract({ address: WETH, abi: ERC20_ABI, functionName: 'balanceOf', args: [AGENT] }),
  client.readContract({ address: DIEM, abi: ERC20_ABI, functionName: 'balanceOf', args: [AGENT] }),
  client.readContract({ address: VVV_STAKING, abi: ERC20_ABI, functionName: 'balanceOf', args: [AGENT] }),
  client.readContract({ address: FEE_LOCKER, abi: FEE_LOCKER_ABI, functionName: 'availableFees', args: [AGENT, DIEM] }),
  client.readContract({ address: NFPM_V3, abi: NFPM_ABI, functionName: 'balanceOf', args: [AGENT] }),
  client.readContract({ address: ETH_DIEM_V3, abi: POOL_ABI, functionName: 'slot0' }),
]);

const currentTick = slot0[1];
const eth  = Number(formatUnits(ethWei, 18));
const weth = Number(formatUnits(wethBal, 18));
const diem = Number(formatUnits(diemBal, 18));
const svvv = Number(formatUnits(svvvBal, 18));
const feeClaimable = Number(formatUnits(claimable, 18));

console.log('=== PORTFOLIO CHECK 2026-05-26 ===');
console.log('ETH:       ' + eth.toFixed(6));
console.log('WETH:      ' + weth.toFixed(6));
console.log('DIEM:      ' + diem.toFixed(4));
console.log('sVVV:      ' + svvv.toFixed(4));
console.log('FeeLocker: ' + feeClaimable.toFixed(4) + ' DIEM claimable');
console.log('NFPM positions: ' + nfpmBal);
console.log('Pool tick: ' + currentTick);
console.log('');

const outOfRange = [];
for (let i = 0n; i < nfpmBal; i++) {
  const tokenId = await client.readContract({
    address: NFPM_V3, abi: NFPM_ABI,
    functionName: 'tokenOfOwnerByIndex', args: [AGENT, i],
  });
  const pos = await client.readContract({
    address: NFPM_V3, abi: NFPM_ABI,
    functionName: 'positions', args: [tokenId],
  });
  const [, , token0, token1, fee, tickLower, tickUpper, liquidity, , , tokensOwed0, tokensOwed1] = pos;
  const inRange = currentTick > tickLower && currentTick < tickUpper;
  const burned = liquidity === 0n;
  const status = burned ? 'BURNED' : inRange ? 'IN_RANGE' : 'OUT_OF_RANGE';
  console.log('tokenId: ' + tokenId);
  console.log('  range: [' + tickLower + ', ' + tickUpper + ']  tick: ' + currentTick + '  -> ' + status);
  console.log('  liquidity: ' + liquidity);
  console.log('  owed0: ' + formatUnits(tokensOwed0, 18) + ' WETH');
  console.log('  owed1: ' + formatUnits(tokensOwed1, 18) + ' DIEM');
  if (!burned && !inRange) outOfRange.push(tokenId.toString());
}

console.log('');
console.log('OUT_OF_RANGE tokenIds: ' + (outOfRange.length === 0 ? 'none' : outOfRange.join(', ')));
console.log('ETH_OK: ' + (eth > 0.003 ? 'YES' : 'NO - LOW GAS'));
