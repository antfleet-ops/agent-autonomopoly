/**
 * scripts/analyze-lp.ts
 *
 * Fetches LP position data from Dune Q7591697 (master portfolio v3, incremental),
 * sends findings to Venice AI for strategy recommendations, writes a dated analysis to
 * memory/lp-analysis-YYYY-MM-DD.md, and updates the Dune strategy log (Q7582817).
 *
 * Usage:
 *   node --env-file=.env --import tsx scripts/analyze-lp.ts
 *   node --env-file=.env --import tsx scripts/analyze-lp.ts --dry-run   # skip Venice + Dune write
 *
 * Env required: DUNE_API_KEY, AGENT_WALLET
 * Wallet: loaded from PRIVY_* env if set, else AGENT_PRIVATE_KEY (Venice key derived from wallet)
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import OpenAI from 'openai';
import { ETH_DIEM_V3 } from '../platform/constants.js';
import {
  loadPrivyConfig, loadSignerFromPrivy,
  loadSignerFromEnv,
  type Signer,
} from '../harness/safety/wallet.js';
import { withVeniceKey } from '../platform/venice-auth.js';

// ── Config ──────────────────────────────────────────────────────────────────

const DUNE_QUERY_ID      = 7591697;  // Master Portfolio v3 (incremental) — single source of truth
const STRATEGY_LOG_QUERY = 7582817;  // LP Strategy Log (agent updates each tick)
const DUNE_API           = 'https://api.dune.com/api/v1';

const LP_GOALS = {
  primary:    'Accumulate WETH and DIEM via LP fee income from the WETH/DIEM 1% pool',
  rule:       'Fee APR must exceed IL rate for LP to outperform simply holding',
  reposition: 'Reposition when within 2 tick spacings (400 ticks) of a range boundary',
  compound:   'Compound fee income into new LP positions or hold as WETH/DIEM treasury',
};

// ── Types ────────────────────────────────────────────────────────────────────

type DuneRow = {
  token_id:           string;
  is_active:          boolean;
  tick_range:         string;
  range_status:       string;           // 'in_range' | 'out_of_range'
  ticks_to_lower:     number;
  ticks_to_upper:     number;
  il_pct:             number;           // impermanent loss as % of cost basis
  fee_apr_pct:        number;           // annualised fee APR
  net_pnl_usd:        number;           // fees earned minus IL in USD
  recommended_action: string;           // HOLD | REPOSITION_NEAR_UPPER | REPOSITION_OOR | etc.
  reposition_flag:    boolean;
  eth_usd:            number;
  diem_usd:           number;
  dep_usd:            number | null;    // cost basis in USD (may be null for very old positions)
  fee_usd:            number | null;
  il_usd:             number | null;
  opened_date:        string | null;
  status:             string | null;    // 'Active' | 'Closed'
};

// ── Dune API ──────────────────────────────────────────────────────────────────

async function fetchDuneResults(queryId: number, apiKey: string): Promise<DuneRow[]> {
  const execResp = await fetch(`${DUNE_API}/query/${queryId}/execute`, {
    method: 'POST',
    headers: { 'X-Dune-API-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ performance: 'free' }),
  });
  if (!execResp.ok) throw new Error(`Dune execute failed: ${execResp.status}`);
  const { execution_id } = await execResp.json() as { execution_id: string };

  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const statusResp = await fetch(
      `${DUNE_API}/execution/${execution_id}/results`,
      { headers: { 'X-Dune-API-Key': apiKey } },
    );
    if (!statusResp.ok) continue;
    const body = await statusResp.json() as {
      state: string;
      result?: { rows: DuneRow[] };
    };
    if (body.state === 'QUERY_STATE_COMPLETED' && body.result) return body.result.rows;
    if (body.state === 'QUERY_STATE_FAILED') throw new Error(`Dune query failed: ${JSON.stringify(body)}`);
  }
  throw new Error('Dune query timed out after 90s');
}

async function updateStrategyLog(
  today: string,
  totalIL: number,
  totalFees: number,
  analysis: string,
  apiKey: string,
): Promise<void> {
  const netPnL = totalFees - totalIL;
  const notes  = analysis.slice(0, 600)
    .replace(/[^\w\s.,;:!?%$()@#\-+=/]/g, ' ')   // allowlist safe chars; strip ) -- etc.
    .replace(/\s+/g, ' ').trim()
    .replace(/'/g, "''");

  const sql = `-- Agent LP Strategy Log
-- Updated by analyze-lp.ts each tick via Dune REST API PATCH
SELECT *
FROM (
    VALUES
        (
            TIMESTAMP '${today} 00:00:00',
            'Periodic Review',
            ${(-totalIL).toFixed(2)},
            ${totalFees.toFixed(2)},
            ${netPnL.toFixed(2)},
            '${notes}'
        ),
        (
            TIMESTAMP '2026-05-26 00:00:00',
            'Initial Setup',
            -167.64,
            0.00,
            -167.64,
            'GOALS: Accumulate WETH and DIEM via LP fee income. Target fee APR > IL rate. STRATEGY: Wide ranges. All positions in range. IL ~$168.'
        )
) AS t(review_date, review_type, il_usd, fees_earned_usd, net_pnl_usd, strategy_notes)
ORDER BY review_date DESC`;

  const resp = await fetch(`${DUNE_API}/query/${STRATEGY_LOG_QUERY}`, {
    method: 'PATCH',
    headers: { 'X-Dune-API-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });

  if (!resp.ok) {
    console.warn(`[analyze-lp] Strategy log update failed: ${resp.status} — ${await resp.text()}`);
  } else {
    console.log('[analyze-lp] Strategy log updated on Dune (Q7582817).');
  }
}

// ── Venice AI analysis ────────────────────────────────────────────────────────

async function analyzeWithVenice(rows: DuneRow[], signer: Signer): Promise<string> {
  return withVeniceKey(signer, async (apiKey) => {
    const client = new OpenAI({ apiKey, baseURL: 'https://api.venice.ai/api/v1' });

    const active = rows.filter(r => r.is_active);
    const closed = rows.filter(r => !r.is_active);

    const totalDeployed = rows.reduce((s, r) => s + (r.dep_usd ?? 0), 0);
    const totalFees     = rows.reduce((s, r) => s + (r.fee_usd ?? 0), 0);
    const totalIL       = active.reduce((s, r) => s + (r.il_usd ?? 0), 0);
    const eth_usd       = rows[0]?.eth_usd ?? 0;
    const diem_usd      = rows[0]?.diem_usd ?? 0;

    const systemPrompt = `You are an autonomous DeFi LP agent analyzing your own performance on the WETH/DIEM 1% Uniswap V3 pool on Base mainnet.

PRIMARY GOAL: ${LP_GOALS.primary}
PROFITABILITY RULE: ${LP_GOALS.rule}
REPOSITION TRIGGER: ${LP_GOALS.reposition}
COMPOUNDING: ${LP_GOALS.compound}

Pool: WETH/DIEM (1% fee, tick spacing 200). ETH: $${eth_usd} | DIEM: $${diem_usd.toFixed(4)}

ANALYSIS GOALS:
1. Is fee APR exceeding IL rate on active positions?
2. Which historical tick ranges produced the best fee APY with least IL?
3. Should any active position be repositioned? Give specific tick boundaries (multiples of 200).
4. What should the NEXT LP deployment target? Specific ticks, capital in WETH and DIEM.
5. Any timing patterns in when fees peak the agent should exploit?

Output ONLY these sections: FINDINGS | CURRENT POSITIONS | NEXT DEPLOYMENT | RULES TO ADOPT`;

    const activeLines = active.map(r => {
      const spacingsToTop = r.ticks_to_upper / ETH_DIEM_V3.TICK_SPACING;
      const spacingsToBot = r.ticks_to_lower / ETH_DIEM_V3.TICK_SPACING;
      return `- #${r.token_id} ${r.tick_range} | ${r.range_status} | il=${r.il_pct.toFixed(2)}% | fee_apr=${r.fee_apr_pct.toFixed(0)}% | net_pnl=$${r.net_pnl_usd.toFixed(0)} | signal=${r.recommended_action} | ${spacingsToTop.toFixed(1)} spacings to top, ${spacingsToBot.toFixed(1)} to bottom`;
    });

    const closedSorted = [...closed].sort((a, b) => (b.fee_apr_pct ?? 0) - (a.fee_apr_pct ?? 0));

    const userPrompt = `PORTFOLIO SUMMARY (from Dune Q7591697):
- Total ever deployed: $${totalDeployed.toFixed(0)}
- Total fees earned: $${totalFees.toFixed(0)} (${totalDeployed > 0 ? ((totalFees / totalDeployed) * 100).toFixed(1) : 0}% of deployed)
- Active IL today: $${totalIL.toFixed(2)}
- Active positions: ${active.length} | Closed: ${closed.length}

ACTIVE POSITIONS:
${activeLines.join('\n') || '(none)'}

TOP CLOSED BY FEE APY:
${closedSorted.slice(0, 5).map(r =>
  `- #${r.token_id} ${r.tick_range} | fee_apr=${r.fee_apr_pct.toFixed(0)}% | il=${r.il_pct.toFixed(1)}% | net=$${r.net_pnl_usd.toFixed(0)}`
).join('\n') || '(none)'}`;

    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b', temperature: 0.3, max_tokens: 2000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
    });

    return response.choices[0]?.message?.content ?? '(no response)';
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const argv   = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');

  const duneApiKey = process.env['DUNE_API_KEY'];
  if (!duneApiKey) throw new Error('DUNE_API_KEY env var required');

  let signer: Signer;
  if (process.env['PRIVY_APP_ID']) {
    signer = await loadSignerFromPrivy(loadPrivyConfig());
  } else {
    signer = loadSignerFromEnv();
  }

  const today = new Date().toISOString().slice(0, 10);
  console.log(`\nLP Analysis — ${today}`);
  console.log(`Dune source: Q${DUNE_QUERY_ID} (master portfolio v3 incremental)\n`);

  console.log(`Executing Dune Q${DUNE_QUERY_ID} and waiting for results...`);
  const rows   = await fetchDuneResults(DUNE_QUERY_ID, duneApiKey);
  const active = rows.filter(r => r.is_active);
  const closed = rows.filter(r => !r.is_active);

  console.log(`  ${rows.length} positions loaded (${active.length} active, ${closed.length} closed)`);

  const totalDeployed = rows.reduce((s, r) => s + (r.dep_usd ?? 0), 0);
  const totalFees     = rows.reduce((s, r) => s + (r.fee_usd ?? 0), 0);
  const totalIL       = active.reduce((s, r) => s + (r.il_usd ?? 0), 0);

  console.log('\n--- Performance Summary (pre-computed by Dune) ---');
  console.log(`Total deployed:    $${totalDeployed.toFixed(0)}`);
  console.log(`Total fees earned: $${totalFees.toFixed(0)} (${totalDeployed > 0 ? ((totalFees / totalDeployed) * 100).toFixed(1) : 0}%)`);
  console.log(`Active IL today:   $${totalIL.toFixed(2)}`);
  console.log(`Net active PnL:    $${active.reduce((s, r) => s + r.net_pnl_usd, 0).toFixed(2)} (fees − IL)`);

  console.log(`\n${'ID'.padEnd(10)} ${'range'.padEnd(14)} ${'status'.padEnd(12)} ${'fee APY'.padEnd(9)} ${'IL%'.padEnd(7)} signal`);
  console.log('-'.repeat(72));
  for (const r of rows) {
    console.log(
      `${r.token_id.padEnd(10)} ${r.tick_range.padEnd(14)} ${(r.range_status ?? r.status ?? '').padEnd(12)} ` +
      `${r.fee_apr_pct.toFixed(0).padEnd(8)}% ${r.il_pct.toFixed(1).padEnd(6)}% ${r.recommended_action ?? ''}`,
    );
  }

  console.log('\n--- Active Position Health ---');
  for (const r of active) {
    const spacingsToTop = r.ticks_to_upper / ETH_DIEM_V3.TICK_SPACING;
    const spacingsToBot = r.ticks_to_lower / ETH_DIEM_V3.TICK_SPACING;
    console.log(
      `  #${r.token_id} ${r.tick_range}: ${r.range_status} | ` +
      `${spacingsToTop.toFixed(1)} spacings to top, ${spacingsToBot.toFixed(1)} to bottom` +
      (r.reposition_flag ? '  ⚠ REPOSITION' : ''),
    );
  }

  if (dryRun) {
    console.log('\n[--dry-run] Skipping Venice AI and Dune strategy log update.');
    return;
  }

  console.log('\nQuerying Venice AI...');
  const analysis = await analyzeWithVenice(rows, signer);
  console.log('\n' + '='.repeat(70));
  console.log('VENICE AI ANALYSIS');
  console.log('='.repeat(70));
  console.log(analysis);
  console.log('='.repeat(70));

  mkdirSync('memory', { recursive: true });
  const outPath = `memory/lp-analysis-${today}.md`;

  const md = [
    `# LP Analysis — ${today}`,
    ``,
    `**Dune source:** Q${DUNE_QUERY_ID} (master portfolio v3 incremental, fresh execution)`,
    ``,
    `## Portfolio Summary`,
    `- Total deployed: $${totalDeployed.toFixed(0)}`,
    `- Total fees: $${totalFees.toFixed(0)} (${totalDeployed > 0 ? ((totalFees / totalDeployed) * 100).toFixed(1) : 0}%)`,
    `- Active IL: $${totalIL.toFixed(2)}`,
    `- Net active PnL (fees − IL): $${active.reduce((s, r) => s + r.net_pnl_usd, 0).toFixed(2)}`,
    ``,
    `## Per-Position Metrics`,
    `| Token ID | Range | Status | Fee APY | IL% | Net PnL | Signal |`,
    `|----------|-------|--------|---------|-----|---------|--------|`,
    ...rows.map(r =>
      `| ${r.token_id} | ${r.tick_range} | ${r.range_status ?? r.status ?? ''} | ${r.fee_apr_pct.toFixed(0)}% | ${r.il_pct.toFixed(1)}% | $${r.net_pnl_usd.toFixed(0)} | ${r.recommended_action ?? ''} |`
    ),
    ``,
    `## Venice AI Recommendations`,
    ``,
    analysis,
    ``,
  ].join('\n');

  writeFileSync(outPath, md);
  console.log(`\nSaved to ${outPath}`);

  await updateStrategyLog(today, totalIL, totalFees, analysis, duneApiKey);
}

main().catch(err => { console.error(err); process.exit(1); });
