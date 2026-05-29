/**
 * scripts/refresh-venice-key.ts
 *
 * Tests whether the current VENICE_API_KEY is still valid.
 * If the key returns 401 (expired or revoked), mints a fresh key via
 * Privy wallet signing and updates the GitHub Actions secret so every
 * future run picks it up automatically.
 *
 * Usage (from GitHub Actions or locally):
 *   node --import tsx scripts/refresh-venice-key.ts
 *
 * Required env vars:
 *   PRIVY_APP_ID, PRIVY_APP_SECRET, PRIVY_WALLET_ID  (for signing)
 *   GITHUB_REPOSITORY   (auto-set in Actions; e.g. "Liquid-Protocol-Ops/agent-autonomopoly")
 *   GH_TOKEN or GITHUB_TOKEN  (for writing the secret back)
 *
 * Optional:
 *   VENICE_API_KEY   (the key to test; if absent a fresh key is always minted)
 */

import { spawnSync } from 'child_process';
import { open } from 'fs/promises';
import { loadPrivyConfig, loadSignerFromPrivy } from '../harness/safety/wallet.js';

const VENICE_API = 'https://api.venice.ai/api/v1';
const BEARER_CACHE = 'memory/venice-bearer.json';

// ── Helpers ───────────────────────────────────────────────────────────────

async function testKey(key: string): Promise<boolean> {
  try {
    const res = await fetch(`${VENICE_API}/models`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function mintFreshKey(): Promise<string> {
  const signer = await loadSignerFromPrivy(loadPrivyConfig());

  // Step 1 — get a short-lived challenge JWT from Venice
  const challengeRes = await fetch(`${VENICE_API}/api_keys/generate_web3_key`);
  if (!challengeRes.ok) {
    throw new Error(`Venice challenge failed: ${challengeRes.status}`);
  }
  const { data } = await challengeRes.json() as { data: { token: string }; success: boolean };

  // Step 2 — sign the challenge with the agent wallet (proves sVVV staking)
  const signature = await signer.signMessage({ message: data.token });

  // Step 3 — exchange signature for an inference API key
  const keyRes = await fetch(`${VENICE_API}/api_keys/generate_web3_key`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      apiKeyType: 'INFERENCE',
      address:    signer.address,
      signature,
      token:      data.token,
    }),
  });

  if (!keyRes.ok) {
    const body = await keyRes.text();
    throw new Error(`Venice key mint failed: ${keyRes.status} — ${body}`);
  }

  const result = await keyRes.json() as { data?: { key?: string; apiKey?: string }; success: boolean };
  const key = result.data?.key ?? result.data?.apiKey;
  if (!key) throw new Error(`Venice returned no key: ${JSON.stringify(result)}`);
  return key;
}

async function updateGithubSecret(key: string): Promise<void> {
  const repo = process.env['GITHUB_REPOSITORY'];
  if (!repo) {
    console.warn('[refresh-venice-key] GITHUB_REPOSITORY not set — skipping secret update');
    return;
  }
  // Pipe the key via stdin so it never appears in process args or ps output
  const result = spawnSync('gh', ['secret', 'set', 'VENICE_API_KEY', '--body-file', '-', '--repo', repo], {
    input: key,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  if (result.status !== 0) {
    throw new Error(`gh secret set failed with exit code ${result.status}`);
  }
  console.log(`[refresh-venice-key] GitHub secret VENICE_API_KEY updated for ${repo}`);
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const currentKey = process.env['VENICE_API_KEY'];

  if (currentKey) {
    console.log('[refresh-venice-key] Testing current VENICE_API_KEY...');
    const valid = await testKey(currentKey);
    if (valid) {
      console.log('[refresh-venice-key] Key is valid — no action needed');
      return;
    }
    console.warn('[refresh-venice-key] Key returned 401 — minting fresh key via Privy signing');
  } else {
    console.warn('[refresh-venice-key] VENICE_API_KEY not set — minting fresh key via Privy signing');
  }

  const freshKey = await mintFreshKey();

  // Update GitHub Actions secret so the next run has the new key
  await updateGithubSecret(freshKey);

  // Update local bearer cache — 0o600 so only the owner can read the key
  const fh = await open(BEARER_CACHE, 'w', 0o600);
  await fh.writeFile(JSON.stringify({ bearer: freshKey }, null, 2));
  await fh.close();

  console.log('[refresh-venice-key] Done — fresh key written to GitHub secret and memory/venice-bearer.json');
}

await main();
