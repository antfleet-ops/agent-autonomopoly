// Stakes all liquid DIEM on Venice for inference compute budget.
// DIEM contract is its own staking contract — stake(uint256) directly, no approve needed.
import { createPublicClient, encodeAbiParameters, parseAbiParameters, http, formatUnits, type Address, type Hex } from 'viem';
import { base } from 'viem/chains';

const DIEM      = '0xF4d97F2da56e8c3098f3a8D538DB630A2606a024' as Address;
const AGENT     = (process.env['AGENT_WALLET'] ?? '0x8767Df39eCeeaeB11554642237aC4E08660aB6A3') as Address;
const PRIVY     = 'https://api.privy.io/v1';
const MIN_STAKE = 1n * 10n ** 18n;  // refuse to stake less than 1 DIEM (likely dust / misconfiguration)

const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
] as const;

async function main() {
  const dryRun    = process.argv.includes('--dry-run');
  const appId     = process.env['PRIVY_APP_ID']!;
  const appSecret = process.env['PRIVY_APP_SECRET']!;
  const walletId  = process.env['PRIVY_WALLET_ID']!;
  const rpcUrl    = process.env['RPC_URL']!;

  const hdrs = () => ({ Authorization: `Basic ${Buffer.from(`${appId}:${appSecret}`).toString('base64')}`, 'privy-app-id': appId, 'Content-Type': 'application/json' });
  const send = async (to: Address, data: Hex): Promise<Hex> => {
    const r = await fetch(`${PRIVY}/wallets/${walletId}/rpc`, { method: 'POST', headers: hdrs(), body: JSON.stringify({ method: 'eth_sendTransaction', caip2: 'eip155:8453', chain_type: 'ethereum', params: { transaction: { to, data } } }) });
    if (!r.ok) throw new Error(`Privy send failed: ${await r.text()}`);
    return ((await r.json()) as { data: { hash: Hex } }).data.hash;
  };

  const client = createPublicClient({ chain: base, transport: http(rpcUrl) });
  const balance = await client.readContract({ address: DIEM, abi: ERC20_ABI, functionName: 'balanceOf', args: [AGENT] });

  if (balance < MIN_STAKE) throw new Error(`DIEM balance ${formatUnits(balance, 18)} below minimum stake of 1 DIEM`);
  console.log(`${dryRun ? '[dry-run] Would stake' : 'Staking'} ${formatUnits(balance, 18)} DIEM...`);

  if (dryRun) return;

  const calldata = encodeAbiParameters(parseAbiParameters('uint256'), [balance]);
  const tx = await send(DIEM, `0xa694fc3a${calldata.slice(2)}` as Hex);
  const receipt = await client.waitForTransactionReceipt({ hash: tx });

  console.log(`tx:     ${tx}`);
  console.log(`status: ${receipt.status}`);
}

main().catch(e => { console.error(e); process.exit(1); });
