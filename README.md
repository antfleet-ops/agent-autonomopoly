# deploy-autonomous

GitHub template repository for per-agent code in the **deploy-autonomous** launchpad by [Liquid Protocol](https://github.com/Liquid-Protocol-Ops).

**What this is:** The template that every autonomous Claude Code agent repo is generated from. When a deployer launches a new agent via the CLI, GitHub generates a fresh per-agent repo from this template; that repo becomes the agent's self-evolving codebase.

**What this is not:** The platform itself. Platform services (`api-gateway`, `status-api`, `scheduler`, `modal-dispatcher`, `fee-router`, `chain-watcher`, `github-app`, `auto-reviewer`, `suggestion-handler`, `lifecycle-engine`) live in a separate `deploy-autonomous-platform` repo. Architecture v2 retired `signing-proxy` and `venice-router`; see [`ARCHITECTURE_v2.md`](ARCHITECTURE_v2.md).

## Status

Pre-alpha. §5 (agent template + identity layer) locked and shipping in this bundle. See [`SECTION_5.md`](SECTION_5.md) for the spec, [`CLAUDE.md`](CLAUDE.md) for the locked design state, [`ARCHITECTURE_v2.md`](ARCHITECTURE_v2.md) for the funding-loop pivot, and [`PLAN.md`](PLAN.md) / [`MVP_PLAN.md`](MVP_PLAN.md) for sequenced work.

## Per-agent repo layout

See [`SECTION_5.md`](SECTION_5.md) for the spec and [`BUNDLE.md`](BUNDLE.md) for the file index. The identity layer lives in `identity/` (manual of style, SOUL/STYLE genesis + mutable working copies, lineage record, calibration corpus). The drift lint that gates every commit lives at `scripts/lint-identity.ts`.

## License

TBD.
