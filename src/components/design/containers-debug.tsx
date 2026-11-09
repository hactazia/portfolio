"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { anchorAt, documentGeometry, placeCursor } from "@/lib/use-presence";
import type { PresenceAnchor, RemoteCursor } from "@/lib/use-presence";

import styles from "./containers-debug.module.scss";

/**
 * Debug overlay: paints the presence "containers" in red.
 *
 * A container is the element a cursor is anchored to — the block whose box the
 * fractions `fx`/`fy` refer to, and the one the receiver measures to decide
 * where the dot goes (or *whether* it goes anywhere at all). Seeing those boxes
 * is the only way to tell an "in container" point from an "out of container"
 * one: the second is a point that leaves the block, and the receiver hides the
 * dot rather than dropping it onto unrelated content.
 *
 * Three kinds of box:
 *
 * - solid red: the container of a *remote* cursor, as resolved by this client;
 * - magenta: same, but this client draws no dot at all for it (the point falls
 *   off this page, or the sender had no position);
 * - dashed orange: the container the *local* pointer would anchor to.
 *
 * Enabled with `?debug` in the URL, or `window.__containers()` from the console.
 * Nothing is measured while it is off: the overlay is inert by default.
 */

type Box = {
  key: string;
  left: number;
  top: number;
  width: number;
  height: number;
  label: string;
  /** No dot is drawn here (off this page, or the sender had no position). */
  hidden: boolean;
  /** Anchored by the local pointer, not by a remote one. */
  local: boolean;
};

/** Query parameter that turns the overlay on. */
const PARAM = "debug";

/** Signature that never matches a real one, so the first frame always paints. */
const EMPTY = "\u0000";

/** The URL is the switch: it survives a reload and needs no UI. */
function hasParam() {
  return new URLSearchParams(window.location.search).has(PARAM);
}

/** Navigating back and forth re-evaluates the switch. */
function subscribeUrl(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

const getSearch = () => window.location.search;

const getNoSearch = () => "";

function element(selector: string): Element | null {
  try {
    const node = document.querySelector(selector);
    return node && node.isConnected ? node : null;
  } catch {
    return null;
  }
}

/** `#work > div:nth-child(1) > aside:nth-child(1) > p` → `aside:nth-child(1) > p`. */
function tail(selector: string): string {
  const parts = selector.split(" > ");
  return parts.length > 2 ? `…${parts.slice(-2).join(" > ")}` : selector;
}

/** Element box, in document coordinates (the layer scrolls with the page). */
function boxOf(key: string, el: Element, label: string, extra: Partial<Box>): Box | null {
  const rect = el.getBoundingClientRect();
  if (!rect.width && !rect.height) return null;
  return {
    key,
    left: rect.left + window.scrollX,
    top: rect.top + window.scrollY,
    width: rect.width,
    height: rect.height,
    label,
    hidden: false,
    local: false,
    ...extra,
  };
}

/** 0 → 1 on both axes, ends included: anything else is out of container. */
function inside(anchor: PresenceAnchor): boolean {
  return anchor.fx >= 0 && anchor.fx <= 1 && anchor.fy >= 0 && anchor.fy <= 1;
}

function fraction(anchor: PresenceAnchor): string {
  return `${anchor.fx.toFixed(2)}/${anchor.fy.toFixed(2)}`;
}

function measure(cursors: RemoteCursor[], anchor: PresenceAnchor | null): Box[] {
  const boxes: Box[] = [];
  const { width, height } = documentGeometry();

  for (const cursor of cursors) {
    if (!cursor.anchor) continue;
    const el = element(cursor.anchor.sel);
    if (!el) continue;
    // Same call the renderer makes: `null` means "no dot on this page".
    const hidden = placeCursor(cursor, width, height) === null;
    const box = boxOf(
      `cursor-${cursor.id}`,
      el,
      `#${cursor.id} ${tail(cursor.anchor.sel)} ${fraction(cursor.anchor)}${hidden ? " · hidden" : ""}`,
      { hidden },
    );
    if (box) boxes.push(box);
  }

  if (anchor) {
    const sel = element(anchor.sel);
    if (sel) {
      const box = boxOf(
        "local",
        sel,
        `local ${tail(anchor.sel)} ${fraction(anchor)} ${inside(anchor) ? "in" : "out"}${
          typeof anchor.ch === "number" ? ` · ch ${anchor.ch}` : ""
        }`,
        { local: true },
      );
      if (box) boxes.push(box);
    }
    // The element really under the pointer, when the anchor is not on it —
    // that is the "void of the block" case, where the fraction points outside.
    if (anchor.hit && anchor.hit !== anchor.sel) {
      const hit = element(anchor.hit);
      const box = hit ? boxOf("local-hit", hit, `hit ${tail(anchor.hit)}`, { local: true }) : null;
      if (box) boxes.push(box);
    }
  }

  return boxes;
}

function signature(boxes: Box[]): string {
  return boxes
    .map(
      (box) =>
        `${box.key}|${Math.round(box.left)}|${Math.round(box.top)}|${Math.round(
          box.width,
        )}|${Math.round(box.height)}|${box.hidden}|${box.label}`,
    )
    .join(";");
}

export function ContainersDebug({ cursors }: { cursors: RemoteCursor[] }) {
  const search = useSyncExternalStore(subscribeUrl, getSearch, getNoSearch);
  /** `null` until the console helper overrides the URL switch. */
  const [forced, setForced] = useState<boolean | null>(null);
  const on = forced ?? new URLSearchParams(search).has(PARAM);

  const [boxes, setBoxes] = useState<Box[]>([]);

  // Latest cursors / pointer, read by the measuring loop without re-subscribing.
  const live = useRef(cursors);
  const pointer = useRef<[number, number] | null>(null);

  useEffect(() => {
    live.current = cursors;
  }, [cursors]);

  useEffect(() => {
    const host = window as Window & { __containers?: (value?: boolean) => void };
    host.__containers = (value) =>
      setForced((current) => value ?? !(current ?? hasParam()));
    return () => {
      delete host.__containers;
    };
  }, []);

  useEffect(() => {
    if (!on) return;

    let frame = 0;
    let settled = EMPTY;
    let pointerKey = EMPTY;
    let anchor: PresenceAnchor | null = null;

    const tick = () => {
      const point = pointer.current;
      const key = point ? `${point[0]},${point[1]}` : "";
      // `anchorAt` walks the text of the block under the pointer, so it only
      // runs when the pointer actually moved.
      if (key !== pointerKey) {
        pointerKey = key;
        anchor = point ? anchorAt(point[0], point[1]) : null;
      }

      const next = measure(live.current, anchor);
      const nextSignature = signature(next);
      if (nextSignature !== settled) {
        settled = nextSignature;
        setBoxes(next);
      }
      frame = requestAnimationFrame(tick);
    };

    const onMove = (event: PointerEvent) => {
      pointer.current = [event.clientX, event.clientY];
    };
    const onLeave = () => {
      pointer.current = null;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerout", onLeave);
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerout", onLeave);
    };
  }, [on]);

  if (!on) return null;

  return (
    <>
      {boxes.map((box) => (
        <div
          key={box.key}
          className={styles.box}
          data-hidden={box.hidden ? "true" : undefined}
          data-local={box.local ? "true" : undefined}
          style={{
            left: `${box.left}px`,
            top: `${box.top}px`,
            width: `${box.width}px`,
            height: `${box.height}px`,
          }}
        >
          <span className={styles.label}>{box.label}</span>
        </div>
      ))}
    </>
  );
}
