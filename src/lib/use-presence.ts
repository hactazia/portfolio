"use client";

import { useEffect, useState } from "react";

export type CursorPosition = [number, number] | null;

/** Geometry of the scrollable document, the reference frame for positions. */
export type DocumentGeometry = {
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
};

/** Scroll size of the page, never zero (guards against divide-by-zero). */
export function documentGeometry(): DocumentGeometry {
  const root = document.documentElement;
  const body = document.body;
  return {
    width: Math.max(root.scrollWidth, body?.scrollWidth ?? 0, root.clientWidth) || 1,
    height: Math.max(root.scrollHeight, body?.scrollHeight ?? 0, root.clientHeight) || 1,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
  };
}

/**
 * Positions travel **normalised against the document** (0 → 1 of the whole
 * scrollable page) rather than in CSS pixels: a pixel coordinate would point at
 * a different piece of content on another screen size, and it would drift as
 * soon as the two visitors are not scrolled to the same offset. Receivers
 * project the point back into their own viewport.
 */
function toDocumentPosition(clientX: number, clientY: number): [number, number] {
  const { width, height } = documentGeometry();
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  return [
    clamp((clientX + window.scrollX) / width),
    clamp((clientY + window.scrollY) / height),
  ];
}

/** Elements that exist once per page, so a selector can be rooted on them. */
const ANCHOR_ROOTS = new Set(["BODY", "MAIN", "HEADER", "FOOTER"]);

/** Marks the content block of a section (see `m.section-box`). */
const CONTAINER = "data-presence-container";

/** Text longer than this is not worth walking just to find one caret. */
const MAX_ANCHOR_TEXT = 8000;

/**
 * Selector of `el`, rooted at the closest thing that identifies the same content
 * on every client: an `id`, or one of the page landmarks.
 *
 * Structure only — the site is rendered by the same code from the same content,
 * so `#about > div:nth-child(2) > p` is the same paragraph everywhere. It is
 * still allowed to fail: content that has not loaded yet (skeletons) resolves to
 * nothing, and the receiver then falls back to the document percentage.
 */
function selectorFor(el: Element): string | null {
  const parts: string[] = [];
  let node: Element | null = el;

  while (node) {
    if (node.id) {
      parts.unshift(`#${CSS.escape(node.id)}`);
      return parts.join(" > ");
    }
    if (ANCHOR_ROOTS.has(node.tagName)) {
      parts.unshift(node.tagName.toLowerCase());
      return parts.join(" > ");
    }
    const parent: Element | null = node.parentElement;
    if (!parent) return null;
    let index = 1;
    for (
      let sibling = node.previousElementSibling;
      sibling;
      sibling = sibling.previousElementSibling
    ) {
      index += 1;
    }
    parts.unshift(`${node.tagName.toLowerCase()}:nth-child(${index})`);
    node = parent;
  }

  return null;
}

/**
 * Index of a caret inside an element's text.
 *
 * Both ends of the socket walk the text the same way (document order, text nodes
 * only), so the index means the same character on both sides.
 */
function textIndex(root: Element, caret: Node, offset: number): number | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let total = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node === caret) return total + Math.min(offset, node.nodeValue?.length ?? 0);
    total += node.nodeValue?.length ?? 0;
    if (total > MAX_ANCHOR_TEXT) return null;
  }
  return null;
}

/**
 * Client point of the caret at `index` in an element's text.
 *
 * The index may point *past* the last character — pointing at the end of a line
 * is exactly that — so it is resolved as a boundary: the right edge of the last
 * character, on its line, rather than a fraction of the whole box.
 */
function caretPoint(root: Element, index: number): { x: number; y: number } | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = index;
  let last: DOMRect | null = null;

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.nodeValue?.length ?? 0;
    if (remaining < length) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.setEnd(node, remaining + 1);
      const box = range.getBoundingClientRect();
      if (!box.width && !box.height) return null;
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    }
    remaining -= length;
    if (length > 0) {
      const range = document.createRange();
      range.setStart(node, length - 1);
      range.setEnd(node, length);
      last = range.getBoundingClientRect();
    }
  }

  if (!last || (!last.width && !last.height)) return null;
  return { x: last.right, y: last.top + last.height / 2 };
}

/** Caret under a viewport point, whichever API the browser exposes. */
function caretFromPoint(
  clientX: number,
  clientY: number,
): { node: Node; offset: number } | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };

  if (doc.caretPositionFromPoint) {
    const position = doc.caretPositionFromPoint(clientX, clientY);
    return position ? { node: position.offsetNode, offset: position.offset } : null;
  }
  const range = doc.caretRangeFromPoint?.(clientX, clientY);
  return range ? { node: range.startContainer, offset: range.startOffset } : null;
}

/**
 * Client box of the character the caret sits on.
 *
 * The caret reports a position even when the pointer is nowhere near the text —
 * it falls back to the closest character. This box is what tells the two apart.
 */
function caretCharacterBox(node: Text, offset: number): DOMRect | null {
  const length = node.nodeValue?.length ?? 0;
  if (!length) return null;
  const index = Math.min(Math.max(0, offset), length - 1);
  const range = document.createRange();
  range.setStart(node, index);
  range.setEnd(node, index + 1);
  const box = range.getBoundingClientRect();
  return box.width || box.height ? box : null;
}

/** How far (as a fraction of the character's height) a point still counts as "on" it. */
const CARET_REACH = 0.35;

/**
 * The nearest `position: fixed` ancestor of `el`, if any.
 *
 * The footer is a fixed curtain *behind* the page body, uncovered by scrolling,
 * and the nav is pinned the same way. Their boxes do not move with the document,
 * so their point cannot be projected with the scroll offset like everything
 * else: it is measured in viewport space and placed on the edge the *layer*
 * belongs to (see `fixedBase`).
 */
function fixedLayerOf(el: Element): Element | null {
  for (let node: Element | null = el; node; node = node.parentElement) {
    if (getComputedStyle(node).position === "fixed") return node;
  }
  return null;
}

/**
 * The anchor of a viewport point: which element, where inside it, and which
 * character when the point is over text.
 *
 * Two cases, and the difference matters:
 *
 * - the pointer is **inside the element that owns the character** under it — the
 *   anchor is that element plus the character index, which is what makes two
 *   layouts agree (same word, however it wrapped);
 * - the pointer is **not** on that text (the empty space past a line, the
 *   leading between two lines): the caret then only reports the *nearest* text,
 *   and anchoring on it would pin the dot to that word while the mouse keeps
 *   moving in the void. The anchor is the element actually under the pointer,
 *   with no character, so the dot follows the pointer again.
 *
 * `null` over the page background, where the caller sends the percentage only.
 */
export function anchorAt(clientX: number, clientY: number): PresenceAnchor | null {
  const caret = caretFromPoint(clientX, clientY);
  const hit = document.elementFromPoint(clientX, clientY);
  const owner = caret?.node.nodeType === Node.TEXT_NODE ? caret.node.parentElement : null;

  // Is the pointer actually *on* the character the caret reports? The caret
  // snaps to the closest text, so in the void past a line it still returns the
  // last word of that line; anchoring there would pin the dot to the text while
  // the mouse keeps moving. Proximity to the character itself decides.
  const charBox =
    owner && caret && caret.node.nodeType === Node.TEXT_NODE
      ? caretCharacterBox(caret.node as Text, caret.offset)
      : null;
  const reachY = charBox ? charBox.height * CARET_REACH : 0;
  const reachX = charBox ? charBox.width : 0;
  const onText =
    !!charBox &&
    !!owner &&
    hit === owner &&
    clientX >= charBox.left - reachX &&
    clientX <= charBox.right + reachX &&
    clientY >= charBox.top - reachY &&
    clientY <= charBox.bottom + reachY;

  const el = onText ? owner : hit;
  if (!el || el === document.body || el === document.documentElement) return null;

  // The footer curtain and the nav are fixed to the viewport: their boxes never
  // move with the document, so the point has to be projected differently (see
  // `anchorToDocument`). They are never re-rooted on a section block either.
  const fixed = fixedLayerOf(el) !== null;

  /*
   * The container of a section is the block its content lives in (the column
   * with `padding-block`, see `m.section-box`). A pointer can be *outside* it —
   * in the gutter beside it, or on the `<section>` itself — and that has to
   * travel as such: the anchor stays rooted on the block, with a fraction that
   * leaves 0 → 1, so the receiver draws the dot in *its* out-container instead
   * of pinning it inside the block.
   */
  let target: Element = el;
  let rect = el.getBoundingClientRect();
  if (!fixed && !el.closest(`[${CONTAINER}]`)) {
    const block = el.closest("section")?.querySelector(`:scope > [${CONTAINER}]`);
    if (block) {
      target = block;
      rect = block.getBoundingClientRect();
    }
  }
  if (rect.width <= 1 || rect.height <= 1) return null;

  const sel = selectorFor(target);
  if (!sel) return null;

  const anchor: PresenceAnchor = {
    sel,
    // Not clamped on purpose: 0 → 1 is "inside the block" and anything beyond is
    // "out of the block". The receiver needs to know the difference, so the raw
    // fraction travels (the wire format allows a little overshoot).
    fx: round((clientX - rect.left) / rect.width),
    fy: round((clientY - rect.top) / rect.height),
  };
  if (fixed) anchor.vp = true;

  // What the pointer was really over. Kept for diagnostics: the receiver no
  // longer rejects on a mismatch, it draws the dot where the anchor says.
  const hitSel = hit ? selectorFor(hit) : null;
  if (hitSel) anchor.hit = hitSel;

  // A character index is only meaningful against the element that owns the text,
  // which is the anchored element itself in that case.
  if (onText && owner && caret && target === owner) {
    const index = textIndex(owner, caret.node, caret.offset);
    if (index !== null) anchor.ch = index;
  }

  return anchor;
}

/** Four decimals: ~0.1 px on a 1000 px block. */
function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/**
 * Document point of an anchor, measured in the *local* layout.
 *
 * The fraction is applied **raw**: 0 → 1 is inside the block and anything
 * outside is out of it, so a visitor pointing in a gutter lands in *this*
 * layout's gutter — the out-container stays the out-container, it is never
 * folded back onto the edge of the block. Points that end up off the page are
 * dropped by the caller.
 *
 * `null` means the block itself is not here (unknown selector, not rendered
 * yet), which is the only case where the caller may fall back to a percentage.
 */
function anchorToDocument(anchor: PresenceAnchor): { x: number; y: number } | null {
  let el: Element | null = null;
  try {
    el = document.querySelector(anchor.sel);
  } catch {
    return null;
  }
  if (!el || !el.isConnected) return null;

  const rect = el.getBoundingClientRect();
  if (!rect.width && !rect.height) return null;

  let point: { x: number; y: number } | null = null;
  if (typeof anchor.ch === "number") {
    point = caretPoint(el, anchor.ch);
  }
  point ??= {
    x: rect.left + anchor.fx * rect.width,
    y: rect.top + anchor.fy * rect.height,
  };

  return {
    x: point.x + window.scrollX,
    y: point.y + (anchor.vp ? fixedBase(el) : window.scrollY),
  };
}

/**
 * Scroll offset at which the fixed layer holding `el` is uncovered.
 *
 * The footer curtain is pinned to the bottom edge: its content is where it is
 * once the page has scrolled to the end. The nav is pinned to the top, so it
 * belongs to the start. Projecting on that edge is what puts the dot on the same
 * character as the sender — and what keeps it off-screen while this client is
 * elsewhere on the page, instead of floating over the hero.
 */
function fixedBase(el: Element): number {
  const layer = fixedLayerOf(el);
  const rect = layer?.getBoundingClientRect();
  if (!rect || rect.bottom < window.innerHeight - 1) return 0;
  return Math.max(0, documentGeometry().height - window.innerHeight);
}

/**
 * Radius of the rendered dot, in px. `.dot` is `0.875rem` across and centred on
 * the pointer, so half of it hangs on each side — keep the two in sync.
 */
const DOT_RADIUS = 7;

/**
 * Is any part of the dot on the page? Only a circle that is *entirely* outside
 * is dropped: a cursor half past the edge still tells you where its visitor is,
 * and on a phone the out-container is barely a dozen pixels wide — hiding at the
 * border would erase it.
 */
function onPage(
  point: { x: number; y: number },
  width: number,
  height: number,
): boolean {
  const reach = DOT_RADIUS + 1;
  return (
    point.x + reach >= 0 &&
    point.x - reach <= width &&
    point.y + reach >= 0 &&
    point.y - reach <= height
  );
}

/**
 * Document coordinates of a remote cursor in *this* layout, or `null` when
 * there is nothing to draw.
 *
 * Anchored first — that is the accurate path, and the point is clamped into the
 * block on arrival, so a cursor that sat *outside* its container on a wider
 * screen is still shown here, against that container. Then the document
 * percentage, for a cursor over nothing, or over content this client has not
 * rendered yet (a section still showing its skeletons). Document coordinates
 * rather than viewport ones on purpose: they do not change when the page
 * scrolls, so a cursor never needs a React render to stay glued to its text.
 *
 * `null` means "hide it", and only two things cause that: the sender had no
 * position to send, or **all** of the dot falls off this client's page (see
 * `onPage`). A dot that merely leaves its container is still drawn.
 */
export function placeCursor(
  cursor: RemoteCursor,
  width: number,
  height: number,
): { x: number; y: number } | null {
  if (cursor.anchor) {
    const placed = anchorToDocument(cursor.anchor);
    if (placed) return onPage(placed, width, height) ? placed : null;
  }

  // The sender sent no position: the pointer had left its document.
  if (!cursor.position) return null;

  const point = {
    x: cursor.position[0] * width,
    y: cursor.position[1] * height,
  };
  return onPage(point, width, height) ? point : null;
}

/**
 * Where a cursor sits, expressed in a way that survives a different layout.
 *
 * `sel` finds the element the pointer was over, and the point is given *inside
 * that element* — so a heading is a heading for everybody, wherever it wrapped.
 * When the point was over text, `ch` is the index of the character under it, and
 * that is what really makes two window sizes agree: the receiver measures the
 * same character with its own font metrics instead of guessing from a percentage
 * of a box.
 */
export type PresenceAnchor = {
  /** CSS selector of the element, rooted at an `id`, a landmark or `body`. */
  sel: string;
  /** Point inside the element's box, 0 → 1 on each axis. */
  fx: number;
  fy: number;
  /** Character index in the element's text, when the point was over text. */
  ch?: number;
  /**
   * Selector of the element that was really under the pointer.
   *
   * `sel` is the block the fraction refers to, which may be an ancestor (the
   * pointer was in its void). This one says what the pointer was actually over,
   * so the receiver can check that the same thing is still there at the computed
   * point — instead of drawing the dot inside a block the sender was outside of.
   */
  hit?: string;
  /**
   * The anchored element lives in a `position: fixed` layer (the footer
   * curtain, the nav), so the point is in **viewport** space: the receiver
   * projects it onto the scroll edge that layer is uncovered at, not with its
   * own scroll offset (see `anchorToDocument`).
   */
  vp?: boolean;
};

/** Shape broadcast by the presence server. */
export type RemoteCursor = {
  id: number;
  /** Route the cursor belongs to, used to dispatch it to the right page. */
  path: string;
  position: CursorPosition;
  /** Element-and-character anchor, when the sender could compute one. */
  anchor?: PresenceAnchor | null;
  /** Local receive time (ms), so an idle visitor can be faded out. */
  at: number;
};

type ServerMessage =
  | { type: "welcome"; id: number }
  | { type: "roster"; cursors: Omit<RemoteCursor, "at">[] }
  | {
      type: "cursor";
      id: number;
      path: string;
      position: CursorPosition;
      anchor?: PresenceAnchor | null;
    }
  | { type: "leave"; id: number };

/** Minimum delay between two position packets, in ms (~16 Hz). */
const SEND_INTERVAL = 60;

/** Ceiling of the reconnect backoff, in ms. */
const MAX_RETRY_DELAY = 15_000;

/**
 * Rooms are keyed on a normalised route: `/x/` and `/x` must land in the same
 * room, otherwise two visitors on the same page never see each other and a
 * cursor could leak into the neighbouring route's room.
 */
export function normalizePath(path: string | null | undefined): string {
  if (!path || path === "/") return "/";
  return path.replace(/\/+$/, "") || "/";
}

/**
 * Endpoint resolution:
 * 1. `NEXT_PUBLIC_WS_URL` when set (any custom deployment),
 * 2. `ws://<host>:3001/ws` under `next dev` (site on :3000, presence on :3001),
 * 3. same-origin `/api/ws`, which nginx upgrades to the api container.
 */
function resolveSocketUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_WS_URL;
  if (explicit) return explicit;
  if (typeof window === "undefined") return null;

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const { hostname, port, host } = window.location;

  if (port === "3000") return `${protocol}//${hostname}:3001/ws`;
  return `${protocol}//${host}/api/ws`;
}

/**
 * Subscribes to the presence channel and returns the cursors of every other
 * client on `path`.
 *
 * The id is assigned by the server (`welcome`), never by the browser.
 */
export function usePresence(path: string): RemoteCursor[] {
  const room = normalizePath(path);
  /** The room is stored with the cursors: a stale room simply renders nothing. */
  const [state, setState] = useState<{ room: string; cursors: RemoteCursor[] }>({
    room,
    cursors: [],
  });

  useEffect(() => {
    const url = resolveSocketUrl();
    if (!url) return;


    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let attempt = 0;
    let lastSent = 0;
    let selfId: number | null = null;
    let position: CursorPosition = null;
    /** Where the pointer sits inside the content, when it sits on something. */
    let anchor: PresenceAnchor | null = null;
    /** Last viewport-space pointer sample, the source of every recompute. */
    let lastClient: [number, number] | null = null;

    const send = (payload: unknown) => {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
    };

    /**
     * Throttled push of the local position, with a trailing send.
     *
     * The position and the anchor are computed *here*, at send time, not on the
     * event that queued the packet: measuring an element (`elementFromPoint`,
     * `caretPositionFromPoint`) on every `pointermove` would cost a hit-test and
     * a layout read per frame for a value that is only transmitted 16 times a
     * second.
     */
    const queuePosition = () => {
      if (flushTimer) return;
      const wait = Math.max(0, SEND_INTERVAL - (performance.now() - lastSent));
      flushTimer = setTimeout(() => {
        flushTimer = undefined;
        lastSent = performance.now();
        if (lastClient) {
          position = toDocumentPosition(lastClient[0], lastClient[1]);
          anchor = anchorAt(lastClient[0], lastClient[1]);
        }
        send({ type: "cursor", path: room, position, anchor });
      }, wait);
    };

    /**
     * Queues a fresh packet from the last pointer sample.
     *
     * Needed beyond `pointermove`: the pointer does not move, but the document
     * does slide under it (scroll), reflow (resize, zoom) or come back from
     * another window (focus) — so what is *under* the pointer changed.
     */
    const publish = () => {
      if (!lastClient) return;
      queuePosition();
    };

    const connect = () => {
      if (disposed) return;
      socket = new WebSocket(url);

      socket.onopen = () => {
        attempt = 0;
        send({ type: "cursor", path: room, position, anchor });
      };

      socket.onmessage = (event) => {
        let message: ServerMessage;
        try {
          message = JSON.parse(event.data as string) as ServerMessage;
        } catch {
          return;
        }

        if (message.type === "welcome") {
          selfId = message.id;
          return;
        }

        if (message.type === "roster") {
          setState({
            room,
            cursors: message.cursors
              .filter((cursor) => cursor.id !== selfId)
              .map((cursor) => ({ ...cursor, at: Date.now() })),
          });
          return;
        }

        if (message.type === "cursor") {
          if (message.id === selfId) return;
          setState((current) => {
            const base = current.room === room ? current.cursors : [];
            const next = base.filter((cursor) => cursor.id !== message.id);
            next.push({
              id: message.id,
              path: message.path,
              position: message.position,
              anchor: message.anchor ?? null,
              at: Date.now(),
            });
            return { room, cursors: next };
          });
          return;
        }

        if (message.type === "leave") {
          setState((current) => ({
            room,
            cursors: current.cursors.filter((cursor) => cursor.id !== message.id),
          }));
        }
      };

      socket.onclose = () => {
        if (disposed) return;
        // Never give up: an API restart must not leave the page without presence
        // until it is reloaded. Back off, then keep knocking at a steady pace.
        attempt += 1;
        retryTimer = setTimeout(connect, Math.min(400 * 2 ** attempt, MAX_RETRY_DELAY));
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      lastClient = [event.clientX, event.clientY];
      publish();
    };

    const clearPosition = () => {
      position = null;
      anchor = null;
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = undefined;
      }
      lastSent = performance.now();
      send({ type: "cursor", path: room, position, anchor });
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") clearPosition();
    };

    // Connecting on the next tick means a React StrictMode mount/unmount pair
    // never opens a socket: the timer is cleared before it fires, so Firefox
    // does not log an aborted handshake on every reload.
    const startTimer = setTimeout(connect, 0);

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", clearPosition);
    window.addEventListener("scroll", publish, { passive: true });
    window.addEventListener("resize", publish);
    window.addEventListener("focus", publish);
    window.addEventListener("blur", clearPosition);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      if (startTimer) clearTimeout(startTimer);
      if (retryTimer) clearTimeout(retryTimer);
      if (flushTimer) clearTimeout(flushTimer);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", clearPosition);
      window.removeEventListener("scroll", publish);
      window.removeEventListener("resize", publish);
      window.removeEventListener("focus", publish);
      window.removeEventListener("blur", clearPosition);
      document.removeEventListener("visibilitychange", onVisibility);

      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close();
      }
    };
  }, [room]);

  if (state.room !== room) return [];

  return state.cursors.filter(
    (cursor) => normalizePath(cursor.path) === room && cursor.position !== null,
  );
}
