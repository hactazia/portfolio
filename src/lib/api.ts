/**
 * Tiny, dependency free API client.
 *
 * The site ships as a static export (GitHub Pages), so there is no Node server
 * of our own. Two deployment modes are supported without touching the UI:
 *
 * - **Behind a proxy** (Docker / nginx / Vercel): `NEXT_PUBLIC_API_BASE_URL`
 *   is empty and every call goes to the same origin under `/api/*`, which
 *   nginx forwards to the backend container. No CORS involved.
 * - **Remote API** (GitHub Pages): set `NEXT_PUBLIC_API_BASE_URL` at build
 *   time, e.g. `https://api.example.com`. Calls then target
 *   `https://api.example.com/api/*` and the backend must allow the Pages
 *   origin via CORS.
 *
 * When no backend answers, `fetchWithFallback` silently returns local demo
 * data so the site always renders something.
 */

/** Normalised base URL of the API (no trailing slash, may be empty). */
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "")
  .trim()
  .replace(/\/+$/, "");

/** Path prefix shared by every endpoint. */
export const API_PREFIX = "/api";

export class ApiError extends Error {
  readonly status: number;
  readonly url: string;
  readonly body: unknown;

  constructor(message: string, options: { status: number; url: string; body?: unknown }) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.url = options.url;
    this.body = options.body;
  }
}

/**
 * Under `next dev` the site runs on :3000 while `api/server.mjs` listens on
 * :3001 (`pnpm dev` starts both), so a same-origin call would hit Next's 404.
 * In any other setup — nginx, GitHub Pages, a custom API host — the origin is
 * left alone.
 */
function devApiOrigin(): string {
  if (typeof window === "undefined") return "";
  if (window.location.port !== "3000") return "";
  return `${window.location.protocol}//${window.location.hostname}:3001`;
}

function buildPath(path: string): string {
  const normalised = path.startsWith("/") ? path : `/${path}`;
  const withPrefix = normalised.startsWith(API_PREFIX) ? normalised : `${API_PREFIX}${normalised}`;
  return `${API_BASE_URL || devApiOrigin()}${withPrefix}`;
}

/** Absolute (or same-origin) URL for an API path. */
export function apiUrl(path: string): string {
  return buildPath(path);
}

type ApiFetchOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  /** Milliseconds before the request is aborted. Defaults to 8s. */
  timeoutMs?: number;
  /** Query string parameters, `undefined`/`null` values are dropped. */
  query?: Record<string, string | number | boolean | undefined | null>;
};

/** Typed `fetch` wrapper: JSON in, JSON out, with a timeout. */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, timeoutMs = 8000, query, headers, ...rest } = options;

  const url = new URL(buildPath(path), globalThis.location?.origin ?? "http://localhost");
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      ...rest,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      throw new ApiError(`Request to ${url.pathname} failed with ${response.status}`, {
        status: response.status,
        url: url.toString(),
        body: await safeParse(response),
      });
    }

    if (response.status === 204) return undefined as T;

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(`Request to ${url.pathname} timed out`, {
        status: 408,
        url: url.toString(),
      });
    }
    throw new ApiError(error instanceof Error ? error.message : "Network error", {
      status: 0,
      url: url.toString(),
    });
  } finally {
    clearTimeout(timer);
  }
}

async function safeParse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/**
 * Try the API first, fall back to local data when it is unreachable.
 * Used by the portfolio sections so the static site never shows an empty page.
 */
export async function fetchWithFallback<T>(
  request: () => Promise<T>,
  fallback: T,
  onFallback?: (error: unknown) => void,
): Promise<{ data: T; source: "api" | "fallback" }> {
  try {
    const data = await request();
    return { data, source: "api" };
  } catch (error) {
    onFallback?.(error);
    return { data: fallback, source: "fallback" };
  }
}
