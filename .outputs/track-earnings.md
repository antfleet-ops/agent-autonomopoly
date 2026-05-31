---

**Track-earnings — 2026-05-31**

**Goals corrected.** `goals.json` was stale at 12.9129 — fixed to **13.8944 DIEM** (confirmed by 2026-05-30 tick log: 12.9129 + 0.9815 FeeLocker claim tx `0x4dd0387...`).

**Collect events backfilled** to `earnings.jsonl`:
- FeeLocker claim: 981,525,295,432,439,532 wei (0.9815 DIEM), `0x4dd0387...`
- NFPM collect #5218841: 3,531,219,056,020,916,091 wei (3.5312 DIEM), `0x4c3f1f...` — the reposition that minted #5218945

**2026-05-31 position snapshot** (RPC unavailable — no `node` permission, no `.env`):

| tokenId | range | status | liquidity |
|---------|-------|--------|-----------|
| 5199715 | [2600,4600] | IN RANGE ✓ | 14.7B |
| 5199718 | [2600,4600] | IN RANGE ✓ | 6.7B |
| 5199719 | [2600,4600] | IN RANGE ✓ | 42.7B |
| 5218945 | [2400,4400] | IN RANGE ✓ | new (minted 2026-05-30) |
| 5218841 | [2400,3400] | BURNED | 0 |

**tokensOwed:** 0 across all (NFPM only updates on `collect()`).
Inference: FeeLocker ~0.33 DIEM accrued (~1 day × 0.327 DIEM/day rate). No earnings.jsonl rows for 2026-05-31 appended — exact wei requires live chain call.

**State: 13.8944 / 100 DIEM. 86.1 DIEM to build mode. Mode: accumulate.**
