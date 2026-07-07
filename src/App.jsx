import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ProtocolsProvider } from '@/lib/ProtocolsContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import Layout from './components/Layout';
import Home from './pages/Home';
import Yields from './pages/Yields';
import Chains from './pages/Chains';
import Protocols from './pages/Protocols';
import Stablecoins from './pages/Stablecoins';
import DexVolumes from './pages/DexVolumes';
import FeesRevenue from './pages/FeesRevenue';
import Bridges from './pages/Bridges';
import Liquidations from './pages/Liquidations';
import Options from './pages/Options';
import Derivatives from './pages/Derivatives';
import Raises from './pages/Raises';
import Hacks from './pages/Hacks';
import Treasuries from './pages/Treasuries';
import Etf from './pages/Etf';
import Markets from './pages/Markets';
import OnChain from './pages/OnChain';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/yields" element={<Yields />} />
        <Route path="/chains" element={<Chains />} />
        <Route path="/protocols" element={<Protocols />} />
        <Route path="/stablecoins" element={<Stablecoins />} />
        <Route path="/dex-volumes" element={<DexVolumes />} />
        <Route path="/fees-revenue" element={<FeesRevenue />} />
        <Route path="/bridges" element={<Bridges />} />
        <Route path="/liquidations" element={<Liquidations />} />
        <Route path="/options" element={<Options />} />
        <Route path="/derivatives" element={<Derivatives />} />
        <Route path="/raises" element={<Raises />} />
        <Route path="/hacks" element={<Hacks />} />
        <Route path="/treasuries" element={<Treasuries />} />
        <Route path="/etf" element={<Etf />} />
        <Route path="/markets" element={<Markets />} />
        {/* Live Prices was merged into Markets (same CoinGecko source, now with
            auto-refresh) — redirect any old bookmarks/links instead of 404ing. */}
        <Route path="/live-prices" element={<Navigate to="/markets" replace />} />
        <Route path="/on-chain" element={<OnChain />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <ThemeProvider>
    <AuthProvider>
      <ProtocolsProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
      </ProtocolsProvider>
    </AuthProvider>
    </ThemeProvider>
  )
}

export default App