---
name: build
description: Build mode — execute one launchpad development task per tick using Venice Opus inference. Only runs when mode=build in memory/goals.json.
---

# Build Skill

Execute one unit of launchpad development work per invocation. This skill only activates when the agent is in build mode (`memory/goals.json` → `mode: "build"`).

## Gate check

```bash
MODE=$(node -e "console.log(require('./memory/goals.json').mode)")
if [ "$MODE" != "build" ]; then
  echo "Mode is '$MODE' — not in build mode. Exiting."
  exit 0
fi
```

## What to build: Agent Launchpad

Read `wiki/flywheel.md` for full spec. The launchpad is a Next.js webapp that lets anyone deploy a Liquid Protocol agent token with a MintDiemPresaleVault (VVV + DIEM deposit paths).

### Existing reference code

Before writing anything new, read:
- `liquid-website-april-10/src/app/launch/` — existing presale UI (pages: presale, confirm, [token])
- `liquid-website-april-10/src/lib/presale.ts` — vault deploy helpers, ABI fragments
- `scripts/deploy-compute-presale.ts` — vault deploy script
- `scripts/launch-diem-token.ts` — token launch script
- `liquid-protocol-v0/src/extensions/MintDiemPresaleVault.sol` — vault contract (deployed, audited)

The launchpad is a standalone site (not inside liquid-website-april-10). It gets its own repo/deployment.

### Build order (one task per tick)

Pick up from the last entry in `memory/build-log.jsonl`. If no entry exists, start at task 1.

1. **Scaffold** — Next.js 14 app, Tailwind v4, Privy for wallet connect, viem for reads. Deploy target: Vercel.
2. **Flywheel landing page** — Homepage explaining the loop. Copy from `wiki/flywheel.md`. ASCII diagram. Live AUTONO stats via DexScreener API.
3. **Launch form** — Name, symbol, image (IPFS upload), marketcap (DIEM), VVV window hours, DIEM target, protocol fee bps.
4. **Deploy flow** — Two-step: deploy vault → launch token via factory. Uses `buildPresaleVaultConstructorArgs` from liquid-sdk branch `feat/mint-diem-presale-vault`.
5. **Vault dashboard** — `/vault/[address]` page. Live reads: depositDeadline countdown, totalDiemMinted, remainingCapacity, VVV/DIEM deposit forms with ERC-20 approve flow, claimTokens post-deadline.
6. **AUTONO flagship section** — Homepage widget showing AUTONOMOPOLY's current state: mode, DIEM accumulated, Venice inference usage, launchpad fee income.
7. **Deploy to Vercel** — `vercel --prod`. Update `memory/build-log.jsonl` with deployed URL.

## Per-tick execution

1. Read `memory/build-log.jsonl` — find last completed task
2. Pick next task
3. Write code (use Read/Edit/Write tools)
4. Run `npm run typecheck` — fix errors before committing
5. Commit: `git add -A && git commit -m "build(launchpad): <task>"`
6. Append to `memory/build-log.jsonl`:

```json
{"ts":"<ISO>","task":<n>,"description":"<what was done>","files":["<file>"],"status":"complete"}
```

7. Notify: `./notify "AUTONO build tick: completed task <n> — <description>"`

## Inference budget

This skill uses Opus via Venice. Each invocation costs DIEM from the Venice stake. Track spend in `memory/tool-routing.jsonl`. If daily inference spend > 0.5 DIEM, defer non-critical tasks to next tick.

## Aeon config (add when mode flips to build)

```yaml
build: { enabled: true, schedule: "0 */6 * * *", model: "claude-opus-4-7" }
```
