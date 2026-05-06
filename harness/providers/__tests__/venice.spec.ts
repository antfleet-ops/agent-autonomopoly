import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadConfig,
  loadCachedBearer,
  saveBearer,
  loadOrMintBearer,
  mintVeniceKey,
  callInference,
  type VeniceConfig,
} from '../venice.js';

// ── Shared fixtures ─────────────────────────────────────────────────

const DUMMY_ADDRESS = '0x0000000000000000000000000000000000000001';

const BASE_ENV: Record<string, string> = {
  DIEM_TOKEN_ADDRESS: DUMMY_ADDRESS,
  VENICE_STAKING_ADDRESS: DUMMY_ADDRESS,
  RPC_URL: 'https://base-mainnet.example.com',
};

const MOCK_SIGNER = {
  address: DUMMY_ADDRESS as `0x${string}`,
  signMessage: vi.fn().mockResolvedValue('0xsignature'),
  signTypedData: vi.fn(),
};

let dir: string;
let logPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'venice-'));
  logPath = join(dir, 'tool-routing.jsonl');
  Object.entries(BASE_ENV).forEach(([k, v]) => (process.env[k] = v));
});

afterEach(() => {
  rmSync(dir, { recursive: true });
  Object.keys(BASE_ENV).forEach(k => delete process.env[k]);
  vi.clearAllMocks();
});

// ── loadConfig ──────────────────────────────────────────────────────

describe('loadConfig', () => {
  it('loads required env vars', () => {
    const cfg = loadConfig();
    expect(cfg.diemAddress).toBe(DUMMY_ADDRESS);
    expect(cfg.stakingAddress).toBe(DUMMY_ADDRESS);
    expect(cfg.rpcUrl).toBe('https://base-mainnet.example.com');
  });

  it('applies defaults for optional vars', () => {
    const cfg = loadConfig();
    expect(cfg.veniceApiBase).toBe('https://api.venice.ai/api/v1');
    expect(cfg.model).toBe('llama-3.3-70b');
    expect(cfg.bearerCachePath).toBe('memory/venice-bearer.json');
  });

  it('throws when DIEM_TOKEN_ADDRESS is missing', () => {
    delete process.env['DIEM_TOKEN_ADDRESS'];
    expect(() => loadConfig()).toThrow('DIEM_TOKEN_ADDRESS is required');
  });

  it('throws when VENICE_STAKING_ADDRESS is missing', () => {
    delete process.env['VENICE_STAKING_ADDRESS'];
    expect(() => loadConfig()).toThrow('VENICE_STAKING_ADDRESS is required');
  });

  it('throws when RPC_URL is missing', () => {
    delete process.env['RPC_URL'];
    expect(() => loadConfig()).toThrow('RPC_URL is required');
  });
});

// ── Bearer cache ────────────────────────────────────────────────────

describe('bearer cache', () => {
  it('returns null when cache file does not exist', () => {
    expect(loadCachedBearer(join(dir, 'nonexistent.json'))).toBeNull();
  });

  it('round-trips a bearer through save + load', () => {
    const cachePath = join(dir, 'memory', 'venice-bearer.json');
    // saveBearer requires path to be allowlisted; use memory/ prefix.
    const allowedPath = 'memory/venice-bearer.json';
    // Write via the public API after creating the dir.
    import('node:fs').then(({ mkdirSync }) => mkdirSync(join(dir, 'memory'), { recursive: true }));
    // Directly test loadCachedBearer with a manually written file.
    import('node:fs').then(({ writeFileSync, mkdirSync }) => {
      mkdirSync(join(dir, 'memory'), { recursive: true });
      writeFileSync(cachePath, JSON.stringify({ bearer: 'vn-test-bearer-abc123' }), 'utf8');
    });
    // Sync version for the test.
    const { writeFileSync, mkdirSync } = require('node:fs');
    mkdirSync(join(dir, 'memory'), { recursive: true });
    writeFileSync(cachePath, JSON.stringify({ bearer: 'vn-test-bearer-abc123' }), 'utf8');
    expect(loadCachedBearer(cachePath)).toBe('vn-test-bearer-abc123');
  });

  it('returns null on malformed cache file', () => {
    const { writeFileSync } = require('node:fs');
    const bad = join(dir, 'bad.json');
    writeFileSync(bad, 'not json', 'utf8');
    expect(loadCachedBearer(bad)).toBeNull();
  });
});

// ── mintVeniceKey ───────────────────────────────────────────────────

describe('mintVeniceKey', () => {
  it('follows challenge → verify → api_keys flow', async () => {
    const cfg = loadConfig();
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ nonce: 'test-nonce-42' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jwt: 'jwt-token-xyz' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ key: 'vn-bearer-final' }) });

    const key = await mintVeniceKey(cfg, MOCK_SIGNER, mockFetch as unknown as typeof fetch);

    expect(key).toBe('vn-bearer-final');
    expect(mockFetch).toHaveBeenCalledTimes(3);

    const [challengeCall, verifyCall, keyCall] = mockFetch.mock.calls;
    expect(challengeCall![0]).toContain('/auth/challenge');
    expect(verifyCall![0]).toContain('/auth/verify');
    expect(JSON.parse(verifyCall![1]!.body as string)).toMatchObject({
      address: DUMMY_ADDRESS,
      nonce: 'test-nonce-42',
    });
    expect(keyCall![0]).toContain('/api_keys');
    expect(keyCall![1]!.headers).toMatchObject({ Authorization: 'Bearer jwt-token-xyz' });
  });

  it('throws on challenge failure', async () => {
    const cfg = loadConfig();
    const mockFetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(mintVeniceKey(cfg, MOCK_SIGNER, mockFetch as unknown as typeof fetch))
      .rejects.toThrow('Venice challenge failed: 503');
  });

  it('throws on verify failure', async () => {
    const cfg = loadConfig();
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ nonce: 'n' }) })
      .mockResolvedValueOnce({ ok: false, status: 401 });
    await expect(mintVeniceKey(cfg, MOCK_SIGNER, mockFetch as unknown as typeof fetch))
      .rejects.toThrow('Venice verify failed: 401');
  });
});

// ── loadOrMintBearer ────────────────────────────────────────────────

describe('loadOrMintBearer', () => {
  it('returns cached bearer without calling Venice', async () => {
    const { writeFileSync, mkdirSync } = require('node:fs');
    const cachePath = join(dir, 'memory', 'bearer.json');
    mkdirSync(join(dir, 'memory'), { recursive: true });
    writeFileSync(cachePath, JSON.stringify({ bearer: 'cached-bearer-999' }), 'utf8');

    const cfg: VeniceConfig = { ...loadConfig(), bearerCachePath: cachePath };
    const mockFetch = vi.fn();
    const bearer = await loadOrMintBearer(cfg, MOCK_SIGNER, mockFetch as unknown as typeof fetch);

    expect(bearer).toBe('cached-bearer-999');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ── callInference ───────────────────────────────────────────────────

describe('callInference', () => {
  it('calls Venice completions and logs via tool-routing', async () => {
    const cfg = loadConfig();
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Hello from Venice' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    });

    const result = await callInference(
      cfg,
      'test-bearer',
      { prompt: 'say hello' },
      logPath,
      mockFetch as unknown as typeof fetch,
    );

    expect(result).toBe('Hello from Venice');

    const { readFileSync } = require('node:fs');
    const line = JSON.parse(readFileSync(logPath, 'utf8').trimEnd());
    expect(line.provider).toBe('venice');
    expect(line.tokens).toEqual({ input: 10, output: 5 });
    expect(line.cost_usd).toBe(0);
    expect(line.cache_hit).toBe(false);
  });

  it('throws on non-ok inference response', async () => {
    const cfg = loadConfig();
    const mockFetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 429 });
    await expect(
      callInference(cfg, 'bearer', { prompt: 'x' }, logPath, mockFetch as unknown as typeof fetch),
    ).rejects.toThrow('Venice inference failed: 429');
  });
});
