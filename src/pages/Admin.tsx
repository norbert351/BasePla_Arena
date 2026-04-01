import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { AdminDashboard } from '@/components/AdminDashboard';
import { WalletConnect } from '@/components/game/WalletConnect';
import { ArrowLeft, Lock } from 'lucide-react';
import baseplayLogo from '@/assets/baseplay-logo.png';

const CREATOR_WALLETS = [
  '0xadf983e3d07d6abf344e1923f1d2164d8dffd816',
  '0xf79f164e634b76815b80b60a85e1258eb21d631c',
].map(addr => addr.toLowerCase());

const Admin = () => {
  const { address, isConnected } = useAccount();
  const isAdmin = isConnected && address && CREATOR_WALLETS.includes(address.toLowerCase());

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-background to-secondary/30 px-4 py-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            <img src={baseplayLogo} alt="BasePlay" className="h-8 w-8" width={32} height={32} />
          </Link>
          <h1 className="text-2xl font-bold ml-2">Admin Dashboard</h1>
        </div>

        {!isConnected ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Lock className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-4">Connect Admin Wallet</h3>
            <WalletConnect onConnect={() => {}} onDisconnect={() => {}} />
          </div>
        ) : isAdmin ? (
          <AdminDashboard />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Lock className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Admin Access Required</h3>
            <p className="text-muted-foreground">This section is restricted to authorized creator wallets.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
