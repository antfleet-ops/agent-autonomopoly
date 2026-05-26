/**
 * platform/venice-auth.ts
 *
 * Retrieves the agent's Venice API key by signing a challenge with the agent wallet.
 * The key is derived from the wallet's on-chain staking position — no manual provisioning.
 *
 * Security model (v0):
 *   - Key lives in process memory only; never logged or written to disk.
 *   - VENICE_API_KEY env var is checked first so Modal secrets work without re-signing.
 *   - On Modal (ephemeral containers), sign on every tick — 2 HTTP calls + 1 Privy sign.
 *   - Post-MVP: TEE sealed storage replaces this; same interface, no call-site changes.
 *
 * Flow:
 *   1. GET /api_keys/generate_web3_key  →  short-lived challenge JWT
 *   2. Sign the JWT with the agent wallet (Privy personal_sign)
 *   3. POST /api_keys/generate_web3_key  →  Venice API key (in memory only)
 */

import type { Signer } from '../harness/safety/wallet.js';

const VENICE_API = 'https://api.venice.ai/api/v1';

// ── Bootstrap ─────────────────────────────────────────────────────────────

async function bootstrapKey(signer: Signer): Promise<string> {
  // Step 1: get challenge token (expires in ~15 min)
  const challengeRes = await fetch(`${VENICE_API}/api_keys/generate_web3_key`);
  if (!challengeRes.ok) throw new Error(`Venice challenge failed: ${challengeRes.status}`);
  const { data } = await challengeRes.json() as { data: { token: string }; success: boolean };
  const token = data.token;

  // Step 2: sign the challenge JWT with the agent wallet — proves staking ownership
  const signature = await signer.signMessage({ message: token });

  // Step 3: exchange for API key (never logged)
  const keyRes = await fetch(`${VENICE_API}/api_keys/generate_web3_key`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      apiKeyType: 'INFERENCE',
      address:    signer.address,
      signature,
      token,
    }),
  });
  if (!keyRes.ok) {
    const body = await keyRes.text();
    throw new Error(`Venice key generation failed: ${keyRes.status} — ${body}`);
  }
  const result = await keyRes.json() as { data?: { key?: string; apiKey?: string }; success: boolean };
  const key = result.data?.key ?? result.data?.apiKey;
  if (!key) throw new Error(`Venice key generation returned no key: ${JSON.stringify(result)}`);

  return key;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Returns the agent's Venice API key. Resolution order:
 *
 *  1. VENICE_API_KEY env var — set as a Modal secret at launch time (zero signing overhead)
 *  2. Wallet signature bootstrap — signs on every tick when no env var is set;
 *     the key lives in memory only and is never persisted
 *
 * Pass `forceRefresh = true` to skip the env var check and re-sign (e.g. after a 401).
 */
export async function getVeniceApiKey(signer: Signer, forceRefresh = false): Promise<string> {
  if (!forceRefresh) {
    const envKey = process.env['VENICE_API_KEY'];
    if (envKey) return envKey;
  }

  return bootstrapKey(signer);
}

/**
 * Wrapper: run a Venice-dependent operation, retry once with a fresh key on 401.
 * Use this instead of getVeniceApiKey directly so key refresh is automatic.
 */
export async function withVeniceKey<T>(
  signer: Signer,
  fn: (apiKey: string) => Promise<T>,
): Promise<T> {
  const key = await getVeniceApiKey(signer);
  try {
    return await fn(key);
  } catch (err) {
    const msg = String(err);
    if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('Invalid API key')) {
      console.warn('[venice-auth] 401 received — re-signing for fresh key...');
      const fresh = await getVeniceApiKey(signer, true);
      return fn(fresh);
    }
    throw err;
  }
}
