import { Grid } from '@/hooks/use2048';
import { GameTile } from './GameTile';
import { useRef, useCallback } from 'react';

interface GameBoardProps {
  grid: Grid;
  onMove: (direction: 'left' | 'right' | 'up' | 'down') => void;
  disabled?: boolean;
}

export const GameBoard = ({ grid, onMove, disabled = false }: GameBoardProps) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // Prevent pull-to-refresh and scrolling while swiping on the board
    if (touchStartRef.current) {
      e.preventDefault();
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (disabled || !touchStartRef.current) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const minSwipe = 30;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (Math.abs(deltaX) > minSwipe) {
        onMove(deltaX > 0 ? 'right' : 'left');
      }
    } else {
      if (Math.abs(deltaY) > minSwipe) {
        onMove(deltaY > 0 ? 'down' : 'up');
      }
    }

    touchStartRef.current = null;
  }, [onMove, disabled]);

  return (
    <div
      ref={boardRef}
      className={`bg-game-bg p-3 md:p-4 rounded-xl w-full max-w-sm mx-auto touch-none ${disabled ? 'pointer-events-none' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="grid grid-cols-4 gap-2 md:gap-3">
        {grid.flat().map((tile, index) => (
          <GameTile key={tile?.id ?? `empty-${index}`} tile={tile} />
        ))}
      </div>
    </div>
  );
};
