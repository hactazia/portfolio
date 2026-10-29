"use client";

import { useEffect, useState } from "react";

import { Logo } from "@/components/design/logo";
import { useContacts, useSiteContent } from "@/components/design/site-content";
import { Skeleton } from "@/components/ui/skeleton";
import { useSectionHref } from "@/lib/section-href";
import type { NavLink } from "@/lib/site";

import styles from "./nav.module.scss";

/** Page anchors: the navbar is the only place that needs this order. */
const LINKS: NavLink[] = [
  { label: "Work", href: "#work" },
  { label: "Showcase", href: "#showcase" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

/* -------------------------------------------------------------------------- */
/* Gradual blur navbar                                                        */
/* -------------------------------------------------------------------------- */

export function GradualBlurNav() {
  const [open, setOpen] = useState(false);
  const site = useSiteContent();
  const sectionHref = useSectionHref();
  // The CTA is just "say hello": its target is the email row of /api/contacts.
  const email = useContacts()?.find((row) => row.kind === "email");

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <header className={styles.header}>
        <div className={styles.bar}>
          <div className={styles.barInner}>
            <a
              href={sectionHref("#top")}
              className={styles.brand}
              aria-label={`${site?.brand.name ?? "Home"} — home`}
            >
              {site ? <Logo art={site.logo} size={28} title={null} /> : <Skeleton className={styles.brandSkeleton} />}
            </a>

            <nav className={styles.links} aria-label="Primary">
              {LINKS.map((item) => (
                <a key={item.href} href={sectionHref(item.href)} className={styles.link}>
                  {item.label}
                </a>
              ))}
            </nav>

            <div className={styles.actions}>
              {email ? (
                <a href={email.href} className={styles.cta}>
                  Contact Me
                </a>
              ) : (
                <Skeleton className={styles.ctaSkeleton} />
              )}
              <button
                type="button"
                className={styles.menuButton}
                data-open={open}
                aria-label={open ? "Close menu" : "Open menu"}
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
              >
                <span />
                <span />
              </button>
            </div>
          </div>
        </div>
      </header>

      <StaggeredMenu open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Staggered menu                                                             */
/* -------------------------------------------------------------------------- */

function StaggeredMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const contacts = useContacts();
  const site = useSiteContent();
  const sectionHref = useSectionHref();

  return (
    <div className={styles.overlay} data-open={open} aria-hidden={!open}>
      <div className={styles.overlayList}>
        {LINKS.map((item, index) => (
          <a
            key={item.href}
            href={sectionHref(item.href)}
            className={styles.overlayItem}
            style={{ "--i": index } as React.CSSProperties}
            onClick={onClose}
            tabIndex={open ? 0 : -1}
          >
            <span className={styles.overlayIndex}>0{index + 1}</span>
            {item.label}
          </a>
        ))}
      </div>

      <div className={styles.overlayFooter}>
        <span>{site?.location?.short}</span>
        <div className={styles.overlaySocials}>
          {(contacts ?? []).map((row) => (
            <a
              key={row.label}
              href={row.href}
              rel={row.rel}
              title={row.title}
              tabIndex={open ? 0 : -1}
            >
              {row.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
