# Agent Presale Dashboard

Interactive presale vault UI for Venice Agent Launchpad.

## Development

```bash
cd dashboard/app
npm install
VITE_PRIVY_APP_ID=your-privy-app-id npm run dev
```

## Build

From repo root:
```bash
node --import tsx scripts/export-presales.ts  # regenerate presales.json
cd dashboard/app && npm run build
```

## Deploy

Push to main — the `dashboard.yml` workflow builds and deploys to GitHub Pages at `/<repo>/presales/`.

Required GitHub secret: `DASHBOARD_PRIVY_APP_ID` — Privy App ID for the presale dashboard.
GitHub Pages must be enabled: Settings → Pages → Source: Deploy from a branch → `gh-pages`.
