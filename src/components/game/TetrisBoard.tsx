import { useRef, useEffect, useState } from 'react';

interface TetrisBoardProps {
  board: (string | null)[][];
  disabled?: boolean;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onMoveDown?: () => void;
  onRotate?: () => void;
  onHardDrop?: () => void;
}

export const TetrisBoard = ({ board, disabled, onMoveLeft, onMoveRight, onMoveDown, onRotate, onHardDrop }: TetrisBoardProps) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => {
    if (disabled) return;
    const el = boardRef.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() });
    };
    const handleTouchMove = (e: TouchEvent) => e.preventDefault();
    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      if (!touchStart) return;
      const dx = e.changedTouches[0].clientX - touchStart.x;
      const dy = e.changedTouches[0].clientY - touchStart.y;
      const elapsed = Date.now() - touchStart.time;
      const minSwipe = 30;
      if (Math.abs(dx) < minSwipe && Math.abs(dy) < minSwipe && elapsed < 300) {
        onRotate?.();
      } else if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dx) > minSwipe) dx > 0 ? onMoveRight?.() : onMoveLeft?.();
      } else {
        if (dy > minSwipe) onHardDrop?.();
        else if (dy < -minSwipe) onRotate?.();
      }
      setTouchStart(null);
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: false });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [touchStart, disabled, onMoveLeft, onMoveRight, onMoveDown, onRotate, onHardDrop]);

  return (
    <div ref={boardRef} className={`bg-game-bg p-2 rounded-xl w-full max-w-[220px] mx-auto ${disabled ? 'pointer-events-none' : ''}`}>
      <div className="grid grid-cols-10 gap-[1px]" style={{ aspectRatio: '1/1' }}>
        {board.flat().map((cell, i) => (
          <div
            key={i}
            className="rounded-[2px]"
            style={{
              backgroundColor: cell || 'hsl(var(--tile-empty))',
              aspectRatio: '1',
            }}
          />
        ))}
      </div>
    </div>
  );
};
