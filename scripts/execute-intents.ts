/**
 * scripts/execute-intents.ts  —  runs in the dedicated "Execute on-chain intents"
 * workflow step (HOLDS the Privy credential; NO LLM in this step).
 *
 * This is the signing chokepoint of the split. It reads the intents the LLM step
 * queued into memory/pending-actions.jsonl, re-validates EACH one against the
 * shared allow-list (defense in depth — never trusts the queue file), and runs
 * the corresponding script via execFile (argv array, never a shell). Anything not
 * on the allow-list is logged and skipped; nothing reaches a signing script
 * unless it passed validation here.
 *
 * After processing, the pending file is cleared and an audit line per intent is
 * appended to memory/processed-actions.jsonl. A human-readable summary is dropped
 * into .pending-notify/ so the existing notification step delivers it.
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { validateIntent } from './lib/intent-allowlist.js';

const PENDING = 'memory/pending-actions.jsonl';
const PROCESSED = 'memory/processed-actions.jsonl';

type Outcome = { action: string; flags: string[]; status: string; detail: string };

function logProcessed(o: Outcome): void {
  mkdirSync('memory', { recursive: true });
  appendFileSync(
    PROCESSED,
    JSON.stringify({ ...o, processedAt: new Date().toISOString() }) + '\n',
  );
}

function notify(summary: string): void {
  try {
    mkdirSync('.pending-notify', { recursive: true });
    const ts = Math.floor(Date.now() / 1000);
    writeFileSync(`.pending-notify/${ts}-onchain.md`, summary);
  } catch {
    /* notification is best-effort */
  }
}

function main(): void {
  if (!existsSync(PENDING)) {
    console.log('execute-intents: no pending actions');
    return;
  }
  const lines = readFileSync(PENDING, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    console.log('execute-intents: no pending actions');
    return;
  }

  const outcomes: Outcome[] = [];
  for (const line of lines) {
    let intent: { action?: string; flags?: string[] };
    try {
      intent = JSON.parse(line);
    } catch {
      console.error(`execute-intents: unparseable intent skipped: ${line.slice(0, 120)}`);
      outcomes.push({ action: '(unparseable)', flags: [], status: 'rejected', detail: 'bad JSON' });
      continue;
    }
    const action = intent.action ?? '';
    const flags = Array.isArray(intent.flags) ? intent.flags.map(String) : [];

    let validated;
    try {
      validated = validateIntent(action, flags);
    } catch (err) {
      const detail = (err as Error).message;
      console.error(`execute-intents: REJECTED ${action} — ${detail}`);
      outcomes.push({ action, flags, status: 'rejected', detail });
      logProcessed({ action, flags, status: 'rejected', detail });
      continue;
    }

    try {
      const out = execFileSync('node', ['--import', 'tsx', validated.script, ...validated.argv], {
        encoding: 'utf8',
        stdio: 'pipe',
        env: process.env,
        maxBuffer: 16 * 1024 * 1024,
      });
      const tail = out.slice(-1500);
      console.log(`execute-intents: ran ${action} ${validated.argv.join(' ')}\n${tail}`);
      outcomes.push({ action, flags, status: 'executed', detail: tail.slice(-300) });
      logProcessed({ action, flags, status: 'executed', detail: tail.slice(-300) });
    } catch (err) {
      const detail = String((err as Error).message).slice(0, 400);
      console.error(`execute-intents: FAILED ${action} — ${detail}`);
      outcomes.push({ action, flags, status: 'failed', detail });
      logProcessed({ action, flags, status: 'failed', detail });
    }
  }

  // Clear the queue (everything has been processed + audited).
  writeFileSync(PENDING, '');

  const executed = outcomes.filter((o) => o.status === 'executed').length;
  const rejected = outcomes.filter((o) => o.status === 'rejected').length;
  const failed = outcomes.filter((o) => o.status === 'failed').length;
  console.log(`execute-intents: ${executed} executed, ${failed} failed, ${rejected} rejected`);

  if (outcomes.length > 0) {
    const summary =
      `On-chain intents: ${executed} executed, ${failed} failed, ${rejected} rejected\n` +
      outcomes
        .map((o) => `- [${o.status}] ${o.action}${o.flags.length ? ' ' + o.flags.join(' ') : ''}`)
        .join('\n');
    notify(summary);
  }

  // A rejected intent means the LLM tried to queue something off-policy — surface
  // it as a job failure so it is visible, but only after everything valid has run.
  if (rejected > 0) {
    process.exitCode = 1;
  }
}

main();
