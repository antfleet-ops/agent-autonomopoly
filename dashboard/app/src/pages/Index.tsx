import { useEffect, useState } from 'react';
import { isAddress } from 'viem';
import VaultCard from '../components/VaultCard';
import { readVaultState } from '../lib/contracts';
import type { PresaleEntry, VaultState } from '../types';

export default function Index() {
  const [entries, setEntries] = useState<PresaleEntry[]>([]);
  const [states, setStates] = useState<Record<string, VaultState | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('./presales.json')
      .then(r => r.json())
      .then((data: PresaleEntry[]) => {
        setEntries(data);
        setLoading(false);
        // Fetch each vault state concurrently
        data.forEach(entry => {
          if (!isAddress(entry.vaultAddress)) return;
          readVaultState(entry.vaultAddress as `0x${string}`)
            .then(state => setStates(prev => ({ ...prev, [entry.vaultAddress]: state })))
            .catch(() => setStates(prev => ({ ...prev, [entry.vaultAddress]: null })));
        });
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 font-mono">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-bold mb-1">Agent Presales</h1>
        <p className="text-gray-400 text-sm mb-6">
          Venice Agent Launchpad — active and historical presale vaults.
        </p>

        {loading && (
          <div className="space-y-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="border border-gray-700 rounded p-4 animate-pulse bg-gray-900 h-16" />
            ))}
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div className="border border-gray-700 rounded p-6 text-center text-gray-500">
            <p>No presales deployed yet.</p>
            <a
              href="https://app.liquidprotocol.org/launch/presale"
              className="text-blue-400 hover:underline text-sm mt-2 block"
            >
              Launch an agent with presale →
            </a>
          </div>
        )}

        <div className="space-y-3">
          {entries.map(entry => (
            <VaultCard
              key={entry.vaultAddress}
              vaultAddress={entry.vaultAddress}
              state={states[entry.vaultAddress] ?? null}
              loading={!(entry.vaultAddress in states)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
