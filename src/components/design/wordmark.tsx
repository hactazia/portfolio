"use client";

import { useEffect, useState, type CSSProperties } from "react";

import { Logo } from "@/components/design/logo";
import type { LogoArt } from "@/lib/site";
import { cn } from "@/lib/utils";

import styles from "./wordmark.module.scss";

/** Fallback cap-height ratio when the canvas metrics are unavailable. */
const FALLBACK_CAP_RATIO = 0.72;

type Metrics = {
  /** Measured cap height, in px. */
  cap: number;
  /** Distance from the line-box centre to the cap-height centre, in px. */
  shift: number;
};

/**
 * Reads the real font metrics once the webfont is ready.
 *
 * `line-height` is 1, so the line box is exactly `size` tall and the baseline
 * sits at `(size - (ascent + descent)) / 2 + ascent` from its top. Centring the
 * symbol on the cap-height centre then only depends on those three numbers.
 */
function useTypeMetrics(size: number): Metrics | null {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    let cancelled = false;

    const measure = () => {
      const ctx = document.createElement("canvas").getContext("2d");
      if (!ctx) return;

      const family =
        getComputedStyle(document.documentElement).getPropertyValue("--font-funnel").trim() ||
        "sans-serif";

      ctx.font = `600 ${size}px ${family}`;
      const m = ctx.measureText("H");

      const cap = m.actualBoundingBoxAscent || size * FALLBACK_CAP_RATIO;
      const ascent = m.fontBoundingBoxAscent;

      if (!ascent) {
        if (!cancelled) setMetrics({ cap, shift: -size * 0.055 });
        return;
      }

      const descent = m.fontBoundingBoxDescent ?? 0;
      const baseline = (size - (ascent + descent)) / 2 + ascent;
      const capCentre = baseline - cap / 2;
      const shift = capCentre - size / 2;

      if (!cancelled) setMetrics({ cap, shift });
    };

    document.fonts.ready.then(measure).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [size]);

  return metrics;
}

/**
 * Horizontal brand signature: animated mark + "Hactazia".
 *
 * `size` is the **font size of the name** — every other dimension (symbol
 * height, gap, clear space) is derived from it in CSS, so the ratios hold at
 * any scale.
 */
export function Wordmark({
  size = 17,
  className,
  name = "Hactazia",
  art,
}: {
  /** Wordmark font size, in pixels. */
  size?: number;
  className?: string;
  /** Brand name, as served by the API. */
  name?: string;
  /** Mark geometry, as served by the API. */
  art?: LogoArt | null;
}) {
  const metrics = useTypeMetrics(size);

  const vars: CSSProperties = {
    "--name-size": `${size}px`,
    ...(metrics
      ? { "--cap": `${metrics.cap}px`, "--mark-shift": `${metrics.shift}px` }
      : null),
  } as CSSProperties;

  return (
    <span className={cn(styles.wordmark, className)} style={vars}>
      <Logo art={art} title={null} className={styles.mark} size={32} />
      <span className={styles.name}>{name}</span>
    </span>
  );
}
