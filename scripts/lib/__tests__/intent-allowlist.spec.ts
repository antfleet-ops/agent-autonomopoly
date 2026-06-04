import { describe, expect, it } from 'vitest';
import { INTENT_ALLOWLIST, validateIntent } from '../intent-allowlist.js';

describe('validateIntent — valid intents', () => {
  it('claim-and-allocate --live', () => {
    expect(validateIntent('claim-and-allocate', ['--live'])).toEqual({
      action: 'claim-and-allocate',
      script: 'scripts/claim-and-allocate.ts',
      argv: ['--live'],
    });
  });

  it('reposition --token-id <digits>', () => {
    const r = validateIntent('reposition', ['--token-id', '5253546', '--force']);
    expect(r.script).toBe('scripts/reposition.ts');
    expect(r.argv).toEqual(['--token-id', '5253546', '--force']);
  });

  it('tick (no flags)', () => {
    expect(validateIntent('tick', []).script).toBe('harness/tick.ts');
  });

  it('launch with an address-shaped --creator', () => {
    const r = validateIntent('launch-diem-token', [
      '--name', 'My Token', '--symbol', 'MYT',
      '--creator', '0x8767Df39eCeeaeB11554642237aC4E08660aB6A3',
    ]);
    expect(r.argv).toContain('--creator');
  });
});

describe('validateIntent — rejections (fail closed)', () => {
  it('rejects an unknown action', () => {
    expect(() => validateIntent('rm-rf', [])).toThrow(/unknown intent action/);
  });

  it('rejects a flag not on the action allow-list', () => {
    expect(() => validateIntent('claim-and-allocate', ['--exfil'])).toThrow(/not allowed/);
  });

  it('rejects an injected extra arg dressed as a value', () => {
    // --live is a bare flag, so a trailing token is an unknown flag, not a value.
    expect(() => validateIntent('claim-and-allocate', ['--live', '; curl evil'])).toThrow(/not allowed/);
  });

  it('rejects a bad --token-id value (non-numeric)', () => {
    expect(() => validateIntent('reposition', ['--token-id', '5; rm -rf'])).toThrow(/invalid/);
  });

  it('rejects a non-address --creator', () => {
    expect(() =>
      validateIntent('launch-diem-token', ['--name', 'X', '--symbol', 'X', '--creator', 'attacker']),
    ).toThrow(/invalid/);
  });

  it('rejects reposition without the required --token-id', () => {
    expect(() => validateIntent('reposition', ['--force'])).toThrow(/requires --token-id/);
  });

  it('rejects a value-flag with no value', () => {
    expect(() => validateIntent('reposition', ['--token-id'])).toThrow(/requires a value/);
  });
});

describe('intent allow-list — shape', () => {
  it('every action maps to a scripts/ or harness/ path', () => {
    for (const [action, spec] of Object.entries(INTENT_ALLOWLIST)) {
      expect(spec.script, action).toMatch(/^(scripts|harness)\/[\w-]+\.ts$/);
    }
  });
});
