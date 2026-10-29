"use client";

import { ArrowUpRight } from "lucide-react";
import { useMemo, useState } from "react";

import { useStack } from "@/components/design/site-content";
import { seatOf, StickerPile } from "@/components/design/sticker-pile";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveAsset } from "@/lib/site";
import type { StackGroup, StackItem } from "@/lib/stack";

import styles from "./stack-lab.module.scss";

/** Stickers kept while the stack is in flight. */
const SKELETON_STICKERS = 6;

/**
 * "05 — Stack": the pile on the left, the file of whichever sticker was clicked
 * on the right.
 *
 * The pile is a playground — stickers are draggable and throwable across the
 * whole page — so clicking one is the only way to read what it is. The tooling
 * comes from `GET /api/stack`; the copy around it is section copy and lives here.
 */
export function StackLab() {
  const groups = useStack();
  const [picked, setPicked] = useState<string | null>(null);

  const total = groups?.reduce((count, group) => count + group.items.length, 0) ?? 0;

  // Stable identity: the pile must not re-mount (and replay its intro) on every
  // render, so the flattening is memoised rather than recomputed.
  const items = useMemo(() => groups?.flatMap((group) => group.items) ?? null, [groups]);
  // Nothing picked yet: the first tool answers, so the panel is never empty.
  const current = items?.find((item) => item.name === picked) ?? items?.[0] ?? null;
  const group = groups?.find((candidate) => candidate.items.includes(current as StackItem));

  return (
    <section id="stack" className={styles.section}>
      <div className={styles.split}>
        <div className={styles.side}>
          <div className={styles.head}>
            <span className="d-label">05 — Stack</span>
            <h2 className={styles.title}>Tools I build with.</h2>
          </div>

          <aside className={styles.panel} aria-live="polite">
            {current && group ? (
              <ToolFile key={current.name} item={current} group={group} />
            ) : (
              <PendingFile />
            )}
          </aside>

          {/* Kept under the file, where it reads as its caption. */}
          <p className={styles.note}>
            {groups ? `${total} tools in ${groups.length} groups. ` : null}
            Drag a sticker anywhere on the page, click one to open its file — every entry says what
            the tool actually does here, plus the libraries it drags along.
          </p>
        </div>

        <section className={styles.pile} aria-label="Pile of stickers">
          {items ? (
            <StickerPile items={items} onSelect={(item) => setPicked(item.name)} />
          ) : (
            <PendingPile />
          )}

          {/*
            The pile is drawn on canvases, so the tools are also listed here:
            same destinations, reachable with the keyboard and by a crawler.
          */}
          <ul className={styles.srList}>
            {(items ?? []).map((item) => (
              <li key={item.name}>
                <button type="button" onClick={() => setPicked(item.name)}>
                  {item.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}

/** The right-hand file: everything the API knows about the clicked tool. */
function ToolFile({ item, group }: { item: StackItem; group: StackGroup }) {
  return (
    <div className={styles.file}>
      <div className={styles.fileTop}>
        <span
          className={styles.fileMark}
          aria-hidden
          style={{
            maskImage: `url(${resolveAsset(item.logo)})`,
            backgroundColor: item.color ?? "var(--d-accent)",
          }}
        />

        <div>
          <span className={styles.fileEyebrow}>
            {group.label}
            {group.note ? ` — ${group.note}` : null}
          </span>
          <h3 className={styles.fileName}>{item.name}</h3>
        </div>
      </div>

      {item.note ? <p className={styles.fileNote}>{item.note}</p> : null}

      {item.also?.length ? (
        <div className={styles.fileAlso}>
          <span className={styles.fileAlsoLabel}>Also in the box</span>
          <ul>
            {item.also.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <dl className={styles.fileMeta}>
        {item.since ? (
          <div>
            <dt>Since</dt>
            <dd>{item.since}</dd>
          </div>
        ) : null}
        <div>
          <dt>Group</dt>
          <dd>{group.label}</dd>
        </div>
      </dl>

      <a href={item.href} target="_blank" rel="noreferrer noopener" className={styles.fileLink}>
        {item.href.replace(/^https?:\/\//, "").replace(/\/$/, "")}
        <ArrowUpRight size={14} />
      </a>
    </div>
  );
}

/** Placeholder file, with the same rhythm as the real one. */
function PendingFile() {
  return (
    <div className={styles.file}>
      <div className={styles.fileTop}>
        <Skeleton className={styles.fileMarkSkeleton} />
        <div>
          <Skeleton className={styles.fileEyebrowSkeleton} />
          <Skeleton className={styles.fileNameSkeleton} />
        </div>
      </div>

      <div className={styles.fileNotes}>
        <Skeleton className={styles.fileLineSkeleton} />
        <Skeleton className={styles.fileLineSkeleton} />
        <Skeleton className={styles.fileLineSkeletonShort} />
      </div>
    </div>
  );
}

/** Grey seats that hold the pile's rhythm while `/api/stack` is in flight. */
function PendingPile() {
  return (
    <div className={styles.pending} aria-hidden>
      {Array.from({ length: SKELETON_STICKERS }, (_, index) => {
        const seat = seatOf(index, SKELETON_STICKERS);

        // Rounded on purpose: raw floats would differ between the server and
        // the client render, and React refuses to patch a style mismatch.
        return (
          <Skeleton
            key={index}
            className={styles.stickerSkeleton}
            style={{
              left: `${(seat.u * 100).toFixed(2)}%`,
              top: `${(seat.v * 100).toFixed(2)}%`,
              width: `${(seat.width / 16).toFixed(2)}rem`,
              height: `${(seat.width / 16).toFixed(2)}rem`,
              transform: `rotate(${seat.rotate.toFixed(1)}deg)`,
            }}
          />
        );
      })}
    </div>
  );
}
