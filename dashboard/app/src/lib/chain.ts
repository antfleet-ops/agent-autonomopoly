import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

export function makePublicClient() {
  return createPublicClient({ chain: base, transport: http() });
}
