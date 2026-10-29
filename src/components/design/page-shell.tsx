import type { ReactNode } from "react";

import { Noise } from "@/components/design/backgrounds";
import { GradualBlurNav } from "@/components/design/nav/nav";
import { PresenceLayer } from "@/components/design/presence-layer";
import { SiteFooter } from "@/components/design/sections/site-footer";
import { SiteContentProvider } from "@/components/design/site-content";
import { STICKER_LAYER_ID } from "@/lib/sticker-layer";

import styles from "./page-shell.module.scss";

/**
 * The chrome every page of the site shares.
 *
 * One provider at the root means `/api/site`, `/api/contacts` and `/api/stack`
 * are requested once per visit, whichever page is opened. The body is drawn as
 * an opaque sheet above the fixed footer, so the footer is uncovered by
 * scrolling rather than pushed down (see `SiteFooter` for the measurement).
 */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <SiteContentProvider>
      <div className={styles.root}>
        <div className={styles.grain}>
          <Noise />
        </div>

        <GradualBlurNav />

        <div className={styles.content}>
          <main>{children}</main>
        </div>

        {/* Full-page playground: stickers live here, above the sheet. */}
        <div id={STICKER_LAYER_ID} className={styles.stickers} />

        <SiteFooter />

        <PresenceLayer />
      </div>
    </SiteContentProvider>
  );
}
