"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { CSSProperties } from "react";

import { GameOfLife } from "@/components/design/game-of-life";
import { ScrollDrawer } from "@/components/design/scroll-drawer";
import { useSiteContent } from "@/components/design/site-content";
import { Skeleton } from "@/components/ui/skeleton";
import type { HeroLine } from "@/lib/site";
import { cn } from "@/lib/utils";

import styles from "./hero.module.scss";

/** Number of headline lines kept while the copy is being fetched. */
const SKELETON_LINES = 3;

/** The statement itself: everything the hero paints. */
export type HeroContent = {
  eyebrow: string;
  meta: string[];
  lines: HeroLine[];
  lead: string;
  /** Optional second paragraph, kept muted and under the lead. */
  note?: string;
};

type HeroProps = {
  /** `small` opens a sub-page: same statement, one breath instead of two. */
  size?: "full" | "small";
  /**
   * Explicit copy. Left out, the hero reads the statement of `GET /api/site` —
   * which is what the homepage does; sub-pages pass their own.
   */
  content?: HeroContent;
  /** Anchor the drag cue points at; `null` hides the cue. */
  scrollTarget?: string | null;
  /** The two calls to action belong to the full statement only. */
  actions?: boolean;
};

export function Hero({
  size = "full",
  content,
  scrollTarget = "work",
  actions = true,
}: HeroProps) {
  // Falls back to the API statement, so the design page keeps its skeleton
  // behaviour; an explicit `content` is already available when it renders.
  const remote = useSiteContent()?.hero;
  const hero: HeroContent | undefined = content ?? remote;
  const small = size === "small";

  return (
    <section id="top" className={cn(styles.hero, small && styles.small)}>
      <div className={styles.life} aria-hidden>
        {/* Same tuning as the reference frontend hero. */}
        <GameOfLife cellSize={16} opacity={small ? 0.05 : 0.08} speed={150} />
      </div>
      <div className={styles.veil} aria-hidden />

      <div className={styles.inner}>
        <div className={styles.meta}>
          <div className={styles.metaBlock}>
            {hero ? <span>{hero.eyebrow}</span> : <Skeleton className={styles.metaSkeleton} />}
          </div>

          <div className={styles.metaBlock} data-align="right">
            {hero && hero.meta.length > 0 ? (
              hero.meta.map((line) => <span key={line}>{line}</span>)
            ) : (
              <>
                <Skeleton className={styles.metaSkeleton} />
                <Skeleton className={styles.metaSkeleton} />
              </>
            )}
          </div>
        </div>

        <h1 className={styles.headline}>
          {hero
            ? hero.lines.map((line, index) => (
                <span
                  key={line.text}
                  className={styles.line}
                  style={{ "--i": index } as CSSProperties}
                >
                  <span className={line.tone ? styles[line.tone] : undefined}>{line.text}</span>
                </span>
              ))
            : Array.from({ length: SKELETON_LINES }, (_, index) => (
                <span key={index} className={styles.line} style={{ "--i": index } as CSSProperties}>
                  <Skeleton className={styles.headlineSkeleton} />
                </span>
              ))}
        </h1>

        <div className={styles.bottom}>
          <div className={styles.copy}>
            {hero ? (
              <p className={styles.lead}>{hero.lead}</p>
            ) : (
              <div className={styles.leadSkeleton}>
                <Skeleton className={styles.lineSkeleton} />
                <Skeleton className={styles.lineSkeleton} />
                <Skeleton className={styles.lineSkeletonShort} />
              </div>
            )}

            {hero?.note ? <p className={styles.note}>{hero.note}</p> : null}
          </div>

          {actions ? (
            <div className={styles.actions}>
              <a href="#work" className={styles.cta}>
                Selected work
                <ArrowDownRight size={16} />
              </a>
              <a href="#contact" className={styles.ghost} aria-label="Contact">
                <ArrowUpRight size={16} />
              </a>
            </div>
          ) : null}
        </div>
      </div>

      {scrollTarget ? <ScrollDrawer targetId={scrollTarget} /> : null}
    </section>
  );
}
