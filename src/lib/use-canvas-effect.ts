"use client";

import { useEffect, useRef } from "react";

export type CanvasFrame = {
  ctx: CanvasRenderingContext2D;
  /** CSS pixels (already corrected for devicePixelRatio). */
  width: number;
  height: number;
  /** Milliseconds elapsed while the canvas was visible. */
  time: number;
  dt: number;
  frame: number;
};

export type CanvasRef = React.RefObject<HTMLCanvasElement | null>;

/**
 * Drives a canvas with requestAnimationFrame.
 *
 * - devicePixelRatio aware (capped at 2)
 * - resizes with a ResizeObserver
 * - pauses while offscreen (IntersectionObserver)
 * - draws a single static frame when the user prefers reduced motion
 */
export function useCanvasEffect(draw: (frame: CanvasFrame) => void): CanvasRef {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useRef(draw);

  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.imageSmoothingEnabled = true;
    };

    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let visible = true;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible = entry.isIntersecting;
      },
      { rootMargin: "160px" },
    );
    io.observe(canvas);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let last = performance.now();
    let time = 0;
    let frame = 0;

    const loop = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;

      if (visible || frame === 0) {
        time += dt;
        frame += 1;
        drawRef.current({ ctx, width, height, time, dt, frame });
      }

      if (!reduce) raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return ref;
}
