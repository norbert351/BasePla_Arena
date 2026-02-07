import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Coins, AlertCircle, CheckCircle } from 'lucide-react';

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
  isCreator?: boolean;
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
  isCreator = false,
}: PaymentModalProps) => {
  // For creators, force ETH selection and hide USDC option
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
            {isCreator ? 'Creator Sign-In' : 'Pay to Play'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {isCreator 
              ? 'Verify your creator wallet with a small transaction on Base'
              : 'Select your preferred payment token on Base'
            }
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          {/* Token Selection - Hidden for creators (ETH only) */}
          {!isCreator && (
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
          )}

          {isCreator && (
            <div className="w-full p-3 rounded-lg bg-primary/10 border border-primary/30 text-center">
              <p className="text-sm font-medium text-primary">👑 Creator Wallet Detected</p>
              <p className="text-xs text-muted-foreground mt-1">You only pay a verification fee</p>
            </div>
          )}

          <div className="w-full p-4 rounded-lg bg-secondary/50 border border-border">
            <div className="flex justify-between items-center mb-2">
              <span className="text-muted-foreground">{isCreator ? 'Verification Fee:' : 'Game Fee:'}</span>
              <span className="font-bold text-accent">{fee} {isCreator ? 'ETH' : selectedToken}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Your Balance:</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{parseFloat(balance).toFixed(isCreator || selectedToken === 'ETH' ? 6 : 2)} {isCreator ? 'ETH' : selectedToken}</span>
                {hasEnoughBalance ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
              </div>
            </div>
          </div>

          {!hasEnoughBalance && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-secondary p-3 rounded-lg w-full border border-destructive/30">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>Insufficient {isCreator ? 'ETH' : selectedToken} balance. Please add funds to your wallet on Base network.</span>
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
              {isLoading ? 'Processing...' : isCreator ? `Verify (${fee} ETH)` : `Pay ${fee} ${selectedToken}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
