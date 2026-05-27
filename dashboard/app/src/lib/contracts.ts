import { type Address } from 'viem';
import { makePublicClient } from './chain';
import type { VaultState } from '../types';

export const VVV_ADDRESS  = '0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf' as const;
export const DIEM_ADDRESS = '0xF4d97F2da56e8c3098f3a8D538DB630A2606a024' as const;

export const VAULT_READ_ABI = [
  { name: 'depositDeadline',        type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'lockExpiry',             type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'lockDuration',           type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalDeposited',         type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalTokenSupply',       type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'initialized',            type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { name: 'depositToken',           type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'agentWallet',            type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'token',                  type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'deposited',              type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'tokensClaimed',          type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'bool' }] },
  { name: 'depositTokenWithdrawn',  type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'bool' }] },
  { name: 'getShare',               type: 'function', stateMutability: 'view', inputs: [{ name: 'who', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const;

export const VAULT_WRITE_ABI = [
  { name: 'deposit',              type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'claimTokens',         type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'withdrawDepositToken',type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'finalizeVVV',         type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
] as const;

export const ERC20_ABI = [
  { name: 'approve',   type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view',       inputs: [{ name: 'owner',   type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view',       inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const;

export async function readVaultState(
  vaultAddress: Address,
  userAddress?: Address,
): Promise<VaultState> {
  const client = makePublicClient();

  const rc = <T>(fn: string, args?: unknown[]) =>
    client.readContract({
      address: vaultAddress,
      abi: VAULT_READ_ABI,
      functionName: fn as never,
      args: (args ?? []) as never,
    }) as Promise<T>;

  const erc = <T>(fn: string, tokenAddr: Address, args: unknown[]) =>
    client.readContract({
      address: tokenAddr,
      abi: ERC20_ABI,
      functionName: fn as never,
      args: args as never,
    }) as Promise<T>;

  const [depositToken, lockDuration, totalDeposited, totalTokenSupply,
         depositDeadline, lockExpiry, initialized, agentWallet, token] =
    await Promise.all([
      rc<Address>('depositToken'),
      rc<bigint>('lockDuration'),
      rc<bigint>('totalDeposited'),
      rc<bigint>('totalTokenSupply'),
      rc<bigint>('depositDeadline'),
      rc<bigint>('lockExpiry'),
      rc<boolean>('initialized'),
      rc<Address>('agentWallet'),
      rc<Address>('token').catch(() => '0x0000000000000000000000000000000000000000' as Address),
    ]);

  const isVvv = depositToken.toLowerCase() === VVV_ADDRESS.toLowerCase();

  let myDeposited: bigint | undefined;
  let myClaimed:   boolean | undefined;
  let myWithdrawn: boolean | undefined;
  let myShare:     bigint | undefined;
  let myBalance:   bigint | undefined;
  let myAllowance: bigint | undefined;

  if (userAddress) {
    [myDeposited, myClaimed, myWithdrawn, myShare, myBalance, myAllowance] = await Promise.all([
      rc<bigint>('deposited',             [userAddress]),
      rc<boolean>('tokensClaimed',        [userAddress]),
      rc<boolean>('depositTokenWithdrawn',[userAddress]),
      rc<bigint>('getShare',              [userAddress]),
      erc<bigint>('balanceOf', depositToken, [userAddress]),
      erc<bigint>('allowance', depositToken, [userAddress, vaultAddress]),
    ]);
  }

  return {
    address: vaultAddress,
    depositToken,
    depositTokenSymbol: isVvv ? 'VVV' : 'DIEM',
    lockDuration,
    totalDeposited,
    totalTokenSupply,
    depositDeadline,
    lockExpiry,
    initialized,
    agentWallet,
    token: token as Address,
    myDeposited,
    myClaimed,
    myWithdrawn,
    myShare,
    myBalance,
    myAllowance,
  };
}
