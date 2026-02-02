import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Wallet } from 'lucide-react';
import { toast } from 'sonner';

interface WalletConnectProps {
  onConnect?: (address: string) => void;
  onDisconnect?: () => void;
}

export const WalletConnect = ({ onConnect, onDisconnect }: WalletConnectProps) => {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const savedAddress = localStorage.getItem('wallet-address');
    if (savedAddress) {
      setAddress(savedAddress);
      onConnect?.(savedAddress);
    }
  }, [onConnect]);

  const connectWallet = async () => {
    setIsConnecting(true);
    try {
      if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts',
        });
        const walletAddress = accounts[0];
        setAddress(walletAddress);
        localStorage.setItem('wallet-address', walletAddress);
        onConnect?.(walletAddress);
        toast.success('Wallet connected!');
      } else {
        toast.error('Please install MetaMask or another wallet');
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      toast.error('Failed to connect wallet');
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

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (address) {
    return (
      <div className="flex flex-col items-center gap-2">
        <Button
          variant="outline"
          onClick={disconnectWallet}
          className="gradient-primary text-primary-foreground border-none hover:opacity-90"
        >
          Logout
        </Button>
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
