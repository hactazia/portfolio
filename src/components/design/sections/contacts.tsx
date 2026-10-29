"use client";

import { ArrowUpRight } from "lucide-react";

import { Aurora } from "@/components/design/backgrounds";
import { useContacts, useSiteContent } from "@/components/design/site-content";
import { Skeleton } from "@/components/ui/skeleton";

import styles from "./contacts.module.scss";

/** Rows kept while the links are being fetched, so the rhythm stays put. */
const SKELETON_ROWS = 4;

export function Contacts() {
  /** `null` = nothing retrieved yet: the list then shows skeletons. */
  const rows = useContacts();
  const site = useSiteContent();

  return (
    <section id="contact" className={styles.section}>
      <div className={styles.aura} aria-hidden>
        <Aurora colors={["#50c878", "#ccccff", "#5b5bd6"]} />
      </div>

      <div className={styles.head}>
        <div>
          <span className="d-label">04 — Contact</span>
          <h2 className={styles.title}>Say hello.</h2>
        </div>
        <p className={styles.note}>
          The fastest way is email — I answer within two working days.
        </p>
      </div>

      <div className={styles.list}>
        {rows
          ? rows.map((contact) => (
              <a
                key={contact.label}
                href={contact.href}
                className={styles.row}
                target={contact.href.startsWith("http") ? "_blank" : undefined}
                rel="noreferrer noopener"
              >
                <span className={styles.label}>{contact.label}</span>
                <span className={styles.value}>{contact.value}</span>
                <span className={styles.icon} aria-hidden>
                  <ArrowUpRight size={16} />
                </span>
              </a>
            ))
          : Array.from({ length: SKELETON_ROWS }, (_, index) => (
              // Same three columns as a real row, so the list does not reflow
              // when the API answers.
              <div key={`skeleton-${index}`} className={styles.row} aria-hidden>
                <Skeleton className={styles.skeletonLabel} />
                <Skeleton className={styles.skeletonValue} />
                <Skeleton className={styles.skeletonIcon} />
              </div>
            ))}
      </div>

      <div className={styles.footer}>
        <span>{site?.location?.long}</span>
      </div>
    </section>
  );
}
