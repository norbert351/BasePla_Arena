import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Coins, AlertCircle } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPay: () => void;
  fee: string;
  balance?: string;
  isLoading?: boolean;
}

export const PaymentModal = ({
  isOpen,
  onClose,
  onPay,
  fee,
  balance = '0',
  isLoading = false,
}: PaymentModalProps) => {
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
            A small fee is required to play each game session
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-full p-4 rounded-lg bg-secondary/50 border border-border">
            <div className="flex justify-between items-center mb-2">
              <span className="text-muted-foreground">Game Fee:</span>
              <span className="font-bold text-accent">{fee} ETH</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Your Balance:</span>
              <span className="font-semibold">{balance} ETH</span>
            </div>
          </div>

          {!hasEnoughBalance && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>Insufficient balance</span>
            </div>
          )}

          <div className="flex gap-3 w-full">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={onPay}
              disabled={!hasEnoughBalance || isLoading}
              className="flex-1 gradient-gold text-accent-foreground hover:opacity-90"
            >
              {isLoading ? 'Processing...' : 'Pay & Play'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
