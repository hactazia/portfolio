/**
 * The parts of the page identity that are served by the API: the brand names,
 * the mark, and the hero statement.
 *
 * The rest is either page structure (the section anchors, which each component
 * knows) or content that lives in another endpoint — the social links are
 * `/api/contacts` rows, so no email or profile is stated twice.
 */

import { apiFetch, apiUrl } from "@/lib/api";

export type NavLink = { label: string; href: string };

/** One headline line, with the treatment it should be painted in. */
export type HeroLine = {
  text: string;
  /** Which headline treatment to use: plain, "muted" or "outline". */
  tone?: "" | "muted" | "outline";
};

/** The mark: a URL to an SVG plus its accessible name. */
export type LogoArt = {
  src: string;
  alt?: string;
};

export type SiteContent = {
  brand: {
    /** Display name, e.g. "Hactazia". */
    name: string;
    /** Lower-case lockup used by the giant footer wordmark. */
    wordmark: string;
  };
  logo: LogoArt;
  /** One-line identity statement, repeated by the footer. */
  tagline?: string;
  /**
   * Where I work from and the hours I answer in. `short` is the line in the menu
   * sheet, `long` the one under the contact list — stated once, on the API.
   */
  location?: {
    short: string;
    long: string;
  };
  /** The opening statement — copy that must not be duplicated in the bundle. */
  hero: {
    eyebrow: string;
    meta: string[];
    lines: HeroLine[];
    lead: string;
  };
};

/**
 * Absolute URL of an asset served by the API.
 *
 * Images and marks are not part of the static export: they live outside the
 * bundle (and outside git) and `GET /api/assets/*` streams them, so a
 * site-relative path such as `/logos/hactazia.svg` becomes
 * `<api>/api/assets/logos/hactazia.svg`. Absolute URLs are returned untouched.
 */
export function resolveAsset(src: string | null | undefined): string {
  if (!src) return "";
  if (!src.startsWith("/")) return src;
  return apiUrl(`/assets${src}`);
}

type SitePayload = { site: SiteContent };

/** Fetches the site content. Throws when the API is unreachable or empty. */
export async function fetchSiteContent(): Promise<SiteContent> {
  const payload = await apiFetch<SitePayload>("/site");
  if (!payload?.site?.brand?.name) throw new Error("Empty site payload");
  return payload.site;
}
