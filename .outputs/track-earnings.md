Snapshot complete. Here's what was executed and recorded:

---

**track-earnings — 2026-06-05**

**On-chain state** (fetched via Basescan + DexScreener — RPC blocked in sandbox):
- Tick: **1828** (DIEM/WETH = 0.8327)
- ETH: 0.008524 | WETH: 5.6536 | Wallet DIEM: 0
- FeeLocker: ~0.020 DIEM (inference: ~1h at 0.019 DIEM/h since 23:10:39Z claim)

**Snapshot: 3 active positions**

| tokenId | range | status | tokensOwed DIEM | delta |
|---------|-------|--------|-----------------|-------|
| 5257576 | [400,2400] | IN RANGE | 0 | 0 (new) |
| 5259057 | [1000,3000] | IN RANGE | 0 | 0 (new) |
| 5259058 | [1000,3000] | IN RANGE | 0 | 0 (new, primary) |

2 additional positions from 23:12Z batch unresolved — tokenIds require live NFPM call.

**FeeLocker claims backfilled into earnings.jsonl** (were missing):
- 07:11Z: 0.09236 DIEM | `0xd18b12a3...`
- 14:45Z: 0.03244 DIEM | `0xa8c05521...`
- 23:10Z: 0.16167 DIEM | `0x29d2b216...`

**NFPM collects backfilled:**
- #5241362: 4.5338 DIEM + 0.04862 WETH | `0x8a490b80...`
- #5253546: 17.0517 DIEM + 0.01739 WETH | `0x7a6d581a...` (LP principal return)

**Cumulative FeeLocker:** 17.6978 + 0.03244 + 0.16167 = **17.8919 DIEM** / 100
**Daily rate:** 0.485 DIEM/day | **ETA to build mode:** ~169 days
