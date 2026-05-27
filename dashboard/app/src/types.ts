export interface PresaleEntry {
  vaultAddress: string;
  deployedAt: string;
  agentWallet?: string;
  contract?: string;
}

export interface VaultState {
  address: `0x${string}`;
  depositToken: `0x${string}`;
  depositTokenSymbol: 'VVV' | 'DIEM';
  lockDuration: bigint;
  totalDeposited: bigint;
  totalTokenSupply: bigint;
  depositDeadline: bigint;
  lockExpiry: bigint;
  initialized: boolean;
  agentWallet: `0x${string}`;
  token: `0x${string}`;
  myDeposited?: bigint;
  myClaimed?: boolean;
  myWithdrawn?: boolean;
  myShare?: bigint;
  myBalance?: bigint;
  myAllowance?: bigint;
}
