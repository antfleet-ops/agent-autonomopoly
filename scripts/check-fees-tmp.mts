import { createPublicClient, http, formatUnits } from 'viem';
import { base } from 'viem/chains';

const AGENT = '0x8767Df39eCeeaeB11554642237aC4E08660aB6A3' as const;
const DIEM = '0xF4d97F2da56e8c3098f3a8D538DB630A2606a024' as const;
const FEE_LOCKER = '0xF7d3BE3FC0de76fA5550C29A8F6fa53667B876FF' as const;
const RPC = process.env.RPC_URL ?? 'https://mainnet.base.org';

const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
] as const;

const FEE_LOCKER_ABI = [{
  name: 'availableFees', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'feeOwner', type: 'address' }, { name: 'token', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }],
}] as const;

const client = createPublicClient({ chain: base, transport: http(RPC) });

const [diemBal, claimable, ethWei] = await Promise.all([
  client.readContract({ address: DIEM, abi: ERC20_ABI, functionName: 'balanceOf', args: [AGENT] }),
  client.readContract({ address: FEE_LOCKER, abi: FEE_LOCKER_ABI, functionName: 'availableFees', args: [AGENT, DIEM] }),
  client.getBalance({ address: AGENT }),
]);

console.log('agentWalletDiem:', formatUnits(diemBal, 18));
console.log('feeLockerBalance:', formatUnits(claimable, 18));
console.log('ethBalance:', formatUnits(ethWei, 18));
