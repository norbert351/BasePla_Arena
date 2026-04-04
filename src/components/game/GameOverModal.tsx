import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trophy, RotateCcw, Save } from 'lucide-react';
import { useState } from 'react';

interface GameOverModalProps {
  isOpen: boolean;
  score: number;
  won: boolean;
  onPlayAgain: () => void;
  onClose?: () => void;
  onSaveScore?: () => Promise<boolean>;
  scoreSaved?: boolean;
}

export const GameOverModal = ({ isOpen, score, won, onPlayAgain, onClose, onSaveScore, scoreSaved }: GameOverModalProps) => {
  const [saving, setSaving] = useState(false);

  const handleOpenChange = (open: boolean) => {
    if (!open && onClose) {
      onClose();
    }
  };

  const handleSave = async () => {
    if (!onSaveScore) return;
    setSaving(true);
    try {
      await onSaveScore();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl flex items-center justify-center gap-2">
            <Trophy className={won ? 'text-accent' : 'text-muted-foreground'} />
            {won ? 'You Won!' : 'Game Over'}
          </DialogTitle>
          <DialogDescription className="text-center text-lg">
            {won ? 'Congratulations! You reached 2048!' : 'No more moves available.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="text-center">
            <p className="text-muted-foreground text-sm">Final Score</p>
            <p className="text-4xl font-bold gradient-title">{score.toLocaleString()}</p>
          </div>

          {onSaveScore && (
            <Button
              onClick={handleSave}
              disabled={saving || scoreSaved}
              variant="outline"
              className={scoreSaved ? 'text-green-500 border-green-500' : ''}
            >
              <Save className="mr-2 h-4 w-4" />
              {scoreSaved ? 'Score Saved to Leaderboard ✓' : saving ? 'Saving...' : 'Save Score to Leaderboard'}
            </Button>
          )}

          <Button
            onClick={(e) => {
              e.stopPropagation();
              onPlayAgain();
            }}
            className="gradient-primary text-primary-foreground glow-primary hover:opacity-90"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Play Again
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
