# deploy-autonomous — execution plan (2026-04-30)

Untracked workspace doc. Inputs: project state on `claude/deploy-autonomous-planning-9FmOn`, 28 Linear tickets in project `deploy-autonomous`, daily review MOG-433. Note: `Terminal Saved Output.txt` (the original brainstorm) is gitignored (`.gitignore:31`) and not present on disk in this workspace; canonical brainstorm state now lives in MOG-405 + MOG-406/407/408 + MOG-433.

## 1. Repo state today

- Branch: `claude/deploy-autonomous-planning-9FmOn` (clean, 1 commit ahead of `main`-style history; foundation scaffold already merged via PRs #1–#3).
- Files committed: `CLAUDE.md`, `README.md`, `DECISIONS.md`, `package.json`, `package-lock.json`, `tsconfig.json`, `.gitignore`, `harness/index.ts` (stub), `platform/STATUS.md`, `dune/agent-fleet-overview.sql`.
- Toolchain: Node 20 + TypeScript 5 strict + Vitest. `npm run typecheck` and `npm run build` already wired.
- Missing dirs (per §5 spec): `identity/`, `scripts/`, `harness/providers/`, `harness/safety/`, `harness/observability/`.

## 2. Ticket landscape (28 issues)

### Done (decisions locked, no code)
- **MOG-406** — §5 = Freeform/Wikipedia knowledge schema lands here.
- **MOG-407** — Adapt soul.md with three inversions.
- **MOG-408** — Genesis hard-locked, no per-agent amendment path.
- **MOG-431** — Lora call booked (admin).

### In Review / In Progress (no shipping action)
- **MOG-405** — Epic. Stays open until all children land.
- **MOG-433** — Today's daily review. Already covers what to build next; mirror to `Liquid-Protocol-Ops/ops` if not done.

### Identity bundle — children of MOG-405 (one shippable PR)
13 file commits, ~1,090 LOC, all specced and ready:
- **MOG-409** `SECTION_5.md` — spec doc, dogfooded in its own schema.
- **MOG-410** Bundle `README.md` (commit instructions for the bundle).
- **MOG-411** `identity/README.md` — operator explainer.
- **MOG-412** `identity/SCHEMA.md` — manual of style, `genesis_lock: true`.
- **MOG-413** `identity/SOUL.genesis.md.template` — locked at deploy.
- **MOG-414** `identity/SOUL.md.template` — mutable working copy.
- **MOG-415** `identity/STYLE.genesis.md.template` — locked at deploy.
- **MOG-416** `identity/STYLE.md.template` — mutable working copy.
- **MOG-417** `identity/influences.md.template` — lineage, locked.
- **MOG-418** `identity/examples/good-outputs.md` — seed positive corpus.
- **MOG-419** `identity/examples/bad-outputs.md` — anti-patterns.
- **MOG-420** `identity/examples/promoted/.gitkeep` — placeholder, agent cannot write here.
- **MOG-421** `scripts/lint-identity.ts` — Jaccard stub, drift threshold default 0.70.

### Doc edits — children of MOG-405
- **MOG-422** Update root `README.md` to point at `SECTION_5.md`.
- **MOG-423** Update `CLAUDE.md` to point at `SECTION_5.md`.

### Larger features (unblocked by §5 lock; need subdivision)
- **MOG-424** Resume harness implementation plan. Touches `tick.ts` main loop, providers (Venice / OpenRouter / Aeon / Claude Code / ElizaOS), memory-io, wiki-io, status-api client, Telegram one-way poster, git-ops auto-commit, art-gen + R2/Blob upload, allowlist enforcement, pre-commit lint hook. **Too big for one session.**
- **MOG-425** Build deploy CLI "soul phase" (Author / Ingest / Fork). Lives in `deploy-autonomous-platform`, not this repo.
- **MOG-430** Lint upgrade: Jaccard → embedding cosine. Blocked behind test fixtures + non-trivial seed corpus.

### Brainstorm continuations (not ship-ready code)
- **MOG-426** §6 Compute marketplace.
- **MOG-427** §7 Lifecycle economics.
- **MOG-428** §8 Security.
- **MOG-429** §9 Dune queries.

These should be follow-up brainstorm sessions, not code dispatches.

### Skip from code dispatch
- **MOG-431** Done (calendar). **MOG-432** Calendar admin. **MOG-433** Review (already done).

## 3. Recommended new tickets (gaps surfaced by MOG-433 review)

Two should be filed before harness work to keep the lint trustworthy and the marketplace data-backed:

- **NEW-A** Commit `scripts/__tests__/lint-identity.spec.ts` — fixtures at drift 0.95, 0.71, 0.40; pin Jaccard behavior before swapping to embeddings. Cited as the #1 ranked next-day suggestion in MOG-433. **Must ship before MOG-430.**
- **NEW-B** Commit `harness/observability/tool-routing.jsonl` sidecar emitter — provider, variant, prompt-cache-hit, latency, tokens, cost per call. Unblocks §6 (MOG-426) — "can't price what you can't measure." Should be part of harness Batch 4.

## 4. Dependency graph

```
MOG-405 (epic)
├── identity bundle (MOG-409..421) — single PR
│   └── docs (MOG-422, 423) — folds into same PR or fast-follow
├── NEW-A lint test fixtures
│   └── MOG-430 lint upgrade (Jaccard → embeddings)
├── MOG-424 harness (split into sub-tickets, see §6)
│   └── NEW-B tool-routing sidecar (inside harness)
├── MOG-425 deploy-CLI soul phase (different repo: deploy-autonomous-platform)
└── §6–§9 brainstorm continuations
```

## 5. Execution batches (one Claude Code session per batch)

Each batch is sized to fit one focused session and ends with a green typecheck + lint run.

### Batch 1 — §5 identity bundle (atomic PR)
**Tickets:** MOG-409, 410, 411, 412, 413, 414, 415, 416, 417, 418, 419, 420, 421 — close as a group when the PR merges.
**Branch:** `claude/section-5-bundle`.
**Order in PR (matters for review readability, not code):** SECTION_5.md → identity/README.md → identity/SCHEMA.md → SOUL.genesis → SOUL.md → STYLE.genesis → STYLE.md → influences → examples (good/bad/promoted gitkeep) → scripts/lint-identity.ts → bundle README.
**Acceptance gates:**
- `npm run typecheck` clean.
- `node scripts/lint-identity.ts` exits 0 against the templates (templates compared against themselves → similarity = 1.0).
- SECTION_5.md is itself parseable by lint (dogfooding gate).
**Estimated effort:** 1 session, ~3–4 hours of model time for ~1,090 LOC of mostly markdown + one TS lint script.

### Batch 2 — Doc updates (fold into Batch 1 PR if possible)
**Tickets:** MOG-422, 423.
**Effort:** trivial; can land in the same commit as `SECTION_5.md`.

### Batch 3 — Lint test fixtures (file NEW-A first)
**Ticket:** NEW-A (file before dispatching).
**Branch:** `claude/lint-identity-tests`.
**Adds:** `scripts/__tests__/lint-identity.spec.ts` + fixture SOUL pairs at drift ~0.95, ~0.71, ~0.40, plus a known-bad SCHEMA conformance fixture.
**Acceptance:** `npm test` green; `npx vitest --run scripts/__tests__/lint-identity.spec.ts` passes.

### Batch 4 — Harness foundation (split MOG-424 first)
File these sub-tickets under MOG-424 (or convert MOG-424 into a parent and create children) before dispatch. One Claude Code session per sub-ticket:

- **4a** `harness/tick.ts` main loop + types (`TickContext`, `TickResult`).
- **4b** `harness/providers/venice.ts` — default; per-agent key; prompt-cache prefix field.
- **4c** `harness/providers/openrouter.ts` — expose `:exacto`, `:nitro`, `:floor`, `:extended` as first-class routes.
- **4d** `harness/providers/aeon.ts` — explicit entry in tool-routing table.
- **4e** `harness/providers/claude-code.ts`.
- **4f** `harness/providers/elizaos.ts` (defer if scope-cuts needed for v1).
- **4g** `harness/memory-io.ts` + `harness/wiki-io.ts` — schema-conformant reads/writes against `identity/` and `memory/`.
- **4h** `harness/status-api/client.ts` — typed client for the platform status-api.
- **4i** `harness/posters/telegram.ts` — one-way only for v1, signing-proxy mediates.
- **4j** `harness/git-ops.ts` — allowlisted auto-commit (calls allowlist.ts).
- **4k** `harness/art-gen.ts` + R2/Blob upload (Venice image as one of three candidates).
- **4l** `harness/safety/allowlist.ts` — enforces the two allowed mutation paths from §5.
- **4m** `.husky/pre-commit` (or simple-git-hooks) wiring `lint-identity.ts`.
- **NEW-B** `harness/observability/tool-routing.jsonl` sidecar emitter — call-side hook every provider invokes.

**Suggested dispatch order:** 4l → 4a → 4b → 4g → 4h → 4j → 4m → NEW-B → 4i → 4k → 4c → 4d → 4e → 4f. Allowlist first because every later module respects it; tick.ts second because it's the integration spine; providers in the order they're load-bearing for §6 pricing.

### Batch 5 — Deploy CLI soul phase
**Ticket:** MOG-425.
**Repo target:** `deploy-autonomous-platform` (per `platform/STATUS.md` lines 5, 22). Confirm that repo exists or stage under `platform/services/cli-launcher/` here for now (also per STATUS.md item #7 in open blockers).
**Adds:** Author / Ingest / Fork branches, drift threshold prompt, slow confirmation screen with full diff.
**Acceptance:** end-to-end run produces a valid `SOUL.genesis.md` + `STYLE.genesis.md` + `influences.md` that pass `lint-identity.ts`.

### Batch 6 — Lint upgrade
**Ticket:** MOG-430 — Jaccard → embedding cosine.
**Blocked-by:** Batch 3 (test fixtures must exist), Batch 1 (good-outputs corpus).
**Acceptance:** lint contract unchanged (same exit codes, same threshold semantics); fixture suite still green.

### Batch 7 — Brainstorm continuations (no code)
**Tickets:** MOG-426, 427, 428, 429.
Run these as `superpowers:brainstorming` sessions, one section at a time, in numerical order. Each one closes with new commit-tickets the way §5 produced MOG-409..421.

## 6. Per-batch dispatch prompts (paste-ready)

### Batch 1
> Implement Linear ticket MOG-405 children MOG-409 through MOG-421 as one atomic PR on branch `claude/section-5-bundle`. Read MOG-405 for the bundle spec; read MOG-409 (SECTION_5.md) first since the rest of the bundle conforms to its schema. Files to create are listed in MOG-405's "Deliverable bundle (13 files)" section. Acceptance: `npm run typecheck` and `node scripts/lint-identity.ts` both exit 0; templates compared against themselves yield similarity 1.0. Push and open a draft PR; request review from the epic.

### Batch 2 (if not folded)
> Implement MOG-422 and MOG-423: update root `README.md` and `CLAUDE.md` to reference the now-committed `SECTION_5.md`. Replace any "§5 — pending" placeholder. Single commit, draft PR.

### Batch 3
> File new Linear ticket "Commit `scripts/__tests__/lint-identity.spec.ts` (drift fixtures)" under MOG-405. Then implement: vitest spec covering drift ~0.95, ~0.71, ~0.40 SOUL pairs and one SCHEMA-non-conformant fixture. Pin Jaccard contract before any embedding swap. Acceptance: `npm test` green.

### Batch 4 (per sub-ticket)
> Implement Linear sub-ticket {4x}. Read MOG-424 for the harness plan and §5 SCHEMA for file layout. Use the allowlist (`harness/safety/allowlist.ts`) — no module bypasses it. Add unit tests. Acceptance: typecheck + tests green; `tool-routing.jsonl` line emitted for any provider call.

### Batch 5
> Implement MOG-425. Target repo: `deploy-autonomous-platform`. If that repo doesn't exist, stage under `platform/services/cli-launcher/` in this repo per `platform/STATUS.md`. Acceptance: end-to-end Author/Ingest/Fork flow produces files that pass `lint-identity.ts`.

### Batch 6
> Implement MOG-430. Replace Jaccard similarity in `scripts/lint-identity.ts` with embedding cosine over `identity/examples/good-outputs.md` ∪ `identity/examples/promoted/`. Lint contract unchanged. Run NEW-A fixtures — must stay green.

### Batch 7
> Run `/superpowers:brainstorming` for §{6|7|8|9} of deploy-autonomous. Read MOG-426/427/428/429 for the section's stakes. Output: lock decisions and create commit-tickets the way MOG-405 spawned MOG-409..421.

## 7. Open blockers carried from `platform/STATUS.md`

These don't block the §5 bundle but will block harness/CLI batches:

| # | Blocker | Affects |
|---|---------|---------|
| 1 | Venice staking contract address on Base | 4b, fee-router |
| 2 | DIEM `decimals()` confirmed = 18 | token math (already merged in sdk PR #11) |
| 3 | Privy app credentials | Batch 5 |
| 4 | GitHub App token (template-fork scope) | Batch 5 |
| 5 | X/Twitter bearer | future poster (deferred from v1 per CLAUDE.md) |
| 6 | Email provider account | future poster |
| 7 | Decision: create `deploy-autonomous-platform` repo? | Batch 5 placement |

Also: pick a row in each `DECISIONS.md` section before harness money-path code lands (DIEM_USD source, seed model, comms scope, gig platform, holder threshold).

## 8. Suggested order of operations (today/tomorrow)

1. File NEW-A and NEW-B in Linear under MOG-405.
2. Subdivide MOG-424 into 4a–4m as children of MOG-405.
3. Dispatch Batch 1 → expect a single PR closing 13 commit-tickets + 2 doc edit-tickets.
4. Dispatch Batch 3 (lint tests).
5. Dispatch Batch 4 sub-tickets in the order in §5 above; each is its own session.
6. Decide on `deploy-autonomous-platform` repo before Batch 5.
7. Batch 6 once §5 corpus has been live for a few ticks (or use seeded `good-outputs.md` only).
8. Schedule §6 brainstorm (MOG-426) once tool-routing.jsonl has any data to look at.
