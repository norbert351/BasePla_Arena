import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Coins, AlertCircle } from 'lucide-react';

export type PaymentToken = 'ETH' | 'USDC';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPay: (token: PaymentToken) => void;
  feeETH: string;
  feeUSDC: string;
  balanceETH?: string;
  balanceUSDC?: string;
  isLoading?: boolean;
  feeAddress: string;
}

export const PaymentModal = ({
  isOpen,
  onClose,
  onPay,
  feeETH,
  feeUSDC,
  balanceETH = '0',
  balanceUSDC = '0',
  isLoading = false,
  feeAddress,
}: PaymentModalProps) => {
  const [selectedToken, setSelectedToken] = useState<PaymentToken>('ETH');
  
  const fee = selectedToken === 'ETH' ? feeETH : feeUSDC;
  const balance = selectedToken === 'ETH' ? balanceETH : balanceUSDC;
  const hasEnoughBalance = parseFloat(balance) >= parseFloat(fee);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-center text-xl flex items-center justify-center gap-2">
            <Coins className="text-accent" />
            Pay to Play
          </DialogTitle>
          <DialogDescription className="text-center">
            Select your preferred payment token
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          {/* Token Selection */}
          <div className="flex gap-2 w-full">
            <Button
              variant={selectedToken === 'ETH' ? 'default' : 'outline'}
              onClick={() => setSelectedToken('ETH')}
              className={`flex-1 ${selectedToken === 'ETH' ? 'gradient-primary text-primary-foreground' : ''}`}
            >
              <span className="font-bold">ETH</span>
            </Button>
            <Button
              variant={selectedToken === 'USDC' ? 'default' : 'outline'}
              onClick={() => setSelectedToken('USDC')}
              className={`flex-1 ${selectedToken === 'USDC' ? 'gradient-primary text-primary-foreground' : ''}`}
            >
              <span className="font-bold">USDC</span>
            </Button>
          </div>

          <div className="w-full p-4 rounded-lg bg-secondary/50 border border-border">
            <div className="flex justify-between items-center mb-2">
              <span className="text-muted-foreground">Game Fee:</span>
              <span className="font-bold text-accent">{fee} {selectedToken}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Your Balance:</span>
              <span className="font-semibold">{balance} {selectedToken}</span>
            </div>
          </div>

          {/* Fee Collection Address */}
          <div className="w-full p-3 rounded-lg bg-muted/30 border border-border">
            <p className="text-xs text-muted-foreground mb-1">Fees sent to:</p>
            <p className="text-xs font-mono text-foreground/80 break-all">{feeAddress}</p>
          </div>

          {!hasEnoughBalance && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>Insufficient {selectedToken} balance</span>
            </div>
          )}

          <div className="flex gap-3 w-full">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={() => onPay(selectedToken)}
              disabled={!hasEnoughBalance || isLoading}
              className="flex-1 gradient-gold text-accent-foreground hover:opacity-90"
            >
              {isLoading ? 'Processing...' : `Pay ${fee} ${selectedToken}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
