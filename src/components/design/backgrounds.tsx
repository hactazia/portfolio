"use client";

import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

import styles from "./backgrounds.module.scss";

type StyleWithVars = CSSProperties & Record<`--${string}`, string | number>;

/* -------------------------------------------------------------------------- */
/* Aurora                                                                     */
/* -------------------------------------------------------------------------- */

const DEFAULT_AURORA = ["#ccccff", "#50c878", "#5b5bd6"];

export function Aurora({
  colors = DEFAULT_AURORA,
  className,
}: {
  colors?: readonly string[];
  className?: string;
}) {
  return (
    <div className={cn(styles.stage, className)} aria-hidden>
      <div className={styles.aurora}>
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            style={{ background: colors[index % colors.length] } as StyleWithVars}
          />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Grain / noise overlay                                                      */
/* -------------------------------------------------------------------------- */

export function Noise({ className }: { className?: string }) {
  return <div className={cn(styles.noise, className)} aria-hidden />;
}

/* -------------------------------------------------------------------------- */
/* Gradient blinds                                                            */
/* -------------------------------------------------------------------------- */

export function GradientBlinds({
  count = 7,
  colors = ["#50c878", "#ccccff"],
  angle = "160deg",
  className,
}: {
  count?: number;
  colors?: readonly [string, string];
  angle?: string;
  className?: string;
}) {
  return (
    <div className={cn(styles.stage, className)} aria-hidden>
      <div className={styles.blinds} style={{ "--angle": angle } as StyleWithVars}>
        {Array.from({ length: count }, (_, index) => (
          <span
            key={index}
            style={
              {
                "--i": index,
                "--c1": colors[0],
                "--c2": colors[1],
              } as StyleWithVars
            }
          />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Grainient                                                                  */
/* -------------------------------------------------------------------------- */

const DEFAULT_GRAINIENT = ["#1b1f3b", "#3b2f63", "#0f2a24"] as const;

export function Grainient({
  colors = DEFAULT_GRAINIENT,
  className,
}: {
  colors?: readonly [string, string, string];
  className?: string;
}) {
  return (
    <div className={cn(styles.stage, className)} aria-hidden>
      <div
        className={styles.grainient}
        style={
          {
            "--c1": colors[0],
            "--c2": colors[1],
            "--c3": colors[2],
          } as StyleWithVars
        }
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Gradual blur (progressive blur stack, used by the navbar)                  */
/* -------------------------------------------------------------------------- */

export type GradualBlurProps = {
  /** Height of the blurred band. Numbers are pixels. */
  height?: number | string;
  /** Blur of the strongest layer, in pixels. */
  strength?: number;
  /** Number of stacked layers. More layers = smoother ramp. */
  divCount?: number;
  /** Curve of the ramp: exponential falls off faster than a linear one. */
  exponential?: boolean;
  /** Which edge is the most blurred. */
  position?: "top" | "bottom";
  opacity?: number;
  className?: string;
};

export function GradualBlur({
  height = 180,
  strength = 8,
  divCount = 8,
  exponential = true,
  position = "top",
  opacity = 1,
  className,
}: GradualBlurProps) {
  const layers = Array.from({ length: divCount }, (_, index) => {
    const ratio = divCount === 1 ? 1 : index / (divCount - 1);
    // `top` blurs the first band the most, then dissolves downwards.
    const curve = position === "top" ? 1 - ratio : ratio;

    return {
      blur: strength * (exponential ? curve * curve : curve),
      from: (index / divCount) * 100,
      to: ((index + 1) / divCount) * 100,
    };
  });

  return (
    <div
      className={cn(styles.gradual, className)}
      style={{ height, opacity }}
      aria-hidden
    >
      {layers.map((layer, index) => (
        <span
          key={index}
          style={
            {
              "--blur": `${layer.blur.toFixed(2)}px`,
              "--from": layer.from.toFixed(2),
              "--to": layer.to.toFixed(2),
            } as StyleWithVars
          }
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Dither veil — intro reveal                                                 */
/* -------------------------------------------------------------------------- */

export function DitherVeil({ className }: { className?: string }) {
  return (
    <div className={cn(styles.stage, className)} aria-hidden>
      <div className={styles.veil} />
    </div>
  );
}
