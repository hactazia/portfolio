"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import styles from "./scroll-drawer.module.scss";

/** Movement below this (px) is treated as a click rather than a drag. */
const CLICK_SLOP = 4;

/**
 * Bottom handle of the hero.
 *
 * The whole strip is one drag surface: press anywhere (bar included) and drag
 * to scroll. The bar and its label are purely decorative (`pointer-events:
 * none`) so they can never steal the gesture; releasing without moving jumps to
 * the next section instead.
 */
export function ScrollDrawer({
  targetId = "work",
  label = "Scroll to the next section",
  className,
}: {
  targetId?: string;
  label?: string;
  className?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const press = useRef<{ y: number; scroll: number } | null>(null);
  const moved = useRef(false);

  const jump = useCallback(() => {
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth" });
  }, [targetId]);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    // Let touch devices keep their native scrolling.
    if (event.pointerType === "touch") return;

    event.preventDefault();
    press.current = { y: event.clientY, scroll: window.scrollY };
    moved.current = false;
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const origin = press.current;
      if (!origin) return;

      const delta = event.clientY - origin.y;
      if (!moved.current && Math.abs(delta) < CLICK_SLOP) return;

      moved.current = true;
      setDragging(true);
      window.scrollTo({ top: origin.scroll - delta, behavior: "auto" });
    };

    const onUp = () => {
      const origin = press.current;
      press.current = null;
      document.body.style.userSelect = "";
      if (!origin) return;

      const wasDragging = moved.current;
      moved.current = false;
      setDragging(false);
      if (!wasDragging) jump();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [jump]);

  return (
    <div className={cn(styles.drawer, className)} data-dragging={dragging}>
      <div className={styles.grabber} onPointerDown={onPointerDown} aria-hidden />

      <button type="button" className={styles.pill} onClick={jump} aria-label={label}>
        <span className={styles.pillLabel} aria-hidden>
          {label}
        </span>
        <span className={styles.pillBar} aria-hidden />
      </button>
    </div>
  );
}
