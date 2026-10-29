"use client";

import { usePathname } from "next/navigation";

/** Where the section anchors (`#work`, `#contact`…) actually live. */
export const SECTIONS_PATH = "/";

/** Base path the export is served under, e.g. `/portfolio` on GitHub Pages. */
const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

/**
 * Resolves a section anchor for the page currently displayed.
 *
 * On the home page it stays a plain hash — the browser scrolls, no navigation.
 * Anywhere else it becomes `/#…`, so the navbar and the footer keep working
 * from another route instead of pointing at anchors that are not there.
 */
export function useSectionHref(): (anchor: string) => string {
  const pathname = usePathname() ?? "";
  // `trailingSlash: false` gives "/", GitHub Pages gives the base path too.
  const here = pathname.replace(/\/+$/, "") === BASE_PATH;

  return (anchor: string) => (here ? anchor : `${SECTIONS_PATH}${anchor}`);
}
