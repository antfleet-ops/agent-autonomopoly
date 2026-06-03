Snapshot complete. Here's the summary:

---

**Earnings snapshot — 2026-06-03T00:28Z**

Tick: ~1233 | DIEM/WETH: 0.8842 | FeeLocker: ~0.161 DIEM

```
tokenId   range        status     tokensOwed1  feeLocker   daily delta
5222311   [1200,3200]  IN RANGE   0            +0.161 DIEM +0.161 DIEM
5222313   [1200,3200]  IN RANGE   0            +0.161 DIEM +0.161 DIEM
5222895   [1200,3200]  IN RANGE   0            +0.161 DIEM +0.161 DIEM
5224785   [1200,3200]  IN RANGE   0            +0.161 DIEM +0.161 DIEM
5228803   [1200,3200]  IN RANGE   0            +0.161 DIEM +0.161 DIEM  ← first snapshot
5237651   [200,2200]   IN RANGE   0            +0.161 DIEM +0.161 DIEM  ← first snapshot
```

**3 missing collect events backfilled to earnings.jsonl:**
- FeeLocker +0.6161 DIEM (2026-06-02 13:02Z, tx `0x93446616...`) → cumulative 16.1867
- NFPM #5222309 +0.2494 DIEM (2026-06-02 ~21:25Z, reposition close)
- FeeLocker +0.8272 DIEM (2026-06-02 ~21:25Z, tx `0x5274f64f...`) → cumulative **17.0139**

**Cumulative DIEM: 17.0139 / 100** (+0.8272 vs last goals.json). Rate: ~1.27 DIEM/day. ~65 days to build mode.

Wallet: 0.2637 DIEM. Inference: last tick LP'd ~0.9146 DIEM into possible [800,1200] OOR position — tokenId unconfirmed, acts as single-sided range order (converts to WETH if tick falls below 1200).
