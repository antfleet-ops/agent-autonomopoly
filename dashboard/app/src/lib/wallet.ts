import { createPublicClient, createWalletClient, custom, http, type WalletClient } from 'viem';
import { base } from 'viem/chains';
import type { ConnectedWallet } from '@privy-io/react-auth';

export async function makeWalletClient(wallet: ConnectedWallet): Promise<WalletClient> {
  const provider = await wallet.getEthereumProvider();
  return createWalletClient({
    account: wallet.address as `0x${string}`,
    chain: base,
    transport: custom(provider as Parameters<typeof custom>[0]),
  });
}

export function makePublicClientForReceipt() {
  return createPublicClient({ chain: base, transport: http() });
}

export async function sendAndWait(
  wallet: ConnectedWallet,
  to: `0x${string}`,
  data: `0x${string}`,
  onStatus: (msg: string) => void,
): Promise<`0x${string}`> {
  const wc = await makeWalletClient(wallet);
  const hash = await wc.sendTransaction({
    account: wallet.address as `0x${string}`,
    to,
    data,
    chain: base,
  });
  onStatus(`tx: ${hash.slice(0, 14)}… confirming`);
  const client = makePublicClientForReceipt();
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('Transaction reverted');
  return hash;
}
