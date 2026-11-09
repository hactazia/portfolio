"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
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

/**
 * Below this width a sticker is just an image.
 *
 * A phone gets no GL context, no shaders and no physics: the pile still sits in
 * its zone and every sticker still opens its file, but the artwork is a plain
 * `<img>` and nothing ever drags. Same seats on both paths, so the layout does
 * not jump between a phone and a desktop.
 */
const PHONE_QUERY = "(max-width: 767.98px)";

const subscribePhone = (onChange: () => void) => {
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/** A boolean snapshot, so `useSyncExternalStore` compares it by value. */
const getPhoneSnapshot = () => window.matchMedia(PHONE_QUERY).matches;

/** Static export: no window, so the page is laid out as a desktop one. */
const getServerPhoneSnapshot = () => false;

function usePhone() {
  return useSyncExternalStore(subscribePhone, getPhoneSnapshot, getServerPhoneSnapshot);
}

export { usePhone };

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
 * buttons that act as hit targets — each carrying the sticker's image as its
 * artwork until the canvas has drawn that sticker, at which point the image is
 * dropped for good. On a phone the canvas is never created: the images are the
 * stickers.
 */
export function StickerPile({
  items,
  onSelect,
}: {
  items: StackItem[];
  /** Called with the tool whose sticker was clicked (not dragged). */
  onSelect: (item: StackItem) => void;
}) {
  const phone = usePhone();
  const zone = useRef<HTMLDivElement | null>(null);
  const field = useRef<StickerField | null>(null);
  const dragged = useRef(false);
  const pressing = useRef<string | null>(null);
  const settleFrame = useRef<number | null>(null);
  const droppedAt = useRef(0);
  /** The hit target of each sticker, so it can follow the artwork. */
  const nodes = useRef(new Map<string, HTMLButtonElement>());
  /** Where the field last drew each sticker (document coordinates). */
  const published = useRef(new Map<string, { x: number; y: number; width: number; rotate: number; scale: number }>());

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
  // upload a texture, once per logo, shared by every sticker using it. A phone
  // has no texture to warm, so it does not pay for any of it.
  useEffect(() => {
    if (!sources || phone) return;
    preloadStickerAssets(Object.values(sources));
  }, [sources, phone]);

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
  // Phones skip it entirely — a context costs memory and battery there, and the
  // buttons already show the artwork.
  useEffect(() => {
    if (!layer || phone) return;

    const canvas = document.createElement("canvas");
    canvas.className = styles.canvas;
    layer.appendChild(canvas);

    const instance = new StickerField(canvas, {
      bounds: { width: layer.clientWidth, height: layer.clientHeight },
      /**
       * The button is the only pointer target, and the canvas is the only thing
       * that is animated: left at its seat, the box ends up beside the picture
       * the moment the sticker springs, wobbles or lifts. Writing the transform
       * straight onto the node keeps the two together without re-rendering the
       * pile every frame.
       */
      onFrame: (name: string, place: { x: number; y: number; width: number; rotate: number; scale: number }) => {
        published.current.set(name, place);
        const node = nodes.current.get(name);
        if (!node) return;
        node.style.left = `${place.x - place.width / 2}px`;
        node.style.top = `${place.y - place.width / 2}px`;
        node.style.setProperty("--rot", `${place.rotate}deg`);
        node.style.setProperty("--scale", `${place.scale}`);
      },
    });
    field.current = instance;
    instance.setScroll();

    const onScroll = () => instance.setScroll();
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
  }, [layer, phone]);

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

  // Each button's image goes away once the canvas has actually drawn that
  // sticker: no blank frame in between, nothing that looks like a load. A
  // sticker is only drawn once it is on screen, so the check keeps running —
  // slower — until the pile has been scrolled through.
  useEffect(() => {
    const instance = field.current;
    if (!instance || !seats || phone) return;

    let frame = 0;
    let timer = 0;
    let tries = 0;
    let ticks = 0;

    /** Reads the field's state back; `true` once every sticker is drawn. */
    const check = () => {
      const ready = instance.paintedIds().sort();
      setPainted((previous) =>
        previous.length === ready.length && previous.every((name, index) => name === ready[index]) ? previous : ready,
      );
      return ready.length >= items.length;
    };

    // The first frames are a tight loop, so the hand-over is invisible; past
    // that only a scroll can reveal a new sticker, so 4 checks a second do —
    // and the timer stops as soon as everything has been drawn.
    const burst = () => {
      if (check()) return;
      tries += 1;
      if (tries < 120) {
        frame = requestAnimationFrame(burst);
        return;
      }
      timer = window.setInterval(() => {
        ticks += 1;
        // Never leave a timer behind: a broken logo must not poll forever.
        if (check() || ticks > 1200) window.clearInterval(timer);
      }, 250);
    };

    frame = requestAnimationFrame(burst);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(timer);
    };
  }, [layer, seats, items.length, phone]);

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

    /** Move the hit target onto where the sticker is right now. */
    const publish = () => {
      const place = instance.position(name);
      if (!place) return;
      setMoved((previous) => ({ ...previous, [name]: { cx: place.x, cy: place.y, rotate: place.rotate } }));
    };

    // First, before anything else: the button is the sticker's only pointer
    // target, and a target left behind where the sticker *used to be* sends the
    // click to the link or the text underneath. It may still be flying — the
    // next hops follow it.
    publish();

    const tick = () => {
      if (!instance.settled(name) && performance.now() - started < 2600) {
        settleFrame.current = requestAnimationFrame(tick);
        return;
      }
      settleFrame.current = null;
      publish();
    };

    settleFrame.current = requestAnimationFrame(tick);
  };

  // Pointer physics belongs to the canvas; on a phone a sticker is a button.
  useEffect(() => {
    if (!layer || phone) return;

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
      /*
       * The sticker wins over whatever it covers. Cancelling the press keeps the
       * browser from starting a text selection under it, dragging the image
       * natively, or handing the focus to the link underneath — the drag is ours
       * from here (the `click` still fires, so the sticker's own button works).
       */
      event.preventDefault();
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
  }, [layer, phone]);

  /**
   * Re-assert the field's transforms after every render.
   *
   * React writes `left`/`top` from the seat it knows (a mount, a settle, a new
   * sticker list), and the canvas is the authority on where the artwork really
   * is — the two must not disagree, or the click lands beside the picture. A
   * handful of style writes, only when the pile re-renders at all.
   */
  useEffect(() => {
    for (const [name, place] of published.current) {
      const node = nodes.current.get(name);
      if (!node) continue;
      node.style.left = `${place.x - place.width / 2}px`;
      node.style.top = `${place.y - place.width / 2}px`;
      node.style.setProperty("--rot", `${place.rotate}deg`);
      node.style.setProperty("--scale", `${place.scale}`);
    }
  });

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
              ref={(node) => {
                if (node) nodes.current.set(item.name, node);
                else nodes.current.delete(item.name);
              }}
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
                  "--rot": `${rotate}deg`,
                  "--i": index,
                } as CSSProperties
              }
              onClick={() => {
                // A throw ends with a click too: the timestamp tells them apart.
                if (dragged.current || Date.now() - droppedAt.current < 250) return;
                onSelect(item);
              }}
            >
              {/*
                The artwork. The button is only a hit target: the sticker itself
                is an image, tinted once per logo, and it is removed from the DOM
                as soon as the canvas draws that sticker — so nothing lingers on
                top of the pile. On a phone the canvas never runs, and this stays.
              */}
              {isPainted ? null : (
                // A tinted SVG data URI, sized by the seat: nothing for an image
                // optimiser to do, and the file is already in memory.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className={styles.art}
                  src={sources[item.logo]}
                  alt=""
                  draggable={false}
                  decoding="async"
                />
              )}
            </button>
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
