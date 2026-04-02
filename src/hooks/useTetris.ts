import { useState, useCallback, useEffect, useRef } from 'react';

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

type Cell = string | null;
type Board = Cell[][];

interface Position { x: number; y: number }

const TETROMINOS: Record<string, { shape: number[][]; color: string }> = {
  I: { shape: [[1, 1, 1, 1]], color: 'hsl(187, 71%, 53%)' },
  O: { shape: [[1, 1], [1, 1]], color: 'hsl(45, 100%, 55%)' },
  T: { shape: [[0, 1, 0], [1, 1, 1]], color: 'hsl(280, 65%, 55%)' },
  S: { shape: [[0, 1, 1], [1, 1, 0]], color: 'hsl(120, 65%, 50%)' },
  Z: { shape: [[1, 1, 0], [0, 1, 1]], color: 'hsl(0, 75%, 55%)' },
  J: { shape: [[1, 0, 0], [1, 1, 1]], color: 'hsl(217, 91%, 60%)' },
  L: { shape: [[0, 0, 1], [1, 1, 1]], color: 'hsl(30, 95%, 55%)' },
};

const PIECE_KEYS = Object.keys(TETROMINOS);

const createBoard = (): Board =>
  Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));

const randomPiece = () => {
  const key = PIECE_KEYS[Math.floor(Math.random() * PIECE_KEYS.length)];
  return { shape: TETROMINOS[key].shape, color: TETROMINOS[key].color, type: key };
};

const rotate = (shape: number[][]): number[][] => {
  const rows = shape.length;
  const cols = shape[0].length;
  const rotated: number[][] = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      rotated[c][rows - 1 - r] = shape[r][c];
  return rotated;
};

const isValid = (board: Board, shape: number[][], pos: Position): boolean => {
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[0].length; c++) {
      if (!shape[r][c]) continue;
      const newR = pos.y + r;
      const newC = pos.x + c;
      if (newC < 0 || newC >= BOARD_WIDTH || newR >= BOARD_HEIGHT) return false;
      if (newR >= 0 && board[newR][newC]) return false;
    }
  return true;
};

const merge = (board: Board, shape: number[][], pos: Position, color: string): Board => {
  const newBoard = board.map(row => [...row]);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[0].length; c++)
      if (shape[r][c]) {
        const newR = pos.y + r;
        if (newR >= 0) newBoard[newR][pos.x + c] = color;
      }
  return newBoard;
};

const clearLines = (board: Board): { board: Board; cleared: number } => {
  const kept = board.filter(row => row.some(cell => !cell));
  const cleared = BOARD_HEIGHT - kept.length;
  const emptyRows = Array.from({ length: cleared }, () => Array(BOARD_WIDTH).fill(null));
  return { board: [...emptyRows, ...kept], cleared };
};

const POINTS = [0, 100, 300, 500, 800];

export const useTetris = () => {
  const [board, setBoard] = useState<Board>(createBoard);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [frozen, setFrozen] = useState(true); // frozen until paid
  const pieceRef = useRef(randomPiece());
  const posRef = useRef<Position>({ x: 3, y: -2 });
  const [, forceRender] = useState(0);
  const rerender = () => forceRender(n => n + 1);

  const spawnPiece = useCallback(() => {
    const p = randomPiece();
    const startPos = { x: Math.floor((BOARD_WIDTH - p.shape[0].length) / 2), y: -p.shape.length };
    pieceRef.current = p;
    posRef.current = startPos;
    return { piece: p, pos: startPos };
  }, []);

  const lockPiece = useCallback(() => {
    setBoard(prev => {
      const merged = merge(prev, pieceRef.current.shape, posRef.current, pieceRef.current.color);
      const { board: cleared, cleared: linesCleared } = clearLines(merged);

      if (linesCleared > 0) {
        setScore(s => s + POINTS[Math.min(linesCleared, 4)] * level);
        setLines(l => {
          const newLines = l + linesCleared;
          setLevel(Math.floor(newLines / 10) + 1);
          return newLines;
        });
      }

      const { piece, pos } = spawnPiece();
      if (!isValid(cleared, piece.shape, pos)) {
        setGameOver(true);
      }

      rerender();
      return cleared;
    });
  }, [level, spawnPiece]);

  const moveDown = useCallback(() => {
    if (gameOver || isPaused || frozen) return;
    const newPos = { ...posRef.current, y: posRef.current.y + 1 };
    setBoard(prev => {
      if (isValid(prev, pieceRef.current.shape, newPos)) {
        posRef.current = newPos;
        rerender();
        return prev;
      }
      lockPiece();
      return prev;
    });
  }, [gameOver, isPaused, lockPiece]);

  const moveHorizontal = useCallback((dir: -1 | 1) => {
    if (gameOver || isPaused || frozen) return;
    const newPos = { ...posRef.current, x: posRef.current.x + dir };
    setBoard(prev => {
      if (isValid(prev, pieceRef.current.shape, newPos)) {
        posRef.current = newPos;
        rerender();
      }
      return prev;
    });
  }, [gameOver, isPaused]);

  const rotatePiece = useCallback(() => {
    if (gameOver || isPaused) return;
    const rotated = rotate(pieceRef.current.shape);
    setBoard(prev => {
      if (isValid(prev, rotated, posRef.current)) {
        pieceRef.current = { ...pieceRef.current, shape: rotated };
        rerender();
      }
      return prev;
    });
  }, [gameOver, isPaused]);

  const hardDrop = useCallback(() => {
    if (gameOver || isPaused) return;
    setBoard(prev => {
      let newY = posRef.current.y;
      while (isValid(prev, pieceRef.current.shape, { ...posRef.current, y: newY + 1 })) newY++;
      posRef.current = { ...posRef.current, y: newY };
      rerender();
      lockPiece();
      return prev;
    });
  }, [gameOver, isPaused, lockPiece]);

  // Auto-drop
  useEffect(() => {
    if (gameOver || isPaused) return;
    const speed = Math.max(100, 800 - (level - 1) * 70);
    const interval = setInterval(moveDown, speed);
    return () => clearInterval(interval);
  }, [moveDown, level, gameOver, isPaused]);

  // Keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      switch (e.key) {
        case 'ArrowLeft': moveHorizontal(-1); break;
        case 'ArrowRight': moveHorizontal(1); break;
        case 'ArrowDown': moveDown(); break;
        case 'ArrowUp': rotatePiece(); break;
        case ' ': hardDrop(); break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [moveHorizontal, moveDown, rotatePiece, hardDrop]);

  const resetGame = useCallback(() => {
    setBoard(createBoard());
    setScore(0);
    setLevel(1);
    setLines(0);
    setGameOver(false);
    setIsPaused(false);
    spawnPiece();
    rerender();
  }, [spawnPiece]);

  // Build display board with active piece
  const displayBoard = board.map(row => [...row]);
  const piece = pieceRef.current;
  const pos = posRef.current;
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[0].length; c++)
      if (piece.shape[r][c]) {
        const dr = pos.y + r;
        const dc = pos.x + c;
        if (dr >= 0 && dr < BOARD_HEIGHT && dc >= 0 && dc < BOARD_WIDTH)
          displayBoard[dr][dc] = piece.color;
      }

  return {
    board: displayBoard,
    score,
    level,
    lines,
    gameOver,
    isPaused,
    moveDown,
    moveHorizontal,
    rotatePiece,
    hardDrop,
    resetGame,
    togglePause: () => setIsPaused(p => !p),
  };
};
