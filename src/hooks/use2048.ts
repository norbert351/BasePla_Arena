import { useState, useCallback, useEffect } from 'react';

export type Tile = {
  value: number;
  id: number;
  isNew?: boolean;
  isMerged?: boolean;
};

export type Grid = (Tile | null)[][];

let tileIdCounter = 0;

const createTile = (value: number): Tile => ({
  value,
  id: tileIdCounter++,
  isNew: true,
});

const createEmptyGrid = (): Grid => {
  return Array(4).fill(null).map(() => Array(4).fill(null));
};

const getEmptyCells = (grid: Grid): [number, number][] => {
  const emptyCells: [number, number][] = [];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      if (!grid[i][j]) {
        emptyCells.push([i, j]);
      }
    }
  }
  return emptyCells;
};

const addRandomTile = (grid: Grid): Grid => {
  const emptyCells = getEmptyCells(grid);
  if (emptyCells.length === 0) return grid;

  const [row, col] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  const newGrid = grid.map(row => [...row]);
  newGrid[row][col] = createTile(Math.random() < 0.9 ? 2 : 4);
  return newGrid;
};

const rotateGrid = (grid: Grid): Grid => {
  const newGrid = createEmptyGrid();
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      newGrid[j][3 - i] = grid[i][j];
    }
  }
  return newGrid;
};

const slideAndMerge = (row: (Tile | null)[]): { row: (Tile | null)[]; score: number } => {
  const tiles = row.filter(tile => tile !== null) as Tile[];
  const newRow: (Tile | null)[] = [];
  let score = 0;

  for (let i = 0; i < tiles.length; i++) {
    if (i < tiles.length - 1 && tiles[i].value === tiles[i + 1].value) {
      const newValue = tiles[i].value * 2;
      newRow.push({ ...createTile(newValue), isMerged: true, isNew: false });
      score += newValue;
      i++;
    } else {
      newRow.push({ ...tiles[i], isNew: false, isMerged: false });
    }
  }

  while (newRow.length < 4) {
    newRow.push(null);
  }

  return { row: newRow, score };
};

const moveLeft = (grid: Grid): { grid: Grid; score: number; moved: boolean } => {
  let totalScore = 0;
  let moved = false;
  const newGrid = grid.map(row => {
    const { row: newRow, score } = slideAndMerge(row);
    totalScore += score;
    if (JSON.stringify(row) !== JSON.stringify(newRow)) {
      moved = true;
    }
    return newRow;
  });
  return { grid: newGrid, score: totalScore, moved };
};

const canMove = (grid: Grid): boolean => {
  // Check for empty cells
  if (getEmptyCells(grid).length > 0) return true;

  // Check for possible merges
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const current = grid[i][j];
      if (!current) continue;

      // Check right
      if (j < 3 && grid[i][j + 1]?.value === current.value) return true;
      // Check down
      if (i < 3 && grid[i + 1][j]?.value === current.value) return true;
    }
  }
  return false;
};

const hasWon = (grid: Grid): boolean => {
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      if (grid[i][j]?.value === 2048) return true;
    }
  }
  return false;
};

export const use2048 = () => {
  const [grid, setGrid] = useState<Grid>(() => {
    let newGrid = createEmptyGrid();
    newGrid = addRandomTile(newGrid);
    newGrid = addRandomTile(newGrid);
    return newGrid;
  });
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(() => {
    const saved = localStorage.getItem('2048-best-score');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [moveCount, setMoveCount] = useState(0);

  useEffect(() => {
    if (score > bestScore) {
      setBestScore(score);
      localStorage.setItem('2048-best-score', score.toString());
    }
  }, [score, bestScore]);

  const move = useCallback((direction: 'left' | 'right' | 'up' | 'down') => {
    if (gameOver) return;

    let workingGrid = grid.map(row => [...row]);

    // Rotate grid to make all moves equivalent to left
    const rotations = { left: 0, up: 1, right: 2, down: 3 };
    for (let i = 0; i < rotations[direction]; i++) {
      workingGrid = rotateGrid(workingGrid);
    }

    const { grid: movedGrid, score: moveScore, moved } = moveLeft(workingGrid);

    if (!moved) return;

    // Rotate back
    let finalGrid = movedGrid;
    for (let i = 0; i < (4 - rotations[direction]) % 4; i++) {
      finalGrid = rotateGrid(finalGrid);
    }

    finalGrid = addRandomTile(finalGrid);

    setGrid(finalGrid);
    setScore(prev => prev + moveScore);
    setMoveCount(prev => prev + 1);

    if (hasWon(finalGrid) && !won) {
      setWon(true);
    }

    if (!canMove(finalGrid)) {
      setGameOver(true);
    }
  }, [grid, gameOver, won]);

  const resetGame = useCallback(() => {
    let newGrid = createEmptyGrid();
    newGrid = addRandomTile(newGrid);
    newGrid = addRandomTile(newGrid);
    setGrid(newGrid);
    setScore(0);
    setGameOver(false);
    setWon(false);
    setMoveCount(0);
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const direction = e.key.replace('Arrow', '').toLowerCase() as 'left' | 'right' | 'up' | 'down';
        move(direction);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [move]);

  return {
    grid,
    score,
    bestScore,
    gameOver,
    won,
    moveCount,
    move,
    resetGame,
  };
};
