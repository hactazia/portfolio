"use client";

import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { fetchShowcaseCards, resolveCardImage, type ShowcaseCard } from "@/lib/showcase";

import styles from "./showcase.module.scss";

/** Polaroid scatter: each card gets its own lean and vertical offset. */
const TILTS = [-2.6, 1.9, -1.4, 2.4, -2.1, 1.5, -1.8];
const DROPS = [0, 12, -6, 16, 4, -10, 8];

/** Slots kept while the cards are being fetched, so the fan keeps its shape. */
const SKELETON_SLOTS = 3;

export function Showcase() {
  /** `null` = nothing retrieved yet: the section then shows skeletons. */
  const [cards, setCards] = useState<ShowcaseCard[] | null>(null);
  // Hover history, oldest first. Every card the visitor touched stays above
  // the untouched ones, and the most recent stays above all of them.
  const [stack, setStack] = useState<string[]>([]);

  const count = cards?.length ?? SKELETON_SLOTS;

  const promote = (id: string) => {
    setStack((current) =>
      current.at(-1) === id ? current : [...current.filter((item) => item !== id), id],
    );
  };

  /**
   * `index + 1` is the default fan order; a promoted card moves past all of
   * them (`count + 1`) and is then ranked by how recently it was hovered, so
   * the latest hover always wins the top spot.
   */
  const layerOf = (id: string, index: number) => {
    const rank = stack.indexOf(id);
    return rank === -1 ? index + 1 : count + 1 + rank;
  };

  useEffect(() => {
    let live = true;

    fetchShowcaseCards()
      .then((data) => {
        if (live) setCards(data);
      })
      // Nothing to do: the skeletons stay, which is the honest state when the
      // API never answered.
      .catch(() => {});

    return () => {
      live = false;
    };
  }, []);

  return (
    <section id="showcase" className={styles.section}>
      <div className={styles.head}>
        <div>
          <span className="d-label">02 — Showcase</span>
          <h2 className={styles.title}>Screens from the workbench.</h2>
        </div>

        <div className={styles.headAside}>
          <p className={styles.lead}>
            Avatars, shaders and the tooling behind them — captured between builds, half in the
            editor and half in VRChat.
          </p>
          <a className={styles.link} href="#work">
            Browse the archive
            <ArrowUpRight size={14} />
          </a>
        </div>
      </div>

      <div className={styles.rail}>
        <ul className={styles.track} style={{ "--n": count } as CSSProperties}>
          {cards
            ? cards.map((card, index) => {
                const image = resolveCardImage(card.image);

                const body = (
                  <div className={styles.card}>
                    <div className={styles.flip}>
                      <figure className={styles.face} data-face="front">
                        <span
                          className={styles.photo}
                          data-has-image={card.image ? "true" : undefined}
                          aria-hidden
                        />
                      </figure>

                      {/* Back face, revealed by the flip on hover / focus. */}
                      <figure className={styles.face} data-face="back">
                        <span className={styles.backTitle}>{card.title}</span>
                        <span className={styles.backMeta}>{card.place}</span>
                        <span className={styles.backMeta}>{card.date}</span>
                        <span className={styles.backCta}>
                          {card.cta}
                          {card.href ? <ArrowUpRight size={12} aria-hidden /> : null}
                        </span>
                      </figure>
                    </div>
                  </div>
                );

                return (
                  <li
                    key={card.id}
                    onPointerEnter={() => promote(card.id)}
                    onFocus={() => promote(card.id)}
                    className={styles.item}
                    style={
                      {
                        "--tilt": `${TILTS[index % TILTS.length]}deg`,
                        "--drop": `${DROPS[index % DROPS.length]}px`,
                        "--tone": card.tone,
                        // Shared by the front photo and the back face's backdrop.
                        "--photo": image ? `url(${image})` : "none",
                        "--focus": card.focus ?? "center",
                        zIndex: layerOf(card.id, index),
                      } as CSSProperties
                    }
                  >
                    {card.href ? (
                      <a
                        className={styles.cardLink}
                        href={card.href}
                        target="_blank"
                        rel="noreferrer noopener"
                        aria-label={`${card.title} — ${card.place} (opens in a new tab)`}
                      >
                        {body}
                      </a>
                    ) : (
                      body
                    )}
                  </li>
                );
              })
            : Array.from({ length: SKELETON_SLOTS }, (_, index) => (
                <li
                  key={`skeleton-${index}`}
                  className={styles.item}
                  aria-hidden
                  style={
                    {
                      "--tilt": `${TILTS[index % TILTS.length]}deg`,
                      "--drop": `${DROPS[index % DROPS.length]}px`,
                      zIndex: index + 1,
                    } as CSSProperties
                  }
                >
                  {/* Nothing retrieved from the API yet: a skeleton plate, not
                      invented content. */}
                  <div className={styles.card}>
                    <Skeleton className={styles.skeletonCard} />
                  </div>
                </li>
              ))}
        </ul>
      </div>
    </section>
  );
}
