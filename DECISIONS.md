# Open decisions for v1

Pick one option per question by editing the `[ ]` to `[x]`. The platform foundation PR will be tuned to your selections.

---

## 1. `DIEM_USD` reference for tick math

How does the deploy script price DIEM in USD when computing tick boundaries from market-cap targets?

- [ ] **A. Hard-code at deploy time** (current PR #11 behaviour, env var `DIEM_USD=181.90`). Simple, but stale if DIEM drifts.
- [ ] **B. Aerodrome TWAP** — read VVV/DIEM or WETH/DIEM pool and compute a 30-min TWAP at deploy time. One extra contract read.
- [ ] **C. Chainlink price feed** — if/when DIEM gets one. Cleanest if available.
- [ ] **D. Pyth pull oracle** — same pattern, different vendor.

## 2. Protocol seed model

When the launchpad deploys an agent, it stakes ~5 DIEM (≈$910) to give the agent immediate compute. How does that capital settle?

- [ ] **A. Gift** — protocol absorbs the cost; agent fees flow per the 20/80 split from tick zero.
- [ ] **B. Loan, no interest** — 100% of agent fees flow to repaying the seed first. Once repaid, normal 20/80 split kicks in.
- [ ] **C. Loan with interest** — like B, but apply ~10% APR until repaid.
- [ ] **D. Hybrid** — gift for the first N agents (bootstrap), loan thereafter.

## 3. Comms scope for v1

Which outbound channels does the agent get on day one?

- [ ] **A. X + email + Fiverr** (recommended) — ~3 adapters, no video pipeline.
- [ ] **B. X-only** — fastest, single integration; defer all others.
- [ ] **C. X + email + Fiverr + TikTok** — add a Remotion render pipeline; +1 week of work.
- [ ] **D. Custom set** — specify: ____________________

## 4. Gig platform for agent-to-human task delegation

- [ ] **A. Fiverr** — largest reach, but no public API; needs browser automation.
- [ ] **B. Upwork** — has an API, more enterprise-feeling.
- [ ] **C. Replit Bounties** — dev-centric, smaller pool.
- [ ] **D. Crypto-native** (Layer3, Beelance, Bondex) — settles in stablecoin, no KYC bridge needed.
- [ ] **E. Multiple** — specify: ____________________

## 5. Holder suggestion threshold

From `CLAUDE.md`: signed messages from holders, weighted by % supply. Defaults: 0.1% min, 1 message per 6h, 24h TTL.

- [ ] **A. Keep CLAUDE.md defaults** (0.1% / 6h / 24h)
- [ ] **B. Lower the bar** (0.01% / 1h / 12h) — more participation, more spam risk
- [ ] **C. Raise the bar** (1% / 24h / 48h) — only whales suggest
- [ ] **D. Weighted-only** — no minimum, but suggestions show up sorted by holder weight; agent decides what to act on

---

## Open data needed (not multichoice)

While you're picking, please also gather:

1. **Venice staking contract address on Base** — only blocker for `fee-router` to actually transact
2. **Confirm DIEM `decimals()`** — PR #11 reads it on-chain and bails if not 18; if it's not 18, please flag
3. **Whether `deploy-autonomous-platform` repo should be created now** — platform services are landing under `platform/` in this repo for now; once that repo exists they get moved out
