'use client';

import { useEffect, useRef } from 'react';

interface GameOfLifeProps {
  cellSize?: number;
  opacity?: number;
  color?: string;
  speed?: number;
  showAge?: boolean;
}

interface Cell {
  alive: boolean;
  age: number;
}

export function GameOfLife({
  cellSize = 12,
  opacity = 0.06,
  color = 'currentColor',
  speed = 100,
  showAge = false,
}: GameOfLifeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let id: number;

    let grid: Cell[][] = [];

    const createGrid = (
      cols: number,
      rows: number,
      density = 0.15,
    ): Cell[][] => {
      return Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => ({
          alive: Math.random() < density,
          age: 0,
        })),
      );
    };

    const countNeighbors = (x: number, y: number) => {
      let count = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const ny = (y + dy + grid.length) % grid.length;
          const nx = (x + dx + grid[0].length) % grid[0].length;
          if (grid[ny][nx].alive) count++;
        }
      return count;
    };

    const nextGeneration = () => {
      const newGrid: Cell[][] = grid.map((row) =>
        row.map((cell) => ({ ...cell })),
      );
      for (let y = 0; y < grid.length; y++)
        for (let x = 0; x < grid[y].length; x++) {
          const neighbors = countNeighbors(x, y);
          const wasAlive = grid[y][x].alive;
          newGrid[y][x].alive = wasAlive
            ? neighbors === 2 || neighbors === 3
            : neighbors === 3;
          if (newGrid[y][x].alive === wasAlive) {
            newGrid[y][x].age++;
          } else newGrid[y][x].age = 0;
        }
      grid = newGrid;
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = color;

      for (let y = 0; y < grid.length; y++)
        for (let x = 0; x < grid[y].length; x++) {
          if (grid[y][x].alive) 
            ctx.fillRect(
              x * cellSize,
              y * cellSize,
              cellSize - 1,
              cellSize - 1,
            );

          if (showAge && grid[y][x].age >= 0) {
            ctx.fillStyle = grid[y][x].alive
              ? 'rgba(255, 255, 255, 0.8)'
              : color;
            ctx.font = `${Math.max(8, cellSize - 2)}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
              grid[y][x].age.toString(),
              x * cellSize + cellSize / 2,
              y * cellSize + cellSize / 2,
            );
            ctx.fillStyle = color;
          }
        }
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const cols = Math.ceil(canvas.width / cellSize);
      const rows = Math.ceil(canvas.height / cellSize);
      grid = createGrid(cols, rows);
    };

    const toggleCell = (x: number, y: number) => {
      if (grid[y] && grid[y][x] !== undefined) {
        grid[y][x].alive = !grid[y][x].alive;
        grid[y][x].age = 0;
      }
    };

    const spawnBatch = (
      centerX: number,
      centerY: number,
      radius: number = 2,
    ) => {
      for (let dy = -radius; dy <= radius; dy++)
        for (let dx = -radius; dx <= radius; dx++) {
          const x = centerX + dx;
          const y = centerY + dy;
          if (grid[y] && grid[y][x] !== undefined && Math.random() < 0.6) {
            grid[y][x].alive = true;
            grid[y][x].age = 0;
          }
        }
      draw();
    };

    const randomToggle = () => {
      if (grid.length === 0 || grid[0].length === 0) return;

      let maxAge = -1;
      const oldestCells: [number, number][] = [];

      for (let y = 0; y < grid.length; y++)
        for (let x = 0; x < grid[y].length; x++) {
          if (grid[y][x].age > maxAge) {
            maxAge = grid[y][x].age;
            oldestCells.length = 0;
            oldestCells.push([x, y]);
          } else if (grid[y][x].age === maxAge) oldestCells.push([x, y]);
        }
      if (oldestCells.length > 0) {
        const [x, y] =
          oldestCells[Math.floor(Math.random() * oldestCells.length)];
        spawnBatch(x, y, Math.floor(Math.random() * 3) + 1);
      }
    };

    let lastTime = 0;
    const animate = (time: number) => {
      if (time - lastTime >= speed) {
        randomToggle();
        nextGeneration();
        draw();
        lastTime = time;
      }
      id = requestAnimationFrame(animate);
    };

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / cellSize);
      const y = Math.floor((e.clientY - rect.top) / cellSize);
      toggleCell(x, y);
    };

    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('click', handleClick);
    id = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('click', handleClick);
      cancelAnimationFrame(id);
    };
  }, [cellSize, color, speed]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 cursor-pointer"
      style={{ opacity }}
    />
  );
}
