import { apiFetch } from "@/lib/api";

/**
 * The stack (`GET /api/stack`), grouped.
 *
 * Same rule as the rest of the page: the API is the only source, so a tool that
 * has not been retrieved yet renders as a skeleton rather than as bundled data.
 * The home page band flattens the groups, `/stack` renders them as sections.
 */
export type StackItem = {
  /** Display name, e.g. "TypeScript". */
  name: string;
  /** SVG used as a CSS mask, so the mark can take `color` on hover. */
  logo: string;
  /** Canonical site of the tool. */
  href: string;
  /** Brand colour, applied to the mask on hover/focus. */
  color?: string;
  /** First year shipped in production. */
  since?: number;
  /** What the tool actually does here — not a tagline. */
  note?: string;
  /** Libraries that come with it, read from the repositories' manifests. */
  also?: string[];
};

export type StackGroup = {
  /** Stable key, used for React keys and deep links (`/stack#languages`). */
  id: string;
  /** Human heading of the group. */
  label: string;
  /** Short role of the group, shown next to the heading. */
  note?: string;
  items: StackItem[];
};

type StackPayload = { groups: StackGroup[] };

/** Fetches the grouped stack. Throws when unreachable or empty. */
export async function fetchStack(): Promise<StackGroup[]> {
  const payload = await apiFetch<StackPayload>("/stack");
  if (!Array.isArray(payload?.groups) || payload.groups.length === 0) {
    throw new Error("Empty stack payload");
  }
  return payload.groups;
}
