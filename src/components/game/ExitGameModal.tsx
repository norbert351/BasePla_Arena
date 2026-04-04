import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Save, LogOut, X } from 'lucide-react';
import { useState } from 'react';

interface ExitGameModalProps {
  isOpen: boolean;
  score: number;
  onCancel: () => void;
  onSaveAndExit: () => Promise<void>;
  onExitWithoutSaving: () => void;
}

export const ExitGameModal = ({ isOpen, score, onCancel, onSaveAndExit, onExitWithoutSaving }: ExitGameModalProps) => {
  const [saving, setSaving] = useState(false);

  const handleSaveAndExit = async () => {
    setSaving(true);
    try {
      await onSaveAndExit();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="sm:max-w-sm bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">Leave Game?</DialogTitle>
          <DialogDescription className="text-center">
            Do you want to save your current score before exiting?
          </DialogDescription>
        </DialogHeader>
        <div className="text-center py-2">
          <p className="text-muted-foreground text-sm">Current Score</p>
          <p className="text-3xl font-bold gradient-title">{score.toLocaleString()}</p>
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <Button
            onClick={handleSaveAndExit}
            disabled={saving}
            className="gradient-primary text-primary-foreground"
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Score & Exit'}
          </Button>
          <Button
            variant="outline"
            onClick={onExitWithoutSaving}
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Exit Without Saving
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
