import { Grid } from '@/hooks/use2048';
import { GameTile } from './GameTile';
import { useRef, useCallback, useEffect } from 'react';

interface GameBoardProps {
  grid: Grid;
  onMove: (direction: 'left' | 'right' | 'up' | 'down') => void;
  disabled?: boolean;
}

export const GameBoard = ({ grid, onMove, disabled = false }: GameBoardProps) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Use native event listeners with { passive: false } to reliably prevent pull-to-refresh
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Always prevent default while touching the board to block pull-to-refresh
      if (touchStartRef.current) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (disabled || !touchStartRef.current) {
        touchStartRef.current = null;
        return;
      }

      e.preventDefault();
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
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onMove, disabled]);

  return (
    <div
      ref={boardRef}
      className={`bg-game-bg p-3 md:p-4 rounded-xl w-full max-w-sm mx-auto touch-none ${disabled ? 'pointer-events-none' : ''}`}
    >
      <div className="grid grid-cols-4 gap-2 md:gap-3">
        {grid.flat().map((tile, index) => (
          <GameTile key={tile?.id ?? `empty-${index}`} tile={tile} />
        ))}
      </div>
    </div>
  );
};
