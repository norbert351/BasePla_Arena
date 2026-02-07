import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Copy, Wallet, RefreshCw, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { getETHBalance, getUSDCBalance, switchToBaseNetwork } from '@/lib/blockchain';
import { resolveBasename, getBaseProfileUrl, type BaseProfile } from '@/lib/basename';
import type { Address } from 'viem';

interface WalletConnectProps {
  onConnect?: (address: string, profile?: BaseProfile) => void;
  onDisconnect?: () => void;
  onBalanceUpdate?: (ethBalance: string, usdcBalance: string) => void;
}

export const WalletConnect = ({ onConnect, onDisconnect, onBalanceUpdate }: WalletConnectProps) => {
  const [address, setAddress] = useState<string | null>(null);
  const [profile, setProfile] = useState<BaseProfile | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  const fetchBalances = useCallback(async (walletAddress: string) => {
    setIsLoadingBalance(true);
    try {
      const [ethBal, usdcBal] = await Promise.all([
        getETHBalance(walletAddress as Address),
        getUSDCBalance(walletAddress as Address),
      ]);
      onBalanceUpdate?.(ethBal, usdcBal);
    } catch (error) {
      console.error('Failed to fetch balances:', error);
      onBalanceUpdate?.('0', '0');
    } finally {
      setIsLoadingBalance(false);
    }
  }, [onBalanceUpdate]);

  const fetchProfile = useCallback(async (walletAddress: string) => {
    try {
      const baseProfile = await resolveBasename(walletAddress);
      setProfile(baseProfile);
      return baseProfile;
    } catch (error) {
      console.error('Failed to fetch Base profile:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    const savedAddress = localStorage.getItem('wallet-address');
    if (savedAddress) {
      setAddress(savedAddress);
      fetchProfile(savedAddress).then((baseProfile) => {
        onConnect?.(savedAddress, baseProfile || undefined);
      });
      fetchBalances(savedAddress);
    }
  }, [onConnect, fetchBalances, fetchProfile]);

  // Keep app state in sync with the wallet (important for in-app browsers)
  useEffect(() => {
    const eth = window.ethereum as any;
    if (!eth?.on) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const accs = Array.isArray(accounts) ? (accounts as unknown[]) : [];
      const next = typeof accs[0] === 'string' ? (accs[0] as string) : null;

      if (!next) {
        setAddress(null);
        setProfile(null);
        localStorage.removeItem('wallet-address');
        onBalanceUpdate?.('0', '0');
        onDisconnect?.();
        toast.info('Wallet disconnected');
        return;
      }

      setAddress(next);
      localStorage.setItem('wallet-address', next);

      fetchProfile(next).then((baseProfile) => {
        onConnect?.(next, baseProfile || undefined);
      });
      fetchBalances(next);

      toast.info('Wallet account updated');
    };

    const handleChainChanged = () => {
      if (address) fetchBalances(address);
    };

    eth.on('accountsChanged', handleAccountsChanged);
    eth.on('chainChanged', handleChainChanged);

    return () => {
      eth.removeListener?.('accountsChanged', handleAccountsChanged);
      eth.removeListener?.('chainChanged', handleChainChanged);
    };
  }, [address, fetchBalances, fetchProfile, onConnect, onDisconnect, onBalanceUpdate]);

  const connectWallet = async () => {
    setIsConnecting(true);
    try {
      if (typeof window.ethereum !== 'undefined') {
        // First switch to Base network
        await switchToBaseNetwork();
        
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts',
        });
        const walletAddress = accounts[0];
        setAddress(walletAddress);
        localStorage.setItem('wallet-address', walletAddress);
        
        // Fetch Base profile
        const baseProfile = await fetchProfile(walletAddress);
        onConnect?.(walletAddress, baseProfile || undefined);
        
        await fetchBalances(walletAddress);
        toast.success('Wallet connected to Base network!');
      } else {
        toast.error('Please install MetaMask or another wallet');
      }
    } catch (error: any) {
      console.error('Failed to connect wallet:', error);
      toast.error(error.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAddress(null);
    setProfile(null);
    localStorage.removeItem('wallet-address');
    onDisconnect?.();
    toast.success('Wallet disconnected');
  };

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      toast.success('Address copied!');
    }
  };

  const refreshBalances = async () => {
    if (address) {
      await fetchBalances(address);
      toast.success('Balances refreshed');
    }
  };

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const openProfile = () => {
    if (profile?.name) {
      window.open(getBaseProfileUrl(profile.name), '_blank');
    } else if (address) {
      window.open(getBaseProfileUrl(address), '_blank');
    }
  };

  if (address) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshBalances}
            disabled={isLoadingBalance}
            className="border-border hover:bg-secondary"
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingBalance ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="outline"
            onClick={disconnectWallet}
            className="gradient-primary text-primary-foreground border-none hover:opacity-90"
          >
            Logout
          </Button>
        </div>
        <button 
          onClick={openProfile}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors group"
        >
          {profile?.avatar && (
            <Avatar className="h-6 w-6">
              <AvatarImage src={profile.avatar} alt={profile.name || 'Profile'} />
              <AvatarFallback className="text-xs">
                {(profile.name || address).slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
          <span className="font-medium">
            {profile?.name || shortenAddress(address)}
          </span>
          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          <button 
            onClick={(e) => { e.stopPropagation(); copyAddress(); }} 
            className="hover:text-foreground transition-colors"
          >
            <Copy className="h-4 w-4" />
          </button>
        </button>
      </div>
    );
  }

  return (
    <Button
      onClick={connectWallet}
      disabled={isConnecting}
      className="gradient-primary text-primary-foreground glow-primary hover:opacity-90 transition-opacity"
    >
      <Wallet className="mr-2 h-4 w-4" />
      {isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </Button>
  );
};

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, listener: (...args: any[]) => void) => void;
      removeListener?: (event: string, listener: (...args: any[]) => void) => void;
    };
  }
}
