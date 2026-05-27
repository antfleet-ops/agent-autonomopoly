import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const REPO_ROOT  = join(__dirname, '..');

const jsonlPath = join(REPO_ROOT, 'memory', 'presales.jsonl');
const outPath   = join(REPO_ROOT, 'dashboard', 'app', 'public', 'presales.json');

interface PresaleEntry {
  vaultAddress: string;
  deployedAt: string;
  agentWallet?: string;
  contract?: string;
}

let entries: PresaleEntry[] = [];

if (existsSync(jsonlPath)) {
  const raw = readFileSync(jsonlPath, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean);

  entries = raw.map(line => {
    const r = JSON.parse(line) as Record<string, unknown>;
    return {
      vaultAddress: typeof r['vaultAddress'] === 'string' ? r['vaultAddress'] : '',
      deployedAt:   typeof r['timestamp']    === 'string' ? r['timestamp']    : '',
      ...(typeof r['agentWallet'] === 'string' && { agentWallet: r['agentWallet'] }),
      ...(typeof r['contract']    === 'string' && { contract:    r['contract'] }),
    };
  }).filter(e => e.vaultAddress.startsWith('0x'));
}

writeFileSync(outPath, JSON.stringify(entries, null, 2));
console.log(`Exported ${entries.length} presale(s) → ${outPath}`);
