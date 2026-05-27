import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { isAddress, formatUnits } from 'viem';
import { useWallets } from '@privy-io/react-auth';
import { readVaultState } from '../lib/contracts';
import ActionPanel from '../components/ActionPanel';
import Countdown from '../components/Countdown';
import type { VaultState } from '../types';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-gray-800 py-2 text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-100 font-mono text-right break-all max-w-[60%]">{value}</span>
    </div>
  );
}

export default function VaultDetail() {
  const { address } = useParams<{ address: string }>();
  const { wallets } = useWallets();
  const wallet = wallets.find(w => w.walletClientType !== 'privy') ?? wallets[0] ?? null;

  const [state, setState] = useState<VaultState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!address || !isAddress(address)) {
      setError('Invalid vault address');
      setLoading(false);
      return;
    }
    setLoading(true);
    readVaultState(
      address as `0x${string}`,
      wallet?.address as `0x${string}` | undefined,
    )
      .then(s => { setState(s); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [address, wallet?.address]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-6 font-mono">
        <div className="max-w-2xl mx-auto animate-pulse space-y-3">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-6 bg-gray-800 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-6 font-mono">
        <div className="max-w-2xl mx-auto">
          <Link to="/" className="text-blue-400 text-sm hover:underline">← back</Link>
          <p className="text-red-400 mt-4">{error ?? 'Vault not found'}</p>
        </div>
      </div>
    );
  }

  const mode = state.lockDuration === 0n ? 'VVV irrevocable' : `DIEM time-lock (${Number(state.lockDuration) / 86400}d)`;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 font-mono">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="text-blue-400 text-sm hover:underline">← all presales</Link>

        <h1 className="text-lg font-bold mt-4 mb-1 break-all">{address}</h1>
        <p className="text-gray-400 text-sm mb-6">Presale vault on Base</p>

        <div className="border border-gray-700 rounded p-4 mb-6 space-y-0">
          <Row label="Mode" value={mode} />
          <Row label="Deposit token" value={state.depositTokenSymbol} />
          <Row label="Total deposited" value={`${formatUnits(state.totalDeposited, 18)} ${state.depositTokenSymbol}`} />
          <Row label="Token supply" value={`${formatUnits(state.totalTokenSupply, 18)} tokens`} />
          <Row label="Agent wallet" value={state.agentWallet} />
          {state.initialized && state.depositDeadline > 0n && (
            <div className="flex justify-between border-b border-gray-800 py-2 text-sm">
              <span className="text-gray-400">Deposit window</span>
              <Countdown targetUnix={state.depositDeadline} label="closes" />
            </div>
          )}
          {state.lockDuration > 0n && state.lockExpiry > 0n && (
            <div className="flex justify-between border-b border-gray-800 py-2 text-sm">
              <span className="text-gray-400">Lock expiry</span>
              <Countdown targetUnix={state.lockExpiry} label="unlocks" />
            </div>
          )}
        </div>

        {wallet && state.myDeposited !== undefined && (
          <div className="border border-gray-700 rounded p-4 mb-6 space-y-0">
            <h2 className="text-sm text-gray-300 mb-2">Your position</h2>
            <Row label="Deposited" value={`${formatUnits(state.myDeposited, 18)} ${state.depositTokenSymbol}`} />
            <Row label="Tokens claimable" value={state.myShare !== undefined ? formatUnits(state.myShare, 18) : '—'} />
            <Row label="Tokens claimed" value={state.myClaimed ? 'Yes' : 'No'} />
            {state.lockDuration > 0n && (
              <Row label="Deposit withdrawn" value={state.myWithdrawn ? 'Yes' : 'No'} />
            )}
          </div>
        )}

        <div className="border border-gray-700 rounded p-4">
          <h2 className="text-sm text-gray-300 mb-3">Actions</h2>
          <ActionPanel vault={state} wallet={wallet} onDone={load} />
        </div>
      </div>
    </div>
  );
}
