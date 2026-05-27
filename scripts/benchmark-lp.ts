/**
 * scripts/benchmark-lp.ts
 *
 * Revert.finance-style LP performance calculator.
 *
 * For every position in memory/lp-positions.jsonl, computes:
 *   - Cost basis in USD (deposit amounts × prices at mint time)
 *   - Current LP value (on-chain LP math + uncollected fees + claimed fees)
 *   - HODL 50/50  — hold the exact initial WETH + DIEM, valued at current prices
 *   - HODL WETH   — convert everything to WETH at mint, hold to now (= "vs ETH" benchmark)
 *   - HODL DIEM   — convert everything to DIEM at mint, hold to now
 *   - vs USD      — cost basis in USD (did you beat the dollar?)
 *   - IL          — HODL 50/50 value minus LP value before fees
 *   - Fees        — sum of all Collect events attributable to fees (not principal)
 *   - Net P&L     — LP value minus cost basis
 *
 * Data sources:
 *   - Deposit amounts: memory/lp-positions.jsonl (exact wei, minted-at timestamp)
 *   - DIEM/WETH price at mint: pool slot0 at block ≈ mintedAt (Alchemy archive node)
 *   - ETH/USD price at mint: CoinGecko /coins/ethereum/history (free, no key)
 *   - Collect events: eth_getLogs on NFPM, filtered by tokenId (fees + close proceeds)
 *   - DecreaseLiquidity events: eth_getLogs on NFPM (to isolate principal from fees)
 *   - Current pool state: slot0() live call
 *   - Current LP amounts: Uniswap v3 LP math from on-chain liquidity + tick
 *
 * Usage:
 *   node --env-file=.env --import tsx scripts/benchmark-lp.ts
 *   node --env-file=.env --import tsx scripts/benchmark-lp.ts --json
 *   node --env-file=.env --import tsx scripts/benchmark-lp.ts --active-only
 */

import { createPublicClient, http, parseAbiItem, type Address } from 'viem';
import { base } from 'viem/chains';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { ADDRESSES } from '../platform/constants.js';

// ── Config ────────────────────────────────────────────────────────────────────

// Earliest block any agent position could exist. Saves getLogs scan time.
// Position #5119885 minted ~2026-05-14 ≈ block 45,900,000 on Base.
const FROM_BLOCK = 45_900_000n;

// ── Types ─────────────────────────────────────────────────────────────────────

type LpPositionRecord = {
  tokenId:           string;
  mintedAt:          string;   // ISO-8601
  tickLower:         number;
  tickUpper:         number;
  wethDeposited:     string;   // wei string
  diemDeposited:     string;   // wei string
  replacedTokenId?:  string;
};

type PositionBenchmark = {
  tokenId:         string;
  mintedAt:        string;
  range:           string;
  active:          boolean;

  // Mint-time prices
  ethUsdAtMint:    number;
  diemPerWethAtMint: number;
  diemUsdAtMint:   number;
  costBasisUsd:    number;     // deposit amounts × mint-time USD prices

  // Current prices
  ethUsdNow:       number;
  diemPerWethNow:  number;
  diemUsdNow:      number;

  // LP position value today
  curWeth:         number;     // from on-chain LP math (active) or 0 (closed)
  curDiem:         number;
  uncollectedWeth: number;     // tokensOwed0
  uncollectedDiem: number;     // tokensOwed1
  feesWeth:        number;     // from Collect events minus principal returned
  feesDiem:        number;
  lpValueUsd:      number;     // curWeth + uncollected + fees, in USD

  // Benchmarks (valued at current prices)
  hodl5050Usd:   number;       // hold initial WETH + DIEM at today's prices
  hodlWethUsd:   number;       // convert all to WETH at mint, hold to now (= vs ETH)
  hodlDiemUsd:   number;       // convert all to DIEM at mint, hold to now
  vsUsdBaseline: number;       // cost basis (beat the dollar?)

  // Derived
  ilUsd:         number;       // HODL 50/50 - (LP value before fees)
  ilPct:         number;
  feesUsd:       number;
  netPnlUsd:     number;       // LP value - cost basis
  netPnlPct:     number;
  vsHodl5050:    number;       // LP outperformance vs simple hold
  vsHodlWeth:    number;       // LP outperformance vs holding ETH
  vsHodlDiem:    number;
  daysOpen:      number;
  feeAprPct:     number;       // annualised fee APR over hold period
};

// ── ABIs ──────────────────────────────────────────────────────────────────────

const SLOT0_ABI = [parseAbiItem(
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)'
)] as const;

const POSITIONS_ABI = [parseAbiItem(
  'function positions(uint256 tokenId) view returns (uint96, address, address, address, uint24, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256, uint256, uint128 tokensOwed0, uint128 tokensOwed1)'
)] as const;

const COLLECT_EVENT = parseAbiItem(
  'event Collect(uint256 indexed tokenId, address recipient, uint256 amount0Collect, uint256 amount1Collect)'
);

const DECREASE_EVENT = parseAbiItem(
  'event DecreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)'
);

// Emitted by NFPM on every addLiquidity/mint — the authoritative deposited amounts.
const INCREASE_EVENT = parseAbiItem(
  'event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)'
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function fromWei(wei: string | bigint): number {
  return Number(BigInt(wei)) / 1e18;
}

/** sqrtPriceX96 → DIEM per WETH  (token1/token0, both 18-decimal) */
function sqrtToPrice(sqrtPriceX96: bigint): number {
  const q96 = 2 ** 96;
  const sqrtP = Number(sqrtPriceX96) / q96;
  return sqrtP * sqrtP;
}

/** Uniswap v3 LP math — amounts of token0 (WETH) and token1 (DIEM) in a position */
function positionAmounts(
  liquidity: bigint,
  tickLower: number,
  tickUpper: number,
  sqrtPriceX96: bigint,
): { weth: number; diem: number } {
  if (liquidity === 0n) return { weth: 0, diem: 0 };

  const sqrtP     = Number(sqrtPriceX96) / 2 ** 96;
  const sqrtLower = Math.pow(1.0001, tickLower / 2);
  const sqrtUpper = Math.pow(1.0001, tickUpper / 2);
  const liq       = Number(liquidity);

  const curTick = Math.round(Math.log(sqrtP * sqrtP) / Math.log(1.0001));

  if (curTick < tickLower) {
    return {
      weth: liq * (sqrtUpper - sqrtLower) / (sqrtLower * sqrtUpper) / 1e18,
      diem: 0,
    };
  }
  if (curTick >= tickUpper) {
    return {
      weth: 0,
      diem: liq * (sqrtUpper - sqrtLower) / 1e18,
    };
  }
  return {
    weth: liq * (sqrtUpper - sqrtP) / (sqrtP * sqrtUpper) / 1e18,
    diem: liq * (sqrtP - sqrtLower) / 1e18,
  };
}

/** Estimate block number closest to a Unix timestamp using current block as anchor. */
async function blockAtTimestamp(
  targetTs: number,
  client: ReturnType<typeof createPublicClient>,
): Promise<bigint> {
  const latestBlock = await client.getBlock({ blockTag: 'latest' });
  const latestTs    = Number(latestBlock.timestamp);
  const latestNum   = latestBlock.number;

  const BASE_BLOCK_TIME = 2; // ~2s per block on Base
  const delta = Math.round((latestTs - targetTs) / BASE_BLOCK_TIME);
  const estimated = latestNum - BigInt(delta);

  // Clamp to a reasonable minimum
  return estimated < FROM_BLOCK ? FROM_BLOCK : estimated;
}

/** Pool slot0 at a specific historical block. */
async function slot0AtBlock(
  blockNum: bigint,
  client: ReturnType<typeof createPublicClient>,
): Promise<bigint> {
  const result = await client.readContract({
    address: ADDRESSES.ETH_DIEM_V3,
    abi: SLOT0_ABI,
    functionName: 'slot0',
    blockNumber: blockNum,
  });
  return result[0]; // sqrtPriceX96
}

/** ETH/USD price for a given date string (YYYY-MM-DD) via CoinGecko free API. */
const ethUsdCache = new Map<string, number>();

async function ethUsdAtDate(dateStr: string): Promise<number> {
  if (ethUsdCache.has(dateStr)) return ethUsdCache.get(dateStr)!;

  // CoinGecko needs DD-MM-YYYY
  const [y, m, d] = dateStr.split('-');
  const cgDate    = `${d}-${m}-${y}`;

  const url = `https://api.coingecko.com/api/v3/coins/ethereum/history?date=${cgDate}&localization=false`;
  const resp = await fetch(url, { headers: { accept: 'application/json' } });

  if (!resp.ok) throw new Error(`CoinGecko ${dateStr} failed: ${resp.status}`);

  const data = await resp.json() as {
    market_data?: { current_price?: { usd?: number } };
  };

  const price = data.market_data?.current_price?.usd;
  if (!price) throw new Error(`CoinGecko returned no price for ${dateStr}`);

  ethUsdCache.set(dateStr, price);

  // Respect free-tier rate limit (30 req/min)
  await new Promise(r => setTimeout(r, 2500));
  return price;
}

/** Sum of Collect event amounts for a tokenId (includes fees + principal on close). */
async function collectTotals(
  tokenId: bigint,
  client: ReturnType<typeof createPublicClient>,
): Promise<{ weth: number; diem: number }> {
  const logs = await client.getLogs({
    address: ADDRESSES.NFPM_V3,
    event:   COLLECT_EVENT,
    args:    { tokenId },
    fromBlock: FROM_BLOCK,
    toBlock:   'latest',
  });

  let weth = 0;
  let diem = 0;
  for (const log of logs) {
    weth += fromWei(log.args.amount0Collect ?? 0n);
    diem += fromWei(log.args.amount1Collect ?? 0n);
  }
  return { weth, diem };
}

/** Sum of DecreaseLiquidity amounts for a tokenId (= principal returned). */
async function decreaseTotals(
  tokenId: bigint,
  client: ReturnType<typeof createPublicClient>,
): Promise<{ weth: number; diem: number }> {
  const logs = await client.getLogs({
    address: ADDRESSES.NFPM_V3,
    event:   DECREASE_EVENT,
    args:    { tokenId },
    fromBlock: FROM_BLOCK,
    toBlock:   'latest',
  });

  let weth = 0;
  let diem = 0;
  for (const log of logs) {
    weth += fromWei(log.args.amount0 ?? 0n);
    diem += fromWei(log.args.amount1 ?? 0n);
  }
  return { weth, diem };
}

/** Actual WETH+DIEM deposited for a tokenId — from IncreaseLiquidity events (authoritative). */
async function mintedAmounts(
  tokenId: bigint,
  client: ReturnType<typeof createPublicClient>,
): Promise<{ weth: number; diem: number }> {
  const logs = await client.getLogs({
    address: ADDRESSES.NFPM_V3,
    event:   INCREASE_EVENT,
    args:    { tokenId },
    fromBlock: FROM_BLOCK,
    toBlock:   'latest',
  });
  let weth = 0;
  let diem = 0;
  for (const log of logs) {
    weth += fromWei(log.args.amount0 ?? 0n);
    diem += fromWei(log.args.amount1 ?? 0n);
  }
  return { weth, diem };
}

// ── Main per-position analysis ────────────────────────────────────────────────

async function benchmarkPosition(
  rec: LpPositionRecord,
  currentSqrtPriceX96: bigint,
  ethUsdNow: number,
  client: ReturnType<typeof createPublicClient>,
): Promise<PositionBenchmark> {
  const tokenId  = BigInt(rec.tokenId);
  const mintTs   = Math.floor(new Date(rec.mintedAt).getTime() / 1000);
  const mintDate = rec.mintedAt.slice(0, 10);
  const today    = new Date().toISOString().slice(0, 10);
  const daysOpen = Math.max(1, (Date.now() / 1000 - mintTs) / 86400);

  // Use on-chain IncreaseLiquidity for actual deposited amounts (lp-positions.jsonl
  // records desired amounts, which may exceed what Uniswap V3 actually accepts).
  const minted  = await mintedAmounts(tokenId, client);
  const wethDep = minted.weth || fromWei(rec.wethDeposited ?? '0');
  const diemDep = minted.diem || fromWei(rec.diemDeposited ?? '0');

  // ── 1. Historical prices at mint ─────────────────────────────────────────

  const mintBlock           = await blockAtTimestamp(mintTs, client);
  const sqrtAtMint          = await slot0AtBlock(mintBlock, client);
  const diemPerWethAtMint   = sqrtToPrice(sqrtAtMint);
  const ethUsdAtMint        = await ethUsdAtDate(mintDate);
  const diemUsdAtMint       = ethUsdAtMint / diemPerWethAtMint;

  const costBasisUsd = wethDep * ethUsdAtMint + diemDep * diemUsdAtMint;

  // ── 2. Current prices ────────────────────────────────────────────────────

  const diemPerWethNow = sqrtToPrice(currentSqrtPriceX96);
  const diemUsdNow     = ethUsdNow / diemPerWethNow;

  // ── 3. On-chain position state ───────────────────────────────────────────

  const posResult = await client.readContract({
    address: ADDRESSES.NFPM_V3,
    abi: POSITIONS_ABI,
    functionName: 'positions',
    args: [tokenId],
  });

  const liquidity    = posResult[7];
  const tokensOwed0  = posResult[10];
  const tokensOwed1  = posResult[11];
  const active       = liquidity > 0n;

  const { weth: curWeth, diem: curDiem } = positionAmounts(
    liquidity, rec.tickLower, rec.tickUpper, currentSqrtPriceX96
  );

  const uncollectedWeth = fromWei(tokensOwed0);
  const uncollectedDiem = fromWei(tokensOwed1);

  // ── 4. Collect + DecreaseLiquidity events ────────────────────────────────
  // Collect = fees + principal returned on close
  // DecreaseLiquidity = principal only
  // Fees = Collect - DecreaseLiquidity (clamped to 0)

  const [collected, decreased] = await Promise.all([
    collectTotals(tokenId, client),
    decreaseTotals(tokenId, client),
  ]);

  const feesWeth = Math.max(0, collected.weth - decreased.weth);
  const feesDiem = Math.max(0, collected.diem - decreased.diem);
  const feesUsd  = feesWeth * ethUsdNow + feesDiem * diemUsdNow;

  // ── 5. LP value ──────────────────────────────────────────────────────────
  // active: principal (curWeth/curDiem) + uncollected fees + previously claimed fees
  // closed: everything came through Collect events

  let lpValueUsd: number;
  if (active) {
    lpValueUsd = (curWeth + uncollectedWeth + feesWeth) * ethUsdNow
               + (curDiem + uncollectedDiem + feesDiem) * diemUsdNow;
  } else {
    lpValueUsd = collected.weth * ethUsdNow + collected.diem * diemUsdNow;
  }

  // ── 6. Benchmarks ────────────────────────────────────────────────────────

  // HODL 50/50: hold exact initial amounts at today's prices
  const hodl5050Usd = wethDep * ethUsdNow + diemDep * diemUsdNow;

  // HODL 100% WETH: convert all capital to WETH at mint, hold to now
  const totalWethAtMint = wethDep + diemDep / diemPerWethAtMint;
  const hodlWethUsd     = totalWethAtMint * ethUsdNow;

  // HODL 100% DIEM: convert all capital to DIEM at mint, hold to now
  const totalDiemAtMint = diemDep + wethDep * diemPerWethAtMint;
  const hodlDiemUsd     = totalDiemAtMint * diemUsdNow;

  const vsUsdBaseline = costBasisUsd;

  // ── 7. Derived metrics ────────────────────────────────────────────────────

  const lpBeforeFees = lpValueUsd - feesUsd;
  const ilUsd        = hodl5050Usd - lpBeforeFees;
  const ilPct        = costBasisUsd > 0 ? (ilUsd / costBasisUsd) * 100 : 0;

  const netPnlUsd = lpValueUsd - costBasisUsd;
  const netPnlPct = costBasisUsd > 0 ? (netPnlUsd / costBasisUsd) * 100 : 0;

  const vsHodl5050 = lpValueUsd - hodl5050Usd;
  const vsHodlWeth = lpValueUsd - hodlWethUsd;
  const vsHodlDiem = lpValueUsd - hodlDiemUsd;

  const feeAprPct = costBasisUsd > 0
    ? (feesUsd / costBasisUsd) * (365 / daysOpen) * 100
    : 0;

  return {
    tokenId:          rec.tokenId,
    mintedAt:         rec.mintedAt,
    range:            `[${rec.tickLower},${rec.tickUpper}]`,
    active,
    ethUsdAtMint,     diemPerWethAtMint, diemUsdAtMint, costBasisUsd,
    ethUsdNow,        diemPerWethNow,    diemUsdNow,
    curWeth, curDiem, uncollectedWeth, uncollectedDiem, feesWeth, feesDiem,
    lpValueUsd,
    hodl5050Usd, hodlWethUsd, hodlDiemUsd, vsUsdBaseline,
    ilUsd, ilPct, feesUsd, netPnlUsd, netPnlPct,
    vsHodl5050, vsHodlWeth, vsHodlDiem,
    daysOpen, feeAprPct,
  };
}

// ── Formatting ────────────────────────────────────────────────────────────────

function usd(n: number): string {
  const sign = n >= 0 ? '' : '-';
  return `${sign}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function pct(n: number): string { return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`; }
function tok(n: number, d = 4): string { return n.toFixed(d); }

function renderTable(results: PositionBenchmark[]): string {
  const lines: string[] = [];

  for (const r of results) {
    const status = r.active ? '✓ ACTIVE' : '✗ CLOSED';
    lines.push(`\n### #${r.tokenId} ${r.range} — ${status} (${r.daysOpen.toFixed(1)} days)`);
    lines.push(`**Minted:** ${r.mintedAt.slice(0, 16)}Z`);
    lines.push('');
    lines.push('**Cost basis at mint:**');
    lines.push(`| | WETH | DIEM | ETH/USD | DIEM/USD |`);
    lines.push(`|---|---|---|---|---|`);
    lines.push(`| Deposited | ${tok(r.curWeth)} WETH | ${tok(r.curDiem)} DIEM | — | — |`);
    lines.push(`| Mint prices | — | — | ${usd(r.ethUsdAtMint)} | ${usd(r.diemUsdAtMint)} |`);
    lines.push(`| **Cost basis** | | | **${usd(r.costBasisUsd)}** | |`);
    lines.push('');
    lines.push('**LP value today:**');
    lines.push(`| Component | WETH | DIEM | USD |`);
    lines.push(`|---|---|---|---|`);
    if (r.active) {
      lines.push(`| In position | ${tok(r.curWeth)} | ${tok(r.curDiem)} | ${usd(r.curWeth * r.ethUsdNow + r.curDiem * r.diemUsdNow)} |`);
      lines.push(`| Uncollected fees | ${tok(r.uncollectedWeth)} | ${tok(r.uncollectedDiem)} | ${usd(r.uncollectedWeth * r.ethUsdNow + r.uncollectedDiem * r.diemUsdNow)} |`);
    }
    lines.push(`| Claimed fees | ${tok(r.feesWeth)} | ${tok(r.feesDiem)} | ${usd(r.feesUsd)} |`);
    lines.push(`| **LP total** | | | **${usd(r.lpValueUsd)}** |`);
    lines.push('');
    lines.push('**Benchmarks (all at today\'s prices):**');
    lines.push(`| Strategy | Value | vs LP |`);
    lines.push(`|---|---|---|`);
    lines.push(`| LP (actual) | ${usd(r.lpValueUsd)} | — |`);
    lines.push(`| HODL 50/50 | ${usd(r.hodl5050Usd)} | ${pct((r.vsHodl5050/r.hodl5050Usd)*100)} |`);
    lines.push(`| HODL 100% WETH (vs ETH) | ${usd(r.hodlWethUsd)} | ${pct((r.vsHodlWeth/r.hodlWethUsd)*100)} |`);
    lines.push(`| HODL 100% DIEM | ${usd(r.hodlDiemUsd)} | ${pct((r.vsHodlDiem/r.hodlDiemUsd)*100)} |`);
    lines.push(`| vs USD (cost basis) | ${usd(r.vsUsdBaseline)} | ${pct(r.netPnlPct)} |`);
    lines.push('');
    lines.push('**P&L breakdown:**');
    lines.push(`| Metric | Value | % of cost |`);
    lines.push(`|---|---|---|`);
    lines.push(`| Impermanent loss | ${usd(-r.ilUsd)} | ${pct(-r.ilPct)} |`);
    lines.push(`| Fees earned | ${usd(r.feesUsd)} | ${pct(r.feeAprPct)} APR |`);
    lines.push(`| **Net P&L** | **${usd(r.netPnlUsd)}** | **${pct(r.netPnlPct)}** |`);
  }

  return lines.join('\n');
}

function printConsole(results: PositionBenchmark[]) {
  const W  = (s: string, n: number) => s.slice(0, n).padEnd(n);
  const RW = (s: string, n: number) => s.slice(0, n).padStart(n);

  console.log('\n' + '═'.repeat(110));
  console.log('LP BENCHMARK REPORT — AUTONOMOPOLY');
  console.log('═'.repeat(110));
  console.log(
    W('Token ID', 10) + W('Range', 14) + W('Days', 5) +
    RW('Cost $', 12) + RW('LP $', 12) +
    RW('HODL 50/50', 12) + RW('vs ETH', 10) +
    RW('IL $', 10) + RW('Fees $', 10) + RW('Net %', 9)
  );
  console.log('─'.repeat(110));

  for (const r of results) {
    const active = r.active ? '●' : '○';
    console.log(
      W(`${active} ${r.tokenId}`, 10) +
      W(r.range, 14) +
      W(r.daysOpen.toFixed(1), 5) +
      RW(usd(r.costBasisUsd), 12) +
      RW(usd(r.lpValueUsd), 12) +
      RW(usd(r.hodl5050Usd), 12) +
      RW(usd(r.hodlWethUsd), 10) +
      RW(usd(-r.ilUsd), 10) +
      RW(usd(r.feesUsd), 10) +
      RW(pct(r.netPnlPct), 9)
    );
  }

  console.log('─'.repeat(110));

  // Totals over active positions only
  const active = results.filter(r => r.active);
  if (active.length > 0) {
    const totalCost = active.reduce((s, r) => s + r.costBasisUsd, 0);
    const totalLp   = active.reduce((s, r) => s + r.lpValueUsd, 0);
    const totalHodl = active.reduce((s, r) => s + r.hodl5050Usd, 0);
    const totalHWeth = active.reduce((s, r) => s + r.hodlWethUsd, 0);
    const totalIl   = active.reduce((s, r) => s + r.ilUsd, 0);
    const totalFees = active.reduce((s, r) => s + r.feesUsd, 0);
    const netPct    = totalCost > 0 ? ((totalLp - totalCost) / totalCost) * 100 : 0;

    console.log(
      W('ACTIVE TOTAL', 10) + W('', 14) + W('', 5) +
      RW(usd(totalCost), 12) + RW(usd(totalLp), 12) +
      RW(usd(totalHodl), 12) + RW(usd(totalHWeth), 10) +
      RW(usd(-totalIl), 10) + RW(usd(totalFees), 10) + RW(pct(netPct), 9)
    );
  }
  console.log('═'.repeat(110));
  console.log('● = active (has liquidity)  ○ = closed  IL shown as loss (negative = you lost to IL)');
  console.log('vs ETH = what you\'d have if you converted everything to WETH at mint and just held');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const argv       = process.argv.slice(2);
  const jsonOutput = argv.includes('--json');
  const activeOnly = argv.includes('--active-only');
  const rpcUrl     = process.env['RPC_URL'] ?? 'https://mainnet.base.org';

  console.log('LP Benchmark — loading positions...');

  const positionsPath = 'memory/lp-positions.jsonl';
  if (!existsSync(positionsPath)) throw new Error('memory/lp-positions.jsonl not found');

  const records: LpPositionRecord[] = readFileSync(positionsPath, 'utf8')
    .trim().split('\n').filter(Boolean)
    .map(l => JSON.parse(l) as LpPositionRecord);

  console.log(`  ${records.length} positions found`);

  const client = createPublicClient({ chain: base, transport: http(rpcUrl) });

  // Current pool state (shared across all positions)
  const currentSlot0 = await client.readContract({
    address: ADDRESSES.ETH_DIEM_V3,
    abi: SLOT0_ABI,
    functionName: 'slot0',
  });
  const currentSqrtPriceX96 = currentSlot0[0];

  // Today's ETH price
  const today      = new Date().toISOString().slice(0, 10);
  const ethUsdNow  = await ethUsdAtDate(today);

  console.log(`  ETH/USD today: $${ethUsdNow.toLocaleString()}`);
  console.log(`  DIEM/WETH now: ${sqrtToPrice(currentSqrtPriceX96).toFixed(6)}\n`);

  // Process positions
  const results: PositionBenchmark[] = [];
  for (const rec of records) {
    process.stdout.write(`  #${rec.tokenId} ${rec.mintedAt.slice(0, 10)}...`);
    try {
      const result = await benchmarkPosition(rec, currentSqrtPriceX96, ethUsdNow, client);
      if (activeOnly && !result.active) {
        process.stdout.write(' (closed, skipped)\n');
        continue;
      }
      results.push(result);
      process.stdout.write(` ${result.active ? '● active' : '○ closed'} cost=${usd(result.costBasisUsd)} lp=${usd(result.lpValueUsd)}\n`);
    } catch (err) {
      process.stdout.write(` ERROR: ${err}\n`);
    }
  }

  if (results.length === 0) {
    console.log('\nNo results to display.');
    return;
  }

  if (jsonOutput) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  printConsole(results);

  // ── Save to memory ────────────────────────────────────────────────────────

  mkdirSync('memory', { recursive: true });
  const outPath = `memory/lp-benchmark-${today}.md`;
  const diemPerWethNow = sqrtToPrice(currentSqrtPriceX96);

  const md = [
    `# LP Benchmark — ${today}`,
    ``,
    `**ETH/USD:** $${ethUsdNow.toLocaleString()} | **DIEM/WETH:** ${diemPerWethNow.toFixed(6)} | **DIEM/USD:** $${(ethUsdNow / diemPerWethNow).toFixed(6)}`,
    ``,
    `## Summary (active positions)`,
    ``,
    (() => {
      const active = results.filter(r => r.active);
      if (!active.length) return '_No active positions._';
      const totalCost = active.reduce((s, r) => s + r.costBasisUsd, 0);
      const totalLp   = active.reduce((s, r) => s + r.lpValueUsd, 0);
      const totalHodl = active.reduce((s, r) => s + r.hodl5050Usd, 0);
      const totalHWeth = active.reduce((s, r) => s + r.hodlWethUsd, 0);
      const totalIl   = active.reduce((s, r) => s + r.ilUsd, 0);
      const totalFees = active.reduce((s, r) => s + r.feesUsd, 0);
      return [
        `| Metric | Value |`,
        `|--------|-------|`,
        `| Positions | ${active.length} active |`,
        `| Cost basis | ${usd(totalCost)} |`,
        `| LP value now | ${usd(totalLp)} |`,
        `| HODL 50/50 | ${usd(totalHodl)} | LP ${totalLp > totalHodl ? 'beats' : 'trails'} by ${usd(Math.abs(totalLp - totalHodl))} |`,
        `| HODL WETH (vs ETH) | ${usd(totalHWeth)} | LP ${totalLp > totalHWeth ? 'beats' : 'trails'} by ${usd(Math.abs(totalLp - totalHWeth))} |`,
        `| Impermanent loss | ${usd(-totalIl)} |`,
        `| Fees earned | ${usd(totalFees)} |`,
        `| Net P&L | ${usd(totalLp - totalCost)} (${pct(((totalLp - totalCost) / totalCost) * 100)}) |`,
      ].join('\n');
    })(),
    ``,
    `## Per-Position Detail`,
    renderTable(results),
  ].join('\n');

  writeFileSync(outPath, md);
  console.log(`\nSaved to ${outPath}`);
}

main().catch(err => { console.error(err); process.exit(1); });
