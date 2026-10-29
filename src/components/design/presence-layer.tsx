"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { usePresence, documentGeometry } from "@/lib/use-presence";

import styles from "./presence-layer.module.scss";

/** Colours cycled by cursor id, so two visitors never look identical. */
const COLORS = ["#ccccff", "#50c878", "#5b5bd6", "#9f8fff"];

/** No update for this long and the visitor is considered away: the dot dims. */
const IDLE_AFTER = 2500;

/** Fade granularity; only changes state when a cursor actually goes idle. */
const IDLE_TICK = 400;

/** Rendered during the static export: no document yet, so nothing is painted. */
const SERVER_SNAPSHOT = "0x0@0x0";

const getServerSnapshot = () => SERVER_SNAPSHOT;

/** Nothing to subscribe to: `document.body` never changes identity. */
const subscribeNothing = () => () => {};

const getBody = () => document.body;

const getNoBody = () => null;

/**
 * The layer is `position: fixed`, but positions are document-relative and the
 * document reflows on resize: both the page size and the scroll offset have to
 * be tracked to keep a cursor on the same piece of content.
 */
function subscribeGeometry(onStoreChange: () => void) {
  window.addEventListener("resize", onStoreChange);
  window.addEventListener("scroll", onStoreChange, { passive: true });
  window.addEventListener("orientationchange", onStoreChange);
  return () => {
    window.removeEventListener("resize", onStoreChange);
    window.removeEventListener("scroll", onStoreChange);
    window.removeEventListener("orientationchange", onStoreChange);
  };
}

/** One string, so the snapshot compares by value instead of by identity. */
function getGeometrySnapshot() {
  const { width, height, scrollX, scrollY } = documentGeometry();
  return `${width}x${height}@${scrollX}x${scrollY}`;
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
 */
export function PresenceLayer() {
  const pathname = usePathname() || "/";
  const cursors = usePresence(pathname);
  const host = useSyncExternalStore(subscribeNothing, getBody, getNoBody);
  const [docWidth, docHeight, scrollX, scrollY] = useSyncExternalStore(
    subscribeGeometry,
    getGeometrySnapshot,
    getServerSnapshot,
  )
    .split(/x|@/)
    .map(Number);

  // Clock used to decide which cursors are idle. It only runs while somebody
  // else is on the page.
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (cursors.length === 0) return;
    const timer = setInterval(() => setClock(Date.now()), IDLE_TICK);
    return () => clearInterval(timer);
  }, [cursors.length]);

  if (!host) return null;

  return createPortal(
    <div className={styles.layer} aria-hidden>
      {cursors.map((cursor) => (
        <span
          key={cursor.id}
          className={styles.cursor}
          data-idle={clock - cursor.at > IDLE_AFTER}
          style={{
            transform: `translate3d(${(
              (cursor.position?.[0] ?? 0) * docWidth - scrollX
            ).toFixed(1)}px, ${(
              (cursor.position?.[1] ?? 0) * docHeight - scrollY
            ).toFixed(1)}px, 0)`,
            color: COLORS[cursor.id % COLORS.length],
          }}
        >
          <span className={styles.dot} />
        </span>
      ))}
    </div>,
    host,
  );
}
