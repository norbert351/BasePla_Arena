import { Tile } from '@/hooks/use2048';
import { cn } from '@/lib/utils';

interface GameTileProps {
  tile: Tile | null;
}

const getTileStyles = (value: number): string => {
  const styles: Record<number, string> = {
    2: 'bg-tile-2 text-foreground',
    4: 'bg-tile-4 text-foreground',
    8: 'bg-tile-8 text-primary-foreground',
    16: 'bg-tile-16 text-primary-foreground',
    32: 'bg-tile-32 text-primary-foreground',
    64: 'bg-tile-64 text-primary-foreground',
    128: 'bg-tile-128 text-foreground',
    256: 'bg-tile-256 text-foreground',
    512: 'bg-tile-512 text-foreground',
    1024: 'bg-tile-1024 text-primary-foreground',
    2048: 'bg-tile-2048 text-primary-foreground',
  };
  return styles[value] || 'bg-tile-2048 text-primary-foreground';
};

const getFontSize = (value: number): string => {
  if (value >= 1000) return 'text-xl md:text-2xl';
  if (value >= 100) return 'text-2xl md:text-3xl';
  return 'text-3xl md:text-4xl';
};

export const GameTile = ({ tile }: GameTileProps) => {
  if (!tile) {
    return (
      <div className="aspect-square rounded-lg bg-game-empty" />
    );
  }

  return (
    <div
      className={cn(
        'aspect-square rounded-lg flex items-center justify-center font-bold tile-shadow',
        getTileStyles(tile.value),
        getFontSize(tile.value)
      )}
    >
      {tile.value}
    </div>
  );
};
