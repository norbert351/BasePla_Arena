import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LogOut, X } from 'lucide-react';

interface ExitGameModalProps {
  isOpen: boolean;
  score: number;
  onCancel: () => void;
  onExit: () => Promise<void>;
}

export const ExitGameModal = ({ isOpen, score, onCancel, onExit }: ExitGameModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="sm:max-w-sm bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">Leave Game?</DialogTitle>
          <DialogDescription className="text-center">
            Your current score will be saved automatically before exit.
          </DialogDescription>
        </DialogHeader>
        <div className="text-center py-2">
          <p className="text-muted-foreground text-sm">Current Score</p>
          <p className="text-3xl font-bold gradient-title">{score.toLocaleString()}</p>
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <Button
            onClick={onExit}
            className="gradient-primary text-primary-foreground"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Save Score & Exit
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
