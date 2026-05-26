/**
 * scripts/analyze-lp.ts
 *
 * Fetches LP position history from Dune, computes performance metrics
 * (including impermanent loss for active positions via on-chain LP math),
 * then sends findings to Venice AI for strategy recommendations.
 *
 * Writes a dated analysis to memory/lp-analysis-YYYY-MM-DD.md and updates
 * the Dune strategy log (Q7582817) via REST API so the dashboard stays current.
 *
 * Usage:
 *   node --env-file=.env --import tsx scripts/analyze-lp.ts
 *   node --env-file=.env --import tsx scripts/analyze-lp.ts --dry-run   # skip Venice + Dune write
 *   node --env-file=.env --import tsx scripts/analyze-lp.ts --execute   # auto-reposition if recommended
 *
 * Env required: RPC_URL, AGENT_WALLET, DUNE_API_KEY
 * Wallet: loaded from PRIVY_* env if set, else AGENT_PRIVATE_KEY (Venice key derived from wallet)
 */

import { createPublicClient, http, type Address } from 'viem';
import { base } from 'viem/chains';
import { writeFileSync, mkdirSync } from 'node:fs';
import OpenAI from 'openai';
import { ADDRESSES, ETH_DIEM_V3 } from '../platform/constants.js';
import {
  loadPrivyConfig, loadSignerFromPrivy,
  loadSignerFromEnv,
  type Signer,
} from '../harness/safety/wallet.js';
import { withVeniceKey } from '../platform/venice-auth.js';

// ── Config ──────────────────────────────────────────────────────────────────

const DUNE_QUERY_ID       = 7582569;  // Per-Position Full Breakdown
const STRATEGY_LOG_QUERY  = 7582817;  // LP Strategy Log (agent updates each tick)
const DUNE_API            = 'https://api.dune.com/api/v1';

// What this agent is trying to do
const LP_GOALS = {
  primary:      'Accumulate WETH and DIEM via LP fee income from the WETH/DIEM 1% pool',
  rule:         'Fee APR must exceed IL rate for LP to outperform simply holding',
  reposition:   'Flag reposition if current tick is within 2 spacings (400 ticks) of any range boundary',
  compound:     'Compound fee income into new LP positions or hold as WETH/DIEM treasury',
};

// ── Types ────────────────────────────────────────────────────────────────────

type DuneRow = {
  token_id:         string;
  tick_range:       string;
  opened_date:      string;
  status_or_close:  string;
  status:           string;
  dep_weth:         number;
  dep_diem:         number;
  dep_usd:          number;
  dec_weth:         number;
  dec_diem:         number;
  dec_usd:          number;
  fee_weth:         number;
  fee_diem:         number;
  fee_usd:          number;
  realized_pnl_usd: number | null;
};

type PositionMetrics = DuneRow & {
  days_open:    number;
  fee_apy_pct:  number;
  il_usd:       number;      // positive = LP underperforms holding
  il_pct:       number;
  net_pnl_usd:  number;      // fee_usd - il_usd
  tick_lower:   number;
  tick_upper:   number;
  range_width:  number;
};

type OnChainState = {
  currentTick:   number;
  sqrtPriceX96:  bigint;
  diemPerWeth:   number;
  ethUsdApprox:  number;
  activePositions: Array<{
    tokenId:    string;
    tickLower:  number;
    tickUpper:  number;
    liquidity:  bigint;
    inRange:    boolean;
  }>;
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
  // Truncate analysis to ~600 chars, escape single quotes for SQL VALUES literal
  const notes = analysis.slice(0, 600).replace(/\n+/g, ' ').replace(/'/g, "''");

  const sql = `-- Autonomopoly LP Strategy Log
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
            'GOALS: Accumulate WETH and DIEM via LP fee income. Target fee APR > IL rate. STRATEGY: Wide ranges (1200-3200, 2000-4000). All 3 positions in range. IL ~$168.'
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

// ── On-chain state ────────────────────────────────────────────────────────────

const SLOT0_ABI = [{
  name: 'slot0', type: 'function', stateMutability: 'view',
  inputs: [],
  outputs: [
    { name: 'sqrtPriceX96', type: 'uint160' },
    { name: 'tick',         type: 'int24'   },
    { name: 'observationIndex',           type: 'uint16' },
    { name: 'observationCardinality',     type: 'uint16' },
    { name: 'observationCardinalityNext', type: 'uint16' },
    { name: 'feeProtocol', type: 'uint8'  },
    { name: 'unlocked',    type: 'bool'   },
  ],
}] as const;

const NFPM_ABI = [{
  name: 'positions', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'tokenId', type: 'uint256' }],
  outputs: [
    { name: 'nonce',                    type: 'uint96'  },
    { name: 'operator',                 type: 'address' },
    { name: 'token0',                   type: 'address' },
    { name: 'token1',                   type: 'address' },
    { name: 'fee',                      type: 'uint24'  },
    { name: 'tickLower',                type: 'int24'   },
    { name: 'tickUpper',                type: 'int24'   },
    { name: 'liquidity',                type: 'uint128' },
    { name: 'feeGrowthInside0LastX128', type: 'uint256' },
    { name: 'feeGrowthInside1LastX128', type: 'uint256' },
    { name: 'tokensOwed0',              type: 'uint128' },
    { name: 'tokensOwed1',              type: 'uint128' },
  ],
}, {
  name: 'balanceOf', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'owner', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }],
}, {
  name: 'tokenOfOwnerByIndex', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'owner', type: 'address' }, { name: 'index', type: 'uint256' }],
  outputs: [{ name: '', type: 'uint256' }],
}] as const;

async function fetchOnChainState(rpcUrl: string, agentAddress: Address): Promise<OnChainState> {
  const client = createPublicClient({ chain: base, transport: http(rpcUrl) });

  const slot0 = await client.readContract({
    address: ADDRESSES.ETH_DIEM_V3, abi: SLOT0_ABI, functionName: 'slot0',
  });
  const currentTick  = slot0[1];
  const sqrtPriceX96 = slot0[0];
  const sqrtF        = Number(sqrtPriceX96) / 2 ** 96;
  const diemPerWeth  = sqrtF * sqrtF;
  const ethUsdApprox = 2500; // fallback; Dune query uses real oracle price

  const nfpmBal = await client.readContract({
    address: ADDRESSES.NFPM_V3, abi: NFPM_ABI, functionName: 'balanceOf', args: [agentAddress],
  });

  const activePositions: OnChainState['activePositions'] = [];
  for (let i = 0n; i < nfpmBal; i++) {
    const tokenId = await client.readContract({
      address: ADDRESSES.NFPM_V3, abi: NFPM_ABI,
      functionName: 'tokenOfOwnerByIndex', args: [agentAddress, i],
    });
    const pos = await client.readContract({
      address: ADDRESSES.NFPM_V3, abi: NFPM_ABI, functionName: 'positions', args: [tokenId],
    });
    const [,,,, , tickLower, tickUpper, liquidity] = pos;
    if (liquidity > 0n) {
      activePositions.push({
        tokenId: tokenId.toString(), tickLower, tickUpper, liquidity,
        inRange: currentTick >= tickLower && currentTick <= tickUpper,
      });
    }
  }

  return { currentTick, sqrtPriceX96, diemPerWeth, ethUsdApprox, activePositions };
}

// ── Uniswap V3 LP math ────────────────────────────────────────────────────────

function computePositionAmounts(
  liquidity: bigint,
  tickLower: number,
  tickUpper: number,
  sqrtPriceX96: bigint,
): { weth: number; diem: number } {
  const sqrtPrice = Number(sqrtPriceX96) / 2 ** 96;
  const sqrtLower = Math.pow(1.0001, tickLower / 2);
  const sqrtUpper = Math.pow(1.0001, tickUpper / 2);
  const liq       = Number(liquidity);
  const curTick   = Math.floor(Math.log(sqrtPrice * sqrtPrice) / Math.log(1.0001));

  let weth: number;
  let diem: number;

  if (curTick < tickLower) {
    weth = liq * (sqrtUpper - sqrtLower) / (sqrtLower * sqrtUpper) / 1e18;
    diem = 0;
  } else if (curTick >= tickUpper) {
    weth = 0;
    diem = liq * (sqrtUpper - sqrtLower) / 1e18;
  } else {
    weth = liq * (sqrtUpper - sqrtPrice) / (sqrtPrice * sqrtUpper) / 1e18;
    diem = liq * (sqrtPrice - sqrtLower) / 1e18;
  }

  return { weth, diem };
}

// ── Metrics computation ───────────────────────────────────────────────────────

function parseTickRange(tickRange: string): [number, number] {
  const m = tickRange.match(/\[(-?\d+),(-?\d+)\]/);
  if (!m) return [0, 0];
  return [parseInt(m[1]!), parseInt(m[2]!)];
}

function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1).getTime();
  const d2 = new Date(date2).getTime();
  return Math.max(1, Math.round(Math.abs(d2 - d1) / 86400000));
}

function computeMetrics(rows: DuneRow[], today: string, onChain: OnChainState): PositionMetrics[] {
  const ethUsd = onChain.ethUsdApprox;
  // DIEM price in USD: 1 DIEM = 1/diemPerWeth WETH = ethUsd / diemPerWeth USD
  const diemUsd = onChain.diemPerWeth > 0 ? ethUsd / onChain.diemPerWeth : 0;

  return rows.map(row => {
    const closeDate   = row.status === 'Closed' ? row.status_or_close : today;
    const days_open   = daysBetween(row.opened_date, closeDate);
    const [tickLower, tickUpper] = parseTickRange(row.tick_range);
    const range_width = tickUpper - tickLower;

    const fee_apy_pct = row.dep_usd > 0
      ? (row.fee_usd / row.dep_usd) / days_open * 365 * 100
      : 0;

    let il_usd = 0;
    let il_pct = 0;

    if (row.status === 'Closed') {
      // For closed: il = principal returned minus deposited (negative = lost principal)
      il_usd = row.dec_usd - row.dep_usd;
      il_pct = row.dep_usd > 0 ? (il_usd / row.dep_usd) * 100 : 0;
    } else {
      // For active: compute HODL value vs current LP value using on-chain LP math
      const pos = onChain.activePositions.find(p => p.tokenId === row.token_id);
      if (pos) {
        const { weth: curWeth, diem: curDiem } = computePositionAmounts(
          pos.liquidity, pos.tickLower, pos.tickUpper, onChain.sqrtPriceX96,
        );
        const hodlValue = row.dep_weth * ethUsd + row.dep_diem * diemUsd;
        const lpValue   = curWeth * ethUsd + curDiem * diemUsd;
        il_usd = hodlValue - lpValue;  // positive = LP worth less than holding
        il_pct = hodlValue > 0 ? (il_usd / hodlValue) * 100 : 0;
      }
    }

    const net_pnl_usd = row.fee_usd - il_usd;

    return {
      ...row,
      days_open, fee_apy_pct,
      il_usd, il_pct, net_pnl_usd,
      tick_lower: tickLower, tick_upper: tickUpper, range_width,
    };
  });
}

// ── Venice AI analysis ────────────────────────────────────────────────────────

async function analyzeWithVenice(
  metrics: PositionMetrics[],
  onChain: OnChainState,
  signer: Signer,
): Promise<string> {
  return withVeniceKey(signer, async (apiKey) => {
    const client = new OpenAI({ apiKey, baseURL: 'https://api.venice.ai/api/v1' });

    const closed  = metrics.filter(m => m.status === 'Closed');
    const active  = metrics.filter(m => m.status !== 'Closed');

    const totalDeployed  = metrics.reduce((s, m) => s + m.dep_usd, 0);
    const totalFees      = metrics.reduce((s, m) => s + m.fee_usd, 0);
    const totalIL        = active.reduce((s, m) => s + m.il_usd, 0);
    const realizedPnl    = closed.reduce((s, m) => s + (m.realized_pnl_usd ?? 0), 0);

    const sortedByFeeApy = [...closed].sort((a, b) => b.fee_apy_pct - a.fee_apy_pct);
    const sortedByPnl    = [...closed].sort((a, b) => (b.realized_pnl_usd ?? 0) - (a.realized_pnl_usd ?? 0));

    const systemPrompt = `You are an autonomous DeFi LP agent analyzing your own performance on the WETH/DIEM 1% Uniswap V3 pool on Base mainnet. Your primary goal is to accumulate WETH and DIEM through LP fee income.

PRIMARY GOAL: ${LP_GOALS.primary}
PROFITABILITY RULE: ${LP_GOALS.rule}
REPOSITION TRIGGER: ${LP_GOALS.reposition}
COMPOUNDING: ${LP_GOALS.compound}

Pool: WETH/DIEM (token0=WETH, token1=DIEM). Fee tier: 1%. Tick spacing: 200.
Current tick: ${onChain.currentTick}
Current DIEM/WETH ratio: ${onChain.diemPerWeth.toFixed(6)} DIEM per WETH

Active positions:
${onChain.activePositions.map(p => {
  const spacingsToTop    = (p.tickUpper - onChain.currentTick) / ETH_DIEM_V3.TICK_SPACING;
  const spacingsToBottom = (onChain.currentTick - p.tickLower) / ETH_DIEM_V3.TICK_SPACING;
  return `- tokenId ${p.tokenId}: [${p.tickLower},${p.tickUpper}] ${p.inRange ? '✓ IN RANGE' : '✗ OUT OF RANGE'} | ${spacingsToTop.toFixed(1)} spacings to top, ${spacingsToBottom.toFixed(1)} to bottom`;
}).join('\n')}

ANALYSIS GOALS:
1. Is fee APR exceeding IL rate on active positions? (fee APR is currently 0% since no collects yet — evaluate when to expect first fees)
2. Which historical tick ranges produced the best fee APY with the least IL?
3. Should any active position be repositioned? Give specific tick boundaries (must be multiples of 200).
4. What should the NEXT LP deployment target? Specific ticks, specific capital amount in WETH and DIEM.
5. Any timing patterns in when fees peak that the agent should exploit?

Output ONLY these sections: FINDINGS | CURRENT POSITIONS | NEXT DEPLOYMENT | RULES TO ADOPT`;

    const userPrompt = `PORTFOLIO SUMMARY:
- Total ever deployed: $${totalDeployed.toFixed(0)}
- Total fees earned: $${totalFees.toFixed(0)} (${totalDeployed > 0 ? ((totalFees / totalDeployed) * 100).toFixed(1) : 0}% of deployed)
- Realized PnL (closed positions): $${realizedPnl.toFixed(0)}
- Active capital: $${active.reduce((s, m) => s + m.dep_usd, 0).toFixed(0)}
- Active IL today: $${totalIL.toFixed(2)} (${totalDeployed > 0 ? ((totalIL / active.reduce((s, m) => s + m.dep_usd, 0)) * 100).toFixed(2) : 0}% of active capital)
- Net PnL on active (fees - IL): $${active.reduce((s, m) => s + m.net_pnl_usd, 0).toFixed(2)}

TOP 3 CLOSED BY FEE APY:
${sortedByFeeApy.slice(0, 3).map(m =>
  `- #${m.token_id} ${m.tick_range} | days=${m.days_open} | fee_apy=${m.fee_apy_pct.toFixed(0)}% | fees=$${m.fee_usd.toFixed(0)} | IL=$${m.il_usd.toFixed(0)} | net_pnl=$${m.net_pnl_usd.toFixed(0)}`
).join('\n')}

WORST 3 CLOSED BY NET PNL:
${sortedByPnl.slice(-3).reverse().map(m =>
  `- #${m.token_id} ${m.tick_range} | days=${m.days_open} | fee_apy=${m.fee_apy_pct.toFixed(0)}% | IL=$${m.il_usd.toFixed(0)} | net_pnl=$${m.net_pnl_usd.toFixed(0)}`
).join('\n')}

ALL CLOSED POSITIONS:
${closed.map(m =>
  `#${m.token_id} ${m.tick_range} | dep=$${m.dep_usd.toFixed(0)} | days=${m.days_open} | fee_apy=${m.fee_apy_pct.toFixed(0)}% | IL=$${m.il_usd.toFixed(0)} (${m.il_pct.toFixed(1)}%) | net=$${m.net_pnl_usd.toFixed(0)}`
).join('\n')}

ACTIVE POSITIONS (IL computed from live on-chain LP math):
${active.map(m =>
  `#${m.token_id} ${m.tick_range} | dep=$${m.dep_usd.toFixed(0)} | days_open=${m.days_open} | IL=$${m.il_usd.toFixed(2)} (${m.il_pct.toFixed(3)}%) | fees_so_far=$${m.fee_usd.toFixed(0)} | net=$${m.net_pnl_usd.toFixed(2)}`
).join('\n')}`;

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
  const argv    = process.argv.slice(2);
  const dryRun  = argv.includes('--dry-run');

  const rpcUrl       = process.env['RPC_URL'] ?? 'https://mainnet.base.org';
  const agentAddress = process.env['AGENT_WALLET'] as Address | undefined;
  const duneApiKey   = process.env['DUNE_API_KEY'];

  if (!agentAddress) throw new Error('AGENT_WALLET env var required');
  if (!duneApiKey)   throw new Error('DUNE_API_KEY env var required');

  let signer: Signer;
  if (process.env['PRIVY_APP_ID']) {
    signer = await loadSignerFromPrivy(loadPrivyConfig());
  } else {
    signer = loadSignerFromEnv();
  }

  const today = new Date().toISOString().slice(0, 10);
  console.log(`\nLP Analysis — ${today}`);
  console.log(`Agent: ${agentAddress}`);
  console.log(`Goal:  ${LP_GOALS.primary}\n`);

  // ── 1. Fetch data ──────────────────────────────────────────────────────────
  console.log('Fetching Dune position history...');
  const rows = await fetchDuneResults(DUNE_QUERY_ID, duneApiKey);
  console.log(`  ${rows.length} positions loaded`);

  console.log('Fetching on-chain state...');
  const onChain = await fetchOnChainState(rpcUrl, agentAddress);
  console.log(`  Current tick: ${onChain.currentTick}`);
  console.log(`  Active positions: ${onChain.activePositions.length}`);

  // ── 2. Compute metrics (IL for active positions via LP math) ───────────────
  const metrics = computeMetrics(rows, today, onChain);
  const closed  = metrics.filter(m => m.status === 'Closed');
  const active  = metrics.filter(m => m.status !== 'Closed');

  const totalFees     = metrics.reduce((s, m) => s + m.fee_usd, 0);
  const totalDeployed = metrics.reduce((s, m) => s + m.dep_usd, 0);
  const totalIL       = active.reduce((s, m) => s + m.il_usd, 0);
  const realizedPnl   = closed.reduce((s, m) => s + (m.realized_pnl_usd ?? 0), 0);

  console.log('\n--- Performance Summary ---');
  console.log(`Total deployed:    $${totalDeployed.toFixed(0)}`);
  console.log(`Total fees earned: $${totalFees.toFixed(0)} (${totalDeployed > 0 ? ((totalFees / totalDeployed) * 100).toFixed(1) : 0}%)`);
  console.log(`Active IL today:   $${totalIL.toFixed(2)}`);
  console.log(`Realized PnL:      $${realizedPnl.toFixed(0)}`);
  console.log(`Net active PnL:    $${active.reduce((s, m) => s + m.net_pnl_usd, 0).toFixed(2)} (fees - IL)`);

  console.log(`\n${'ID'.padEnd(10)} ${'range'.padEnd(14)} ${'days'.padEnd(5)} ${'fee APY'.padEnd(9)} ${'IL $'.padEnd(10)} ${'net PnL'}`);
  console.log('-'.repeat(70));
  for (const m of metrics) {
    const pnl = m.realized_pnl_usd !== null ? `$${m.realized_pnl_usd.toFixed(0)}` : `$${m.net_pnl_usd.toFixed(0)} (active)`;
    console.log(
      `${m.token_id.padEnd(10)} ${m.tick_range.padEnd(14)} ${String(m.days_open).padEnd(5)} ` +
      `${m.fee_apy_pct.toFixed(0).padEnd(8)}% $${m.il_usd.toFixed(0).padEnd(8)} ${pnl}`,
    );
  }

  // ── 3. Active position health check ───────────────────────────────────────
  console.log('\n--- Active Position Check ---');
  for (const pos of onChain.activePositions) {
    const spacingsToTop    = (pos.tickUpper - onChain.currentTick) / ETH_DIEM_V3.TICK_SPACING;
    const spacingsToBottom = (onChain.currentTick - pos.tickLower) / ETH_DIEM_V3.TICK_SPACING;
    const needsReposition  = spacingsToTop <= 2 || spacingsToBottom <= 2;
    console.log(
      `  tokenId ${pos.tokenId}: [${pos.tickLower},${pos.tickUpper}] tick=${onChain.currentTick} ` +
      `${pos.inRange ? '✓ in range' : '✗ OUT OF RANGE'} ` +
      `(${spacingsToTop.toFixed(1)} spacings to top, ${spacingsToBottom.toFixed(1)} to bottom)` +
      (needsReposition ? '  ⚠ REPOSITION CANDIDATE' : ''),
    );
  }

  if (dryRun) {
    console.log('\n[--dry-run] Skipping Venice AI and Dune strategy log update.');
    return;
  }

  // ── 4. Venice AI analysis ──────────────────────────────────────────────────
  console.log('\nQuerying Venice AI for LP strategy analysis...');
  const analysis = await analyzeWithVenice(metrics, onChain, signer);
  console.log('\n' + '='.repeat(70));
  console.log('VENICE AI ANALYSIS');
  console.log('='.repeat(70));
  console.log(analysis);
  console.log('='.repeat(70));

  // ── 5. Write to memory ─────────────────────────────────────────────────────
  mkdirSync('memory', { recursive: true });
  const outPath = `memory/lp-analysis-${today}.md`;

  const md = [
    `# LP Analysis — ${today}`,
    ``,
    `## Goals`,
    `- Primary: ${LP_GOALS.primary}`,
    `- Rule: ${LP_GOALS.rule}`,
    ``,
    `## Portfolio Summary`,
    `- Total deployed: $${totalDeployed.toFixed(0)}`,
    `- Total fees: $${totalFees.toFixed(0)} (${totalDeployed > 0 ? ((totalFees / totalDeployed) * 100).toFixed(1) : 0}%)`,
    `- Active IL: $${totalIL.toFixed(2)}`,
    `- Realized PnL: $${realizedPnl.toFixed(0)}`,
    `- Net active PnL (fees − IL): $${active.reduce((s, m) => s + m.net_pnl_usd, 0).toFixed(2)}`,
    `- Current tick: ${onChain.currentTick}`,
    ``,
    `## Per-Position Metrics`,
    `| Token ID | Range | Days | Fee APY | IL $ | Net PnL |`,
    `|----------|-------|------|---------|------|---------|`,
    ...metrics.map(m =>
      `| ${m.token_id} | ${m.tick_range} | ${m.days_open} | ${m.fee_apy_pct.toFixed(0)}% | $${m.il_usd.toFixed(0)} | ${m.realized_pnl_usd !== null ? '$' + m.realized_pnl_usd.toFixed(0) : '$' + m.net_pnl_usd.toFixed(0) + ' (active)'} |`
    ),
    ``,
    `## Venice AI Recommendations`,
    ``,
    analysis,
    ``,
  ].join('\n');

  writeFileSync(outPath, md);
  console.log(`\nSaved to ${outPath}`);

  // ── 6. Update Dune strategy log ────────────────────────────────────────────
  await updateStrategyLog(today, totalIL, totalFees, analysis, duneApiKey);
}

main().catch(err => { console.error(err); process.exit(1); });
