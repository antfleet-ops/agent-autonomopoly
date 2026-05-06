import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { verifyMessage } from 'viem';
import { loadSignerFromEnv } from '../wallet.js';

// Known fixture: a deterministic private key with a well-known address.
// This is a public test vector; do not use this key for anything real.
const FIXTURE_KEY = '0x0123456789012345678901234567890123456789012345678901234567890123';
const FIXTURE_ADDRESS = '0x14791697260E4c9A71f18484C9f997B308e59325';

describe('loadSignerFromEnv — happy path', () => {
  let savedEnv: string | undefined;
  beforeEach(() => {
    savedEnv = process.env['AGENT_PRIVATE_KEY'];
    process.env['AGENT_PRIVATE_KEY'] = FIXTURE_KEY;
  });
  afterEach(() => {
    if (savedEnv === undefined) delete process.env['AGENT_PRIVATE_KEY'];
    else process.env['AGENT_PRIVATE_KEY'] = savedEnv;
  });

  it('derives the correct address from the fixture key', () => {
    const signer = loadSignerFromEnv();
    expect(signer.address.toLowerCase()).toBe(FIXTURE_ADDRESS.toLowerCase());
  });

  it('signs a message and the signature verifies', async () => {
    const signer = loadSignerFromEnv();
    const message = 'hello world';
    const signature = await signer.signMessage({ message });
    const valid = await verifyMessage({
      address: signer.address,
      message,
      signature,
    });
    expect(valid).toBe(true);
  });

  it('accepts the key with or without the 0x prefix', () => {
    process.env['AGENT_PRIVATE_KEY'] = FIXTURE_KEY.slice(2); // strip 0x
    const signer = loadSignerFromEnv();
    expect(signer.address.toLowerCase()).toBe(FIXTURE_ADDRESS.toLowerCase());
  });
});

describe('loadSignerFromEnv — key isolation', () => {
  let savedEnv: string | undefined;
  beforeEach(() => {
    savedEnv = process.env['AGENT_PRIVATE_KEY'];
    process.env['AGENT_PRIVATE_KEY'] = FIXTURE_KEY;
  });
  afterEach(() => {
    if (savedEnv === undefined) delete process.env['AGENT_PRIVATE_KEY'];
    else process.env['AGENT_PRIVATE_KEY'] = savedEnv;
  });

  it('does not expose the private key via Object.keys', () => {
    const signer = loadSignerFromEnv();
    const keys = Object.keys(signer);
    for (const k of keys) {
      expect(k.toLowerCase()).not.toMatch(/private|secret|key$|raw/);
    }
  });

  it('does not expose the private key via JSON.stringify', () => {
    const signer = loadSignerFromEnv();
    const json = JSON.stringify(signer);
    // The fixture key (with and without 0x prefix) must not appear in the
    // JSON serialization.
    expect(json).not.toContain(FIXTURE_KEY);
    expect(json).not.toContain(FIXTURE_KEY.slice(2));
  });

  it('only exposes address + sign methods', () => {
    const signer = loadSignerFromEnv();
    const keys = Object.keys(signer).sort();
    expect(keys).toEqual(['address', 'signMessage', 'signTypedData']);
  });
});

describe('loadSignerFromEnv — error handling', () => {
  let savedEnv: string | undefined;
  beforeEach(() => {
    savedEnv = process.env['AGENT_PRIVATE_KEY'];
  });
  afterEach(() => {
    if (savedEnv === undefined) delete process.env['AGENT_PRIVATE_KEY'];
    else process.env['AGENT_PRIVATE_KEY'] = savedEnv;
  });

  it('throws when AGENT_PRIVATE_KEY is unset', () => {
    delete process.env['AGENT_PRIVATE_KEY'];
    expect(() => loadSignerFromEnv()).toThrow(/AGENT_PRIVATE_KEY is required/);
  });

  it('throws when AGENT_PRIVATE_KEY is empty', () => {
    process.env['AGENT_PRIVATE_KEY'] = '';
    expect(() => loadSignerFromEnv()).toThrow(/AGENT_PRIVATE_KEY is required/);
  });

  it('throws when AGENT_PRIVATE_KEY is malformed (wrong length)', () => {
    process.env['AGENT_PRIVATE_KEY'] = '0xdeadbeef';
    expect(() => loadSignerFromEnv()).toThrow(/malformed/);
  });

  it('throws when AGENT_PRIVATE_KEY contains non-hex characters', () => {
    process.env['AGENT_PRIVATE_KEY'] =
      '0xZZZZ567890123456789012345678901234567890123456789012345678901234';
    expect(() => loadSignerFromEnv()).toThrow(/malformed/);
  });

  it('does not echo the bad value in the malformed-key error message', () => {
    const badKey = '0xZZZZ567890123456789012345678901234567890123456789012345678901234';
    process.env['AGENT_PRIVATE_KEY'] = badKey;
    try {
      loadSignerFromEnv();
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Error).message).not.toContain(badKey);
      expect((err as Error).message).not.toContain(badKey.slice(2));
      expect((err as Error).message).not.toContain('ZZZZ');
    }
  });
});
