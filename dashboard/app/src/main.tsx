import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PrivyProvider } from '@privy-io/react-auth';
import { base } from 'viem/chains';
import App from './App';
import './index.css';

const appId = import.meta.env['VITE_PRIVY_APP_ID'] as string;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrivyProvider
      appId={appId}
      config={{
        defaultChain: base,
        supportedChains: [base],
        appearance: { theme: 'dark' },
        loginMethods: ['wallet'],
        embeddedWallets: { ethereum: { createOnLogin: 'off' } },
      }}
    >
      <App />
    </PrivyProvider>
  </StrictMode>,
);
