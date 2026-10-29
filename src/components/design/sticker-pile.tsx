"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

import { preloadStickerAssets, StickerField } from "./sticker-field";
import { resolveAsset } from "@/lib/site";
import type { StackItem } from "@/lib/stack";
import { STICKER_LAYER_ID } from "@/lib/sticker-layer";

import styles from "./sticker-pile.module.scss";

/** Where a sticker sits and how big it is, in normalised parent units. */
export type Seat = { u: number; v: number; rotate: number; width: number };

/** Size range of a sticker, in px. */
const MIN_WIDTH = 62;
const MAX_WIDTH = 98;

/** Where a sticker sits now: its seat, or wherever it was dropped. */
type Placement = { cx: number; cy: number; width: number; rotate: number };
/** Where a sticker was left by the visitor: same shape, minus its size. */
type Spot = { cx: number; cy: number; rotate: number };

/**
 * Deterministic scatter.
 *
 * A jittered grid rather than pure randomness: every sticker gets a cell of its
 * own — so the whole zone is used and none hide behind another — then the cell
 * is nudged by a sine hash. Same result on every render, and no hydration
 * mismatch, while still looking thrown.
 */
export function seatOf(index: number, total: number): Seat {
  const noise = (salt: number) => {
    const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return value - Math.floor(value);
  };

  const columns = 4;
  const rows = Math.max(1, Math.ceil(total / columns));
  const column = index % columns;
  const row = Math.floor(index / columns);

  return {
    u: (column + 0.5) / columns + (noise(1) - 0.5) * (0.8 / columns),
    v: (row + 0.5) / rows + (noise(2) - 0.5) * (0.9 / rows),
    rotate: (noise(3) - 0.5) * 30,
    width: MIN_WIDTH + noise(4) * (MAX_WIDTH - MIN_WIDTH),
  };
}

/**
 * Rewrites a brand logo into a sticker source.
 *
 * The logos are single-colour SVGs whose `fill` sits on the root element. Two
 * things are needed here: the on-dark colour the API provides (several marks are
 * pure black otherwise) and an intrinsic square size, because the texture is
 * built from the image's natural dimensions.
 */
function toStickerSource(svg: string, color: string): string {
  const tinted = svg.replace(/<svg\b([^>]*)>/, (_match, attrs: string) => {
    const cleaned = attrs.replace(/\sfill="[^"]*"/g, "").replace(/\s(width|height)="[^"]*"/g, "");
    return `<svg fill="${color}" width="160" height="160"${cleaned}>`;
  });

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(tinted)}`;
}

/**
 * The pile: every sticker drawn by one GL context.
 *
 * `StickerField` owns the canvas, the shaders and the physics for the whole pile.
 * This component only feeds it images, seats and pointer input, and renders the
 * die-cut buttons that act as hit targets — and as the artwork for the first
 * frames, before the canvas has drawn anything.
 */
export function StickerPile({
  items,
  onSelect,
}: {
  items: StackItem[];
  /** Called with the tool whose sticker was clicked (not dragged). */
  onSelect: (item: StackItem) => void;
}) {
  const zone = useRef<HTMLDivElement | null>(null);
  const field = useRef<StickerField | null>(null);
  const dragged = useRef(false);
  const pressing = useRef<string | null>(null);
  const settleFrame = useRef<number | null>(null);
  const droppedAt = useRef(0);

  const [layer, setLayer] = useState<HTMLElement | null>(null);
  const [sources, setSources] = useState<Record<string, string> | null>(null);
  const [painted, setPainted] = useState<string[]>([]);
  const [moved, setMoved] = useState<Record<string, Spot>>({});
  const [area, setArea] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const key = items.map((item) => item.name).join("|");

  useEffect(() => {
    let live = true;

    // Stickers are tinted on the client: the logo files are monochrome, the
    // colour that reads on this background comes from `/api/stack`.
    Promise.all(
      items.map(async (item) => {
        const response = await fetch(resolveAsset(item.logo));
        if (!response.ok) throw new Error(`Missing logo: ${item.logo}`);
        return [item.logo, toStickerSource(await response.text(), item.color ?? "#ffffff")] as const;
      }),
    )
      .then((entries) => {
        if (live) setSources(Object.fromEntries(entries));
      })
      // No stickers rather than broken ones: the zone simply stays empty.
      .catch(() => {});

    return () => {
      live = false;
    };
    // `key` stands for the whole list: the effect must not restart on identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Decode, mask and hull every logo up front: the canvas then only has to
  // upload a texture, once per logo, shared by every sticker using it.
  useEffect(() => {
    if (!sources) return;
    preloadStickerAssets(Object.values(sources));
  }, [sources]);

  const attachZone = (node: HTMLDivElement | null) => {
    zone.current = node;
    if (!node) return;
    const sheet = document.getElementById(STICKER_LAYER_ID);
    if (sheet) setLayer(sheet);
  };

  useEffect(() => {
    const element = zone.current;
    if (!element || !layer) return;

    const measure = () => {
      const box = element.getBoundingClientRect();
      const sheet = layer.getBoundingClientRect();
      setArea({
        x: box.left - sheet.left,
        y: box.top - sheet.top,
        width: box.width,
        height: box.height,
      });
      field.current?.setBounds({ width: layer.clientWidth, height: layer.clientHeight });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observer.observe(layer);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [layer]);

  // One canvas for the whole pile, pinned to the viewport: stickers live in
  // document coordinates, so the renderer offsets by the scroll every frame.
  useEffect(() => {
    if (!layer) return;

    const canvas = document.createElement("canvas");
    canvas.className = styles.canvas;
    layer.appendChild(canvas);

    const instance = new StickerField(canvas, {
      bounds: { width: layer.clientWidth, height: layer.clientHeight },
    });
    field.current = instance;
    instance.setScroll(window.scrollY);

    const onScroll = () => instance.setScroll(window.scrollY);
    const onResize = () => {
      instance.resize();
      instance.setBounds({ width: layer.clientWidth, height: layer.clientHeight });
      instance.wake();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      instance.destroy();
      canvas.remove();
      field.current = null;
    };
  }, [layer]);

  const seats = useMemo(() => {
    if (!area) return null;

    const next: Record<string, Placement> = {};
    items.forEach((item, index) => {
      const seat = seatOf(index, items.length);
      const width = Math.round(seat.width);
      next[item.name] = {
        width,
        // Centres resolved inside the zone, in the sheet's coordinates.
        cx: area.x + width / 2 + seat.u * Math.max(1, area.width - width),
        cy: area.y + width / 2 + seat.v * Math.max(1, area.height - width),
        rotate: seat.rotate,
      };
    });

    return next;
  }, [area, items]);

  // Hand the field every sticker as soon as its image and its seat are known.
  useEffect(() => {
    const instance = field.current;
    if (!instance || !seats || !sources) return;

    for (const item of items) {
      const seat = seats[item.name];
      const spot = moved[item.name];
      if (!seat) continue;
      instance.add(item.name, {
        src: sources[item.logo],
        width: seat.width,
        rotate: spot?.rotate ?? seat.rotate,
        x: spot?.cx ?? seat.cx,
        y: spot?.cy ?? seat.cy,
      });
    }
    // `moved` is read for the initial placement only; later commits are pushed
    // with `place()` and must not re-add (and re-place) a sticker in flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer, seats, sources, items]);

  // The die-cut buttons step aside once the canvas has actually drawn that
  // sticker: no blank frame in between, nothing that looks like a load.
  useEffect(() => {
    const instance = field.current;
    if (!instance || !seats) return;

    let frame = 0;
    let tries = 0;

    const check = () => {
      const ready = instance.paintedIds().sort();
      setPainted((previous) =>
        previous.length === ready.length && previous.every((name, index) => name === ready[index]) ? previous : ready,
      );
      tries += 1;
      if (ready.length < items.length && tries < 120) frame = requestAnimationFrame(check);
    };

    frame = requestAnimationFrame(check);
    return () => cancelAnimationFrame(frame);
  }, [layer, seats, items.length]);

  /**
   * Stores where a sticker came to rest.
   *
   * The field owns the motion, so its position is read back once it reports the
   * sticker at rest — polled a frame at a time, with a cap so a stuck animation
   * can never leave the loop running.
   */
  const commitWhenStill = (name: string) => {
    const instance = field.current;
    if (!instance) return;
    if (settleFrame.current) cancelAnimationFrame(settleFrame.current);
    const started = performance.now();

    const tick = () => {
      if (!instance.settled(name) && performance.now() - started < 2600) {
        settleFrame.current = requestAnimationFrame(tick);
        return;
      }
      settleFrame.current = null;
      const place = instance.position(name);
      if (!place) return;
      setMoved((previous) => ({ ...previous, [name]: { cx: place.x, cy: place.y, rotate: place.rotate } }));
    };

    settleFrame.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    if (!layer) return;

    const nameAt = (x: number, y: number) => {
      const host = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-sticker]");
      return host && layer.contains(host) ? (host.dataset.sticker ?? null) : null;
    };

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const instance = field.current;
      if (!instance) return;
      const name = nameAt(event.clientX, event.clientY);
      if (!name) return;
      dragged.current = false;
      if (!instance.press(name, event.clientX, event.clientY)) return;
      pressing.current = name;
    };

    const onMove = (event: PointerEvent) => {
      const instance = field.current;
      if (!instance) return;
      instance.pointerMove(event.clientX, event.clientY);
      const name = pressing.current;
      if (name) instance.drag(name, event.clientX, event.clientY);
    };

    const onUp = (event: PointerEvent) => {
      const instance = field.current;
      const name = pressing.current;
      pressing.current = null;
      if (!instance || !name) return;
      instance.pointerMove(event.clientX, event.clientY, false);
      dragged.current = instance.release(name);
      if (!dragged.current) return;
      droppedAt.current = Date.now();
      commitWhenStill(name);
    };

    const onLeave = () => field.current?.pointerMove(0, 0, false);

    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
    document.documentElement.addEventListener("pointerleave", onLeave);

    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      if (settleFrame.current) cancelAnimationFrame(settleFrame.current);
    };
  }, [layer]);

  const stickers =
    sources && seats
      ? items.map((item, index) => {
          const seat = seats[item.name];
          if (!seat) return null;
          const spot = moved[item.name];
          const cx = spot?.cx ?? seat.cx;
          const cy = spot?.cy ?? seat.cy;
          const rotate = spot?.rotate ?? seat.rotate;
          const isPainted = painted.includes(item.name);

          return (
            <button
              key={item.name}
              type="button"
              title={item.name}
              aria-label={item.name}
              data-sticker={item.name}
              className={isPainted ? `${styles.flat} ${styles.painted}` : styles.flat}
              style={
                {
                  left: cx - seat.width / 2,
                  top: cy - seat.width / 2,
                  width: seat.width,
                  height: seat.width,
                  backgroundColor: item.color ?? "var(--d-accent)",
                  maskImage: `url(${sources[item.logo]})`,
                  "--rot": `${rotate}deg`,
                  "--i": index,
                } as CSSProperties
              }
              onClick={() => {
                // A throw ends with a click too: the timestamp tells them apart.
                if (dragged.current || Date.now() - droppedAt.current < 250) return;
                onSelect(item);
              }}
            />
          );
        })
      : null;

  return (
    <>
      <div ref={attachZone} className={styles.zone} />
      {layer && stickers ? createPortal(<>{stickers}</>, layer) : null}
    </>
  );
}
