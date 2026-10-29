import { apiFetch } from "@/lib/api";

/**
 * The "03 — About" section (`GET /api/about`): copy, counters and timeline.
 *
 * Everything the section says is stated once, here — the component only decides
 * which paragraph is the lead and how a figure or a row is painted. Same rule as
 * the rest of the page: nothing retrieved yet renders as a skeleton, never as
 * bundled copy.
 */
export type AboutStat = {
  /** Figure as displayed, e.g. "36" or "2023" — never derived from `label`. */
  value: string;
  /** What the figure counts, e.g. "Public repos". */
  label: string;
};

export type AboutEntry = {
  /** Period as displayed, e.g. "2019 — 2020"; a single year when it is one. */
  year: string;
  /** Job title, e.g. "Full-stack developer intern". */
  role: string;
  /** Employer and what it did, e.g. "Polycube · VPS & web hosting". */
  company: string;
};

export type AboutContent = {
  /** Body copy, in order; the first string is rendered as the lead. */
  paragraphs: string[];
  stats: AboutStat[];
  timeline: AboutEntry[];
};

/** Fetches the About content. Throws when unreachable or incomplete. */
export async function fetchAbout(): Promise<AboutContent> {
  const payload = await apiFetch<AboutContent>("/about");

  if (!Array.isArray(payload?.paragraphs) || payload.paragraphs.length === 0) {
    throw new Error("Empty about paragraphs");
  }
  if (!Array.isArray(payload?.stats) || payload.stats.length === 0) {
    throw new Error("Empty about payload");
  }
  if (!Array.isArray(payload?.timeline) || payload.timeline.length === 0) {
    throw new Error("Empty about timeline");
  }

  return payload;
}
