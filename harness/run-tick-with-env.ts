// Temporary runner that injects required on-chain addresses from platform/constants.ts
// before delegating to tick.ts — used when env vars aren't pre-set in the shell.
import { ADDRESSES } from '../platform/constants.js';

process.env['DIEM_TOKEN_ADDRESS'] ??= ADDRESSES.DIEM;
process.env['VVV_STAKING_ADDRESS'] ??= ADDRESSES.VVV_STAKING;

const { loadTickDeps, runTick } = await import('./tick.js');
const deps = await loadTickDeps();
await runTick(deps);
