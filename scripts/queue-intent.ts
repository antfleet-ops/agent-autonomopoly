/**
 * scripts/queue-intent.ts  —  runs in the LLM tick step (NO signing credential)
 *
 * The agent calls this to request an on-chain action instead of executing it
 * directly. It validates the action + flags against the shared allow-list and
 * appends one JSON line to memory/pending-actions.jsonl. The separate, non-LLM
 * "Execute on-chain intents" workflow step (scripts/execute-intents.ts), which
 * holds the Privy credential, runs the queued actions.
 *
 * Usage:
 *   node --import tsx scripts/queue-intent.ts <action> [flags...]
 * Examples:
 *   node --import tsx scripts/queue-intent.ts claim-and-allocate --live
 *   node --import tsx scripts/queue-intent.ts reposition --token-id 5253546
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import { INTENT_ALLOWLIST, validateIntent } from './lib/intent-allowlist.js';

const PENDING = 'memory/pending-actions.jsonl';

function main(): void {
  const [action, ...flags] = process.argv.slice(2);
  if (!action) {
    console.error(
      `usage: queue-intent <action> [flags...]\nactions: ${Object.keys(INTENT_ALLOWLIST).join(', ')}`,
    );
    process.exit(1);
  }
  try {
    validateIntent(action, flags); // throws on anything not allow-listed
  } catch (err) {
    console.error(`queue-intent: rejected — ${(err as Error).message}`);
    process.exit(1);
  }
  mkdirSync('memory', { recursive: true });
  const line = JSON.stringify({ action, flags, queuedAt: new Date().toISOString() });
  appendFileSync(PENDING, line + '\n');
  console.log(
    `queue-intent: queued "${action}${flags.length ? ' ' + flags.join(' ') : ''}". ` +
      `It will run in the gated executor step (this step cannot sign).`,
  );
}

main();
