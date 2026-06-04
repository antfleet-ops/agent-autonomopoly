/**
 * scripts/lib/intent-allowlist.ts
 *
 * Single source of truth for the signing-split: the set of on-chain actions the
 * agent is allowed to request, and the exact flags each one accepts.
 *
 * The LLM-driven tick step has NO signing credential — it can only *queue* an
 * intent (via scripts/queue-intent.ts). A separate, non-LLM executor step
 * (scripts/execute-intents.ts), which holds the Privy credential, validates each
 * queued intent against THIS allow-list and runs the corresponding script.
 * Validation happens on both sides (queue + execute), so a malformed or hostile
 * intent never reaches a signing script.
 *
 * Because the executor runs scripts via execFile (an argv array, never a shell),
 * values cannot shell-inject; the per-flag patterns below are sanity bounds, and
 * the load-bearing controls are: (a) only listed actions run, (b) only listed
 * flags are passed, (c) the script's own guards (TxSender destination allow-list,
 * launch --creator pin) still apply.
 */

export type FlagSpec =
  | { kind: 'bare' }                       // valueless flag, e.g. --live, --dry-run
  | { kind: 'value'; pattern: RegExp };    // flag + one value, e.g. --token-id 123

export type IntentSpec = {
  /** Script path, run as `node --import tsx <script> <argv...>`. */
  script: string;
  /** Allowed flags for this action. */
  flags: Record<string, FlagSpec>;
  /** Flags that MUST be present. */
  requiredFlags?: string[];
};

const ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const NUMBER = /^[0-9]+(\.[0-9]+)?$/;
const TOKEN_ID = /^[0-9]{1,20}$/;
const SYMBOL = /^[A-Za-z0-9]{1,12}$/;
const NAME = /^[\x20-\x7E]{1,80}$/;        // printable ASCII, bounded
const URLISH = /^[^\s]{1,300}$/;           // no whitespace, bounded (image/metadata URI)

export const INTENT_ALLOWLIST: Record<string, IntentSpec> = {
  // ── routine earning loop ────────────────────────────────────────────
  'claim-and-allocate': {
    script: 'scripts/claim-and-allocate.ts',
    flags: { '--live': { kind: 'bare' }, '--dry-run': { kind: 'bare' } },
  },
  'reposition': {
    script: 'scripts/reposition.ts',
    flags: {
      '--token-id': { kind: 'value', pattern: TOKEN_ID },
      '--dry-run': { kind: 'bare' },
      '--mint-only': { kind: 'bare' },
      '--skip-decrease': { kind: 'bare' },
      '--skip-swap': { kind: 'bare' },
      '--force': { kind: 'bare' },
      '--min-age-override': { kind: 'bare' },
    },
    requiredFlags: ['--token-id'],
  },
  'tick': { script: 'harness/tick.ts', flags: {} },
  'stake-diem': { script: 'scripts/stake-diem.ts', flags: { '--dry-run': { kind: 'bare' } } },
  'stake-vvv': { script: 'scripts/stake-vvv.ts', flags: {} },

  // ── launches / presale (rarer; --creator is additionally pinned inside the script) ──
  'launch-diem-token': {
    script: 'scripts/launch-diem-token.ts',
    flags: {
      '--name': { kind: 'value', pattern: NAME },
      '--symbol': { kind: 'value', pattern: SYMBOL },
      '--creator': { kind: 'value', pattern: ADDRESS },
      '--marketcap-diem': { kind: 'value', pattern: NUMBER },
      '--image': { kind: 'value', pattern: URLISH },
      '--metadata': { kind: 'value', pattern: URLISH },
      '--vvv-vault': { kind: 'value', pattern: ADDRESS },
      '--diem-vault': { kind: 'value', pattern: ADDRESS },
      '--presale-vault': { kind: 'value', pattern: ADDRESS },
      '--extension-bps': { kind: 'value', pattern: NUMBER },
      '--dry-run': { kind: 'bare' },
    },
    requiredFlags: ['--name', '--symbol'],
  },
  'launch-vvv-token': {
    script: 'scripts/launch-vvv-token.ts',
    flags: {
      '--name': { kind: 'value', pattern: NAME },
      '--symbol': { kind: 'value', pattern: SYMBOL },
      '--creator': { kind: 'value', pattern: ADDRESS },
      '--marketcap-vvv': { kind: 'value', pattern: NUMBER },
      '--image': { kind: 'value', pattern: URLISH },
      '--metadata': { kind: 'value', pattern: URLISH },
      '--dry-run': { kind: 'bare' },
    },
    requiredFlags: ['--name', '--symbol'],
  },
  'deploy-compute-presale': {
    script: 'scripts/deploy-compute-presale.ts',
    flags: {
      '--agent-wallet': { kind: 'value', pattern: ADDRESS },
      '--protocol': { kind: 'value', pattern: ADDRESS },
      '--protocol-fee-bps': { kind: 'value', pattern: NUMBER },
      '--diem-target': { kind: 'value', pattern: NUMBER },
      '--deposit-window-hours': { kind: 'value', pattern: NUMBER },
      '--dry-run': { kind: 'bare' },
    },
  },
};

export type ValidatedIntent = { action: string; script: string; argv: string[] };

/**
 * Validate an action + raw flag list against the allow-list. Returns the script
 * to run and the exact argv to pass. Throws on any unknown action, unknown flag,
 * bad value, missing required flag, or missing value for a value-flag.
 */
export function validateIntent(action: string, flags: readonly string[]): ValidatedIntent {
  const spec = INTENT_ALLOWLIST[action];
  if (!spec) {
    throw new Error(
      `unknown intent action "${action}" — allowed: ${Object.keys(INTENT_ALLOWLIST).join(', ')}`,
    );
  }
  const argv: string[] = [];
  for (let i = 0; i < flags.length; i++) {
    const flag = flags[i]!;
    const fs = spec.flags[flag];
    if (!fs) {
      throw new Error(`flag "${flag}" is not allowed for action "${action}"`);
    }
    if (fs.kind === 'bare') {
      argv.push(flag);
    } else {
      const value = flags[i + 1];
      i += 1;
      if (value === undefined) throw new Error(`flag "${flag}" requires a value`);
      if (!fs.pattern.test(value)) {
        throw new Error(`value for "${flag}" is invalid: ${value}`);
      }
      argv.push(flag, value);
    }
  }
  for (const req of spec.requiredFlags ?? []) {
    if (!argv.includes(req)) {
      throw new Error(`action "${action}" requires ${req}`);
    }
  }
  return { action, script: spec.script, argv };
}
