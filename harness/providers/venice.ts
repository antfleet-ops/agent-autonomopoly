// Venice provider — claim DIEM → stake → mint bearer key → call inference.
//
// Required env vars:
//   DIEM_TOKEN_ADDRESS     — DIEM ERC-20 / staking contract on Base mainnet
//   VENICE_STAKING_ADDRESS — same address as DIEM_TOKEN_ADDRESS (DIEM is its own staking contract)
//   RPC_URL                — Base mainnet JSON-RPC endpoint
//
// Optional env vars:
//   VENICE_STAKE_THRESHOLD   — min DIEM (18-dec wei) before staking triggers (default: 0.1 ether)
//   VENICE_BEARER_CACHE_PATH — where to persist the bearer key (default: memory/venice-bearer.json)
//   VENICE_API_BASE          — Venice API base URL (default: https://api.venice.ai/api/v1)
//   VENICE_MODEL             — inference model slug (default: llama-3.3-70b)
//
// On-chain write functions accept a TxSender (from wallet.ts), which abstracts the signing substrate
// (Privy server wallet for v0; TEE for v1). Signer is used only for message signing in the Venice
// key mint flow.

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import {
  createPublicClient,
  encodeFunctionData,
  http,
  parseEther,
  type Address,
  type Hex,
} from 'viem';
import { base } from 'viem/chains';
import { ADDRESSES } from '../../platform/constants.js';
import { assertAllowed } from '../safety/allowlist.js';
import { emit, type ToolRoutingEntry } from '../observability/tool-routing.js';
import type { Signer, TxSender } from '../safety/wallet.js';

// ── Minimal ABIs ────────────────────────────────────────────────────

const FEE_LOCKER_ABI = [
  {
    type: 'function', name: 'availableFees',
    inputs: [{ name: 'feeOwner', type: 'address' }, { name: 'token', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'claim',
    inputs: [{ name: 'feeOwner', type: 'address' }, { name: 'token', type: 'address' }],
    outputs: [], stateMutability: 'nonpayable',
  },
] as const;

const ERC20_ABI = [
  {
    type: 'function', name: 'decimals',
    inputs: [], outputs: [{ name: '', type: 'uint8' }], stateMutability: 'view',
  },
] as const;

const SDIEM_STAKING_ABI = [
  {
    type: 'function', name: 'stake',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view',
  },
] as const;

// ── Config ──────────────────────────────────────────────────────────

export type VeniceConfig = {
  diemAddress: Address;
  stakingAddress: Address;
  rpcUrl: string;
  stakeThreshold: bigint;
  bearerCachePath: string;
  veniceApiBase: string;
  model: string;
};

export function loadConfig(): VeniceConfig {
  const diemAddress = process.env['DIEM_TOKEN_ADDRESS'];
  const stakingAddress = process.env['VENICE_STAKING_ADDRESS'];
  const rpcUrl = process.env['RPC_URL'];
  if (!diemAddress) throw new Error('DIEM_TOKEN_ADDRESS is required');
  if (!stakingAddress) throw new Error('VENICE_STAKING_ADDRESS is required');
  if (!rpcUrl) throw new Error('RPC_URL is required');
  return {
    diemAddress: diemAddress as Address,
    stakingAddress: stakingAddress as Address,
    rpcUrl,
    stakeThreshold: BigInt(process.env['VENICE_STAKE_THRESHOLD'] ?? String(parseEther('0.1'))),
    bearerCachePath: process.env['VENICE_BEARER_CACHE_PATH'] ?? 'memory/venice-bearer.json',
    veniceApiBase: process.env['VENICE_API_BASE'] ?? 'https://api.venice.ai/api/v1',
    model: process.env['VENICE_MODEL'] ?? 'llama-3.3-70b',
  };
}

// ── On-chain reads ──────────────────────────────────────────────────

export function makePublicClient(rpcUrl: string) {
  return createPublicClient({ chain: base, transport: http(rpcUrl) });
}

type BasePublicClient = ReturnType<typeof makePublicClient>;

export async function getClaimable(
  config: VeniceConfig,
  agentAddress: Address,
  publicClient: BasePublicClient = makePublicClient(config.rpcUrl),
): Promise<bigint> {
  // Guard: confirm DIEM uses 18 decimals.
  const decimals = await publicClient.readContract({
    address: config.diemAddress,
    abi: ERC20_ABI,
    functionName: 'decimals',
  });
  if (decimals !== 18) throw new Error(`DIEM decimals() = ${decimals}, expected 18`);

  return publicClient.readContract({
    address: ADDRESSES.FEE_LOCKER,
    abi: FEE_LOCKER_ABI,
    functionName: 'availableFees',
    args: [agentAddress, config.diemAddress],
  });
}

export async function getStakedBalance(
  config: VeniceConfig,
  agentAddress: Address,
  publicClient: BasePublicClient = makePublicClient(config.rpcUrl),
): Promise<bigint> {
  return publicClient.readContract({
    address: config.stakingAddress,
    abi: SDIEM_STAKING_ABI,
    functionName: 'balanceOf',
    args: [agentAddress],
  });
}

// ── On-chain writes (walletClient built by tick from full keypair) ──

export async function claimDiem(
  config: VeniceConfig,
  agentAddress: Address,
  txSender: TxSender,
): Promise<Hex> {
  const data = encodeFunctionData({
    abi: FEE_LOCKER_ABI,
    functionName: 'claim',
    args: [agentAddress, config.diemAddress],
  });
  return txSender({ to: ADDRESSES.FEE_LOCKER, data });
}

export async function stakeDiem(
  config: VeniceConfig,
  amount: bigint,
  txSender: TxSender,
  publicClient: BasePublicClient = makePublicClient(config.rpcUrl),
): Promise<void> {
  // DIEM is its own staking contract — call stake() directly, no ERC-20 approve needed.
  const data = encodeFunctionData({
    abi: SDIEM_STAKING_ABI,
    functionName: 'stake',
    args: [amount],
  });
  const stakeTx = await txSender({ to: config.diemAddress, data });
  await publicClient.waitForTransactionReceipt({ hash: stakeTx });
}

// ── Venice key mint ─────────────────────────────────────────────────

// Flow: GET /auth/challenge → personal_sign(nonce) → POST /auth/verify → POST /api_keys
export async function mintVeniceKey(
  config: VeniceConfig,
  signer: Signer,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  // 1. Get challenge nonce.
  const challengeRes = await fetchFn(`${config.veniceApiBase}/auth/challenge`);
  if (!challengeRes.ok) throw new Error(`Venice challenge failed: ${challengeRes.status}`);
  const { nonce } = await challengeRes.json() as { nonce: string };

  // 2. Sign nonce — proves wallet ownership; Venice checks sDIEM balance on-chain.
  const signature = await signer.signMessage({ message: nonce });

  // 3. Exchange for a short-lived JWT.
  const verifyRes = await fetchFn(`${config.veniceApiBase}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: signer.address, signature, nonce }),
  });
  if (!verifyRes.ok) throw new Error(`Venice verify failed: ${verifyRes.status}`);
  const { jwt } = await verifyRes.json() as { jwt: string };

  // 4. Mint a durable bearer API key.
  const keyRes = await fetchFn(`${config.veniceApiBase}/api_keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ type: 'INFERENCE', name: 'agent' }),
  });
  if (!keyRes.ok) throw new Error(`Venice api_keys failed: ${keyRes.status}`);
  const { key } = await keyRes.json() as { key: string };
  return key;
}

// ── Bearer cache ────────────────────────────────────────────────────

export function loadCachedBearer(cachePath: string): string | null {
  if (!existsSync(cachePath)) return null;
  try {
    const data = JSON.parse(readFileSync(cachePath, 'utf8')) as { bearer: string };
    return data.bearer ?? null;
  } catch {
    return null;
  }
}

export function saveBearer(cachePath: string, bearer: string): void {
  assertAllowed(cachePath);
  writeFileSync(cachePath, JSON.stringify({ bearer }), 'utf8');
}

export async function loadOrMintBearer(
  config: VeniceConfig,
  signer: Signer,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const cached = loadCachedBearer(config.bearerCachePath);
  if (cached) return cached;
  const bearer = await mintVeniceKey(config, signer, fetchFn);
  saveBearer(config.bearerCachePath, bearer);
  return bearer;
}

// ── Inference ───────────────────────────────────────────────────────

export type InferenceOpts = {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
};

export async function callInference(
  config: VeniceConfig,
  bearer: string,
  opts: InferenceOpts,
  logPath: string,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const start = Date.now();
  const res = await fetchFn(`${config.veniceApiBase}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
    body: JSON.stringify({
      model: config.model,
      messages: [
        ...(opts.systemPrompt ? [{ role: 'system', content: opts.systemPrompt }] : []),
        { role: 'user', content: opts.prompt },
      ],
      max_tokens: opts.maxTokens ?? 512,
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`Venice inference failed: ${res.status}`);

  const latency_ms = Date.now() - start;
  const data = await res.json() as {
    choices: { message: { content: string } }[];
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  const entry: ToolRoutingEntry = {
    ts: new Date().toISOString(),
    provider: 'venice',
    variant: `:${config.model}`,
    cache_hit: false,
    latency_ms,
    tokens: { input: data.usage.prompt_tokens, output: data.usage.completion_tokens },
    // Venice cost is covered by staked sDIEM daily budget — not a per-call USD charge.
    cost_usd: 0,
  };
  emit(entry, logPath);

  return data.choices[0]?.message.content ?? '';
}
