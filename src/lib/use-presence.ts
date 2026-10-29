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

/** Shape broadcast by the presence server. */
export type RemoteCursor = {
  id: number;
  /** Route the cursor belongs to, used to dispatch it to the right page. */
  path: string;
  position: CursorPosition;
  /** Local receive time (ms), so an idle visitor can be faded out. */
  at: number;
};

type ServerMessage =
  | { type: "welcome"; id: number }
  | { type: "roster"; cursors: RemoteCursor[] }
  | { type: "cursor"; id: number; path: string; position: CursorPosition }
  | { type: "leave"; id: number };

/** Minimum delay between two position packets, in ms (~16 Hz). */
const SEND_INTERVAL = 60;

/** Give up after this many failed attempts instead of logging forever. */
const MAX_ATTEMPTS = 5;

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
    /** Last viewport-space pointer sample, the source of every recompute. */
    let lastClient: [number, number] | null = null;

    const send = (payload: unknown) => {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
    };

    /** Throttled push of the local position, with a trailing send. */
    const queuePosition = () => {
      if (flushTimer) return;
      const wait = Math.max(0, SEND_INTERVAL - (performance.now() - lastSent));
      flushTimer = setTimeout(() => {
        flushTimer = undefined;
        lastSent = performance.now();
        send({ type: "cursor", path: room, position });
      }, wait);
    };

    /**
     * Recomputes the document point from the last pointer sample and queues it.
     *
     * Needed beyond `pointermove`: the pointer does not move, but the document
     * does slide under it (scroll), reflow (resize, zoom) or come back from
     * another window (focus). The stored point is document-relative, so each of
     * those events changes it even though the pointer stayed put.
     */
    const publish = () => {
      if (!lastClient) return;
      position = toDocumentPosition(lastClient[0], lastClient[1]);
      queuePosition();
    };

    const connect = () => {
      if (disposed) return;
      socket = new WebSocket(url);

      socket.onopen = () => {
        attempt = 0;
        send({ type: "cursor", path: room, position });
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
        attempt = Math.min(attempt + 1, MAX_ATTEMPTS);
        if (attempt >= MAX_ATTEMPTS) return;
        retryTimer = setTimeout(connect, 400 * 2 ** attempt);
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      lastClient = [event.clientX, event.clientY];
      publish();
    };

    const clearPosition = () => {
      position = null;
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = undefined;
      }
      lastSent = performance.now();
      send({ type: "cursor", path: room, position });
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
