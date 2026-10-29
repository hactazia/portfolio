"use client";

import { useRef } from "react";

import { useCanvasEffect } from "@/lib/use-canvas-effect";
import { cn } from "@/lib/utils";

/**
 * Conway's Game of Life, ported from the reference frontend
 * (`.portfolio/frontend/src/components/GameOfLife.tsx`).
 *
 * Ported as-is rather than reimagined, because the look comes from two details
 * a plain Conway loop does not have:
 *
 * - every cell carries an `age` (incremented while its state does not change),
 * - each generation first reseeds a random cluster around the *oldest* cell, so
 *   the colony never dies out into a static still-life graveyard.
 *
 * The grid is stored flat (`y * cols + x`) and toruses on both axes, like the
 * original `countNeighbors`.
 */

type Grid = {
  cols: number;
  rows: number;
  alive: Uint8Array;
  age: Uint32Array;
  nextAlive: Uint8Array;
  nextAge: Uint32Array;
  accumulator: number;
};

export function GameOfLife({
  cellSize = 12,
  opacity = 0.06,
  color = "currentColor",
  speed = 100,
  showAge = false,
  density = 0.15,
  className,
}: {
  /** Side of a cell, in CSS pixels. */
  cellSize?: number;
  opacity?: number;
  /** Any CSS colour, or `currentColor` to follow the canvas text colour. */
  color?: string;
  /** Milliseconds between two generations. */
  speed?: number;
  /** Draw each cell's age (generations since its last change) inside it. */
  showAge?: boolean;
  /** Initial ratio of living cells. */
  density?: number;
  className?: string;
}) {
  const grid = useRef<Grid | null>(null);

  const ref = useCanvasEffect(({ ctx, width, height, dt }) => {
    const canvas = ctx.canvas;
    const cols = Math.ceil(width / cellSize);
    const rows = Math.ceil(height / cellSize);

    if (!grid.current || grid.current.cols !== cols || grid.current.rows !== rows) {
      grid.current = createGrid(cols, rows, density);
    }

    const current = grid.current;
    current.accumulator += dt;

    // Cap the catch-up so a long frame does not burn through dozens of steps.
    let steps = 0;
    while (current.accumulator >= speed && steps < 3) {
      current.accumulator -= speed;
      steps += 1;
      seedOldest(current);
      step(current);
    }

    // Canvas 2D does not understand `currentColor`, so it is resolved to the
    // real computed text colour — re-read every frame so a theme change lands.
    const fill = color === "currentColor" ? getComputedStyle(canvas).color : color;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = fill;

    for (let y = 0; y < rows; y += 1) {
      const row = y * cols;
      for (let x = 0; x < cols; x += 1) {
        if (!current.alive[row + x]) continue;
        ctx.fillRect(x * cellSize, y * cellSize, cellSize - 1, cellSize - 1);
      }
    }

    if (!showAge) return;

    ctx.font = `${Math.max(8, cellSize - 2)}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let y = 0; y < rows; y += 1) {
      const row = y * cols;
      for (let x = 0; x < cols; x += 1) {
        const index = row + x;
        ctx.fillStyle = current.alive[index] ? "rgba(255, 255, 255, 0.8)" : fill;
        ctx.fillText(
          String(current.age[index]),
          x * cellSize + cellSize / 2,
          y * cellSize + cellSize / 2,
        );
      }
    }

    ctx.fillStyle = fill;
  });

  /** Click toggles a cell, like the reference implementation. */
  const onClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const current = grid.current;
    if (!current) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / cellSize);
    const y = Math.floor((event.clientY - rect.top) / cellSize);
    if (x < 0 || y < 0 || x >= current.cols || y >= current.rows) return;

    const index = y * current.cols + x;
    current.alive[index] = current.alive[index] ? 0 : 1;
    current.age[index] = 0;
  };

  return (
    <canvas
      ref={ref}
      aria-hidden
      onClick={onClick}
      className={cn("size-full cursor-pointer", className)}
      style={{ opacity, color: "var(--d-fg-dim)" }}
    />
  );
}

/* -------------------------------------------------------------------------- */

function createGrid(cols: number, rows: number, density: number): Grid {
  const size = cols * rows;
  const alive = new Uint8Array(size);
  for (let index = 0; index < size; index += 1) {
    alive[index] = Math.random() < density ? 1 : 0;
  }

  return {
    cols,
    rows,
    alive,
    age: new Uint32Array(size),
    nextAlive: new Uint8Array(size),
    nextAge: new Uint32Array(size),
    accumulator: 0,
  };
}

/**
 * Reseeds a random cluster around the oldest cell, so the colony keeps
 * producing activity instead of settling into still lifes.
 */
function seedOldest({ cols, rows, alive, age }: Grid) {
  let oldest = -1;
  const candidates: number[] = [];

  for (let index = 0; index < age.length; index += 1) {
    if (age[index] > oldest) {
      oldest = age[index];
      candidates.length = 0;
      candidates.push(index);
    } else if (age[index] === oldest) {
      candidates.push(index);
    }
  }

  if (candidates.length === 0) return;

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  const centerX = pick % cols;
  const centerY = Math.floor(pick / cols);
  const radius = Math.floor(Math.random() * 3) + 1;

  for (let dy = -radius; dy <= radius; dy += 1) {
    const y = centerY + dy;
    if (y < 0 || y >= rows) continue;

    for (let dx = -radius; dx <= radius; dx += 1) {
      const x = centerX + dx;
      if (x < 0 || x >= cols) continue;
      if (Math.random() >= 0.6) continue;

      const target = y * cols + x;
      alive[target] = 1;
      age[target] = 0;
    }
  }
}

/** One generation, with the neighbourhood wrapping on both axes. */
function step({ cols, rows, alive, age, nextAlive, nextAge }: Grid) {
  for (let y = 0; y < rows; y += 1) {
    const up = ((y - 1 + rows) % rows) * cols;
    const down = ((y + 1) % rows) * cols;
    const row = y * cols;

    for (let x = 0; x < cols; x += 1) {
      const left = (x - 1 + cols) % cols;
      const right = (x + 1) % cols;

      const neighbours =
        alive[up + left] +
        alive[up + x] +
        alive[up + right] +
        alive[row + left] +
        alive[row + right] +
        alive[down + left] +
        alive[down + x] +
        alive[down + right];

      const index = row + x;
      const wasAlive = alive[index] === 1;
      const survives = wasAlive ? neighbours === 2 || neighbours === 3 : neighbours === 3;

      nextAlive[index] = survives ? 1 : 0;
      // A cell that did not change keeps ageing; a birth or a death resets it.
      nextAge[index] = survives === wasAlive ? age[index] + 1 : 0;
    }
  }

  alive.set(nextAlive);
  age.set(nextAge);
}
