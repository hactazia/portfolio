"use client";

import { useEffect, useRef } from "react";
import { ArrowUp, ArrowUpRight } from "lucide-react";

import { useContacts, useSiteContent } from "@/components/design/site-content";
import { Wordmark } from "@/components/design/wordmark";
import { Skeleton } from "@/components/ui/skeleton";
import type { ContactRow } from "@/lib/contacts";
import { useSectionHref } from "@/lib/section-href";
import type { NavLink } from "@/lib/site";

import styles from "./site-footer.module.scss";

/** Page anchors, mirroring the navbar: UI structure, so it lives here. */
const STUDIO_LINKS: NavLink[] = [
  { label: "Work", href: "#work" },
  { label: "Showcase", href: "#showcase" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

/**
 * Footer revealed under the page body.
 *
 * The panel is `position: fixed` at the bottom of the viewport, and the page
 * content (`.content` on the design page) is opaque and sits above it. The
 * content reserves `--footer-h` of bottom margin, so scrolling to the end
 * uncovers the footer instead of pushing it.
 */
export function SiteFooter() {
  const ref = useRef<HTMLElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const site = useSiteContent();
  const contacts = useContacts();
  const sectionHref = useSectionHref();
  // "Say hello" points at the email row, so the address is stated once.
  const email = contacts?.find((row) => row.kind === "email");

  useEffect(() => {
    const footer = ref.current;
    const inner = innerRef.current;
    if (!footer || !inner) return;

    const root = document.documentElement;

    // The footer spans the whole viewport, so the space the page must reserve
    // is the height of its content, not of the panel.
    const publishHeight = () => {
      root.style.setProperty("--footer-h", `${Math.round(inner.offsetHeight)}px`);
    };

    // The wordmark rises once, when the footer starts being uncovered.
    // Only the state flip touches the DOM, so there is no per-frame jitter.
    let revealed: boolean | null = null;

    const publishReveal = () => {
      const distance =
        document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      const height = inner.offsetHeight || 1;
      const next = 1 - distance / height > 0.16;

      if (next === revealed) return;
      revealed = next;
      footer.dataset.revealed = String(next);
    };

    const update = () => {
      publishHeight();
      publishReveal();
    };

    update();

    const ro = new ResizeObserver(update);
    ro.observe(inner);

    window.addEventListener("scroll", publishReveal, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", publishReveal);
      window.removeEventListener("resize", update);
      root.style.removeProperty("--footer-h");
    };
  }, []);

  return (
    <footer ref={ref} className={styles.footer}>
      <div ref={innerRef} className={styles.content}>
        <div className={styles.inner}>
          <div className={styles.top}>
            <div className={styles.brandBlock}>
              {site ? (
                <Wordmark size={20} name={site.brand.name} art={site.logo} />
              ) : (
                <Skeleton className={styles.wordmarkSkeleton} />
              )}

              {site?.tagline ? (
                <p className={styles.tagline}>{site.tagline}</p>
              ) : (
                <Skeleton className={styles.lineSkeleton} />
              )}

              {email ? (
                <a href={email.href} className={styles.cta}>
                  Contact Me
                  <ArrowUpRight size={15} />
                </a>
              ) : (
                <Skeleton className={styles.ctaSkeleton} />
              )}
            </div>

            {/*
              Two columns: the shared anchors, then the `GET /api/contacts`
              rows. The column headings are UI chrome, not content.
            */}
            <div className={styles.columns}>
              <FooterColumn
                title="Studio"
                links={STUDIO_LINKS.map((link) => ({
                  ...link,
                  href: sectionHref(link.href),
                }))}
              />
              {contacts ? (
                <ContactColumn rows={contacts} />
              ) : (
                <div>
                  <Skeleton className={styles.columnTitleSkeleton} />
                  <Skeleton className={styles.lineSkeleton} />
                  <Skeleton className={styles.lineSkeletonShort} />
                </div>
              )}
            </div>
          </div>

          <div className={styles.tail}>
            <a href={sectionHref("#top")} className={styles.toTop}>
              Back to top
              <ArrowUp size={12} />
            </a>
          </div>
        </div>

        {/* Full-bleed wordmark, clipped in half by the bottom edge. */}
        <div className={styles.mark} aria-hidden>
          {site ? (
            <span className={styles.markText}>{site.brand.wordmark}</span>
          ) : (
            <Skeleton className={styles.markSkeleton} />
          )}
        </div>
      </div>
    </footer>
  );
}

/** One footer column: a heading plus its links. */
function FooterColumn({ title, links }: { title: string; links: NavLink[] }) {
  return (
    <div>
      <div className={styles.columnTitle}>{title}</div>
      <div className={styles.columnLinks}>
        {links.map((link) => (
          <a
            key={`${title}-${link.label}`}
            href={link.href}
            target={link.href.startsWith("http") ? "_blank" : undefined}
            rel="noreferrer noopener"
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}

/** "Elsewhere": the contact rows, rel/title included for identity links. */
function ContactColumn({ rows }: { rows: ContactRow[] }) {
  return (
    <div>
      <div className={styles.columnTitle}>Elsewhere</div>
      <div className={styles.columnLinks}>
        {rows.map((row) => (
          <a
            key={row.label}
            href={row.href}
            rel={row.rel ? `${row.rel} noreferrer noopener` : "noreferrer noopener"}
            title={row.title}
            target={row.href.startsWith("http") ? "_blank" : undefined}
          >
            {row.label}
          </a>
        ))}
      </div>
    </div>
  );
}
