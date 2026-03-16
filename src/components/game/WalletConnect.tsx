import { useCallback, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Copy, Wallet, RefreshCw, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { getETHBalance, getUSDCBalance } from '@/lib/blockchain';
import { resolveBasename, getBaseProfileUrl, type BaseProfile } from '@/lib/basename';
import { useState } from 'react';
import type { Address } from 'viem';

interface WalletConnectProps {
  onConnect?: (address: string, profile?: BaseProfile) => void;
  onDisconnect?: () => void;
  onBalanceUpdate?: (ethBalance: string, usdcBalance: string) => void;
}

export const WalletConnect = ({ onConnect, onDisconnect, onBalanceUpdate }: WalletConnectProps) => {
  const { address, isConnected } = useAccount();
  const { connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();

  const [profile, setProfile] = useState<BaseProfile | null>(null);
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

  // React to wagmi connection state changes
  useEffect(() => {
    if (isConnected && address) {
      fetchProfile(address).then((baseProfile) => {
        onConnect?.(address, baseProfile || undefined);
      });
      fetchBalances(address);
    } else if (!isConnected) {
      setProfile(null);
      onBalanceUpdate?.('0', '0');
    }
  }, [isConnected, address, fetchProfile, fetchBalances, onConnect, onBalanceUpdate]);

  const handleConnect = () => {
    connect({ connector: injected() });
  };

  const handleDisconnect = () => {
    disconnect();
    setProfile(null);
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

  const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const openProfile = () => {
    if (profile?.name) {
      window.open(getBaseProfileUrl(profile.name), '_blank');
    } else if (address) {
      window.open(getBaseProfileUrl(address), '_blank');
    }
  };

  if (isConnected && address) {
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
            onClick={handleDisconnect}
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
      onClick={handleConnect}
      disabled={isConnecting}
      className="gradient-primary text-primary-foreground glow-primary hover:opacity-90 transition-opacity"
    >
      <Wallet className="mr-2 h-4 w-4" />
      {isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </Button>
  );
};
