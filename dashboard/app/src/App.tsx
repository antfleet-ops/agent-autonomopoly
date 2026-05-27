import { HashRouter, Routes, Route } from 'react-router-dom';
import Index from './pages/Index';
import VaultDetail from './pages/VaultDetail';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/vault/:address" element={<VaultDetail />} />
      </Routes>
    </HashRouter>
  );
}
