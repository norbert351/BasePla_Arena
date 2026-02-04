import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Wallet, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getETHBalance, getUSDCBalance, switchToBaseNetwork } from '@/lib/blockchain';
import type { Address } from 'viem';

interface WalletConnectProps {
  onConnect?: (address: string) => void;
  onDisconnect?: () => void;
  onBalanceUpdate?: (ethBalance: string, usdcBalance: string) => void;
}

export const WalletConnect = ({ onConnect, onDisconnect, onBalanceUpdate }: WalletConnectProps) => {
  const [address, setAddress] = useState<string | null>(null);
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

  useEffect(() => {
    const savedAddress = localStorage.getItem('wallet-address');
    if (savedAddress) {
      setAddress(savedAddress);
      onConnect?.(savedAddress);
      fetchBalances(savedAddress);
    }
  }, [onConnect, fetchBalances]);

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
        onConnect?.(walletAddress);
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
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Player: {shortenAddress(address)}</span>
          <button onClick={copyAddress} className="hover:text-foreground transition-colors">
            <Copy className="h-4 w-4" />
          </button>
        </div>
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
      request: (args: { method: string; params?: unknown[] }) => Promise<string[]>;
    };
  }
}
