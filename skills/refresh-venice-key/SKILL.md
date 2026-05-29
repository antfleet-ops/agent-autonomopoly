---
name: refresh-venice-key
description: Test Venice API key validity and mint a fresh key if expired or revoked
tags: [ops, venice, self-heal]
---

Test whether the current `VENICE_API_KEY` secret is still valid. If it returns 401 (expired or revoked), mint a fresh inference key by signing a challenge with the agent wallet, then update the GitHub Actions secret so all future skill runs use the new key automatically.

Run:

```bash
node --import tsx scripts/refresh-venice-key.ts
```

The script exits 0 in all non-error cases. Read its stdout to determine what happened:
- `"Key is valid — no action needed"` → key is fine; nothing to do
- `"Done — fresh key written"` → key was stale; secret updated

Log the result to `memory/logs/${today}.md` under a `### refresh-venice-key` heading:

```
refresh-venice-key: key valid — no action needed
```

or:

```
refresh-venice-key: key expired — fresh key minted and GitHub secret updated
```

If the script fails (non-zero exit), log the error and send a Telegram notification via the notify skill:
- Error: Venice challenge endpoint unreachable → likely a Venice outage; retry tomorrow
- Error: Privy signing failed → check PRIVY_APP_SECRET and PRIVY_WALLET_ID secrets

After a successful key refresh, also verify the gateway in `aeon.yml` is set to `provider: venice` (not `direct`). If it was switched to `direct` as a workaround, switch it back:

```bash
grep "provider:" aeon.yml
```

If the output shows `provider: direct`, update `aeon.yml`:
```
gateway:
  provider: venice    # primary: sDIEM-gated inference
```

Then commit and push the change.
