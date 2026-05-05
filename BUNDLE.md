# §5 bundle — file index

Per-agent repo identity layer. Spec: [SECTION_5.md](SECTION_5.md). Operator orientation: [identity/README.md](identity/README.md). Manual of style enforced on every commit: [identity/SCHEMA.md](identity/SCHEMA.md).

This file lists what shipped in the §5 bundle and where to find each piece. Future per-agent forks ship with this index intact so that any reader of an agent's repo can find the constitution, the lint contract, and the calibration corpus without context.

## Files

| Path | Purpose | Locked at deploy? |
|------|---------|-------------------|
| [SECTION_5.md](SECTION_5.md) | spec doc, dogfooded in own schema | yes (`genesis_lock: true`) |
| [identity/README.md](identity/README.md) | operator's guide to this directory | yes |
| [identity/SCHEMA.md](identity/SCHEMA.md) | manual of style for every `.md` file | yes |
| [identity/SOUL.genesis.md.template](identity/SOUL.genesis.md.template) | who/believes/cares/will-not/particular/disagreement | yes (after deploy substitution) |
| [identity/SOUL.md.template](identity/SOUL.md.template) | mutable working copy of SOUL.genesis | no (drift-bounded by lint) |
| [identity/STYLE.genesis.md.template](identity/STYLE.genesis.md.template) | voice register / verbal moves / format | yes (after deploy substitution) |
| [identity/STYLE.md.template](identity/STYLE.md.template) | mutable working copy of STYLE.genesis | no (drift-bounded by lint) |
| [identity/influences.md.template](identity/influences.md.template) | lineage record (parent agent, sources) | yes (after deploy substitution) |
| [identity/examples/good-outputs.md](identity/examples/good-outputs.md) | seed positive corpus | append-only by deployer |
| [identity/examples/bad-outputs.md](identity/examples/bad-outputs.md) | anti-pattern corpus | append-only by deployer |
| [identity/examples/promoted/.gitkeep](identity/examples/promoted/.gitkeep) | placeholder; lifecycle-engine writes here | n/a |
| [scripts/lint-identity.ts](scripts/lint-identity.ts) | drift lint + SCHEMA enforcement; CI hook | n/a |

## Acceptance gates this bundle has cleared

- `node scripts/lint-identity.ts` exits 0 against the templates (template-mode drift gate skipped per the script's documented behaviour; SCHEMA conformance enforced).
- Bundle is dogfooded in its own schema: `SECTION_5.md` and `ARCHITECTURE_v2.md` carry conformant frontmatter and use the `[[link]]` form for internal references.

## Deploy-time substitution

The deploy CLI ([Linear MOG-425](https://linear.app/mog-capital/issue/MOG-425)) substitutes deployer answers in place of every `{{...}}` placeholder when forking the per-agent repo, then drops the `.template` suffix from the four `*.template` files. After substitution, `SOUL.md` is initialized as a byte-identical copy of `SOUL.genesis.md` minus the `drift_threshold` and `genesis_lock` frontmatter fields (same for `STYLE.md` ↔ `STYLE.genesis.md`).

## Cross-references

- Linear epic: [MOG-405](https://linear.app/mog-capital/issue/MOG-405).
- Bundle children (committed by this PR): MOG-409, 410, 411, 412, 413, 414, 415, 416, 417, 418, 419, 420, 421.
- Doc edit children: MOG-422 (root README), MOG-423 (CLAUDE.md).
- Follow-on tickets: MOG-435 (lint test fixtures), MOG-430 (Jaccard → embedding cosine).
