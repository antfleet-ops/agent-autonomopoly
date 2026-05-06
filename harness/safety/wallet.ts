// Agent wallet substrate.
//
// v0:  loads the keypair from process.env.AGENT_PRIVATE_KEY (.env file).
// v1:  the same Signer interface will be backed by a TEE attestation
//      (Phala / Marlin Oyster / AWS Nitro). Callers don't change.
//
// Design constraints (per ARCHITECTURE_v2.md §2.1 and MOG-450):
//   - No key material crosses the module boundary. The returned Signer
//     exposes only `address` and the sign methods. The private key bytes
//     are held inside viem's account closure; we never put them on the
//     returned object.
//   - No logging of key material. Errors thrown for missing/malformed env
//     do not include the bad value.
//   - The Signer shape is a structural subset of viem's LocalAccount so
//     a future loadSignerFromTEE() can satisfy the same interface.

import { privateKeyToAccount } from 'viem/accounts';
import type { Hex, LocalAccount } from 'viem';

export type Signer = Pick<LocalAccount, 'address' | 'signMessage' | 'signTypedData'>;

const AGENT_PRIVATE_KEY = 'AGENT_PRIVATE_KEY';

export function loadSignerFromEnv(): Signer {
  const raw = process.env[AGENT_PRIVATE_KEY];
  if (raw === undefined || raw === '') {
    throw new Error(`${AGENT_PRIVATE_KEY} is required`);
  }
  const normalized = raw.startsWith('0x') ? raw : `0x${raw}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    // Note: error message MUST NOT include `raw` or `normalized`.
    throw new Error(`${AGENT_PRIVATE_KEY} is malformed (expected 64-char hex, with or without 0x prefix)`);
  }
  const account = privateKeyToAccount(normalized as Hex);
  // Return a fresh object that exposes only address + sign methods. The
  // private key never appears as a property on the Signer; it's captured
  // inside viem's `account.signMessage` / `account.signTypedData` closures.
  return {
    address: account.address,
    signMessage: account.signMessage.bind(account),
    signTypedData: account.signTypedData.bind(account),
  };
}
