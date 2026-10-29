"use client";

import { usePathname } from "next/navigation";

/** Base path the export is served under, e.g. `/portfolio` on GitHub Pages. */
const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

/**
 * Where the section anchors (`#work`, `#contact`…) actually live.
 *
 * It has to carry the base path: GitHub Pages serves this site from
 * `/portfolio/`, so an absolute `/#work` would jump back to the account root.
 */
export const SECTIONS_PATH = `${BASE_PATH}/`;

/**
 * Resolves a section anchor for the page currently displayed.
 *
 * On the home page it stays a plain hash — the browser scrolls, no navigation.
 * Anywhere else it becomes `<base><sep>#…`, so the navbar and the footer keep
 * working from another route instead of pointing at anchors that are not there.
 */
export function useSectionHref(): (anchor: string) => string {
  const pathname = usePathname() ?? "";
  // `usePathname()` returns "/" or "/portfolio" depending on the router, and
  // may or may not keep a trailing slash; all of those mean "the home page".
  const normalized = pathname.replace(/\/+$/, "");
  const here = normalized === "" || normalized === BASE_PATH;

  return (anchor: string) => (here ? anchor : `${SECTIONS_PATH}${anchor}`);
}
