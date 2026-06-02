---

**Earnings snapshot — 2026-06-02**

Wallet: `0x8767Df39eCeeaeB11554642237aC4E08660aB6A3`
Mode: accumulate

---

**Cumulative DIEM harvested: 15.5706 / 100**
Progress: 15.6% (+1.23 DIEM since last snapshot)

| Event | Date | Amount |
|-------|------|--------|
| FeeLocker claim | 2026-06-01 09:16Z | +0.14321 DIEM |
| FeeLocker claim | 2026-06-02 01:23Z | +1.08857 DIEM → reinvested #5228593 |

FeeLocker: 0 (claimed 01:23Z, rebuilding)

---

**Active positions (6 total) at tick 2169 (0.8049 WETH/DIEM)**

| tokenId | range | status |
|---------|-------|--------|
| 5222309 | [1400,3400] | IN RANGE |
| 5222311 | [1200,3200] | IN RANGE |
| 5222313 | [1200,3200] | IN RANGE |
| 5222895 | [1200,3200] | IN RANGE |
| 5224785 | [1200,3200] | IN RANGE |
| 5228593 | [1000,2000] | **OUT OF RANGE** — tickUpper 2000 < tick 2169 |

---

**Daily rate (Inference):** ~1.62 DIEM/day (1.0886 DIEM accrued in 16.12 hours, 09:16Z June 1 → 01:23Z June 2). 3.6× the prior 0.45 DIEM/day estimate — driven by 5 positions in range with larger LP principal.

**Days to compute milestone:** (100 − 15.57) / 1.5 = **~56 days** (conservative) vs 190 days at old rate.

**Action required:** Position #5228593 [1000,2000] is OUT OF RANGE. Its DIEM (1.0886) sits idle earning no fees. Reposition to a range covering tick 2169 (e.g., [1400,3400] or [1200,3200]) to put it back to work. Every day OOR at this size costs ~0.27 DIEM in missed fees.
