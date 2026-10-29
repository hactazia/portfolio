"use client";

import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { fetchAbout, type AboutContent } from "@/lib/about";
import styles from "./about.module.scss";

/** Placeholders kept while the content is being fetched, so nothing jumps. */
const SKELETON_PARAGRAPHS = 3;
const SKELETON_STATS = 3;
const SKELETON_ENTRIES = 4;

export function About() {
  /** `null` = nothing retrieved yet: the figures then show skeletons. */
  const [about, setAbout] = useState<AboutContent | null>(null);

  useEffect(() => {
    let live = true;

    fetchAbout()
      .then((data) => {
        if (live) setAbout(data);
      })
      // The skeletons stay: nothing was retrieved, so there is nothing to show.
      .catch(() => {});

    return () => {
      live = false;
    };
  }, []);

  return (
    <section id="about" className={styles.section}>
      <div className={styles.layout}>
        <div className={styles.aside}>
          <span className="d-label">03 — About</span>
          <h2 className={styles.statement}>
            I build interfaces where <em>craft</em> is not a layer on top of engineering.
          </h2>
        </div>

        <div className={styles.body}>
          {about
            ? about.paragraphs.map((paragraph, index) => (
                <p
                  key={`paragraph-${index}`}
                  className={index === 0 ? styles.lead : styles.paragraph}
                >
                  {paragraph}
                </p>
              ))
            : Array.from({ length: SKELETON_PARAGRAPHS }, (_, index) => (
                <Skeleton
                  key={index}
                  aria-hidden
                  className={index === 0 ? styles.leadSkeleton : styles.paragraphSkeleton}
                />
              ))}

          <div className={styles.stats}>
            {about
              ? about.stats.map((stat) => (
                  <div key={stat.label}>
                    <span className={styles.statValue}>{stat.value}</span>
                    <span className={styles.statLabel}>{stat.label}</span>
                  </div>
                ))
              : Array.from({ length: SKELETON_STATS }, (_, index) => (
                  <div key={index} aria-hidden>
                    <Skeleton className={styles.statValueSkeleton} />
                    <Skeleton className={styles.statLabelSkeleton} />
                  </div>
                ))}
          </div>

          <div className={styles.timeline}>
            {about
              ? about.timeline.map((entry) => (
                  <div key={`${entry.year}-${entry.role}`} className={styles.entry}>
                    <span className={styles.year}>{entry.year}</span>
                    <span className={styles.role}>{entry.role}</span>
                    <span className={styles.company}>{entry.company}</span>
                  </div>
                ))
              : Array.from({ length: SKELETON_ENTRIES }, (_, index) => (
                  <div key={index} className={styles.entry} aria-hidden>
                    <Skeleton className={styles.yearSkeleton} />
                    <Skeleton className={styles.roleSkeleton} />
                    <Skeleton className={styles.companySkeleton} />
                  </div>
                ))}
          </div>
        </div>
      </div>
    </section>
  );
}
