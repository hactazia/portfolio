"use client";

import type { CSSProperties } from "react";

import type { LogoArt } from "@/lib/site";
import { resolveAsset } from "@/lib/site";
import { cn } from "@/lib/utils";

import styles from "./logo.module.scss";

/**
 * The Hactazia mark.
 *
 * The silhouette is not bundled: the API hands over a URL to an SVG, which is
 * painted as a CSS mask over a drifting gradient. That keeps the file itself a
 * plain shape (no baked-in colours) while the gradient stays animatable in
 * CSS — something an `<img>`-embedded SVG cannot do.
 *
 * Renders nothing when the art has not been retrieved yet; callers show a
 * skeleton in that state.
 */
export function Logo({
  art,
  size = 32,
  animated = true,
  className,
  title = "Hactazia",
}: {
  /** `{ src, alt }` as served by the API. */
  art?: LogoArt | null;
  size?: number;
  animated?: boolean;
  className?: string;
  /** Set to `null` when the mark is decorative (e.g. next to the wordmark). */
  title?: string | null;
}) {
  if (!art?.src) return null;

  return (
    <span
      className={cn(styles.logo, animated && styles.animated, className)}
      style={
        {
          "--logo-src": `url(${resolveAsset(art.src)})`,
          "--logo-size": `${size}px`,
        } as CSSProperties
      }
      {...(title
        ? { role: "img" as const, "aria-label": title }
        : { "aria-hidden": true as const })}
    />
  );
}
