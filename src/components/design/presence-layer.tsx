"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { usePresence, documentGeometry, placeCursor } from "@/lib/use-presence";

import styles from "./presence-layer.module.scss";

/** Colours cycled by cursor id, so two visitors never look identical. */
const COLORS = ["#ccccff", "#50c878", "#5b5bd6", "#9f8fff"];

/**
 * Last document point each cursor was actually drawn at, by id.
 *
 * A cursor has to disappear sometimes (no position yet, or its dot entirely off
 * this page) and it must come back *naturally*: the element keeps this point as
 * its transform while hidden, so on return the 130 ms transition animates from
 * there to the new one — a slide, not a jump across the page. Kept outside React
 * because it is a rendering leftover, not state: writing it does not require a
 * render, and it is dropped as soon as the visitor leaves.
 */
const lastPoint = new Map<number, { x: number; y: number }>();

/** No update for this long and the visitor is considered away: the dot dims. */
const IDLE_AFTER = 2500;

/** Fade granularity; only changes state when a cursor actually goes idle. */
const IDLE_TICK = 400;

/** Rendered during the static export: no document yet, so nothing is painted. */
const SERVER_SNAPSHOT = "0x0";

const getServerSnapshot = () => SERVER_SNAPSHOT;

/** Nothing to subscribe to: `document.body` never changes identity. */
const subscribeNothing = () => () => {};

const getBody = () => document.body;

const getNoBody = () => null;

/**
 * Only the *size* of the document is React state.
 *
 * The scroll offset deliberately is not: a `scroll` event followed by a render
 * lands a frame after the paint that scrolled, so every dot would trail the
 * page by one frame — plus the 130 ms transform transition, which would have to
 * catch up as well. The offset is written on the wrapper at paint time instead
 * (see `PresenceLayer`).
 */
function subscribeSize(onStoreChange: () => void) {
  window.addEventListener("resize", onStoreChange);
  window.addEventListener("orientationchange", onStoreChange);
  return () => {
    window.removeEventListener("resize", onStoreChange);
    window.removeEventListener("orientationchange", onStoreChange);
  };
}

/** One string, so the snapshot compares by value instead of by identity. */
function getSizeSnapshot() {
  const { width, height } = documentGeometry();
  return `${width}x${height}`;
}

/**
 * Overlay that renders the other visitors' cursors on the current page.
 *
 * Positions arrive normalised against the *document* (0 → 1 of the whole page)
 * and are projected back into this viewport, so two visitors see the cursor on
 * the same content whether they are on a 1280 px laptop or a 4K screen, and
 * whatever their scroll offsets are.
 *
 * `usePathname` is what the server's `path` field is matched against, so
 * cursors only appear on the page they belong to.
 *
 * The layer is portalled to `<body>` and carries a huge `z-index`: it has to
 * stay above the film grain, the menu overlay and the nav — and out of any
 * `isolation` context a section might create.
 *
 * The layer is pinned to the viewport while the dots live in document
 * coordinates, so the scroll offset is applied by `.shift`, written once per
 * frame at paint time. Native scrolling moves the page in the compositor; a
 * React round-trip cannot land on the same frame, and a dot that lags the
 * content it points at reads as a bug.
 */
export function PresenceLayer() {
  const pathname = usePathname() || "/";
  const cursors = usePresence(pathname);
  const host = useSyncExternalStore(subscribeNothing, getBody, getNoBody);
  const [docWidth, docHeight] = useSyncExternalStore(subscribeSize, getSizeSnapshot, getServerSnapshot)
    .split("x")
    .map(Number);
  const shift = useRef<HTMLDivElement | null>(null);

  // Late update: one transform, written in a frame callback scheduled by the
  // scroll, so it lands on the very frame that scrolled. The cursor keeps its
  // own transition: that one smooths *remote* movement, which is independent of
  // the scroll — the two no longer fight each other.
  useEffect(() => {
    if (!host) return;

    let frame = 0;

    function schedule() {
      if (frame) return;
      frame = requestAnimationFrame(apply);
    }

    function apply() {
      frame = 0;
      const node = shift.current;
      if (!node) return;
      const x = window.scrollX;
      const y = window.scrollY;
      node.style.transform = `translate3d(${-x}px, ${-y}px, 0)`;
      // Smooth scrolling (and momentum) can move the page once more between
      // the event and this frame: follow it until the offset stops changing.
      if (x !== window.scrollX || y !== window.scrollY) schedule();
    }

    apply();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
    };
  }, [host]);

  // Clock used to decide which cursors are idle. It only runs while somebody
  // else is on the page.
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (cursors.length === 0) return;
    const timer = setInterval(() => setClock(Date.now()), IDLE_TICK);
    return () => clearInterval(timer);
  }, [cursors.length]);

  if (!host) return null;

  // Forget the visitors who left, so the cache cannot grow for ever.
  const live = new Set(cursors.map((cursor) => cursor.id));
  for (const id of lastPoint.keys()) {
    if (!live.has(id)) lastPoint.delete(id);
  }

  return createPortal(
    <div className={styles.layer} aria-hidden>
      <div ref={shift} className={styles.shift}>
        {cursors.map((cursor) => {
          // Anchored on purpose: a heading is a heading whatever the window
          // size, while a percentage of the page is not the same sentence once
          // the text reflows. `placeCursor` measures the same element (or the
          // same character) here, in this layout, and applies the fraction as
          // it is — 0 → 1 inside the block, beyond that in the gutter.
          const point = placeCursor(cursor, docWidth, docHeight);
          if (point) lastPoint.set(cursor.id, point);

          // Nothing honest to draw right now (no position, or the whole dot off
          // this page): the element is kept, invisible, at the last place it
          // was seen — see `.cursor[data-off]`. It keeps its transform, so when
          // it comes back it *slides* from there instead of popping at the new
          // spot. Never placed at all: nothing to keep, nothing to draw.
          const shown = point ?? lastPoint.get(cursor.id);
          if (!shown) return null;

          return (
            <span
              key={cursor.id}
              className={styles.cursor}
              data-off={point ? undefined : "true"}
              data-idle={clock - cursor.at > IDLE_AFTER}
              style={{
                transform: `translate3d(${shown.x.toFixed(1)}px, ${shown.y.toFixed(1)}px, 0)`,
                color: COLORS[cursor.id % COLORS.length],
              }}
            >
              <span className={styles.dot} />
            </span>
          );
        })}
      </div>
    </div>,
    host,
  );
}
