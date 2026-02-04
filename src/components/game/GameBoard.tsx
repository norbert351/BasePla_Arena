import { Grid } from '@/hooks/use2048';
import { GameTile } from './GameTile';
import { useRef, useEffect, useState } from 'react';

interface GameBoardProps {
  grid: Grid;
  onMove: (direction: 'left' | 'right' | 'up' | 'down') => void;
  disabled?: boolean;
}

export const GameBoard = ({ grid, onMove, disabled = false }: GameBoardProps) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (disabled) return;
    
    const board = boardRef.current;
    if (!board) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      setTouchStart({ x: touch.clientX, y: touch.clientY });
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStart) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStart.x;
      const deltaY = touch.clientY - touchStart.y;
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

      setTouchStart(null);
    };

    board.addEventListener('touchstart', handleTouchStart, { passive: true });
    board.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      board.removeEventListener('touchstart', handleTouchStart);
      board.removeEventListener('touchend', handleTouchEnd);
    };
  }, [touchStart, onMove, disabled]);

  return (
    <div
      ref={boardRef}
      className={`bg-game-bg p-3 md:p-4 rounded-xl w-full max-w-sm mx-auto ${disabled ? 'pointer-events-none' : ''}`}
    >
      <div className="grid grid-cols-4 gap-2 md:gap-3">
        {grid.flat().map((tile, index) => (
          <GameTile key={tile?.id ?? `empty-${index}`} tile={tile} />
        ))}
      </div>
    </div>
  );
};
