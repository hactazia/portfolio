"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { fetchProjects, projectIndex, projectYearRange, type Project } from "@/lib/projects";
import styles from "./project-list.module.scss";

/** Rows kept while the list is being fetched, so the layout does not jump. */
const SKELETON_ROWS = 3;

export function ProjectList() {
  /** `null` = nothing retrieved yet: the list then shows skeletons. */
  const [projects, setProjects] = useState<Project[] | null>(null);

  useEffect(() => {
    let live = true;

    fetchProjects()
      .then((data) => {
        if (live) setProjects(data);
      })
      // The skeletons stay: nothing was retrieved, so there is nothing to show.
      .catch(() => {});

    return () => {
      live = false;
    };
  }, []);

  return (
    <section id="work" className={styles.section}>
      <div className={styles.layout}>
        <aside className={styles.aside}>
          <span className="d-label">01 — Selected work</span>
          <h2 className={styles.asideTitle}>Projects built end to end.</h2>
          <p className={styles.asideText}>
            Products where the interface, the protocol and the deployment were designed together.
          </p>

          <div className={styles.asideMeta}>
            {projects ? (
              <>
                <span>{projects.length} projects</span>
                <span>{projectYearRange(projects)}</span>
              </>
            ) : (
              <>
                <Skeleton className={styles.metaSkeleton} />
                <Skeleton className={styles.metaSkeleton} />
              </>
            )}
          </div>
        </aside>

        <div className={styles.list}>
          {projects
            ? projects.map((project, index) => (
                <a
                  key={project.slug}
                  href={project.repo ?? "#work"}
                  className={styles.row}
                  {...(project.repo
                    ? { target: "_blank", rel: "noreferrer noopener" }
                    : null)}
                >
                  <span className={styles.index}>{projectIndex(index)}</span>

                  <div className={styles.rowMain}>
                    <span className={styles.titleWrap}>
                      <span className={styles.title}>{project.title}</span>
                    </span>
                    <span className={styles.tags}>
                      {project.tags.map((tag) => (
                        <span key={tag} className={styles.tag}>
                          {tag}
                        </span>
                      ))}
                    </span>
                  </div>

                  <div className={styles.rowAside}>
                    <span>{project.category}</span>
                    <span className={styles.index}>{project.year}</span>
                    <span className={styles.arrow} aria-hidden>
                      <ArrowUpRight size={14} />
                    </span>
                  </div>
                </a>
              ))
            : Array.from({ length: SKELETON_ROWS }, (_, index) => (
                <div key={index} className={styles.row} aria-hidden>
                  <Skeleton className={styles.indexSkeleton} />
                  <div className={styles.rowMain}>
                    <Skeleton className={styles.rowTitleSkeleton} />
                    <Skeleton className={styles.rowTagsSkeleton} />
                  </div>
                  <div className={styles.rowAside}>
                    <Skeleton className={styles.metaSkeleton} />
                  </div>
                </div>
              ))}
        </div>
      </div>
    </section>
  );
}
